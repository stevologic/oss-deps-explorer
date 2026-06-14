package npm

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strings"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

// NPM implements manager.Manager using the deps.dev API.
type NPM struct {
	BaseURL string
}

// Dependencies fetches dependency information from deps.dev.
func (n *NPM) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	client := &depsdev.Client{BaseURL: n.BaseURL}
	pkg := name
	if namespace != "" {
		pkg = namespace + "/" + name
	}
	deps, repo, depsErr := client.GetDependencies(ctx, "npm", pkg, version)
	if depsErr == nil {
		if depMap, _ := deps["dependencies"].(map[string]interface{}); len(depMap) > 0 {
			deps["resolved_version"] = version
			return deps, repo, nil
		}
	}
	fallback, fallbackRepo, err := registryDependencies(ctx, pkg, version)
	if err != nil {
		if depsErr != nil {
			return nil, "", depsErr
		}
		return deps, repo, nil
	}
	if fallbackRepo != "" && repo == "" {
		repo = fallbackRepo
	}
	return fallback, repo, nil
}

func registryDependencies(ctx context.Context, pkg, version string) (map[string]interface{}, string, error) {
	out, err := registryVersionManifest(ctx, pkg, version)
	if err != nil {
		return nil, "", err
	}
	deps := registryManifestDependencies(out)
	res := map[string]interface{}{"dependencies": deps}
	if out.Version != "" {
		res["resolved_version"] = out.Version
	}
	return res, npmRepo(out.Repository), nil
}

func registryVersionManifest(ctx context.Context, pkg, version string) (registryManifest, error) {
	endpoint := fmt.Sprintf("https://registry.npmjs.org/%s/%s", url.PathEscape(pkg), url.PathEscape(version))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return registryManifest{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oss-deps-explorer/1.0")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return registryManifest{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode == http.StatusOK {
		var out registryManifest
		if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
			return registryManifest{}, err
		}
		return out, nil
	}

	out, err := registryPackageManifest(ctx, pkg, version)
	if err == nil {
		return out, nil
	}
	return registryManifest{}, fmt.Errorf("npm registry returned status %d", resp.StatusCode)
}

func registryPackageManifest(ctx context.Context, pkg, requested string) (registryManifest, error) {
	endpoint := fmt.Sprintf("https://registry.npmjs.org/%s", url.PathEscape(pkg))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return registryManifest{}, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oss-deps-explorer/1.0")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return registryManifest{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return registryManifest{}, fmt.Errorf("npm registry package returned status %d", resp.StatusCode)
	}
	var out registryPackage
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return registryManifest{}, err
	}
	resolved := selectRegistryVersion(out, requested)
	if resolved == "" {
		return registryManifest{}, fmt.Errorf("npm version %q not found", requested)
	}
	raw, ok := out.Versions[resolved]
	if !ok {
		return registryManifest{}, fmt.Errorf("npm version %q not found", resolved)
	}
	var manifest registryManifest
	if err := json.Unmarshal(raw, &manifest); err != nil {
		return registryManifest{}, err
	}
	return manifest, nil
}

type registryManifest struct {
	Version              string            `json:"version"`
	Dependencies         map[string]string `json:"dependencies"`
	OptionalDependencies map[string]string `json:"optionalDependencies"`
	Repository           interface{}       `json:"repository"`
}

type registryPackage struct {
	DistTags map[string]string          `json:"dist-tags"`
	Versions map[string]json.RawMessage `json:"versions"`
}

func registryManifestDependencies(manifest registryManifest) map[string]interface{} {
	deps := make(map[string]interface{}, len(manifest.Dependencies)+len(manifest.OptionalDependencies))
	for name, version := range manifest.Dependencies {
		deps[name] = version
	}
	for name, version := range manifest.OptionalDependencies {
		if _, exists := deps[name]; !exists {
			deps[name] = version
		}
	}
	return deps
}

var datedPrereleaseRe = regexp.MustCompile(`^(.*-)([0-9A-Za-z]+)-([0-9]{8})$`)

func selectRegistryVersion(pkg registryPackage, requested string) string {
	req := strings.TrimSpace(requested)
	if req == "" {
		return pkg.DistTags["latest"]
	}
	if _, ok := pkg.Versions[req]; ok {
		return req
	}
	if tag := pkg.DistTags[req]; tag != "" {
		return tag
	}
	return closestDatedPrerelease(pkg.Versions, req)
}

func closestDatedPrerelease(versions map[string]json.RawMessage, requested string) string {
	match := datedPrereleaseRe.FindStringSubmatch(requested)
	if len(match) != 4 {
		return ""
	}
	prefix, hash, date := match[1], strings.ToLower(match[2]), match[3]
	candidates := make([]string, 0)
	for version := range versions {
		candidate := datedPrereleaseRe.FindStringSubmatch(version)
		if len(candidate) != 4 {
			continue
		}
		if candidate[1] == prefix && candidate[3] == date {
			candidates = append(candidates, version)
		}
	}
	sort.Strings(candidates)
	best := ""
	bestScore := -1
	for _, version := range candidates {
		candidate := datedPrereleaseRe.FindStringSubmatch(version)
		score := commonPrefixLen(hash, strings.ToLower(candidate[2]))
		if score > bestScore {
			best = version
			bestScore = score
		}
	}
	return best
}

func commonPrefixLen(a, b string) int {
	max := len(a)
	if len(b) < max {
		max = len(b)
	}
	for i := 0; i < max; i++ {
		if a[i] != b[i] {
			return i
		}
	}
	return max
}

func npmRepo(raw interface{}) string {
	var repo string
	switch v := raw.(type) {
	case string:
		repo = v
	case map[string]interface{}:
		if s, ok := v["url"].(string); ok {
			repo = s
		}
	}
	repo = strings.TrimSpace(repo)
	repo = strings.TrimPrefix(repo, "git+")
	repo = strings.TrimPrefix(repo, "git://")
	repo = strings.TrimPrefix(repo, "git@github.com:")
	repo = strings.TrimPrefix(repo, "ssh://git@github.com/")
	repo = strings.TrimSuffix(repo, ".git")
	if u, err := url.Parse(repo); err == nil && strings.EqualFold(u.Host, "github.com") {
		repo = strings.TrimPrefix(u.Path, "/")
	}
	repo = strings.TrimPrefix(repo, "github.com/")
	parts := strings.Split(repo, "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return ""
	}
	return "github.com/" + parts[0] + "/" + strings.TrimSuffix(parts[1], ".git")
}
