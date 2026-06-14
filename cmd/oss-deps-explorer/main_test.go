package main

import (
	"context"
	"net/http"
	"net/url"
	"reflect"
	"testing"
)

type fakeManager struct {
	deps     map[string]map[string]interface{}
	repo     map[string]string
	err      map[string]error
	resolved map[string]string
}

func (f *fakeManager) Dependencies(ctx context.Context, ns, name, version string) (map[string]interface{}, string, error) {
	key := ns + ":" + name + ":" + version
	if e, ok := f.err[key]; ok {
		return nil, "", e
	}
	repo := f.repo[key]
	if d, ok := f.deps[key]; ok {
		out := make(map[string]interface{})
		for k, v := range d {
			out[k] = v
		}
		res := map[string]interface{}{"dependencies": out}
		if f.resolved != nil && f.resolved[key] != "" {
			res["resolved_version"] = f.resolved[key]
		}
		return res, repo, nil
	}
	return map[string]interface{}{"dependencies": map[string]interface{}{}}, repo, nil
}

func TestValidateName(t *testing.T) {
	cases := []struct {
		name string
		err  bool
	}{
		{"express", false},
		{"pkg", false},
		{"@scope", false},
		{"", true},
		{"bad name", true},
		{"name%", true},
	}
	for _, c := range cases {
		err := validateName(c.name)
		if c.err && err == nil {
			t.Errorf("validateName(%q) expected error", c.name)
		}
		if !c.err && err != nil {
			t.Errorf("validateName(%q) unexpected error: %v", c.name, err)
		}
	}
}

func TestNormalizeVersion(t *testing.T) {
	cases := map[string]string{
		"1.2.3":    "1.2.3",
		"v1.2.3":   "1.2.3",
		"1+meta":   "1",
		"foo1.2.3": "1.2.3",
		"":         "",
	}
	for in, expect := range cases {
		if got := normalizeVersion(in); got != expect {
			t.Errorf("normalizeVersion(%q)=%q want %q", in, got, expect)
		}
	}
}

func TestDependencyVersion(t *testing.T) {
	if got := dependencyVersion("go", "v1.2.3"); got != "v1.2.3" {
		t.Fatalf("go dependency version=%q", got)
	}
	if got := dependencyVersion("composer", "^2.0 || ^3.0"); got != "^2.0 || ^3.0" {
		t.Fatalf("composer dependency version=%q", got)
	}
	if got := dependencyVersion("rubygems", "= 7.0.0"); got != "7.0.0" {
		t.Fatalf("rubygems dependency version=%q", got)
	}
}

func TestSortVersionStrings(t *testing.T) {
	versions := []string{"9.0.2-beta2", "13.0.4", "2.34.2", "2.9.2"}
	sortVersionStrings(versions)
	if versions[0] != "13.0.4" || versions[1] != "9.0.2-beta2" {
		t.Fatalf("unexpected sort order: %v", versions)
	}
}

func TestSplitDep(t *testing.T) {
	cases := []struct {
		dep  string
		ns   string
		name string
	}{
		{"@scope/pkg", "@scope", "pkg"},
		{"group:artifact", "group", "artifact"},
		{"github.com/pkg/errors", "github.com", "pkg/errors"},
		{"left", "", "left"},
	}
	for _, c := range cases {
		ns, name := splitDep(c.dep)
		if ns != c.ns || name != c.name {
			t.Errorf("splitDep(%q)=(%q,%q) want (%q,%q)", c.dep, ns, name, c.ns, c.name)
		}
	}
}

func TestQueryBool(t *testing.T) {
	req := &http.Request{URL: &url.URL{}}
	if queryBool(req, "x", true) != true {
		t.Error("default true failed")
	}
	req.URL.RawQuery = "x=false"
	if queryBool(req, "x", true) != false {
		t.Error("parse false failed")
	}
	req.URL.RawQuery = "x=invalid"
	if queryBool(req, "x", true) != true {
		t.Error("invalid value should return default")
	}
}

func TestFormatPackage(t *testing.T) {
	if formatPackage("npm", "@s", "pkg") != "@s/pkg" {
		t.Error("npm with ns failed")
	}
	if formatPackage("maven", "g", "a") != "g:a" {
		t.Error("maven with ns failed")
	}
	if formatPackage("go", "github.com", "mux") != "github.com/mux" {
		t.Error("go with ns failed")
	}
	if formatPackage("npm", "", "pkg") != "pkg" {
		t.Error("npm without ns failed")
	}
}

func TestDepsToDot(t *testing.T) {
	deps := map[string]interface{}{"b": "1", "c": "2"}
	got := depsToDot("a", deps)
	expect := "digraph deps {\n    \"a\" -> \"b\"\n    \"a\" -> \"c\"\n}\n"
	if got != expect {
		t.Errorf("depsToDot output mismatch\n got:%s\n want:%s", got, expect)
	}
}

func TestCollectVulnerabilitiesMarksUnsupportedEcosystem(t *testing.T) {
	res := collectVulnerabilities(
		context.Background(),
		"unknown-manager",
		"",
		"root",
		"1.0.0",
		map[string]interface{}{"dep": "2.0.0"},
		nil,
		0,
	)
	if len(res.Vulnerabilities) != 0 {
		t.Fatalf("unsupported ecosystem should not return vulnerability hits: %v", res.Vulnerabilities)
	}
	for _, pkg := range []string{"root", "dep"} {
		status, ok := res.Status[pkg]
		if !ok {
			t.Fatalf("missing OSV status for %s", pkg)
		}
		if status.Status != "not_checked" || status.Checked {
			t.Fatalf("status for %s = %+v, want not_checked and unchecked", pkg, status)
		}
	}
}

func TestFetchAllDeps(t *testing.T) {
	f := &fakeManager{deps: map[string]map[string]interface{}{
		":root:1": {"dep1": "1", "dep2": "2"},
		":dep1:1": {"dep3": "3"},
		":dep2:2": {},
		":dep3:3": {"dep1": "1"},
	}, repo: map[string]string{
		":root:1": "github.com/root/root",
		":dep1:1": "github.com/dep1/dep1",
		":dep3:3": "github.com/dep3/dep3",
	}}
	ctx := context.Background()
	res, parents, errs, err := fetchAllDeps(ctx, f, "", "root", "1", true, map[string]struct{}{}, "", "npm", nil, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Fatalf("unexpected errs: %v", errs)
	}
	depMap := res["dependencies"].(map[string]interface{})
	repoMap := res["repositories"].(map[string]string)
	if len(depMap) != 3 {
		t.Errorf("expected 3 deps got %d", len(depMap))
	}
	if !reflect.DeepEqual(parents["dep1"], []string{"", "dep3"}) ||
		!reflect.DeepEqual(parents["dep2"], []string{""}) ||
		!reflect.DeepEqual(parents["dep3"], []string{"dep1"}) {
		t.Errorf("parents map incorrect: %v", parents)
	}
	if repoMap["root"] != "github.com/root/root" || repoMap["dep1"] != "github.com/dep1/dep1" || repoMap["dep3"] != "github.com/dep3/dep3" {
		t.Errorf("repository map incorrect: %v", repoMap)
	}
}

func TestFetchAllDepsUsesResolvedDependencyVersions(t *testing.T) {
	f := &fakeManager{
		deps: map[string]map[string]interface{}{
			":root:canary": {"dep": "canary"},
			":dep:canary":  {"leaf": "1.0.0"},
			":leaf:1.0.0":  {},
		},
		resolved: map[string]string{
			":root:canary": "2.0.0-canary-a1b2c3d4-20260101",
			":dep:canary":  "1.5.0-canary-a1b2c3d4-20260101",
		},
	}
	ctx := context.Background()
	res, _, errs, err := fetchAllDeps(ctx, f, "", "root", "canary", true, map[string]struct{}{}, "", "npm", nil, 0)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if len(errs) != 0 {
		t.Fatalf("unexpected errs: %v", errs)
	}
	if got := res["resolved_version"]; got != "2.0.0-canary-a1b2c3d4-20260101" {
		t.Fatalf("root resolved_version=%v", got)
	}
	depMap := res["dependencies"].(map[string]interface{})
	if got := depMap["dep"]; got != "1.5.0-canary-a1b2c3d4-20260101" {
		t.Fatalf("dep version=%v, want resolved canary", got)
	}
}

func TestCacheKey(t *testing.T) {
	k1 := cacheKey("npm", "", "pkg", "1.0.0", false, false, false)
	k2 := cacheKey("npm", "", "pkg", "1.0.0", true, false, false)
	if k1 == k2 {
		t.Errorf("cache key should differ for recursive queries")
	}
	p1 := purlCacheKey("pkg:npm/pkg@1.0.0", false, false, false, false)
	p2 := purlCacheKey("pkg:npm/pkg@1.0.0", true, false, false, false)
	if p1 == p2 {
		t.Errorf("purl cache key should differ for recursive queries")
	}
	p3 := purlCacheKey("pkg:npm/pkg@1.0.0", false, false, false, true)
	if p1 == p3 {
		t.Errorf("purl cache key should differ for graph queries")
	}
}
