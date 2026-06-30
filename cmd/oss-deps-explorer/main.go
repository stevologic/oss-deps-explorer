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
	"sync"
	"time"

	"golang.org/x/mod/semver"

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

type redisCache struct {
	client        *redis.Client
	mu            sync.Mutex
	disabledUntil time.Time
}

func newRedisCache(cfg *config.Config) *redisCache {
	if cfg.Redis.Addr == "" {
		return nil
	}
	return &redisCache{client: redis.NewClient(&redis.Options{
		Addr:     cfg.Redis.Addr,
		Password: cfg.Redis.Password,
		DB:       cfg.Redis.DB,
	})}
}

func (c *redisCache) available() bool {
	if c == nil || c.client == nil {
		return false
	}
	c.mu.Lock()
	defer c.mu.Unlock()
	return time.Now().After(c.disabledUntil)
}

func (c *redisCache) markUnavailable(err error) {
	if err == nil || errors.Is(err, redis.Nil) {
		return
	}
	c.mu.Lock()
	c.disabledUntil = time.Now().Add(30 * time.Second)
	c.mu.Unlock()
	log.Printf("redis cache unavailable, temporarily disabling cache: %v", err)
}

func (c *redisCache) get(ctx context.Context, key string) (string, bool) {
	if !c.available() {
		return "", false
	}
	ctx, cancel := context.WithTimeout(ctx, 300*time.Millisecond)
	defer cancel()
	val, err := c.client.Get(ctx, key).Result()
	if err == nil {
		return val, true
	}
	c.markUnavailable(err)
	return "", false
}

func (c *redisCache) set(ctx context.Context, key string, value interface{}, ttl time.Duration) {
	if !c.available() {
		return
	}
	ctx, cancel := context.WithTimeout(ctx, 300*time.Millisecond)
	defer cancel()
	if err := c.client.Set(ctx, key, value, ttl).Err(); err != nil {
		c.markUnavailable(err)
	}
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

var purlTypeToManager = map[string]string{
	"npm":      "npm",
	"pypi":     "pypi",
	"golang":   "go",
	"maven":    "maven",
	"cargo":    "cargo",
	"gem":      "rubygems",
	"nuget":    "nuget",
	"composer": "composer",
}

type githubDependencyPackage struct {
	Manager          string `json:"manager"`
	Namespace        string `json:"namespace,omitempty"`
	Name             string `json:"name"`
	Version          string `json:"version,omitempty"`
	PURL             string `json:"purl"`
	SPDXID           string `json:"spdx_id,omitempty"`
	Display          string `json:"display"`
	License          string `json:"license,omitempty"`
	LicenseConcluded string `json:"license_concluded,omitempty"`
	LicenseDeclared  string `json:"license_declared,omitempty"`
}

type githubUnsupportedDependencyPackage struct {
	Name             string   `json:"name,omitempty"`
	Version          string   `json:"version,omitempty"`
	PURL             string   `json:"purl,omitempty"`
	SPDXID           string   `json:"spdx_id,omitempty"`
	Display          string   `json:"display"`
	License          string   `json:"license,omitempty"`
	LicenseConcluded string   `json:"license_concluded,omitempty"`
	LicenseDeclared  string   `json:"license_declared,omitempty"`
	ExternalRefs     []string `json:"external_refs,omitempty"`
}

type githubDependencyGraphResult struct {
	Repository          string                               `json:"repository"`
	Source              string                               `json:"source"`
	PackageCount        int                                  `json:"package_count"`
	UnsupportedCount    int                                  `json:"unsupported_count"`
	Packages            []githubDependencyPackage            `json:"packages"`
	UnsupportedPackages []githubUnsupportedDependencyPackage `json:"unsupported_packages,omitempty"`
}

type githubSBOMExternalRef struct {
	ReferenceCategory string `json:"referenceCategory"`
	ReferenceType     string `json:"referenceType"`
	ReferenceLocator  string `json:"referenceLocator"`
}

type githubSBOMPackage struct {
	Name             string                  `json:"name"`
	SPDXID           string                  `json:"SPDXID"`
	VersionInfo      string                  `json:"versionInfo"`
	LicenseConcluded string                  `json:"licenseConcluded"`
	LicenseDeclared  string                  `json:"licenseDeclared"`
	ExternalRefs     []githubSBOMExternalRef `json:"externalRefs"`
}

type githubSBOMResponse struct {
	SBOM struct {
		Packages []githubSBOMPackage `json:"packages"`
	} `json:"sbom"`
}

func fetchAllDeps(ctx context.Context, m manager.Manager, ns, name, version string, recursive bool, visited map[string]struct{}, parent string, pm string, cache *redisCache, ttl time.Duration) (map[string]interface{}, map[string][]string, []string, error) {

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
	resolvedVersion, _ := deps["resolved_version"].(string)
	if resolvedVersion == "" {
		resolvedVersion = version
	}
	if !recursive {
		res := map[string]interface{}{"dependencies": deps["dependencies"], "repositories": repositories, "resolved_version": resolvedVersion}
		if cache != nil {
			if data, err := json.Marshal(res); err == nil {
				cache.set(ctx, cacheKey(pm, ns, name, version, recursive, false, false), data, ttl)
			}
		}
		return res, nil, nil, nil
	}
	depMap, _ := deps["dependencies"].(map[string]interface{})
	result := make(map[string]interface{})
	parents := make(map[string][]string)
	var errs []string
	for k, v := range depMap {
		vs := dependencyVersion(pm, fmt.Sprint(v))
		result[k] = vs
		if _, ok := parents[k]; !ok {
			parents[k] = []string{}
		}
		if !contains(parents[k], parent) {
			parents[k] = append(parents[k], parent)
		}
		id := fmt.Sprintf("%s:%s:%s", pm, k, vs)
		if _, ok := visited[id]; ok {
			continue
		}
		visited[id] = struct{}{}
		dns, dname := splitDep(k)
		sub, subParents, subErrs, err := fetchAllDeps(ctx, m, dns, dname, vs, recursive, visited, k, pm, cache, ttl)
		if err != nil {
			errs = append(errs, fmt.Sprintf("%s@%s: %v", k, vs, err))
			continue
		}
		errs = append(errs, subErrs...)
		subMap, _ := sub["dependencies"].(map[string]interface{})
		if subResolved, _ := sub["resolved_version"].(string); subResolved != "" {
			result[k] = subResolved
		}
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
	res := map[string]interface{}{"dependencies": result, "parents": parents, "repositories": repositories, "resolved_version": resolvedVersion}
	if len(errs) > 0 {
		res["errors"] = errs
	}
	if cache != nil {
		if data, err := json.Marshal(res); err == nil {
			cache.set(ctx, cacheKey(pm, ns, name, version, recursive, false, false), data, ttl)
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

func dependencyVersion(pm, v string) string {
	switch pm {
	case "go", "composer":
		return strings.TrimSpace(v)
	default:
		return normalizeVersion(v)
	}
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

func pathVar(vars map[string]string, key string) (string, error) {
	return url.PathUnescape(vars[key])
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
		key += ":v2"
	}
	if score {
		key += ":sc"
	}
	return key
}

func graphCacheKey(key string) string {
	return key + ":dot"
}

func purlCacheKey(purl string, recursive, vuln, score, graph bool) string {
	key := fmt.Sprintf("purl:%s", purl)
	if recursive {
		key += ":trans"
	}
	if vuln {
		key += ":v2"
	}
	if score {
		key += ":sc"
	}
	if graph {
		key += ":dot"
	}
	return key
}

func fetchVulns(ctx context.Context, ecosystem, name, version string, cache *redisCache, ttl time.Duration) ([]map[string]interface{}, error) {
	var key string
	if cache != nil {
		key = fmt.Sprintf("osv:%s:%s@%s", ecosystem, name, version)
		if val, ok := cache.get(ctx, key); ok {
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
	if cache != nil {
		if data, err := json.Marshal(out.Vulns); err == nil {
			cache.set(ctx, key, data, ttl)
		}
	}
	return out.Vulns, nil
}

type vulnerabilityStatus struct {
	Status        string `json:"status"`
	Checked       bool   `json:"checked"`
	AdvisoryCount int    `json:"advisory_count"`
	Error         string `json:"error,omitempty"`
}

type vulnerabilityResult struct {
	Vulnerabilities map[string]interface{}
	Status          map[string]vulnerabilityStatus
}

func collectVulnerabilities(ctx context.Context, manager, ns, name, version string, deps map[string]interface{}, cache *redisCache, ttl time.Duration) vulnerabilityResult {
	eco := osvEcosystem[manager]
	result := vulnerabilityResult{
		Vulnerabilities: make(map[string]interface{}),
		Status:          make(map[string]vulnerabilityStatus),
	}

	record := func(pkg, ver string) {
		if pkg == "" {
			return
		}
		if _, exists := result.Status[pkg]; exists {
			return
		}
		if eco == "" {
			result.Status[pkg] = vulnerabilityStatus{
				Status: "not_checked",
				Error:  "unsupported OSV ecosystem",
			}
			return
		}
		if strings.TrimSpace(ver) == "" {
			result.Status[pkg] = vulnerabilityStatus{
				Status: "not_checked",
				Error:  "no resolved version",
			}
			return
		}
		vulns, err := fetchVulns(ctx, eco, pkg, ver, cache, ttl)
		if err != nil {
			result.Status[pkg] = vulnerabilityStatus{
				Status: "unknown",
				Error:  err.Error(),
			}
			return
		}
		status := vulnerabilityStatus{
			Status:        "no_advisory",
			Checked:       true,
			AdvisoryCount: len(vulns),
		}
		if len(vulns) > 0 {
			status.Status = "vulnerable"
			result.Vulnerabilities[pkg] = vulns
		}
		result.Status[pkg] = status
	}

	rootPkg := formatPackage(manager, ns, name)
	record(rootPkg, version)
	for dep, v := range deps {
		record(dep, fmt.Sprint(v))
	}
	return result
}

func fetchScorecard(ctx context.Context, repo string, cache *redisCache, ttl time.Duration) (map[string]interface{}, error) {
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

func collectScorecards(ctx context.Context, manager, ns, name string, deps map[string]interface{}, repos map[string]string, cache *redisCache, ttl time.Duration) map[string]interface{} {
	result := make(map[string]interface{})
	rootPkg := formatPackage(manager, ns, name)
	repo := repos[rootPkg]
	if repo == "" {
		repo = repoFromPackage(manager, rootPkg)
	}
	if repo != "" {
		if sc, err := fetchScorecard(ctx, repo, cache, ttl); err == nil {
			result[rootPkg] = sc
		}
	}
	for dep := range deps {
		repo := repos[dep]
		if repo == "" {
			repo = repoFromPackage(manager, dep)
		}
		if repo != "" {
			if sc, err := fetchScorecard(ctx, repo, cache, ttl); err == nil {
				result[dep] = sc
			}
		}
	}
	return result
}

func dotQuote(label string) string {
	return strconv.Quote(label)
}

func scorecardScore(scorecard interface{}) string {
	sc, ok := scorecard.(map[string]interface{})
	if !ok {
		return ""
	}
	if score, ok := sc["score"]; ok {
		return fmt.Sprint(score)
	}
	if nested, ok := sc["scorecard"].(map[string]interface{}); ok {
		if score, ok := nested["score"]; ok {
			return fmt.Sprint(score)
		}
	}
	return ""
}

func dotStatusColor(status vulnerabilityStatus) string {
	switch status.Status {
	case "vulnerable":
		return "#fecaca"
	case "no_advisory":
		return "#bbf7d0"
	case "unknown":
		return "#fde68a"
	case "not_checked":
		return "#e5e7eb"
	default:
		return "#ffffff"
	}
}

func writeDotLegend(b *strings.Builder) {
	b.WriteString("    subgraph cluster_legend {\n")
	b.WriteString("        label=\"OSV status\"\n")
	b.WriteString("        color=\"#cbd5e1\"\n")
	b.WriteString("        style=\"rounded\"\n")
	b.WriteString("        \"__legend_vulnerable\" [label=\"vulnerable\" style=\"filled\" fillcolor=\"#fecaca\"]\n")
	b.WriteString("        \"__legend_no_advisory\" [label=\"no advisory\" style=\"filled\" fillcolor=\"#bbf7d0\"]\n")
	b.WriteString("        \"__legend_unknown\" [label=\"unknown\" style=\"filled\" fillcolor=\"#fde68a\"]\n")
	b.WriteString("        \"__legend_not_checked\" [label=\"not checked\" style=\"filled\" fillcolor=\"#e5e7eb\"]\n")
	b.WriteString("    }\n")
}

func depsToDot(root, rootVersion string, deps map[string]interface{}, parents map[string][]string, repos map[string]string, vulnStatus map[string]vulnerabilityStatus, scorecards map[string]interface{}) string {
	var b strings.Builder
	b.WriteString("digraph deps {\n")
	b.WriteString("    node [shape=box]\n")
	type node struct {
		id         string
		label      string
		version    string
		repository string
		osvStatus  vulnerabilityStatus
		scorecard  string
	}
	type edge struct {
		from string
		to   string
	}
	nodes := []node{{
		id:         root,
		label:      root,
		version:    rootVersion,
		repository: repos[root],
		osvStatus:  vulnStatus[root],
		scorecard:  scorecardScore(scorecards[root]),
	}}
	depKeys := make([]string, 0, len(deps))
	for dep := range deps {
		depKeys = append(depKeys, dep)
	}
	sort.Strings(depKeys)
	for _, dep := range depKeys {
		version := ""
		if deps[dep] != nil {
			version = fmt.Sprint(deps[dep])
		}
		label := dep
		if version != "" {
			label = dep + "\n" + version
		}
		nodes = append(nodes, node{
			id:         dep,
			label:      label,
			version:    version,
			repository: repos[dep],
			osvStatus:  vulnStatus[dep],
			scorecard:  scorecardScore(scorecards[dep]),
		})
	}
	for _, n := range nodes {
		attrs := []string{fmt.Sprintf("label=%s", dotQuote(n.label))}
		attrs = append(attrs, "style=\"filled\"")
		attrs = append(attrs, fmt.Sprintf("fillcolor=%s", dotQuote(dotStatusColor(n.osvStatus))))
		if n.version != "" {
			attrs = append(attrs, fmt.Sprintf("version=%s", dotQuote(n.version)))
		}
		if n.repository != "" {
			attrs = append(attrs, fmt.Sprintf("repository=%s", dotQuote(n.repository)))
			attrs = append(attrs, fmt.Sprintf("URL=%s", dotQuote(n.repository)))
		}
		if n.osvStatus.Status != "" {
			attrs = append(attrs, fmt.Sprintf("osv_status=%s", dotQuote(n.osvStatus.Status)))
			attrs = append(attrs, fmt.Sprintf("osv_checked=%s", dotQuote(strconv.FormatBool(n.osvStatus.Checked))))
			attrs = append(attrs, fmt.Sprintf("advisory_count=%s", dotQuote(strconv.Itoa(n.osvStatus.AdvisoryCount))))
			if n.osvStatus.Error != "" {
				attrs = append(attrs, fmt.Sprintf("osv_error=%s", dotQuote(n.osvStatus.Error)))
			}
		}
		if n.scorecard != "" {
			attrs = append(attrs, fmt.Sprintf("scorecard_score=%s", dotQuote(n.scorecard)))
		}
		fmt.Fprintf(&b, "    %s [%s]\n", dotQuote(n.id), strings.Join(attrs, " "))
	}
	edges := make([]edge, 0, len(deps))
	for _, dep := range depKeys {
		ps := parents[dep]
		if len(ps) == 0 {
			ps = []string{""}
		}
		for _, parent := range ps {
			from := parent
			if from == "" {
				from = root
			}
			edges = append(edges, edge{from: from, to: dep})
		}
	}
	sort.Slice(edges, func(i, j int) bool {
		if edges[i].from == edges[j].from {
			return edges[i].to < edges[j].to
		}
		return edges[i].from < edges[j].from
	})
	for _, e := range edges {
		fmt.Fprintf(&b, "    %s -> %s\n", dotQuote(e.from), dotQuote(e.to))
	}
	writeDotLegend(&b)
	b.WriteString("}\n")
	return b.String()
}

func dependencyGraphDot(ctx context.Context, managerName, ns, name, version string, deps map[string]interface{}, parents map[string][]string, cache *redisCache, ttl time.Duration, withVuln, withScorecard bool) string {
	depMap, _ := deps["dependencies"].(map[string]interface{})
	repoMap, _ := deps["repositories"].(map[string]string)
	vulnStatus := map[string]vulnerabilityStatus{}
	if withVuln {
		vulnStatus = collectVulnerabilities(ctx, managerName, ns, name, version, depMap, cache, ttl).Status
	}
	scorecards := map[string]interface{}{}
	if withScorecard {
		scorecards = collectScorecards(ctx, managerName, ns, name, depMap, repoMap, cache, ttl)
	}
	return depsToDot(formatPackage(managerName, ns, name), version, depMap, parents, repoMap, vulnStatus, scorecards)
}

type packageSuggestion struct {
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name"`
	Version   string `json:"version,omitempty"`
}

type versionInfo struct {
	Namespace string   `json:"namespace,omitempty"`
	Name      string   `json:"name"`
	Latest    string   `json:"latest,omitempty"`
	Versions  []string `json:"versions"`
}

const versionSuggestionLimit = 250

func getJSON(ctx context.Context, endpoint string, out interface{}) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oss-deps-explorer/1.0")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("metadata endpoint returned status %d", resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}

func packageSearch(ctx context.Context, manager, query string) ([]packageSuggestion, error) {
	switch manager {
	case "npm":
		return npmSearch(ctx, query)
	case "pypi":
		info, err := pypiVersions(ctx, query)
		if err != nil {
			return nil, err
		}
		return []packageSuggestion{{Name: info.Name, Version: info.Latest}}, nil
	case "go":
		return []packageSuggestion{{Name: query}}, nil
	case "maven":
		return mavenSearch(ctx, query)
	case "cargo":
		return cargoSearch(ctx, query)
	case "rubygems":
		return rubyGemsSearch(ctx, query)
	case "nuget":
		return nugetSearch(ctx, query)
	case "composer":
		return composerSearch(ctx, query)
	default:
		return nil, fmt.Errorf("unsupported package manager")
	}
}

func packageVersions(ctx context.Context, manager, namespace, name string) (*versionInfo, error) {
	switch manager {
	case "npm":
		return npmVersions(ctx, namespace, name)
	case "pypi":
		return pypiVersions(ctx, name)
	case "go":
		return goVersions(ctx, namespace, name)
	case "maven":
		return mavenVersions(ctx, namespace, name)
	case "cargo":
		return cargoVersions(ctx, name)
	case "rubygems":
		return rubyGemsVersions(ctx, name)
	case "nuget":
		return nugetVersions(ctx, name)
	case "composer":
		return composerVersions(ctx, namespace, name)
	default:
		return nil, fmt.Errorf("unsupported package manager")
	}
}

func npmSearch(ctx context.Context, query string) ([]packageSuggestion, error) {
	endpoint := fmt.Sprintf("https://registry.npmjs.org/-/v1/search?text=%s&size=10", url.QueryEscape(query))
	var out struct {
		Objects []struct {
			Package struct {
				Name    string `json:"name"`
				Version string `json:"version"`
			} `json:"package"`
		} `json:"objects"`
	}
	if err := getJSON(ctx, endpoint, &out); err != nil {
		return nil, err
	}
	results := make([]packageSuggestion, 0, len(out.Objects))
	for _, obj := range out.Objects {
		ns, name := splitPackageForManager("npm", obj.Package.Name)
		results = append(results, packageSuggestion{Namespace: ns, Name: name, Version: obj.Package.Version})
	}
	return results, nil
}

func npmVersions(ctx context.Context, namespace, name string) (*versionInfo, error) {
	pkg := name
	if namespace != "" {
		pkg = namespace + "/" + name
	}
	var out struct {
		DistTags map[string]string          `json:"dist-tags"`
		Versions map[string]json.RawMessage `json:"versions"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://registry.npmjs.org/%s", url.PathEscape(pkg)), &out); err != nil {
		return nil, err
	}
	versions := mapKeys(out.Versions)
	sortVersionStrings(versions)
	return &versionInfo{Namespace: namespace, Name: name, Latest: out.DistTags["latest"], Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func pypiVersions(ctx context.Context, name string) (*versionInfo, error) {
	var out struct {
		Info struct {
			Name    string `json:"name"`
			Version string `json:"version"`
		} `json:"info"`
		Releases map[string]json.RawMessage `json:"releases"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://pypi.org/pypi/%s/json", url.PathEscape(name)), &out); err != nil {
		return nil, err
	}
	versions := mapKeys(out.Releases)
	sortVersionStrings(versions)
	pkgName := out.Info.Name
	if pkgName == "" {
		pkgName = name
	}
	return &versionInfo{Name: pkgName, Latest: out.Info.Version, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func goVersions(ctx context.Context, namespace, name string) (*versionInfo, error) {
	module := name
	if namespace != "" {
		module = namespace + "/" + name
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, fmt.Sprintf("https://proxy.golang.org/%s/@v/list", escapePathSegments(module)), nil)
	if err != nil {
		return nil, err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("go proxy returned status %d", resp.StatusCode)
	}
	var buf bytes.Buffer
	if _, err := buf.ReadFrom(resp.Body); err != nil {
		return nil, err
	}
	versions := strings.Fields(buf.String())
	sortVersionStrings(versions)
	latest := ""
	if len(versions) > 0 {
		latest = versions[0]
	}
	ns, pkgName := splitPackageForManager("go", module)
	return &versionInfo{Namespace: ns, Name: pkgName, Latest: latest, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func mavenSearch(ctx context.Context, query string) ([]packageSuggestion, error) {
	if strings.Contains(query, ":") {
		ns, name := splitPackageForManager("maven", query)
		return []packageSuggestion{{Namespace: ns, Name: name}}, nil
	}
	endpoint := fmt.Sprintf("https://search.maven.org/solrsearch/select?q=%s&rows=10&wt=json", url.QueryEscape(fmt.Sprintf("a:%q", query)))
	var out struct {
		Response struct {
			Docs []struct {
				GroupID       string `json:"g"`
				ArtifactID    string `json:"a"`
				LatestVersion string `json:"latestVersion"`
			} `json:"docs"`
		} `json:"response"`
	}
	if err := getJSON(ctx, endpoint, &out); err != nil {
		return nil, err
	}
	results := make([]packageSuggestion, 0, len(out.Response.Docs))
	for _, doc := range out.Response.Docs {
		results = append(results, packageSuggestion{Namespace: doc.GroupID, Name: doc.ArtifactID, Version: doc.LatestVersion})
	}
	return results, nil
}

func mavenVersions(ctx context.Context, namespace, name string) (*versionInfo, error) {
	if namespace == "" {
		suggestions, err := mavenSearch(ctx, name)
		if err != nil {
			return nil, err
		}
		if len(suggestions) == 0 {
			return nil, fmt.Errorf("maven package not found")
		}
		namespace = suggestions[0].Namespace
		name = suggestions[0].Name
	}
	endpoint := fmt.Sprintf("https://search.maven.org/solrsearch/select?q=%s&core=gav&rows=%d&wt=json", url.QueryEscape(fmt.Sprintf("g:%q AND a:%q", namespace, name)), versionSuggestionLimit)
	var out struct {
		Response struct {
			Docs []struct {
				Version string `json:"v"`
			} `json:"docs"`
		} `json:"response"`
	}
	if err := getJSON(ctx, endpoint, &out); err != nil {
		return nil, err
	}
	versions := make([]string, 0, len(out.Response.Docs))
	seen := map[string]struct{}{}
	for _, doc := range out.Response.Docs {
		if doc.Version == "" {
			continue
		}
		if _, ok := seen[doc.Version]; ok {
			continue
		}
		seen[doc.Version] = struct{}{}
		versions = append(versions, doc.Version)
	}
	latest := ""
	if len(versions) > 0 {
		latest = versions[0]
	}
	return &versionInfo{Namespace: namespace, Name: name, Latest: latest, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func cargoSearch(ctx context.Context, query string) ([]packageSuggestion, error) {
	var out struct {
		Crates []struct {
			Name    string `json:"name"`
			Version string `json:"newest_version"`
		} `json:"crates"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://crates.io/api/v1/crates?q=%s&per_page=10", url.QueryEscape(query)), &out); err != nil {
		return nil, err
	}
	results := make([]packageSuggestion, 0, len(out.Crates))
	for _, c := range out.Crates {
		results = append(results, packageSuggestion{Name: c.Name, Version: c.Version})
	}
	return results, nil
}

func cargoVersions(ctx context.Context, name string) (*versionInfo, error) {
	var out struct {
		Crate struct {
			Name          string `json:"name"`
			NewestVersion string `json:"newest_version"`
			MaxVersion    string `json:"max_version"`
		} `json:"crate"`
		Versions []struct {
			Number string `json:"num"`
		} `json:"versions"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://crates.io/api/v1/crates/%s", url.PathEscape(name)), &out); err != nil {
		return nil, err
	}
	versions := make([]string, 0, len(out.Versions))
	for _, v := range out.Versions {
		if v.Number != "" {
			versions = append(versions, v.Number)
		}
	}
	sortVersionStrings(versions)
	latest := out.Crate.NewestVersion
	if latest == "" {
		latest = out.Crate.MaxVersion
	}
	pkgName := out.Crate.Name
	if pkgName == "" {
		pkgName = name
	}
	return &versionInfo{Name: pkgName, Latest: latest, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func rubyGemsSearch(ctx context.Context, query string) ([]packageSuggestion, error) {
	var out []struct {
		Name    string `json:"name"`
		Version string `json:"version"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://rubygems.org/api/v1/search.json?query=%s", url.QueryEscape(query)), &out); err != nil {
		return nil, err
	}
	results := make([]packageSuggestion, 0, len(out))
	for _, gem := range out {
		results = append(results, packageSuggestion{Name: gem.Name, Version: gem.Version})
	}
	return results, nil
}

func rubyGemsVersions(ctx context.Context, name string) (*versionInfo, error) {
	var out []struct {
		Number string `json:"number"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://rubygems.org/api/v1/versions/%s.json", url.PathEscape(name)), &out); err != nil {
		return nil, err
	}
	versions := make([]string, 0, len(out))
	for _, v := range out {
		if v.Number != "" {
			versions = append(versions, v.Number)
		}
	}
	sortVersionStrings(versions)
	latest := ""
	if len(versions) > 0 {
		latest = versions[0]
	}
	return &versionInfo{Name: name, Latest: latest, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func nugetSearch(ctx context.Context, query string) ([]packageSuggestion, error) {
	var out struct {
		Data []struct {
			ID      string `json:"id"`
			Version string `json:"version"`
		} `json:"data"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://azuresearch-usnc.nuget.org/query?q=%s&take=10&prerelease=false", url.QueryEscape(query)), &out); err != nil {
		return nil, err
	}
	results := make([]packageSuggestion, 0, len(out.Data))
	for _, pkg := range out.Data {
		results = append(results, packageSuggestion{Name: pkg.ID, Version: pkg.Version})
	}
	return results, nil
}

func nugetVersions(ctx context.Context, name string) (*versionInfo, error) {
	pkg := strings.ToLower(name)
	var out struct {
		Versions []string `json:"versions"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://api.nuget.org/v3-flatcontainer/%s/index.json", url.PathEscape(pkg)), &out); err != nil {
		return nil, err
	}
	versions := append([]string(nil), out.Versions...)
	versions = stableVersions(versions)
	sortVersionStrings(versions)
	latest := ""
	if len(versions) > 0 {
		latest = versions[0]
	}
	return &versionInfo{Name: name, Latest: latest, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func stableVersions(values []string) []string {
	stable := values[:0]
	for _, v := range values {
		if !strings.Contains(v, "-") {
			stable = append(stable, v)
		}
	}
	return stable
}

func composerSearch(ctx context.Context, query string) ([]packageSuggestion, error) {
	if strings.Contains(query, "/") {
		ns, name := splitPackageForManager("composer", query)
		return []packageSuggestion{{Namespace: ns, Name: name}}, nil
	}
	var out struct {
		Results []struct {
			Name string `json:"name"`
		} `json:"results"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://packagist.org/search.json?q=%s", url.QueryEscape(query)), &out); err != nil {
		return nil, err
	}
	results := make([]packageSuggestion, 0, len(out.Results))
	for _, pkg := range out.Results {
		ns, name := splitPackageForManager("composer", pkg.Name)
		results = append(results, packageSuggestion{Namespace: ns, Name: name})
	}
	return results, nil
}

func composerVersions(ctx context.Context, namespace, name string) (*versionInfo, error) {
	if namespace == "" {
		if strings.Contains(name, "/") {
			namespace, name = splitPackageForManager("composer", name)
		} else {
			suggestions, err := composerSearch(ctx, name)
			if err != nil {
				return nil, err
			}
			if len(suggestions) == 0 {
				return nil, fmt.Errorf("composer package not found")
			}
			namespace = suggestions[0].Namespace
			name = suggestions[0].Name
		}
	}
	pkg := namespace + "/" + name
	var out struct {
		Packages map[string][]struct {
			Version string `json:"version"`
		} `json:"packages"`
	}
	if err := getJSON(ctx, fmt.Sprintf("https://repo.packagist.org/p2/%s.json", url.PathEscape(pkg)), &out); err != nil {
		return nil, err
	}
	list := out.Packages[pkg]
	versions := make([]string, 0, len(list))
	for _, v := range list {
		if v.Version != "" && !strings.HasPrefix(v.Version, "dev-") {
			versions = append(versions, v.Version)
		}
	}
	latest := ""
	if len(versions) > 0 {
		latest = versions[0]
	}
	return &versionInfo{Namespace: namespace, Name: name, Latest: latest, Versions: limitStrings(versions, versionSuggestionLimit)}, nil
}

func splitPackageForManager(manager, pkg string) (string, string) {
	switch manager {
	case "npm":
		if strings.HasPrefix(pkg, "@") {
			if i := strings.Index(pkg, "/"); i > 0 {
				return pkg[:i], pkg[i+1:]
			}
		}
	case "maven":
		if strings.Contains(pkg, ":") {
			parts := strings.SplitN(pkg, ":", 2)
			return parts[0], parts[1]
		}
	case "go", "composer":
		if strings.Count(pkg, "/") > 0 {
			idx := strings.Index(pkg, "/")
			return pkg[:idx], pkg[idx+1:]
		}
	}
	return "", pkg
}

func parseGitHubRepository(raw string) (string, string, string, error) {
	trimmed := strings.TrimSpace(raw)
	if trimmed == "" {
		return "", "", "", fmt.Errorf("repository required")
	}
	trimmed = strings.TrimSuffix(trimmed, ".git")
	trimmed = strings.TrimPrefix(trimmed, "git@github.com:")
	trimmed = strings.TrimPrefix(trimmed, "github.com/")

	if strings.Contains(trimmed, "://") {
		u, err := url.Parse(trimmed)
		if err != nil {
			return "", "", "", fmt.Errorf("invalid GitHub repository URL")
		}
		host := strings.ToLower(u.Hostname())
		if host != "github.com" && host != "www.github.com" {
			return "", "", "", fmt.Errorf("repository must be hosted on github.com")
		}
		trimmed = strings.Trim(u.EscapedPath(), "/")
		path, err := url.PathUnescape(trimmed)
		if err != nil {
			return "", "", "", fmt.Errorf("invalid GitHub repository path")
		}
		trimmed = path
	}

	parts := strings.Split(strings.Trim(trimmed, "/"), "/")
	if len(parts) < 2 {
		return "", "", "", fmt.Errorf("repository must include owner and name")
	}
	owner := strings.TrimSpace(parts[0])
	repo := strings.TrimSuffix(strings.TrimSpace(parts[1]), ".git")
	if owner == "" || repo == "" {
		return "", "", "", fmt.Errorf("repository must include owner and name")
	}
	if err := validateName(owner); err != nil {
		return "", "", "", fmt.Errorf("invalid GitHub owner")
	}
	if err := validateName(repo); err != nil {
		return "", "", "", fmt.Errorf("invalid GitHub repository")
	}
	return owner, repo, owner + "/" + repo, nil
}

func cleanSPDXValue(value string) string {
	value = strings.TrimSpace(value)
	switch strings.ToUpper(value) {
	case "", "NOASSERTION", "NONE":
		return ""
	default:
		return value
	}
}

func githubDependencyLicense(concluded, declared string) (string, string, string) {
	cleanConcluded := cleanSPDXValue(concluded)
	cleanDeclared := cleanSPDXValue(declared)
	if cleanConcluded != "" {
		return cleanConcluded, cleanConcluded, cleanDeclared
	}
	return cleanDeclared, cleanConcluded, cleanDeclared
}

func githubDependencyDisplayName(managerName, namespace, name string) string {
	if namespace == "" {
		return name
	}
	if managerName == "maven" {
		return namespace + ":" + name
	}
	return namespace + "/" + name
}

func githubDependencyPackageFromPURL(locator, spdxName, spdxVersion, spdxID string) (githubDependencyPackage, bool) {
	pu, err := purl.FromString(locator)
	if err != nil {
		return githubDependencyPackage{}, false
	}
	managerName, ok := purlTypeToManager[strings.ToLower(pu.Type)]
	if !ok {
		return githubDependencyPackage{}, false
	}
	name := strings.TrimSpace(pu.Name)
	if name == "" {
		name = strings.TrimSpace(spdxName)
	}
	if name == "" {
		return githubDependencyPackage{}, false
	}
	version := cleanSPDXValue(pu.Version)
	if version == "" {
		version = cleanSPDXValue(spdxVersion)
	}
	dep := githubDependencyPackage{
		Manager:   managerName,
		Namespace: pu.Namespace,
		Name:      name,
		Version:   version,
		PURL:      locator,
		SPDXID:    spdxID,
	}
	dep.Display = githubDependencyDisplayName(dep.Manager, dep.Namespace, dep.Name)
	return dep, true
}

func githubSBOMExternalRefLocators(refs []githubSBOMExternalRef) []string {
	seen := map[string]struct{}{}
	locators := []string{}
	for _, ref := range refs {
		locator := strings.TrimSpace(ref.ReferenceLocator)
		if locator == "" {
			continue
		}
		if _, ok := seen[locator]; ok {
			continue
		}
		seen[locator] = struct{}{}
		locators = append(locators, locator)
	}
	sort.Strings(locators)
	return locators
}

func githubFirstPURL(locators []string) string {
	for _, locator := range locators {
		if strings.HasPrefix(locator, "pkg:") {
			return locator
		}
	}
	return ""
}

func githubUnsupportedDependencyFromSBOM(pkg githubSBOMPackage) githubUnsupportedDependencyPackage {
	name := strings.TrimSpace(pkg.Name)
	version := cleanSPDXValue(pkg.VersionInfo)
	refs := githubSBOMExternalRefLocators(pkg.ExternalRefs)
	license, concluded, declared := githubDependencyLicense(pkg.LicenseConcluded, pkg.LicenseDeclared)
	display := name
	if display == "" {
		display = githubFirstPURL(refs)
	}
	if display == "" {
		display = strings.TrimSpace(pkg.SPDXID)
	}
	return githubUnsupportedDependencyPackage{
		Name:             name,
		Version:          version,
		PURL:             githubFirstPURL(refs),
		SPDXID:           strings.TrimSpace(pkg.SPDXID),
		Display:          display,
		License:          license,
		LicenseConcluded: concluded,
		LicenseDeclared:  declared,
		ExternalRefs:     refs,
	}
}

func fetchGitHubDependencyGraph(ctx context.Context, repo string, cache *redisCache, ttl time.Duration) (githubDependencyGraphResult, error) {
	owner, name, slug, err := parseGitHubRepository(repo)
	if err != nil {
		return githubDependencyGraphResult{}, err
	}
	key := "github-dependency-graph:v2:" + slug
	if val, ok := cache.get(ctx, key); ok {
		var cached githubDependencyGraphResult
		if json.Unmarshal([]byte(val), &cached) == nil {
			return cached, nil
		}
	}

	endpoint := fmt.Sprintf("https://api.github.com/repos/%s/%s/dependency-graph/sbom", url.PathEscape(owner), url.PathEscape(name))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return githubDependencyGraphResult{}, err
	}
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")
	req.Header.Set("User-Agent", "oss-deps-explorer/1.0")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return githubDependencyGraphResult{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return githubDependencyGraphResult{}, fmt.Errorf("github dependency graph returned status %d", resp.StatusCode)
	}

	var sbom githubSBOMResponse
	if err := json.NewDecoder(resp.Body).Decode(&sbom); err != nil {
		return githubDependencyGraphResult{}, err
	}

	result := githubDependencyGraphResult{
		Repository: slug,
		Source:     "github_dependency_graph_sbom",
		Packages:   []githubDependencyPackage{},
	}
	seen := map[string]struct{}{}
	unsupportedSeen := map[string]struct{}{}
	for _, pkg := range sbom.SBOM.Packages {
		foundSupported := false
		for _, ref := range pkg.ExternalRefs {
			if !strings.EqualFold(ref.ReferenceType, "purl") && !strings.HasPrefix(ref.ReferenceLocator, "pkg:") {
				continue
			}
			dep, ok := githubDependencyPackageFromPURL(ref.ReferenceLocator, pkg.Name, pkg.VersionInfo, pkg.SPDXID)
			if !ok {
				continue
			}
			dep.License, dep.LicenseConcluded, dep.LicenseDeclared = githubDependencyLicense(pkg.LicenseConcluded, pkg.LicenseDeclared)
			foundSupported = true
			key := strings.Join([]string{dep.Manager, dep.Namespace, dep.Name, dep.Version}, "\x00")
			if _, exists := seen[key]; exists {
				continue
			}
			seen[key] = struct{}{}
			result.Packages = append(result.Packages, dep)
		}
		if !foundSupported {
			unsupported := githubUnsupportedDependencyFromSBOM(pkg)
			key := strings.Join([]string{unsupported.Name, unsupported.Version, unsupported.PURL, unsupported.SPDXID}, "\x00")
			if _, exists := unsupportedSeen[key]; exists {
				continue
			}
			unsupportedSeen[key] = struct{}{}
			result.UnsupportedPackages = append(result.UnsupportedPackages, unsupported)
		}
	}
	sort.Slice(result.Packages, func(i, j int) bool {
		a := result.Packages[i]
		b := result.Packages[j]
		if a.Manager != b.Manager {
			return a.Manager < b.Manager
		}
		if a.Display != b.Display {
			return strings.ToLower(a.Display) < strings.ToLower(b.Display)
		}
		return a.Version > b.Version
	})
	result.PackageCount = len(result.Packages)
	sort.Slice(result.UnsupportedPackages, func(i, j int) bool {
		a := result.UnsupportedPackages[i]
		b := result.UnsupportedPackages[j]
		if strings.ToLower(a.Display) != strings.ToLower(b.Display) {
			return strings.ToLower(a.Display) < strings.ToLower(b.Display)
		}
		return a.Version > b.Version
	})
	result.UnsupportedCount = len(result.UnsupportedPackages)

	if data, err := json.Marshal(result); err == nil {
		cache.set(ctx, key, data, ttl)
	}
	return result, nil
}

func escapePathSegments(path string) string {
	parts := strings.Split(path, "/")
	for i, part := range parts {
		parts[i] = url.PathEscape(part)
	}
	return strings.Join(parts, "/")
}

func mapKeys[V any](m map[string]V) []string {
	keys := make([]string, 0, len(m))
	for k := range m {
		keys = append(keys, k)
	}
	return keys
}

func limitStrings(values []string, limit int) []string {
	if len(values) <= limit {
		return values
	}
	return values[:limit]
}

func sortVersionStrings(values []string) {
	sort.SliceStable(values, func(i, j int) bool {
		return compareVersionStrings(values[i], values[j]) > 0
	})
}

func compareVersionStrings(a, b string) int {
	va := semverish(a)
	vb := semverish(b)
	if semver.IsValid(va) && semver.IsValid(vb) {
		return semver.Compare(va, vb)
	}
	return naturalCompare(a, b)
}

func semverish(v string) string {
	v = strings.TrimSpace(v)
	if v == "" {
		return ""
	}
	v = strings.TrimPrefix(v, "v")
	parts := strings.SplitN(v, "-", 2)
	nums := strings.Split(parts[0], ".")
	for len(nums) < 3 {
		nums = append(nums, "0")
	}
	out := "v" + strings.Join(nums[:3], ".")
	if len(parts) == 2 {
		out += "-" + parts[1]
	}
	return out
}

func naturalCompare(a, b string) int {
	as := versionRe.FindAllString(a, -1)
	bs := versionRe.FindAllString(b, -1)
	for i := 0; i < len(as) && i < len(bs); i++ {
		ai, aerr := strconv.Atoi(as[i])
		bi, berr := strconv.Atoi(bs[i])
		if aerr == nil && berr == nil {
			if ai > bi {
				return 1
			}
			if ai < bi {
				return -1
			}
			continue
		}
		if as[i] > bs[i] {
			return 1
		}
		if as[i] < bs[i] {
			return -1
		}
	}
	if len(as) > len(bs) {
		return 1
	}
	if len(as) < len(bs) {
		return -1
	}
	if a > b {
		return 1
	}
	if a < b {
		return -1
	}
	return 0
}

func fetchRepoMetadata(ctx context.Context, repo string, cache *redisCache, ttl time.Duration) (map[string]interface{}, error) {
	if cache != nil {
		if val, ok := cache.get(ctx, "repometa:"+repo); ok {
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

	if cache != nil {
		if data, err := json.Marshal(meta); err == nil {
			cache.set(ctx, "repometa:"+repo, data, ttl)
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

	cache := newRedisCache(cfg)

	r := mux.NewRouter()
	r.UseEncodedPath()
	r.Use(logRequests)

	r.HandleFunc("/api/config", func(w http.ResponseWriter, req *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(cfg.PackageManager)
	}).Methods(http.MethodGet)

	r.HandleFunc("/api/suggest/{manager}/{query}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pm, err := pathVar(vars, "manager")
		if err != nil {
			http.Error(w, "invalid package manager", http.StatusBadRequest)
			return
		}
		q, err := pathVar(vars, "query")
		if err != nil {
			http.Error(w, "invalid query", http.StatusBadRequest)
			return
		}
		if q == "" {
			http.Error(w, "query required", http.StatusBadRequest)
			return
		}

		key := fmt.Sprintf("suggest:%s:%s", pm, q)
		ctx := req.Context()
		if val, ok := cache.get(ctx, key); ok {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(val))
			return
		}

		results, err := packageSearch(ctx, pm, q)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		data, err := json.Marshal(results)
		if err == nil {
			cache.set(ctx, key, data, cfg.Cache.TTL)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	r.HandleFunc("/api/versions", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		pm := q.Get("manager")
		ns := q.Get("namespace")
		name := q.Get("name")
		if pm == "" || name == "" {
			http.Error(w, "manager and name required", http.StatusBadRequest)
			return
		}
		key := fmt.Sprintf("versions:v2:%s:%s:%s", pm, ns, name)
		ctx := req.Context()
		if val, ok := cache.get(ctx, key); ok {
			w.Header().Set("Content-Type", "application/json")
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(val))
			return
		}
		info, err := packageVersions(ctx, pm, ns, name)
		if err != nil {
			http.Error(w, err.Error(), http.StatusNotFound)
			return
		}
		data, err := json.Marshal(info)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cache.set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	r.HandleFunc("/api/repo/{repo:.*}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		rawRepo, err := pathVar(vars, "repo")
		if err != nil {
			http.Error(w, "invalid repository", http.StatusBadRequest)
			return
		}
		repo := strings.TrimPrefix(rawRepo, "github.com/")
		ctx := req.Context()
		meta, err := fetchRepoMetadata(ctx, repo, cache, cfg.Cache.TTL)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(meta)
	}).Methods(http.MethodGet)

	r.HandleFunc("/api/github/dependencies", func(w http.ResponseWriter, req *http.Request) {
		repo := req.URL.Query().Get("repo")
		if repo == "" {
			http.Error(w, "repo required", http.StatusBadRequest)
			return
		}
		result, err := fetchGitHubDependencyGraph(req.Context(), repo, cache, cfg.Cache.TTL)
		if err != nil {
			status := http.StatusInternalServerError
			if strings.Contains(err.Error(), "required") ||
				strings.Contains(err.Error(), "invalid") ||
				strings.Contains(err.Error(), "github.com") {
				status = http.StatusBadRequest
			}
			http.Error(w, err.Error(), status)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(result)
	}).Methods(http.MethodGet)

	// generic lookup endpoint using query parameters
	r.HandleFunc("/api/lookup", func(w http.ResponseWriter, req *http.Request) {
		q := req.URL.Query()
		pm := q.Get("manager")
		ns := q.Get("namespace")
		name := q.Get("name")
		version := q.Get("version")
		recursive := queryBool(req, "recursive", false)
		vflag := queryBool(req, "vuln", false)
		sflag := queryBool(req, "scorecard", false)
		gflag := queryBool(req, "graph", withGraph)

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
		if gflag {
			key = graphCacheKey(key)
		}
		ctx := req.Context()
		if val, ok := cache.get(ctx, key); ok {
			if gflag {
				w.Header().Set("Content-Type", "text/vnd.graphviz")
			} else {
				w.Header().Set("Content-Type", "application/json")
			}
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(val))
			return
		}

		deps, parents, errs, err := fetchAllDeps(ctx, m, ns, name, version, recursive, map[string]struct{}{}, "", pm, cache, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		depMap, _ := deps["dependencies"].(map[string]interface{})
		if gflag {
			dot := dependencyGraphDot(ctx, pm, ns, name, version, deps, parents, cache, cfg.Cache.TTL, vflag, sflag)
			cache.set(ctx, key, []byte(dot), cfg.Cache.TTL)
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			w.Header().Set("X-Cache-Status", "MISS")
			w.Write([]byte(dot))
			return
		}
		if vflag {
			vulns := collectVulnerabilities(ctx, pm, ns, name, version, depMap, cache, cfg.Cache.TTL)
			if len(vulns.Vulnerabilities) > 0 {
				deps["vulnerabilities"] = vulns.Vulnerabilities
			}
			if len(vulns.Status) > 0 {
				deps["vulnerability_status"] = vulns.Status
			}
		}
		if sflag {
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, ns, name, depMap, repoMap, cache, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err == nil {
			cache.set(ctx, key, data, cfg.Cache.TTL)
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// special route for Go modules which may contain slashes in the module path
	r.HandleFunc("/api/dependencies/go/{module:.+}/{version}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		module, err := pathVar(vars, "module")
		if err != nil {
			http.Error(w, "invalid module", http.StatusBadRequest)
			return
		}
		version, err := pathVar(vars, "version")
		if err != nil {
			http.Error(w, "invalid version", http.StatusBadRequest)
			return
		}

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
		reqGraph := queryBool(req, "graph", withGraph)
		key := cacheKey("go", ns, name, version, reqRecurse, reqVuln, reqScore)
		if reqGraph {
			key = graphCacheKey(key)
		}
		ctx := req.Context()
		if cached, ok := cache.get(ctx, key); ok {
			if reqGraph {
				w.Header().Set("Content-Type", "text/vnd.graphviz")
			} else {
				w.Header().Set("Content-Type", "application/json")
			}
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, parents, errs, err := fetchAllDeps(ctx, m, ns, name, version, reqRecurse, map[string]struct{}{}, "", "go", cache, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		depMap, _ := deps["dependencies"].(map[string]interface{})
		if reqGraph {
			dot := dependencyGraphDot(ctx, "go", ns, name, version, deps, parents, cache, cfg.Cache.TTL, reqVuln, reqScore)
			cache.set(ctx, key, []byte(dot), cfg.Cache.TTL)
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			w.Header().Set("X-Cache-Status", "MISS")
			w.Write([]byte(dot))
			return
		}

		if reqVuln {
			vulns := collectVulnerabilities(ctx, "go", ns, name, version, depMap, cache, cfg.Cache.TTL)
			if len(vulns.Vulnerabilities) > 0 {
				deps["vulnerabilities"] = vulns.Vulnerabilities
			}
			if len(vulns.Status) > 0 {
				deps["vulnerability_status"] = vulns.Status
			}
		}
		if reqScore {
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, "go", ns, name, depMap, repoMap, cache, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cache.set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// lookup via package URL
	r.HandleFunc("/api/purl/{purl:.*}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pstr, err := url.PathUnescape(vars["purl"])
		if err != nil {
			http.Error(w, "invalid purl", http.StatusBadRequest)
			return
		}
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

		reqRecurse := queryBool(req, "recursive", recurse)
		reqVuln := queryBool(req, "vuln", withVuln)
		reqScore := queryBool(req, "scorecard", withScorecard)
		reqGraph := queryBool(req, "graph", withGraph)
		key := purlCacheKey(pstr, reqRecurse, reqVuln, reqScore, reqGraph)
		ctx := req.Context()
		if cached, ok := cache.get(ctx, key); ok {
			if reqGraph {
				w.Header().Set("Content-Type", "text/vnd.graphviz")
			} else {
				w.Header().Set("Content-Type", "application/json")
			}
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, parents, errs, err := fetchAllDeps(ctx, m, ns, name, version, reqRecurse, map[string]struct{}{}, "", pm, cache, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		depMap, _ := deps["dependencies"].(map[string]interface{})
		if reqGraph {
			dot := dependencyGraphDot(ctx, pm, ns, name, version, deps, parents, cache, cfg.Cache.TTL, reqVuln, reqScore)
			cache.set(ctx, key, []byte(dot), cfg.Cache.TTL)
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			w.Header().Set("X-Cache-Status", "MISS")
			w.Write([]byte(dot))
			return
		}
		if reqVuln {
			vulns := collectVulnerabilities(ctx, pm, ns, name, version, depMap, cache, cfg.Cache.TTL)
			if len(vulns.Vulnerabilities) > 0 {
				deps["vulnerabilities"] = vulns.Vulnerabilities
			}
			if len(vulns.Status) > 0 {
				deps["vulnerability_status"] = vulns.Status
			}
		}
		if reqScore {
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, ns, name, depMap, repoMap, cache, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cache.set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// route with namespace
	r.HandleFunc("/api/dependencies/{manager}/{namespace}/{name}/{version}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pm, err := pathVar(vars, "manager")
		if err != nil {
			http.Error(w, "invalid package manager", http.StatusBadRequest)
			return
		}
		ns, err := pathVar(vars, "namespace")
		if err != nil {
			http.Error(w, "invalid namespace", http.StatusBadRequest)
			return
		}
		name, err := pathVar(vars, "name")
		if err != nil {
			http.Error(w, "invalid package name", http.StatusBadRequest)
			return
		}
		version, err := pathVar(vars, "version")
		if err != nil {
			http.Error(w, "invalid version", http.StatusBadRequest)
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

		reqRecurse := queryBool(req, "recursive", recurse)
		reqVuln := queryBool(req, "vuln", withVuln)
		reqScore := queryBool(req, "scorecard", withScorecard)
		reqGraph := queryBool(req, "graph", withGraph)
		key := cacheKey(pm, ns, name, version, reqRecurse, reqVuln, reqScore)
		if reqGraph {
			key = graphCacheKey(key)
		}
		ctx := req.Context()
		if cached, ok := cache.get(ctx, key); ok {
			if reqGraph {
				w.Header().Set("Content-Type", "text/vnd.graphviz")
			} else {
				w.Header().Set("Content-Type", "application/json")
			}
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, parents, errs, err := fetchAllDeps(ctx, m, ns, name, version, reqRecurse, map[string]struct{}{}, "", pm, cache, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		depMap, _ := deps["dependencies"].(map[string]interface{})
		if reqGraph {
			dot := dependencyGraphDot(ctx, pm, ns, name, version, deps, parents, cache, cfg.Cache.TTL, reqVuln, reqScore)
			cache.set(ctx, key, []byte(dot), cfg.Cache.TTL)
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			w.Header().Set("X-Cache-Status", "MISS")
			w.Write([]byte(dot))
			return
		}

		if reqVuln {
			vulns := collectVulnerabilities(ctx, pm, ns, name, version, depMap, cache, cfg.Cache.TTL)
			if len(vulns.Vulnerabilities) > 0 {
				deps["vulnerabilities"] = vulns.Vulnerabilities
			}
			if len(vulns.Status) > 0 {
				deps["vulnerability_status"] = vulns.Status
			}
		}
		if reqScore {
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, ns, name, depMap, repoMap, cache, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cache.set(ctx, key, data, cfg.Cache.TTL)
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("X-Cache-Status", "MISS")
		w.Write(data)
	}).Methods(http.MethodGet)

	// route without namespace
	r.HandleFunc("/api/dependencies/{manager}/{name}/{version}", func(w http.ResponseWriter, req *http.Request) {
		vars := mux.Vars(req)
		pm, err := pathVar(vars, "manager")
		if err != nil {
			http.Error(w, "invalid package manager", http.StatusBadRequest)
			return
		}
		name, err := pathVar(vars, "name")
		if err != nil {
			http.Error(w, "invalid package name", http.StatusBadRequest)
			return
		}
		version, err := pathVar(vars, "version")
		if err != nil {
			http.Error(w, "invalid version", http.StatusBadRequest)
			return
		}

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
		reqGraph := queryBool(req, "graph", withGraph)
		key := cacheKey(pm, "", name, version, reqRecurse, reqVuln, reqScore)
		if reqGraph {
			key = graphCacheKey(key)
		}
		ctx := req.Context()
		if cached, ok := cache.get(ctx, key); ok {
			if reqGraph {
				w.Header().Set("Content-Type", "text/vnd.graphviz")
			} else {
				w.Header().Set("Content-Type", "application/json")
			}
			w.Header().Set("X-Cache-Status", "HIT")
			w.Write([]byte(cached))
			return
		}

		deps, parents, errs, err := fetchAllDeps(ctx, m, "", name, version, reqRecurse, map[string]struct{}{}, "", pm, cache, cfg.Cache.TTL)
		if err != nil {
			writeError(w, err)
			return
		}
		if len(errs) > 0 {
			deps["errors"] = errs
		}
		depMap, _ := deps["dependencies"].(map[string]interface{})
		if reqGraph {
			dot := dependencyGraphDot(ctx, pm, "", name, version, deps, parents, cache, cfg.Cache.TTL, reqVuln, reqScore)
			cache.set(ctx, key, []byte(dot), cfg.Cache.TTL)
			w.Header().Set("Content-Type", "text/vnd.graphviz")
			w.Header().Set("X-Cache-Status", "MISS")
			w.Write([]byte(dot))
			return
		}

		if reqVuln {
			vulns := collectVulnerabilities(ctx, pm, "", name, version, depMap, cache, cfg.Cache.TTL)
			if len(vulns.Vulnerabilities) > 0 {
				deps["vulnerabilities"] = vulns.Vulnerabilities
			}
			if len(vulns.Status) > 0 {
				deps["vulnerability_status"] = vulns.Status
			}
		}
		if reqScore {
			repoMap, _ := deps["repositories"].(map[string]string)
			scs := collectScorecards(ctx, pm, "", name, depMap, repoMap, cache, cfg.Cache.TTL)
			if len(scs) > 0 {
				deps["scorecards"] = scs
			}
		}
		data, err := json.Marshal(deps)
		if err != nil {
			http.Error(w, err.Error(), http.StatusInternalServerError)
			return
		}
		cache.set(ctx, key, data, cfg.Cache.TTL)
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
