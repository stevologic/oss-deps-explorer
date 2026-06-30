package main

import (
	"context"
	"io"
	"net/http"
	"net/url"
	"reflect"
	"strings"
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

type roundTripFunc func(*http.Request) (*http.Response, error)

func (f roundTripFunc) RoundTrip(req *http.Request) (*http.Response, error) {
	return f(req)
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

func TestParseGitHubRepository(t *testing.T) {
	cases := []struct {
		in    string
		owner string
		repo  string
		slug  string
	}{
		{"https://github.com/axios/axios", "axios", "axios", "axios/axios"},
		{"github.com/facebook/react.git", "facebook", "react", "facebook/react"},
		{"git@github.com:vuejs/core.git", "vuejs", "core", "vuejs/core"},
		{"owner/repo/tree/main", "owner", "repo", "owner/repo"},
	}
	for _, c := range cases {
		owner, repo, slug, err := parseGitHubRepository(c.in)
		if err != nil {
			t.Fatalf("parseGitHubRepository(%q) unexpected error: %v", c.in, err)
		}
		if owner != c.owner || repo != c.repo || slug != c.slug {
			t.Fatalf("parseGitHubRepository(%q)=(%q,%q,%q), want (%q,%q,%q)", c.in, owner, repo, slug, c.owner, c.repo, c.slug)
		}
	}
	if _, _, _, err := parseGitHubRepository("https://example.com/owner/repo"); err == nil {
		t.Fatal("expected non-GitHub URL to fail")
	}
}

func TestGitHubDependencyPackageFromPURL(t *testing.T) {
	cases := []struct {
		purl      string
		manager   string
		namespace string
		name      string
		version   string
		display   string
	}{
		{"pkg:npm/%40angular/core@18.0.0", "npm", "@angular", "core", "18.0.0", "@angular/core"},
		{"pkg:maven/org.apache.logging.log4j/log4j-core@2.17.1", "maven", "org.apache.logging.log4j", "log4j-core", "2.17.1", "org.apache.logging.log4j:log4j-core"},
		{"pkg:golang/github.com/gin-gonic/gin@v1.10.0", "go", "github.com/gin-gonic", "gin", "v1.10.0", "github.com/gin-gonic/gin"},
		{"pkg:nuget/Newtonsoft.Json@13.0.3", "nuget", "", "Newtonsoft.Json", "13.0.3", "Newtonsoft.Json"},
	}
	for _, c := range cases {
		dep, ok := githubDependencyPackageFromPURL(c.purl, "", "", "SPDXRef-Package")
		if !ok {
			t.Fatalf("githubDependencyPackageFromPURL(%q) unsupported", c.purl)
		}
		if dep.Manager != c.manager ||
			dep.Namespace != c.namespace ||
			dep.Name != c.name ||
			dep.Version != c.version ||
			dep.Display != c.display {
			t.Fatalf("githubDependencyPackageFromPURL(%q)=%+v, want manager=%q namespace=%q name=%q version=%q display=%q", c.purl, dep, c.manager, c.namespace, c.name, c.version, c.display)
		}
	}
	if _, ok := githubDependencyPackageFromPURL("pkg:github/owner/repo@v1", "", "", ""); ok {
		t.Fatal("github purl should not be presented as analyzable package")
	}
}

func TestGitHubDependencyLicense(t *testing.T) {
	cases := []struct {
		concluded string
		declared  string
		license   string
	}{
		{" MIT ", "Apache-2.0", "MIT"},
		{"NOASSERTION", "BSD-3-Clause", "BSD-3-Clause"},
		{"NONE", "NOASSERTION", ""},
		{"", "ISC", "ISC"},
	}
	for _, c := range cases {
		license, concluded, declared := githubDependencyLicense(c.concluded, c.declared)
		if license != c.license {
			t.Fatalf("githubDependencyLicense(%q,%q) license=%q want %q", c.concluded, c.declared, license, c.license)
		}
		if concluded != cleanSPDXValue(c.concluded) {
			t.Fatalf("concluded=%q want cleaned %q", concluded, cleanSPDXValue(c.concluded))
		}
		if declared != cleanSPDXValue(c.declared) {
			t.Fatalf("declared=%q want cleaned %q", declared, cleanSPDXValue(c.declared))
		}
	}
}

func TestGitHubUnsupportedDependencyFromSBOM(t *testing.T) {
	pkg := githubSBOMPackage{
		Name:             "github.com/actions/checkout",
		SPDXID:           "SPDXRef-actions-checkout",
		VersionInfo:      "v4",
		LicenseConcluded: "NOASSERTION",
		LicenseDeclared:  "MIT",
		ExternalRefs: []githubSBOMExternalRef{
			{ReferenceType: "purl", ReferenceLocator: "pkg:github/actions/checkout@v4"},
			{ReferenceType: "website", ReferenceLocator: "https://github.com/actions/checkout"},
			{ReferenceType: "purl", ReferenceLocator: "pkg:github/actions/checkout@v4"},
		},
	}
	dep := githubUnsupportedDependencyFromSBOM(pkg)
	if dep.Display != "github.com/actions/checkout" ||
		dep.Version != "v4" ||
		dep.PURL != "pkg:github/actions/checkout@v4" ||
		dep.License != "MIT" ||
		dep.LicenseDeclared != "MIT" ||
		dep.LicenseConcluded != "" {
		t.Fatalf("unexpected unsupported package: %+v", dep)
	}
	if !reflect.DeepEqual(dep.ExternalRefs, []string{"https://github.com/actions/checkout", "pkg:github/actions/checkout@v4"}) {
		t.Fatalf("external refs not deduplicated and sorted: %v", dep.ExternalRefs)
	}
}

func TestFetchGitHubDependencyGraphIncludesUnsupportedPackages(t *testing.T) {
	oldClient := http.DefaultClient
	defer func() { http.DefaultClient = oldClient }()
	http.DefaultClient = &http.Client{Transport: roundTripFunc(func(req *http.Request) (*http.Response, error) {
		if req.URL.String() != "https://api.github.com/repos/acme/project/dependency-graph/sbom" {
			t.Fatalf("unexpected GitHub API URL: %s", req.URL.String())
		}
		body := `{
			"sbom": {
				"packages": [
					{
						"name": "lodash",
						"SPDXID": "SPDXRef-lodash",
						"versionInfo": "4.17.21",
						"licenseConcluded": "MIT",
						"externalRefs": [
							{"referenceType": "purl", "referenceLocator": "pkg:npm/lodash@4.17.21"}
						]
					},
					{
						"name": "actions/checkout",
						"SPDXID": "SPDXRef-actions-checkout",
						"versionInfo": "v4",
						"licenseDeclared": "MIT",
						"externalRefs": [
							{"referenceType": "purl", "referenceLocator": "pkg:github/actions/checkout@v4"}
						]
					},
					{
						"name": "ghcr.io/acme/runtime",
						"SPDXID": "SPDXRef-container",
						"versionInfo": "sha256:abc",
						"licenseConcluded": "NOASSERTION",
						"externalRefs": [
							{"referenceType": "purl", "referenceLocator": "pkg:oci/runtime@sha256:abc"}
						]
					}
				]
			}
		}`
		return &http.Response{
			StatusCode: http.StatusOK,
			Header:     make(http.Header),
			Body:       io.NopCloser(strings.NewReader(body)),
			Request:    req,
		}, nil
	})}

	result, err := fetchGitHubDependencyGraph(context.Background(), "acme/project", nil, 0)
	if err != nil {
		t.Fatalf("fetchGitHubDependencyGraph unexpected error: %v", err)
	}
	if result.Repository != "acme/project" || result.PackageCount != 1 || len(result.Packages) != 1 {
		t.Fatalf("supported package summary mismatch: %+v", result)
	}
	if result.Packages[0].Manager != "npm" || result.Packages[0].Name != "lodash" || result.Packages[0].License != "MIT" {
		t.Fatalf("supported package mismatch: %+v", result.Packages[0])
	}
	if result.UnsupportedCount != 2 || len(result.UnsupportedPackages) != 2 {
		t.Fatalf("unsupported package summary mismatch: %+v", result)
	}
	if result.UnsupportedPackages[0].Name != "actions/checkout" ||
		result.UnsupportedPackages[0].PURL != "pkg:github/actions/checkout@v4" ||
		result.UnsupportedPackages[0].License != "MIT" {
		t.Fatalf("first unsupported package mismatch: %+v", result.UnsupportedPackages[0])
	}
	if result.UnsupportedPackages[1].Name != "ghcr.io/acme/runtime" ||
		result.UnsupportedPackages[1].PURL != "pkg:oci/runtime@sha256:abc" {
		t.Fatalf("second unsupported package mismatch: %+v", result.UnsupportedPackages[1])
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
	got := depsToDot("a", "0", deps, nil, nil, nil, nil)
	expect := "digraph deps {\n" +
		"    node [shape=box]\n" +
		"    \"a\" [label=\"a\" style=\"filled\" fillcolor=\"#ffffff\" version=\"0\"]\n" +
		"    \"b\" [label=\"b\\n1\" style=\"filled\" fillcolor=\"#ffffff\" version=\"1\"]\n" +
		"    \"c\" [label=\"c\\n2\" style=\"filled\" fillcolor=\"#ffffff\" version=\"2\"]\n" +
		"    \"a\" -> \"b\"\n" +
		"    \"a\" -> \"c\"\n" +
		"    subgraph cluster_legend {\n" +
		"        label=\"OSV status\"\n" +
		"        color=\"#cbd5e1\"\n" +
		"        style=\"rounded\"\n" +
		"        \"__legend_vulnerable\" [label=\"vulnerable\" style=\"filled\" fillcolor=\"#fecaca\"]\n" +
		"        \"__legend_no_advisory\" [label=\"no advisory\" style=\"filled\" fillcolor=\"#bbf7d0\"]\n" +
		"        \"__legend_unknown\" [label=\"unknown\" style=\"filled\" fillcolor=\"#fde68a\"]\n" +
		"        \"__legend_not_checked\" [label=\"not checked\" style=\"filled\" fillcolor=\"#e5e7eb\"]\n" +
		"    }\n" +
		"}\n"
	if got != expect {
		t.Errorf("depsToDot output mismatch\n got:%s\n want:%s", got, expect)
	}
}

func TestDepsToDotIncludesRootWhenEmpty(t *testing.T) {
	got := depsToDot("root", "1.0.0", map[string]interface{}{}, nil, map[string]string{"root": "https://github.com/acme/root"}, nil, nil)
	expect := "digraph deps {\n" +
		"    node [shape=box]\n" +
		"    \"root\" [label=\"root\" style=\"filled\" fillcolor=\"#ffffff\" version=\"1.0.0\" repository=\"https://github.com/acme/root\" URL=\"https://github.com/acme/root\"]\n" +
		"    subgraph cluster_legend {\n" +
		"        label=\"OSV status\"\n" +
		"        color=\"#cbd5e1\"\n" +
		"        style=\"rounded\"\n" +
		"        \"__legend_vulnerable\" [label=\"vulnerable\" style=\"filled\" fillcolor=\"#fecaca\"]\n" +
		"        \"__legend_no_advisory\" [label=\"no advisory\" style=\"filled\" fillcolor=\"#bbf7d0\"]\n" +
		"        \"__legend_unknown\" [label=\"unknown\" style=\"filled\" fillcolor=\"#fde68a\"]\n" +
		"        \"__legend_not_checked\" [label=\"not checked\" style=\"filled\" fillcolor=\"#e5e7eb\"]\n" +
		"    }\n" +
		"}\n"
	if got != expect {
		t.Errorf("depsToDot empty output mismatch\n got:%s\n want:%s", got, expect)
	}
}

func TestDepsToDotUsesParents(t *testing.T) {
	deps := map[string]interface{}{
		"direct":         "1",
		"shared":         "2",
		"transitive":     "3",
		`quoted"package`: "4",
	}
	parents := map[string][]string{
		"direct":         {""},
		"shared":         {"direct", "transitive"},
		"transitive":     {"direct"},
		`quoted"package`: {`parent\package`},
	}
	repos := map[string]string{
		"direct":         "https://github.com/acme/direct",
		`quoted"package`: `https://github.com/acme/quoted"package`,
	}
	got := depsToDot("root", "0", deps, parents, repos, nil, nil)
	expect := "digraph deps {\n" +
		"    node [shape=box]\n" +
		"    \"root\" [label=\"root\" style=\"filled\" fillcolor=\"#ffffff\" version=\"0\"]\n" +
		"    \"direct\" [label=\"direct\\n1\" style=\"filled\" fillcolor=\"#ffffff\" version=\"1\" repository=\"https://github.com/acme/direct\" URL=\"https://github.com/acme/direct\"]\n" +
		"    \"quoted\\\"package\" [label=\"quoted\\\"package\\n4\" style=\"filled\" fillcolor=\"#ffffff\" version=\"4\" repository=\"https://github.com/acme/quoted\\\"package\" URL=\"https://github.com/acme/quoted\\\"package\"]\n" +
		"    \"shared\" [label=\"shared\\n2\" style=\"filled\" fillcolor=\"#ffffff\" version=\"2\"]\n" +
		"    \"transitive\" [label=\"transitive\\n3\" style=\"filled\" fillcolor=\"#ffffff\" version=\"3\"]\n" +
		"    \"direct\" -> \"shared\"\n" +
		"    \"direct\" -> \"transitive\"\n" +
		"    \"parent\\\\package\" -> \"quoted\\\"package\"\n" +
		"    \"root\" -> \"direct\"\n" +
		"    \"transitive\" -> \"shared\"\n" +
		"    subgraph cluster_legend {\n" +
		"        label=\"OSV status\"\n" +
		"        color=\"#cbd5e1\"\n" +
		"        style=\"rounded\"\n" +
		"        \"__legend_vulnerable\" [label=\"vulnerable\" style=\"filled\" fillcolor=\"#fecaca\"]\n" +
		"        \"__legend_no_advisory\" [label=\"no advisory\" style=\"filled\" fillcolor=\"#bbf7d0\"]\n" +
		"        \"__legend_unknown\" [label=\"unknown\" style=\"filled\" fillcolor=\"#fde68a\"]\n" +
		"        \"__legend_not_checked\" [label=\"not checked\" style=\"filled\" fillcolor=\"#e5e7eb\"]\n" +
		"    }\n" +
		"}\n"
	if got != expect {
		t.Errorf("depsToDot parent output mismatch\n got:%s\n want:%s", got, expect)
	}
}

func TestDepsToDotIncludesSecurityAttributes(t *testing.T) {
	deps := map[string]interface{}{"dep": "1.2.3"}
	statuses := map[string]vulnerabilityStatus{
		"root": {Status: "no_advisory", Checked: true},
		"dep":  {Status: "vulnerable", Checked: true, AdvisoryCount: 2, Error: "partial OSV result"},
	}
	scorecards := map[string]interface{}{
		"root": map[string]interface{}{"score": 8.5},
		"dep":  map[string]interface{}{"scorecard": map[string]interface{}{"score": 4}},
	}
	got := depsToDot("root", "1.0.0", deps, nil, nil, statuses, scorecards)
	expect := "digraph deps {\n" +
		"    node [shape=box]\n" +
		"    \"root\" [label=\"root\" style=\"filled\" fillcolor=\"#bbf7d0\" version=\"1.0.0\" osv_status=\"no_advisory\" osv_checked=\"true\" advisory_count=\"0\" scorecard_score=\"8.5\"]\n" +
		"    \"dep\" [label=\"dep\\n1.2.3\" style=\"filled\" fillcolor=\"#fecaca\" version=\"1.2.3\" osv_status=\"vulnerable\" osv_checked=\"true\" advisory_count=\"2\" osv_error=\"partial OSV result\" scorecard_score=\"4\"]\n" +
		"    \"root\" -> \"dep\"\n" +
		"    subgraph cluster_legend {\n" +
		"        label=\"OSV status\"\n" +
		"        color=\"#cbd5e1\"\n" +
		"        style=\"rounded\"\n" +
		"        \"__legend_vulnerable\" [label=\"vulnerable\" style=\"filled\" fillcolor=\"#fecaca\"]\n" +
		"        \"__legend_no_advisory\" [label=\"no advisory\" style=\"filled\" fillcolor=\"#bbf7d0\"]\n" +
		"        \"__legend_unknown\" [label=\"unknown\" style=\"filled\" fillcolor=\"#fde68a\"]\n" +
		"        \"__legend_not_checked\" [label=\"not checked\" style=\"filled\" fillcolor=\"#e5e7eb\"]\n" +
		"    }\n" +
		"}\n"
	if got != expect {
		t.Errorf("depsToDot security attributes mismatch\n got:%s\n want:%s", got, expect)
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
	k3 := graphCacheKey(k1)
	if k1 == k3 {
		t.Errorf("graph cache key should differ from JSON dependency query")
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
