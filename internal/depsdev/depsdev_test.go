package depsdev

import (
	"context"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestBaseDefaultsToStableV3(t *testing.T) {
	c := &Client{}
	if got := c.base(); got != "https://api.deps.dev/v3" {
		t.Fatalf("base()=%q want stable v3", got)
	}
}

func TestBasePreservesExplicitAPIVersion(t *testing.T) {
	cases := map[string]string{
		"https://api.deps.dev":         "https://api.deps.dev/v3",
		"https://api.deps.dev/v3":      "https://api.deps.dev/v3",
		"https://api.deps.dev/v3alpha": "https://api.deps.dev/v3alpha",
	}
	for in, want := range cases {
		c := &Client{BaseURL: in}
		if got := c.base(); got != want {
			t.Fatalf("base(%q)=%q want %q", in, got, want)
		}
	}
}

func TestRequirementsFallbackForGo(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.EscapedPath() {
		case "/v3/systems/GO/packages/github.com%2Fstretchr%2Ftestify/versions/v1.8.2:dependencies":
			http.NotFound(w, r)
		case "/v3/systems/GO/packages/github.com%2Fstretchr%2Ftestify/versions/v1.8.2:requirements":
			w.Write([]byte(`{"go":{"directDependencies":[{"name":"github.com/davecgh/go-spew","requirement":"v1.1.1"}],"indirectDependencies":[]}}`))
		case "/v3/systems/GO/packages/github.com%2Fstretchr%2Ftestify/versions/v1.8.2":
			w.Write([]byte(`{"relatedProjects":[{"projectKey":{"id":"github.com/stretchr/testify"},"relationType":"SOURCE_REPO"}]}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.EscapedPath())
		}
	}))
	defer server.Close()

	client := &Client{BaseURL: server.URL}
	got, repo, err := client.GetDependencies(context.Background(), "go", "github.com/stretchr/testify", "v1.8.2")
	if err != nil {
		t.Fatalf("GetDependencies returned error: %v", err)
	}
	deps := got["dependencies"].(map[string]interface{})
	if deps["github.com/davecgh/go-spew"] != "v1.1.1" {
		t.Fatalf("unexpected deps: %v", deps)
	}
	if repo != "github.com/stretchr/testify" {
		t.Fatalf("repo=%q", repo)
	}
}

func TestRequirementsFallbackForNuGetDedupesGroups(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.EscapedPath() {
		case "/v3/systems/NUGET/packages/Newtonsoft.Json/versions/13.0.3:dependencies":
			http.NotFound(w, r)
		case "/v3/systems/NUGET/packages/Newtonsoft.Json/versions/13.0.3:requirements":
			w.Write([]byte(`{"nuget":{"dependencyGroups":[{"dependencies":[{"name":"microsoft.csharp","requirement":"4.3.0"}]},{"dependencies":[{"name":"microsoft.csharp","requirement":"4.3.0"},{"name":"system.xml.xmldocument","requirement":"4.3.0"}]}]}}`))
		case "/v3/systems/NUGET/packages/Newtonsoft.Json/versions/13.0.3":
			w.Write([]byte(`{"links":[{"label":"SOURCE_REPO","url":"https://github.com/JamesNK/Newtonsoft.Json.git"}]}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.EscapedPath())
		}
	}))
	defer server.Close()

	client := &Client{BaseURL: server.URL}
	got, repo, err := client.GetDependencies(context.Background(), "nuget", "Newtonsoft.Json", "13.0.3")
	if err != nil {
		t.Fatalf("GetDependencies returned error: %v", err)
	}
	deps := got["dependencies"].(map[string]interface{})
	if len(deps) != 2 || deps["microsoft.csharp"] != "4.3.0" || deps["system.xml.xmldocument"] != "4.3.0" {
		t.Fatalf("unexpected deps: %v", deps)
	}
	if repo != "github.com/JamesNK/Newtonsoft.Json" {
		t.Fatalf("repo=%q", repo)
	}
}

func TestGetDependenciesSkipsRootSelfEdge(t *testing.T) {
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		switch r.URL.EscapedPath() {
		case "/v3/systems/NPM/packages/react/versions/1.0.0:dependencies":
			w.Write([]byte(`{"nodes":[{"versionKey":{"system":"NPM","name":"react","version":"1.0.0"}}],"edges":[{"fromNode":0,"toNode":0,"requirement":"1.0.0"}]}`))
		case "/v3/systems/NPM/packages/react/versions/1.0.0":
			w.Write([]byte(`{}`))
		default:
			t.Fatalf("unexpected path %s", r.URL.EscapedPath())
		}
	}))
	defer server.Close()

	client := &Client{BaseURL: server.URL}
	got, _, err := client.GetDependencies(context.Background(), "npm", "react", "1.0.0")
	if err != nil {
		t.Fatalf("GetDependencies returned error: %v", err)
	}
	deps := got["dependencies"].(map[string]interface{})
	if len(deps) != 0 {
		t.Fatalf("dependencies=%v, want empty after self-edge filtering", deps)
	}
}
