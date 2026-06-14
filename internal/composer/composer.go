package composer

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"sort"
	"strconv"
	"strings"

	"github.com/example/oss-deps-explorer/internal/depsdev"
)

type Composer struct {
	BaseURL string
}

type packagistResponse struct {
	Minified string                        `json:"minified"`
	Packages map[string][]packagistVersion `json:"packages"`
}

func (r *packagistResponse) UnmarshalJSON(data []byte) error {
	var raw struct {
		Minified string                       `json:"minified"`
		Packages map[string][]json.RawMessage `json:"packages"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	r.Minified = raw.Minified
	r.Packages = make(map[string][]packagistVersion, len(raw.Packages))
	for pkg, rows := range raw.Packages {
		if raw.Minified == "composer/2.0" {
			var err error
			rows, err = expandMinifiedPackageRows(rows)
			if err != nil {
				return err
			}
		}
		versions := make([]packagistVersion, 0, len(rows))
		for _, row := range rows {
			var version packagistVersion
			if err := json.Unmarshal(row, &version); err != nil {
				return err
			}
			versions = append(versions, version)
		}
		r.Packages[pkg] = versions
	}
	return nil
}

func expandMinifiedPackageRows(rows []json.RawMessage) ([]json.RawMessage, error) {
	expanded := make([]json.RawMessage, 0, len(rows))
	var current map[string]json.RawMessage
	for _, row := range rows {
		var diff map[string]json.RawMessage
		if err := json.Unmarshal(row, &diff); err != nil {
			return nil, err
		}
		if current == nil {
			current = cloneRawMap(diff)
		} else {
			for key, val := range diff {
				var marker string
				if json.Unmarshal(val, &marker) == nil && marker == "__unset" {
					delete(current, key)
					continue
				}
				current[key] = cloneRawMessage(val)
			}
		}
		data, err := json.Marshal(current)
		if err != nil {
			return nil, err
		}
		expanded = append(expanded, data)
	}
	return expanded, nil
}

func cloneRawMap(in map[string]json.RawMessage) map[string]json.RawMessage {
	out := make(map[string]json.RawMessage, len(in))
	for key, val := range in {
		out[key] = cloneRawMessage(val)
	}
	return out
}

func cloneRawMessage(in json.RawMessage) json.RawMessage {
	out := make([]byte, len(in))
	copy(out, in)
	return out
}

type packagistVersion struct {
	Version           string            `json:"version"`
	VersionNormalized string            `json:"version_normalized"`
	Require           map[string]string `json:"require"`
	Homepage          string            `json:"homepage"`
	Source            struct {
		URL string `json:"url"`
	} `json:"source"`
	Support map[string]string `json:"support"`
}

func (v *packagistVersion) UnmarshalJSON(data []byte) error {
	var raw struct {
		Version           string          `json:"version"`
		VersionNormalized string          `json:"version_normalized"`
		Homepage          string          `json:"homepage"`
		Require           json.RawMessage `json:"require"`
		Source            json.RawMessage `json:"source"`
		Support           json.RawMessage `json:"support"`
	}
	if err := json.Unmarshal(data, &raw); err != nil {
		return err
	}
	v.Version = raw.Version
	v.VersionNormalized = raw.VersionNormalized
	v.Homepage = raw.Homepage
	if !isJSONObject(raw.Require) {
		v.Require = nil
	} else {
		var require map[string]string
		if err := json.Unmarshal(raw.Require, &require); err != nil {
			return err
		}
		v.Require = require
	}
	if isJSONObject(raw.Source) {
		var source struct {
			URL string `json:"url"`
		}
		if json.Unmarshal(raw.Source, &source) == nil {
			v.Source.URL = source.URL
		}
	}
	if isJSONObject(raw.Support) {
		var support map[string]string
		if json.Unmarshal(raw.Support, &support) == nil {
			v.Support = support
		}
	}
	return nil
}

func isJSONObject(raw json.RawMessage) bool {
	return strings.HasPrefix(strings.TrimSpace(string(raw)), "{")
}

type semver struct {
	parts [4]int
	pre   bool
	ok    bool
}

var versionTokenRe = regexp.MustCompile(`\d+(?:\.\d+){0,3}`)

func (c *Composer) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	pkg := name
	if namespace != "" {
		pkg = namespace + "/" + name
	}
	versions, err := c.fetchVersions(ctx, pkg)
	if err != nil {
		return nil, "", err
	}
	selected := selectVersion(versions, version)
	if selected == nil {
		return nil, "", &depsdev.StatusError{Code: http.StatusNotFound}
	}

	deps := make(map[string]interface{})
	for dep, constraint := range selected.Require {
		if isPlatformRequirement(dep) {
			continue
		}
		deps[dep] = constraint
	}
	return map[string]interface{}{"dependencies": deps}, repoFromVersion(*selected), nil
}

func (c *Composer) fetchVersions(ctx context.Context, pkg string) ([]packagistVersion, error) {
	base := strings.TrimSuffix(c.BaseURL, "/")
	if base == "" || strings.Contains(base, "api.deps.dev") {
		base = "https://repo.packagist.org"
	}
	endpoint := fmt.Sprintf("%s/p2/%s.json", base, url.PathEscape(pkg))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, &depsdev.StatusError{Code: resp.StatusCode}
	}
	var out packagistResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		return nil, err
	}
	versions := out.Packages[pkg]
	if len(versions) == 0 {
		return nil, &depsdev.StatusError{Code: http.StatusNotFound}
	}
	return versions, nil
}

func selectVersion(versions []packagistVersion, requested string) *packagistVersion {
	req := strings.TrimSpace(requested)
	if !looksLikeConstraint(req) {
		for i := range versions {
			if versionEquivalent(versions[i].Version, req) || versionEquivalent(versions[i].VersionNormalized, req) {
				return &versions[i]
			}
		}
		return nil
	}

	indexes := make([]int, 0, len(versions))
	for i := range versions {
		indexes = append(indexes, i)
	}
	sort.SliceStable(indexes, func(i, j int) bool {
		a := parseVersion(versions[indexes[i]].Version)
		b := parseVersion(versions[indexes[j]].Version)
		if a.pre != b.pre {
			return !a.pre
		}
		return compareVersion(a, b) > 0
	})
	for _, idx := range indexes {
		if satisfiesConstraint(versions[idx].Version, req) {
			return &versions[idx]
		}
	}
	return nil
}

func versionEquivalent(a, b string) bool {
	ca := canonicalVersion(a)
	cb := canonicalVersion(b)
	if ca == "" || cb == "" {
		return false
	}
	if ca == cb {
		return true
	}
	va := parseVersion(a)
	vb := parseVersion(b)
	return va.ok && vb.ok && compareVersion(va, vb) == 0
}

func canonicalVersion(v string) string {
	v = strings.TrimSpace(strings.ToLower(v))
	v = strings.TrimPrefix(v, "v")
	if i := strings.IndexAny(v, "+-"); i >= 0 {
		v = v[:i]
	}
	for strings.Count(v, ".") > 2 && strings.HasSuffix(v, ".0") {
		v = strings.TrimSuffix(v, ".0")
	}
	return v
}

func looksLikeConstraint(v string) bool {
	return strings.ContainsAny(v, "^~<>=|*, ") || strings.Contains(v, " - ")
}

func isPlatformRequirement(dep string) bool {
	dep = strings.ToLower(dep)
	return dep == "php" ||
		strings.HasPrefix(dep, "ext-") ||
		strings.HasPrefix(dep, "lib-") ||
		strings.HasPrefix(dep, "composer-")
}

func satisfiesConstraint(version, constraint string) bool {
	constraint = strings.TrimSpace(strings.Split(constraint, "@")[0])
	if constraint == "" || constraint == "*" {
		return true
	}
	for _, group := range strings.Split(constraint, "||") {
		if satisfiesAll(version, group) {
			return true
		}
	}
	return false
}

func satisfiesAll(version, group string) bool {
	terms := splitConstraintTerms(group)
	if len(terms) == 0 {
		return true
	}
	for _, term := range terms {
		if !satisfiesTerm(version, term) {
			return false
		}
	}
	return true
}

func splitConstraintTerms(group string) []string {
	group = strings.ReplaceAll(group, ",", " ")
	raw := strings.Fields(group)
	terms := make([]string, 0, len(raw))
	for _, term := range raw {
		term = strings.TrimSpace(term)
		if term != "" {
			terms = append(terms, term)
		}
	}
	return terms
}

func satisfiesTerm(version, term string) bool {
	term = strings.TrimSpace(term)
	if term == "" || term == "*" {
		return true
	}
	if strings.ContainsAny(term, "*xX") {
		return wildcardMatch(version, term)
	}
	switch {
	case strings.HasPrefix(term, "^"):
		return inCaretRange(version, strings.TrimPrefix(term, "^"))
	case strings.HasPrefix(term, "~"):
		return inTildeRange(version, strings.TrimPrefix(term, "~"))
	case strings.HasPrefix(term, ">="):
		return compareVersion(parseVersion(version), parseVersion(term[2:])) >= 0
	case strings.HasPrefix(term, ">"):
		return compareVersion(parseVersion(version), parseVersion(term[1:])) > 0
	case strings.HasPrefix(term, "<="):
		return compareVersion(parseVersion(version), parseVersion(term[2:])) <= 0
	case strings.HasPrefix(term, "<"):
		return compareVersion(parseVersion(version), parseVersion(term[1:])) < 0
	case strings.HasPrefix(term, "=="):
		return versionEquivalent(version, term[2:])
	case strings.HasPrefix(term, "="):
		return versionEquivalent(version, term[1:])
	default:
		return versionEquivalent(version, term)
	}
}

func inCaretRange(version, base string) bool {
	v := parseVersion(version)
	lower := parseVersion(base)
	upper := lower
	if lower.parts[0] > 0 {
		upper.parts[0]++
		upper.parts[1], upper.parts[2], upper.parts[3] = 0, 0, 0
	} else if lower.parts[1] > 0 {
		upper.parts[1]++
		upper.parts[2], upper.parts[3] = 0, 0
	} else {
		upper.parts[2]++
		upper.parts[3] = 0
	}
	return compareVersion(v, lower) >= 0 && compareVersion(v, upper) < 0
}

func inTildeRange(version, base string) bool {
	v := parseVersion(version)
	lower := parseVersion(base)
	upper := lower
	if strings.Count(versionToken(base), ".") >= 2 {
		upper.parts[1]++
		upper.parts[2], upper.parts[3] = 0, 0
	} else {
		upper.parts[0]++
		upper.parts[1], upper.parts[2], upper.parts[3] = 0, 0, 0
	}
	return compareVersion(v, lower) >= 0 && compareVersion(v, upper) < 0
}

func wildcardMatch(version, term string) bool {
	v := strings.Split(canonicalVersion(version), ".")
	t := strings.Split(strings.ToLower(strings.TrimPrefix(term, "v")), ".")
	for i := 0; i < len(t) && i < len(v); i++ {
		if t[i] == "*" || t[i] == "x" {
			return true
		}
		if t[i] != v[i] {
			return false
		}
	}
	return true
}

func parseVersion(v string) semver {
	token := versionToken(v)
	if token == "" {
		return semver{}
	}
	var out semver
	out.ok = true
	lower := strings.TrimPrefix(strings.ToLower(strings.TrimSpace(v)), "v")
	out.pre = strings.ContainsAny(strings.TrimPrefix(lower, token), "-abcdefghijklmnopqrstuvwxyz")
	parts := strings.Split(token, ".")
	for i := 0; i < len(parts) && i < len(out.parts); i++ {
		n, _ := strconv.Atoi(parts[i])
		out.parts[i] = n
	}
	return out
}

func versionToken(v string) string {
	return versionTokenRe.FindString(strings.TrimPrefix(strings.ToLower(v), "v"))
}

func compareVersion(a, b semver) int {
	for i := range a.parts {
		if a.parts[i] > b.parts[i] {
			return 1
		}
		if a.parts[i] < b.parts[i] {
			return -1
		}
	}
	if a.pre == b.pre {
		return 0
	}
	if a.pre {
		return -1
	}
	return 1
}

func repoFromVersion(v packagistVersion) string {
	candidates := []string{v.Source.URL, v.Support["source"], v.Homepage}
	for _, candidate := range candidates {
		if repo := githubRepo(candidate); repo != "" {
			return repo
		}
	}
	return ""
}

func githubRepo(raw string) string {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return ""
	}
	raw = strings.TrimSuffix(raw, ".git")
	raw = strings.TrimPrefix(raw, "git@github.com:")
	raw = strings.TrimPrefix(raw, "ssh://git@github.com/")
	if strings.HasPrefix(raw, "http://") || strings.HasPrefix(raw, "https://") {
		u, err := url.Parse(raw)
		if err != nil || !strings.EqualFold(u.Host, "github.com") {
			return ""
		}
		raw = strings.TrimPrefix(u.Path, "/")
	} else {
		raw = strings.TrimPrefix(raw, "github.com/")
	}
	parts := strings.Split(raw, "/")
	if len(parts) < 2 || parts[0] == "" || parts[1] == "" {
		return ""
	}
	repo := strings.TrimSuffix(parts[1], ".git")
	return "github.com/" + parts[0] + "/" + repo
}
