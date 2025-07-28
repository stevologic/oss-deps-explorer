package pypi

import (
	"context"
	"regexp"
	"strings"

	"github.com/example/oss-deps-explorer/internal/depsdev"
	"golang.org/x/mod/semver"
)

// PyPI implements manager.Manager using the deps.dev API.
type PyPI struct {
	BaseURL string
}

// Dependencies fetches dependency data from deps.dev.
func (p *PyPI) Dependencies(ctx context.Context, namespace, name, version string) (map[string]interface{}, string, error) {
	client := &depsdev.Client{BaseURL: p.BaseURL}
	// namespace is unused for PyPI
	return client.GetDependencies(ctx, "pypi", name, version)
}

// The functions below are retained for compatibility with existing tests.
// They parse dependency requirement strings used by PyPI metadata.

var versionPat = regexp.MustCompile(`[0-9]+[0-9A-Za-z.\-]*`)

// parseRequirement extracts the package name and lowest version from a PyPI
// Requires-Dist entry. Environment markers and extras are ignored.
func parseRequirement(req string) (string, string) {
	if i := strings.Index(req, ";"); i >= 0 {
		req = strings.TrimSpace(req[:i])
	}
	name := strings.TrimSpace(req)
	if i := strings.Index(name, "["); i >= 0 {
		name = strings.TrimSpace(name[:i])
	}
	verSpec := ""
	if i := strings.IndexAny(req, " (<>=!~"); i >= 0 {
		name = strings.TrimSpace(req[:i])
		verSpec = strings.TrimSpace(req[i:])
	}
	if i := strings.Index(verSpec, "("); i >= 0 {
		if j := strings.Index(verSpec, ")"); j > i {
			verSpec = verSpec[i+1 : j]
		}
	}
	minVer := ""
	for _, part := range strings.Split(verSpec, ",") {
		part = strings.TrimSpace(part)
		if strings.HasPrefix(part, "!=") {
			continue
		}
		m := versionPat.FindString(part)
		if m == "" {
			continue
		}
		if minVer == "" || versionLess(m, minVer) {
			minVer = m
		}
	}
	return name, minVer
}

func versionLess(a, b string) bool {
	va := "v" + a
	vb := "v" + b
	if semver.IsValid(va) && semver.IsValid(vb) {
		return semver.Compare(va, vb) < 0
	}
	return strings.Compare(a, b) < 0
}
