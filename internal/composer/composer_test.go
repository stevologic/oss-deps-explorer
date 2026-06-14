package composer

import (
	"encoding/json"
	"testing"
)

func TestSelectVersionExactAndConstraint(t *testing.T) {
	versions := []packagistVersion{
		{Version: "3.10.0", VersionNormalized: "3.10.0.0"},
		{Version: "3.5.0", VersionNormalized: "3.5.0.0"},
		{Version: "2.9.3", VersionNormalized: "2.9.3.0"},
		{Version: "2.0.0", VersionNormalized: "2.0.0.0"},
		{Version: "dev-main"},
	}

	if got := selectVersion(versions, "3.5.0"); got == nil || got.Version != "3.5.0" {
		t.Fatalf("exact version selected %v, want 3.5.0", got)
	}
	if got := selectVersion(versions, "2.0"); got == nil || got.Version != "2.0.0" {
		t.Fatalf("short exact version selected %v, want 2.0.0", got)
	}
	if got := selectVersion(versions, "^2.0 || ^3.0"); got == nil || got.Version != "3.10.0" {
		t.Fatalf("constraint selected %v, want highest stable compatible", got)
	}
	if got := selectVersion(versions, "~2.0.0"); got == nil || got.Version != "2.0.0" {
		t.Fatalf("tilde constraint selected %v, want 2.0.0", got)
	}
}

func TestPackagistVersionAllowsEmptyRequireArray(t *testing.T) {
	var v packagistVersion
	if err := json.Unmarshal([]byte(`{"version":"3.0.0","require":"legacy","source":"legacy"}`), &v); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	if v.Require != nil {
		t.Fatalf("Require=%v, want nil", v.Require)
	}
}

func TestPackagistResponseExpandsComposer2MinifiedMetadata(t *testing.T) {
	data := []byte(`{
		"minified": "composer/2.0",
		"packages": {
			"monolog/monolog": [
				{
					"version": "3.10.0",
					"version_normalized": "3.10.0.0",
					"require": {"php": ">=8.1", "psr/log": "^2.0 || ^3.0"}
				},
				{"version": "3.5.0", "version_normalized": "3.5.0.0"},
				{"version": "3.4.0", "version_normalized": "3.4.0.0", "require": "__unset"}
			]
		}
	}`)
	var out packagistResponse
	if err := json.Unmarshal(data, &out); err != nil {
		t.Fatalf("unexpected unmarshal error: %v", err)
	}
	versions := out.Packages["monolog/monolog"]
	if len(versions) != 3 {
		t.Fatalf("len(versions)=%d want 3", len(versions))
	}
	if versions[1].Require["psr/log"] != "^2.0 || ^3.0" {
		t.Fatalf("expanded require=%v", versions[1].Require)
	}
	if versions[2].Require != nil {
		t.Fatalf("unset require=%v, want nil", versions[2].Require)
	}
}

func TestPlatformRequirementsAreIgnored(t *testing.T) {
	for _, dep := range []string{"php", "ext-json", "lib-curl", "composer-runtime-api"} {
		if !isPlatformRequirement(dep) {
			t.Fatalf("%q should be treated as a platform requirement", dep)
		}
	}
	if isPlatformRequirement("psr/log") {
		t.Fatal("package requirement should not be treated as platform requirement")
	}
}

func TestGitHubRepoNormalization(t *testing.T) {
	cases := map[string]string{
		"https://github.com/Seldaek/monolog.git":         "github.com/Seldaek/monolog",
		"https://github.com/Seldaek/monolog/tree/3.10.0": "github.com/Seldaek/monolog",
		"git@github.com:Seldaek/monolog.git":             "github.com/Seldaek/monolog",
		"ssh://git@github.com/Seldaek/monolog.git":       "github.com/Seldaek/monolog",
		"https://gitlab.com/example/project":             "",
	}
	for in, want := range cases {
		if got := githubRepo(in); got != want {
			t.Fatalf("githubRepo(%q)=%q want %q", in, got, want)
		}
	}
}
