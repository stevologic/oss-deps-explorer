package npm

import (
	"encoding/json"
	"testing"
)

func TestRegistryManifestDependenciesMergesOptional(t *testing.T) {
	got := registryManifestDependencies(registryManifest{
		Dependencies: map[string]string{
			"loose-envify": "^1.1.0",
			"shared":       "^1.0.0",
		},
		OptionalDependencies: map[string]string{
			"fsevents": "^2.3.3",
			"shared":   "^2.0.0",
		},
	})

	if len(got) != 3 {
		t.Fatalf("len(deps)=%d want 3: %v", len(got), got)
	}
	if got["loose-envify"] != "^1.1.0" {
		t.Fatalf("loose-envify=%v", got["loose-envify"])
	}
	if got["fsevents"] != "^2.3.3" {
		t.Fatalf("fsevents=%v", got["fsevents"])
	}
	if got["shared"] != "^1.0.0" {
		t.Fatalf("shared=%v, direct dependency should win", got["shared"])
	}
}

func TestSelectRegistryVersion(t *testing.T) {
	pkg := registryPackage{
		DistTags: map[string]string{
			"canary": "19.3.0-canary-900ae094-20260605",
			"latest": "19.2.7",
		},
		Versions: map[string]json.RawMessage{
			"19.2.7":                          nil,
			"19.3.0-canary-900ae094-20260605": nil,
			"19.3.0-canary-03ca38e6-20260213": nil,
			"19.3.0-canary-e8c63626-20260213": nil,
		},
	}

	if got := selectRegistryVersion(pkg, "canary"); got != "19.3.0-canary-900ae094-20260605" {
		t.Fatalf("canary tag resolved to %q", got)
	}
	if got := selectRegistryVersion(pkg, "19.2.7"); got != "19.2.7" {
		t.Fatalf("exact version resolved to %q", got)
	}
	if got := selectRegistryVersion(pkg, "19.3.0-canary-e8c63262-20260213"); got != "19.3.0-canary-e8c63626-20260213" {
		t.Fatalf("near canary resolved to %q", got)
	}
}

func TestNPMRepoNormalizesGitHubURLs(t *testing.T) {
	cases := []struct {
		in   interface{}
		want string
	}{
		{"git+https://github.com/facebook/react.git", "github.com/facebook/react"},
		{"git://github.com/expressjs/express.git", "github.com/expressjs/express"},
		{"git@github.com:lodash/lodash.git", "github.com/lodash/lodash"},
		{map[string]interface{}{"url": "ssh://git@github.com/npm/cli.git"}, "github.com/npm/cli"},
		{map[string]interface{}{"url": "https://gitlab.com/example/repo.git"}, ""},
	}

	for _, tc := range cases {
		if got := npmRepo(tc.in); got != tc.want {
			t.Fatalf("npmRepo(%v)=%q want %q", tc.in, got, tc.want)
		}
	}
}
