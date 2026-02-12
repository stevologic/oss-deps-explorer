package main

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"

	purl "github.com/package-url/packageurl-go"

	"github.com/go-redis/redis/v8"
	"github.com/gorilla/mux"

	"github.com/example/oss-deps-explorer/internal/cargo"
	"github.com/example/oss-deps-explorer/internal/composer"
	"github.com/example/oss-deps-explorer/internal/config"
	"github.com/example/oss-deps-explorer/internal/depsdev"
	"github.com/example/oss-deps-explorer/internal/gomod"
	"github.com/example/oss-deps-explorer/internal/manager"
	"github.com/example/oss-deps-explorer/internal/maven"
	"github.com/example/oss-deps-explorer/internal/npm"
	"github.com/example/oss-deps-explorer/internal/nuget"
	"github.com/example/oss-deps-explorer/internal/pypi"
	"github.com/example/oss-deps-explorer/internal/rubygems"
)

func withCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		if r.Method == http.MethodOptions {
			w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
			w.Header().Set("Access-Control-Allow-Headers", "Content-Type")
			return
		}
		next.ServeHTTP(w, r)
	})
}

type statusWriter struct {
	http.ResponseWriter
	status int
}

func (w *statusWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func logRequests(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sw := &statusWriter{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(sw, r)
		log.Printf("%s %s -> %d (%s)", r.Method, r.URL.Path, sw.status, time.Since(start))
	})
}

// writeError writes an HTTP error status based on the provided error.
// It returns true after writing a response.
func writeError(w http.ResponseWriter, err error) bool {
	var se *depsdev.StatusError
	if errors.As(err, &se) && se.Code == http.StatusNotFound {
		http.Error(w, "package not found", http.StatusNotFound)
		return true
	}
	http.Error(w, err.Error(), http.StatusInternalServerError)
	return true
}

// Registry maps package managers to implementations.
var Registry map[string]manager.Manager

var osvEcosystem = map[string]string{
	"npm":      "npm",
	"pypi":     "PyPI",
	"go":       "Go",
	"maven":    "Maven",
	"cargo":    "crates.io",
	"rubygems": "RubyGems",
	"nuget":    "NuGet",
	"composer": "Packagist",
}

func repoFromPackage(pm, pkg string) string {
	if pm == "go" {
		return pkg
	}
	if strings.HasPrefix(pkg, "github.com/") {
		return pkg
	}
	return ""
}

// purlMap maps package managers to their corresponding Package URL (purl)
// ecosystem identifiers. This is used when querying vulnerability databases
// that accept purl-based lookups.
var purlMap = map[string]string{
	"npm":      "npm",
	"pypi":     "pypi",
	"go":       "golang",
	"maven":    "maven",
	"cargo":    "cargo",
	"rubygems": "gem",
	"nuget":    "nuget",
	"composer": "composer",
}

func fetchAllDeps(ctx context.Context, m manager.Manager, ns, name, version string, recursive bool, visited map[string]struct{}, parent string, pm string, rdb *redis.Client, ttl time.Duration) (map[string]interface{}, map[string][]string, []string, error) {

	deps, repo, err := m.Dependencies(ctx, ns, name, version)
	if err != nil {
		return nil, nil, nil, err
	}
	repositories := map[string]string{}
	if repo == "" {
		pkg := formatPackage(pm, ns, name)
		repo = repoFromPackage(pm, pkg)
	}
	if repo != "" {
		repositories[formatPackage(pm, ns, name)] = repo
	}
	if !recursive {
		res := map[string]interface{}{"dependencies": deps["dependencies"], "repositories": repositories}
		if rdb != nil {
			if data, err := json.Marshal(res); err == nil {
				rdb.Set(ctx, cacheKey(pm, ns, name, version, recursive, false, false), data, ttl)
			}
		}
		return res, nil, nil, nil
	}
	depMap, _ := deps["dependencies"].(map[string]interface{})
	result := make(map[string]interface{})
	parents := make(map[string][]string)
	var errs []string
	for k, v := range depMap {
		vs := normalizeVersion(fmt.Sprint(v))
		result[k] = vs
		if _, ok := parents[k]; !ok {
			parents[k] = []string{}
		}
		if !contains(parents[k], parent) {
			parents[k] = append(parents[k], parent)
		}
		id := fmt.Sprintf("%s:%s:%s", k, m, vs)
		if _, ok := visited[id]; ok {
			continue
		}
		visited[id] = struct{}{}
		dns, dname := splitDep(k)
		sub, subParents, subErrs, err := fetchAllDeps(ctx, m, dns, dname, vs, recursive, visited, k, pm, rdb, ttl)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s@%s: %v", k, vs, err))
			continue
		}
		errs = append(errs, subErrs...)
		subMap, _ := sub["dependencies"].(map[string]interface{})
		for sk, sv := range subMap {
			if _, ok := result[sk]; !ok {
				result[sk] = sv
			}
		}
		subRepos, _ := sub["repositories"].(map[string]string)
		for pk, rv := range subRepos {
			if _, ok := repositories[pk]; !ok {
				repositories[pk] = rv
			}
		}
		for sp, ps := range subParents {
			if _, ok := parents[sp]; !ok {
				parents[sp] = []string{}
			}
			for _, p := range ps {
				if !contains(parents[sp], p) {
					parents[sp] = append(parents[sp], p)
				}
			}
		}
	}
	res := map[string]interface{}{"dependencies": result, "parents": parents, "repositories": repositories}
	if len(errs) > 0 {
		res["errors"] = errs
	}
	if rdb != nil {
		if data, err := json.Marshal(res); err == nil {
			rdb.Set(ctx, cacheKey(pm, ns, name, version, recursive, false, false), data, ttl)
		}
	}
	return res, parents, errs, nil
}

var versionRe = regexp.MustCompile(`([0-9]+[0-9A-Za-z.\-]*)`)
var nameRe = regexp.MustCompile(`^[A-Za-z0-9._@\-/]+$`)

func contains(slice []string, s string) bool {
	for _, v := range slice {
		if v == s {
			return true
		}
	}
	return false
}

func validateName(name string) error {
	if name == "" {
		return fmt.Errorf("empty name")
	}
	if !nameRe.MatchString(name) {
		return fmt.Errorf("invalid characters in name")
	}
	return nil
}

func normalizeVersion(v string) string {
	m := versionRe.FindStringSubmatch(v)
	if len(m) > 1 {
		return m[1]
	}
	return v
}

func splitDep(dep string) (string, string) {
	if strings.HasPrefix(dep, "@") {
		if i := strings.Index(dep, "/"); i > 0 {
			return dep[:i], dep[i+1:]
		}
	}
	if strings.Contains(dep, ":") {
		parts := strings.SplitN(dep, ":", 2)
		return parts[0], parts[1]
	}
	if strings.Count(dep, "/") > 1 {
		idx := strings.Index(dep, "/")
		return dep[:idx], dep[idx+1:]
	}
	return "", dep
}

func queryBool(req *http.Request, key string, def bool) bool {
	val := req.URL.Query().Get(key)
	if val == "" {
		return def
	}
	b, err := strconv.ParseBool(val)
	if err != nil {
		return def
	}
	return b
}

func formatPackage(manager, ns, name string) string {
	switch manager {
	case "npm":
		if ns != "" {
			return ns + "/" + name
		}
		return name
	case "maven":
		if ns != "" {
			return ns + ":" + name
		}
		return name
	case "go":
		if ns != "" {
			return ns + "/" + name
		}
		return name
	default:
		if ns != "" {
			return ns + "/" + name
		}
		return name
	}
}

func cacheKey(pm, ns, name, version string, recursive, vuln, score bool) string {
	var key string
	if pm == "go" {
		if ns != "" {
			key = fmt.Sprintf("go:%s/%s:%s", ns, name, version)
		} else {
			key = fmt.Sprintf("go:%s:%s", name, version)
		}
	} else {
		if ns != "" {
			key = fmt.Sprintf("%s:%s:%s:%s", pm, ns, name, version)
		} else {
			key = fmt.Sprintf("%s::%s:%s", pm, name, version)
		}
	}
	if recursive {
		key += ":trans"
	}
	if vuln {
		key += ":v"
	}
	if score {
		key += ":sc"
	}
	return key
}

func purlCacheKey(purl string, recursive, vuln, score bool) string {
	key := fmt.Sprintf("purl:%s", purl)
	if recursive {
		key += ":trans"
	}
	if vuln {
		key += ":v"
	}
	if score {
		key += ":sc"
	}
	return key
}

// aliasFromURL extracts a potential OSV ID or CVE from a reference URL.
func aliasFromURL(u string) string {
	if i := strings.LastIndex(u, "/"); i >= 0 && i < len(u)-1 {
		return u[i+1:]
	}
	return ""
}

// fetchVulnByID retrieves a vulnerability entry from OSV by ID.
func fetchVulnByID(ctx context.Context, id string) (map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.osv.dev/v1/vulns/%s", id)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("osv.dev returned status %d", resp.StatusCode)
	}
	var out map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	return out, nil
}

func fetchVulns(ctx context.Context, ecosystem, name, version string, rdb *redis.Client, ttl time.Duration) ([]map[string]interface{}, error) {
	var key string
	if rdb != nil {
		key = fmt.Sprintf("osv:%s:%s@%s", ecosystem, name, version)
		if val, err := rdb.Get(ctx, key).Result(); err == nil {
			var cached []map[string]interface{}
			if json.Unmarshal([]byte(val), &cached) == nil {
				return cached, nil
			}
		}
	}
	payload := map[string]interface{}{
		"package": map[string]string{
			"name":      name,
			"ecosystem": ecosystem,
		},
		"version": version,
	}
	data, _ := json.Marshal(payload)
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, "https://api.osv.dev/v1/query", bytes.NewBuffer(data))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("osv.dev returned status %d", resp.StatusCode)
	}
	var out struct {
		Vulns []map[string]interface{} `json:"vulns"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	// Populate missing severity information using alias references.
	for _, v := range out.Vulns {
		sev, ok := v["severity"]
		hasSev := false
		if ok {
			if arr, ok := sev.([]interface{}); ok && len(arr) > 0 {
				hasSev = true
			} else if m, ok := sev.(map[string]interface{}); ok && len(m) > 0 {
				hasSev = true
			}
		}
		if hasSev {
			continue
		}
		var aliases []string
		if a, ok := v["aliases"].([]interface{}); ok {
			for _, idv := range a {
				if s, ok := idv.(string); ok {
					aliases = append(aliases, s)
				}
			}
		}
		if refs, ok := v["references"].([]interface{}); ok {
			for _, rv := range refs {
				if m, ok := rv.(map[string]interface{}); ok {
					if u, ok := m["url"].(string); ok {
						if id := aliasFromURL(u); id != "" {
							aliases = append(aliases, id)
						}
					}
				}
			}
		}
		for _, id := range aliases {
			if aliasVuln, err := fetchVulnByID(ctx, id); err == nil {
				if sev, ok := aliasVuln["severity"]; ok {
					if arr, ok := sev.([]interface{}); ok && len(arr) > 0 {
						v["severity"] = sev
						break
					}
				}
			}
		}
	}
	if rdb != nil {
		if data, err := json.Marshal(out.Vulns); err == nil {
			rdb.Set(ctx, key, data, ttl)
		}
	}
	return out.Vulns, nil
}

func collectVulnerabilities(ctx context.Context, manager, ns, name, version string, deps map[string]interface{}, rdb *redis.Client, ttl time.Duration) map[string]interface{} {
	eco := osvEcosystem[manager]
	result := make(map[string]interface{})
	rootPkg := formatPackage(manager, ns, name)
	if vulns, err := fetchVulns(ctx, eco, rootPkg, version, rdb, ttl); err == nil && len(vulns) > 0 {
		result[rootPkg] = vulns
	}
	for dep, v := range deps {
		if vulns, err := fetchVulns(ctx, eco, dep, fmt.Sprint(v), rdb, ttl); err == nil && len(vulns) > 0 {
			result[dep] = vulns
		}
	}
	return result
}

func fetchScorecard(ctx context.Context, repo string, rdb *redis.Client, ttl time.Duration) (map[string]interface{}, error) {
	url := fmt.Sprintf("https://api.securityscorecards.dev/projects/%s", repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("scorecard api returned status %d", resp.StatusCode)
	}
	var out map[string]interface{}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	// scorecard responses are not cached
	return out, nil
}

func collectScorecards(ctx context.Context, manager, ns, name string, deps map[string]interface{}, repos map[string]string, rdb *redis.Client, ttl time.Duration) map[string]interface{} {
	result := make(map[string]interface{})
	rootPkg := formatPackage(manager, ns, name)
	repo := repos[rootPkg]
	if repo == "" {
		repo = repoFromPackage(manager, rootPkg)
	}
	if repo != "" {
		if sc, err := fetchScorecard(ctx, repo, rdb, ttl); err == nil {
			result[rootPkg] = sc
		}
	}
	for dep := range deps {
		repo := repos[dep]
		if repo == "" {
			repo = repoFromPackage(manager, dep)
		}
		if repo != "" {
			if sc, err := fetchScorecard(ctx, repo, rdb, ttl); err == nil {
				result[dep] = sc
			}
		}
	}
	return result
}

func depsToDot(root string, deps map[string]interface{}) string {
	var b strings.Builder
	b.WriteString("digraph deps {\n")
	keys := make([]string, 0, len(deps))
	for k := range deps {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, dep := range keys {
		fmt.Fprintf(&b, "    \"%s\" -> \"%s\"\n", root, dep)
	}
	b.WriteString("}\n")
	return b.String()
}

func npmSearch(ctx context.Context, query string) ([]map[string]string, error) {
	url := fmt.Sprintf("https://registry.npmjs.org/-/v1/search?text=%s&size=10", url.QueryEscape(query))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("npm search returned status %d", resp.StatusCode)
	}
	var out struct {
		Objects []struct {
			Package struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			} `json:"package"`
		} `json:"objects"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	results := make([]map[string]string, 0, len(out.Objects))
	for _, obj := range out.Objects {
		results = append(results, map[string]string{
			"name":    obj.Package.Name,
			"version": obj.Package.Version,
		})
	}
	return results, nil
}

func fetchRepoMetadata(ctx context.Context, repo string, rdb *redis.Client, ttl time.Duration) (map[string]interface{}, error) {
	if rdb != nil {
		if val, err := rdb.Get(ctx, "repometa:"+repo).Result(); err == nil {
			var cached map[string]interface{}
			if json.Unmarshal([]byte(val), &cached) == nil {
				return cached, nil
			}
		}
	}
	url := fmt.Sprintf("https://api.github.com/repos/%s", repo)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", resp.StatusCode)
	}
	var info struct {
		Description   string `json:"description"`
		Language      string `json:"language"`
		Archived      bool   `json:"archived"`
		CreatedAt     string `json:"created_at"`
		UpdatedAt     string `json:"updated_at"`
		DefaultBranch string `json:"default_branch"`
		Watchers      int    `json:"watchers_count"`
		Subscribers   int    `json:"subscribers_count"`
		Stars         int    `json:"stargazers_count"`
		Forks         int    `json:"forks_count"`
		OpenIssues    int    `json:"open_issues_count"`
		License       *struct {
			SPDX string `json:"spdx_id"`
			Name string `json:"name"`
		} `json:"license"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&info); err != nil {
		return nil, err
	}
	watchers := info.Subscribers
	if watchers == 0 {
		watchers = info.Watchers
	}
	meta := map[string]interface{}{
		"description":    info.Description,
		"language":       info.Language,
		"archived":       info.Archived,
		"created":        info.CreatedAt,
		"updated":        info.UpdatedAt,
		"default_branch": info.DefaultBranch,
		"watchers":       watchers,
		"stars":          info.Stars,
		"forks":          info.Forks,
		"issues":         info.OpenIssues,
	}
	if info.License != nil {
		if info.License.SPDX != "" {
			meta["license"] = info.License.SPDX
		} else if info.License.Name != "" {
			meta["license"] = info.License.Name
		}
	}

	openCount, _ := searchPRs(repo, "open")
	closedCount, _ := searchPRs(repo, "closed")
	meta["pulls_open"] = openCount
	meta["pulls_closed"] = closedCount

	commits, last, _ := repoCommits(repo)
	meta["commit_count"] = commits
	if last != "" {
		meta["last_commit"] = last
	}

	if rdb != nil {
		if data, err := json.Marshal(meta); err == nil {
			rdb.Set(ctx, "repometa:"+repo, data, ttl)
		}
	}
	return meta, nil
}

func searchPRs(repo, state string) (int, error) {
	url := fmt.Sprintf("https://api.github.com/search/issues?q=repo:%s+is:pr+state:%s&per_page=1", repo, state)
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return 0, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, fmt.Errorf("status %d", resp.StatusCode)
	}
	var out struct {
		Total int `json:"total_count"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return 0, err
	}
	return out.Total, nil
}

func repoCommits(repo string) (int, string, error) {
	url := fmt.Sprintf("https://api.github.com/repos/%s/commits?per_page=1", repo)
	req, _ := http.NewRequest(http.MethodGet, url, nil)
	req.Header.Set("Accept", "application/vnd.github+json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return 0, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return 0, "", fmt.Errorf("status %d", resp.StatusCode)
	}
	var arr []struct {
		Commit struct {
			Author struct {
				Date string `json:"date"`
			} `json:"author"`
		} `json:"commit"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&arr); err != nil {
		return 0, "", err
	}
	last := ""
	if len(arr) > 0 {
		last = arr[0].Commit.Author.Date
	}
	count := 1
	if link := resp.Header.Get("Link"); link != "" {
		if p := parseLastPage(link); p > 0 {
			count = p
		}
	}
	return count, last, nil
}

func parseLastPage(link string) int {
	parts := strings.Split(link, ",")
	for _, p := range parts {
		p = strings.TrimSpace(p)
		if strings.HasSuffix(p, "rel=\"last\"") {
			if i := strings.Index(p, "page="); i >= 0 {
				s := p[i+5:]
				for j := 0; j < len(s); j++ {
					if s[j] < '0' || s[j] > '9' {
						s = s[:j]
						break
					}
				}
				if n, err := strconv.Atoi(s); err == nil {
					return n
				}
			}
		}
	}
	return 1
}

func main() {
	var cfgPath string
	flag.StringVar(&cfgPath, "config", "config.yaml", "path to config file")
	var recurse bool
	flag.BoolVar(&recurse, "recursive", false, "resolve dependencies recursively")
	var withVuln bool
	flag.BoolVar(&withVuln, "vuln", false, "include vulnerability data from osv.dev")
	var withScorecard bool
	flag.BoolVar(&withScorecard, "scorecard", false, "include OpenSSF Scorecard data")
	var withGraph bool
	flag.BoolVar(&withGraph, "graph", false, "return GraphViz dot output")
	flag.Parse()

	// options also accessible via /lookup endpoint

	cfg, err := config.Load(cfgPath)
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	Registry = map[string]manager.Manager{
		"npm":      &npm.NPM{BaseURL: cfg.PackageManager.NPM},
		"pypi":     &pypi.PyPI{BaseURL: cfg.PackageManager.PyPI},
		"go":       &gomod.Go{BaseURL: cfg.PackageManager.Go},
		"maven":    &maven.Maven{BaseURL: cfg.PackageManager.Maven},
		"cargo":    &cargo.Cargo{BaseURL: cfg.PackageManager.Cargo},
		"rubygems": &rubygems.RubyGems{BaseURL: cfg.PackageManager.RubyGems},
		"nuget":    &nuget.NuGet{BaseURL: cfg.PackageManager.NuGet},
		"composer": &composer.Composer{BaseURL: cfg.PackageManager.Composer},
	}

	if cfg.Proxy.URL != "" {
		purl, err := url.Parse(cfg.Proxy.URL)
		if err != nil {
			log.Fatalf("invalid proxy url: %v", err)
		}
		tr := http.DefaultTransport.(*http.Transport).Clone()
		tr.Proxy = http.ProxyURL(purl)
		http.DefaultTransport = tr
	}

	rdb := redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})

	r := mux.NewRouter()
	r.Use(logRequests)

	r.HandleFunc("/api/config", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cfg.PackageManager)
	}).Methods(http.MethodGet)

	r.HandleFunc("/api/suggest/{manager}/{query}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pm := vars["manager"]
		q := vars["query"]
		if q == "" {
			http.Error(w, "query required", http.StatusBadRequest)
			return
		}

		key := fmt.Sprintf("suggest:%s:%s", pm, q)
		ctx := req.Context()
		if val, err := rdb.Get(ctx, key).Result(); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(val))
			return
		}

		var results []map[string]string
		var err error
		switch pm {
		case "npm":
			results, err = npmSearch(ctx, q)
		default:
			http.Error(w, "unsupported package manager", http.StatusBadRequest)
			return
		}
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data, err := json.Marshal(results)
		if err == nil {
			rdb.Set(ctx, key, data, cfg.Cache.TTL)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	r.HandleFunc("/api/repo/{repo:.*}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		repo := strings.TrimPrefix(vars["repo"], "github.com/")
		ctx := req.Context()
		meta, err := fetchRepoMetadata(ctx, repo, rdb, cfg.Cache.TTL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(meta)
	}).Methods(http.MethodGet)

	// generic lookup endpoint using query parameters
	r.HandleFunc("/api/lookup", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		pm := q.Get("manager")
		ns := q.Get("namespace")
		name := q.Get("name")
		version := q.Get("version")
		recursive := q.Get("recursive") == "true"
		vflag := q.Get("vuln") == "true"
		sflag := q.Get("scorecard") == "true"

		if pm == "" || name == "" || version == "" {
			http.Error(w, "manager, name and version required", http.StatusBadRequest)
			return
		}
		if err := validateName(name); err != nil {
			http.Error(w, "invalid package name", http.StatusBadRequest)
			return
		}
		if ns != "" {
			if err := validateName(ns); err != nil {
				http.Error(w, "invalid namespace", http.StatusBadRequest)
				return
			}
		}
		m, ok := Registry[pm]
		if !ok {
			http.Error(w, "unsupported package manager", http.StatusBadRequest)
			return
		}

		key := cacheKey(pm, ns, name, version, recursive, vflag, sflag)
		ctx := req.Context()
		if val, err := rdb.Get(ctx, key).Result(); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(val))
			return
		}

		deps, _, errs, err := fetchAllDeps(ctx, m, ns, name, version, recursive, map[string]struct{}{}, "", pm, rdb, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		if vflag {
			depMap, _ := deps["dependencies"].(map[string]interface{})
			vulns := collectVulnerabilities(ctx, pm, ns, name, version, depMap, rdb, cfg.Cache.TTL)
			if len(vulns) > 0 {
				deps["vulnerabilities"] = vulns
			}
		}
		if sflag {
			depMap, _ := deps["dependencies"].(map[string]interface{})
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, ns, name, depMap, repoMap, rdb, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err == nil {
			rdb.Set(ctx, key, data, cfg.Cache.TTL)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// special route for Go modules which may contain slashes in the module path
	r.HandleFunc("/api/dependencies/go/{module:.+}/{version}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		module := vars["module"]
		version := vars["version"]

		parts := strings.SplitN(module, "/", 2)
		ns := ""
		name := module
		if len(parts) == 2 {
			ns = parts[0]
			name = parts[1]
		}

		if err := validateName(name); err != nil {
			http.Error(w, "invalid module name", http.StatusBadRequest)
			return
		}
		if ns != "" {
			if err := validateName(ns); err != nil {
				http.Error(w, "invalid namespace", http.StatusBadRequest)
				return
			}
		}

		m := Registry["go"]

		reqRecurse := queryBool(req, "recursive", recurse)
		reqVuln := queryBool(req, "vuln", withVuln)
		reqScore := queryBool(req, "scorecard", withScorecard)
		key := cacheKey("go", ns, name, version, reqRecurse, reqVuln, reqScore)
		ctx := req.Context()
		if cached, err := rdb.Get(ctx, key).Result(); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, _, errs, err := fetchAllDeps(ctx, m, ns, name, version, reqRecurse, map[string]struct{}{}, "", "go", rdb, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}

		if reqVuln {
			depMap, _ := deps["dependencies"].(map[string]interface{})

			vulns := collectVulnerabilities(ctx, "go", ns, name, version, depMap, rdb, cfg.Cache.TTL)
			if len(vulns) > 0 {
				deps["vulnerabilities"] = vulns
			}
		}
		if reqScore {
			depMap, _ := deps["dependencies"].(map[string]interface{})
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, "go", ns, name, depMap, repoMap, rdb, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		rdb.Set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// lookup via package URL
	r.HandleFunc("/api/purl/{purl}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pstr := vars["purl"]
		pu, err := purl.FromString(pstr)
		if err != nil {
			http.Error(w, "invalid purl", http.StatusBadRequest)
			return
		}
		if err := validateName(pu.Name); err != nil {
			http.Error(w, "invalid purl", http.StatusBadRequest)
			return
		}
		if pu.Namespace != "" {
			if err := validateName(pu.Namespace); err != nil {
				http.Error(w, "invalid purl", http.StatusBadRequest)
				return
			}
		}
		pm, ok := purlMap[pu.Type]
		if !ok {
			http.Error(w, "unsupported purl type", http.StatusBadRequest)
			return
		}
		m := Registry[pm]
		ns := pu.Namespace
		name := pu.Name
		version := pu.Version

		reqScore := queryBool(req, "scorecard", withScorecard)
		key := purlCacheKey(pstr, recurse, withVuln, reqScore)
		ctx := req.Context()
		if cached, err := rdb.Get(ctx, key).Result(); err == nil {
			if withGraph {
				w.Header().Set("Content-Type", "text/vnd.graphviz")
			} else {
				w.Header().Set("Content-Type", "application/json")
			}
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, _, errs, err := fetchAllDeps(ctx, m, ns, name, version, recurse, map[string]struct{}{}, "", pm, rdb, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		depMap, _ := deps["dependencies"].(map[string]interface{})
		if withGraph {
			dot := depsToDot(formatPackage(pm, ns, name), depMap)
			rdb.Set(ctx, key, []byte(dot), cfg.Cache.TTL)
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			w.Header().Set("X-Cache-Status", "MISS")
			w.Write([]byte(dot))
			return
		}
		if withVuln {
			vulns := collectVulnerabilities(ctx, pm, ns, name, version, depMap, rdb, cfg.Cache.TTL)
			if len(vulns) > 0 {
				deps["vulnerabilities"] = vulns
			}
		}
		if reqScore {
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, ns, name, depMap, repoMap, rdb, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		rdb.Set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// route with namespace
	r.HandleFunc("/api/dependencies/{manager}/{namespace}/{name}/{version}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pm := vars["manager"]
		ns := vars["namespace"]
		name := vars["name"]
		version := vars["version"]

		if err := validateName(name); err != nil {
			http.Error(w, "invalid package name", http.StatusBadRequest)
			return
		}
		if ns != "" {
			if err := validateName(ns); err != nil {
				http.Error(w, "invalid namespace", http.StatusBadRequest)
				return
			}
		}

		m, ok := Registry[pm]
		if !ok {
			http.Error(w, "unsupported package manager", http.StatusBadRequest)
			return
		}

		reqRecurse := queryBool(req, "recursive", recurse)
		reqVuln := queryBool(req, "vuln", withVuln)
		reqScore := queryBool(req, "scorecard", withScorecard)
		key := cacheKey(pm, ns, name, version, reqRecurse, reqVuln, reqScore)
		ctx := req.Context()
		if cached, err := rdb.Get(ctx, key).Result(); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, _, errs, err := fetchAllDeps(ctx, m, ns, name, version, reqRecurse, map[string]struct{}{}, "", pm, rdb, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}

		if reqVuln {
			depMap, _ := deps["dependencies"].(map[string]interface{})

			vulns := collectVulnerabilities(ctx, pm, ns, name, version, depMap, rdb, cfg.Cache.TTL)
			if len(vulns) > 0 {
				deps["vulnerabilities"] = vulns
			}
		}
		if reqScore {
			depMap, _ := deps["dependencies"].(map[string]interface{})
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, ns, name, depMap, repoMap, rdb, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		rdb.Set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// route without namespace
	r.HandleFunc("/api/dependencies/{manager}/{name}/{version}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pm := vars["manager"]
		name := vars["name"]
		version := vars["version"]

		if err := validateName(name); err != nil {
			http.Error(w, "invalid package name", http.StatusBadRequest)
			return
		}

		m, ok := Registry[pm]
		if !ok {
			http.Error(w, "unsupported package manager", http.StatusBadRequest)
			return
		}

		reqRecurse := queryBool(req, "recursive", recurse)
		reqVuln := queryBool(req, "vuln", withVuln)
		reqScore := queryBool(req, "scorecard", withScorecard)
		key := cacheKey(pm, "", name, version, reqRecurse, reqVuln, reqScore)
		ctx := req.Context()
		if cached, err := rdb.Get(ctx, key).Result(); err == nil {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, _, errs, err := fetchAllDeps(ctx, m, "", name, version, reqRecurse, map[string]struct{}{}, "", pm, rdb, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}

		if reqVuln {
			depMap, _ := deps["dependencies"].(map[string]interface{})

			vulns := collectVulnerabilities(ctx, pm, "", name, version, depMap, rdb, cfg.Cache.TTL)
			if len(vulns) > 0 {
				deps["vulnerabilities"] = vulns
			}
		}
		if reqScore {
			depMap, _ := deps["dependencies"].(map[string]interface{})
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, "", name, depMap, repoMap, rdb, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		rdb.Set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// serve static UI
	r.PathPrefix("/").Handler(http.FileServer(http.Dir("./ui")))

	addr := ":" + cfg.Server.Port
	srv := &http.Server{
		Addr:    addr,
		Handler: withCORS(r),
	}
	log.Printf("starting server on %s", addr)
	if err := srv.ListenAndServe(); err != nil {
		log.Fatalf("server error: %v", err)
	}
}
