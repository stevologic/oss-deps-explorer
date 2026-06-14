package depsdev

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/url"
	"strings"
)

// Client fetches dependency data from the deps.dev API.
type Client struct {
	// BaseURL is the API base URL, defaulting to https://api.deps.dev.
	BaseURL string
}

// StatusError reports a non-200 response from the deps.dev API.
type StatusError struct {
	Code int
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("deps.dev returned status %d", e.Code)
}

func (c *Client) base() string {
	base := c.BaseURL
	if base == "" {
		base = "https://api.deps.dev"
	}
	base = strings.TrimSuffix(base, "/")
	if !strings.HasSuffix(base, "/v3") && !strings.HasSuffix(base, "/v3alpha") {
		base += "/v3"
	}
	return base
}

type versionKey struct {
	System  string `json:"system"`
	Name    string `json:"name"`
	Version string `json:"version"`
}

type depNode struct {
	VersionKey versionKey `json:"versionKey"`
	Errors     []string   `json:"errors"`
}

type depEdge struct {
	FromNode    int    `json:"fromNode"`
	ToNode      int    `json:"toNode"`
	Requirement string `json:"requirement"`
}

// dependenciesResponse models the GetDependencies response.
type dependenciesResponse struct {
	Nodes []depNode `json:"nodes"`
	Edges []depEdge `json:"edges"`
	Error string    `json:"error"`
}

type versionResponse struct {
	RelatedProjects []struct {
		ProjectKey struct {
			ID string `json:"id"`
		} `json:"projectKey"`
		RelationType string `json:"relationType"`
	} `json:"relatedProjects"`
	Links []struct {
		Label string `json:"label"`
		URL   string `json:"url"`
	} `json:"links"`
}

type requirement struct {
	Name        string `json:"name"`
	Requirement string `json:"requirement"`
}

type requirementsResponse struct {
	Go struct {
		DirectDependencies   []requirement `json:"directDependencies"`
		IndirectDependencies []requirement `json:"indirectDependencies"`
	} `json:"go"`
	RubyGems struct {
		RuntimeDependencies []requirement `json:"runtimeDependencies"`
	} `json:"rubygems"`
	NuGet struct {
		DependencyGroups []struct {
			Dependencies []requirement `json:"dependencies"`
		} `json:"dependencyGroups"`
	} `json:"nuget"`
}

// GetDependencies retrieves dependency data and a repository URL for the package.
func (c *Client) GetDependencies(ctx context.Context, system, pkg, version string) (map[string]interface{}, string, error) {
	base := c.base()
	sys := canonicalSystem(system)
	depURL := fmt.Sprintf("%s/systems/%s/packages/%s/versions/%s:dependencies", base, url.PathEscape(sys), url.PathEscape(pkg), url.PathEscape(version))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, depURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		if resp.StatusCode == http.StatusNotFound && usesRequirements(sys) {
			deps, repo, reqErr := c.getRequirements(ctx, base, sys, pkg, version)
			if reqErr == nil {
				return deps, repo, nil
			}
		}
		return nil, "", &StatusError{Code: resp.StatusCode}
	}
	var dres dependenciesResponse
	if err := json.NewDecoder(resp.Body).Decode(&dres); err != nil {
		return nil, "", err
	}
	deps := make(map[string]interface{})
	for _, e := range dres.Edges {
		if e.FromNode != 0 || e.ToNode < 0 || e.ToNode >= len(dres.Nodes) {
			continue
		}
		node := dres.Nodes[e.ToNode]
		if node.VersionKey.Name == pkg && node.VersionKey.Version == version {
			continue
		}
		deps[node.VersionKey.Name] = node.VersionKey.Version
	}

	repo := ""
	verURL := fmt.Sprintf("%s/systems/%s/packages/%s/versions/%s", base, url.PathEscape(sys), url.PathEscape(pkg), url.PathEscape(version))
	if req, err := http.NewRequestWithContext(ctx, http.MethodGet, verURL, nil); err == nil {
		if r, err := http.DefaultClient.Do(req); err == nil {
			defer r.Body.Close()
			if r.StatusCode == http.StatusOK {
				var vres versionResponse
				if json.NewDecoder(r.Body).Decode(&vres) == nil {
					for _, p := range vres.RelatedProjects {
						if strings.ToUpper(p.RelationType) == "SOURCE_REPO" {
							repo = p.ProjectKey.ID
							break
						}
					}
					if repo == "" {
						repo = repoFromLinks(vres.Links)
					}
				}
			}
		}
	}

	return map[string]interface{}{"dependencies": deps}, repo, nil
}

func (c *Client) getRequirements(ctx context.Context, base, system, pkg, version string) (map[string]interface{}, string, error) {
	reqURL := fmt.Sprintf("%s/systems/%s/packages/%s/versions/%s:requirements", base, url.PathEscape(system), url.PathEscape(pkg), url.PathEscape(version))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, reqURL, nil)
	if err != nil {
		return nil, "", err
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, "", &StatusError{Code: resp.StatusCode}
	}
	var rres requirementsResponse
	if err := json.NewDecoder(resp.Body).Decode(&rres); err != nil {
		return nil, "", err
	}
	deps := make(map[string]interface{})
	switch system {
	case "GO":
		for _, dep := range rres.Go.DirectDependencies {
			deps[dep.Name] = dep.Requirement
		}
	case "RUBYGEMS":
		for _, dep := range rres.RubyGems.RuntimeDependencies {
			deps[dep.Name] = dep.Requirement
		}
	case "NUGET":
		for _, group := range rres.NuGet.DependencyGroups {
			for _, dep := range group.Dependencies {
				if _, ok := deps[dep.Name]; !ok {
					deps[dep.Name] = dep.Requirement
				}
			}
		}
	}
	repo := c.getVersionRepo(ctx, base, system, pkg, version)
	return map[string]interface{}{"dependencies": deps}, repo, nil
}

func (c *Client) getVersionRepo(ctx context.Context, base, system, pkg, version string) string {
	verURL := fmt.Sprintf("%s/systems/%s/packages/%s/versions/%s", base, url.PathEscape(system), url.PathEscape(pkg), url.PathEscape(version))
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, verURL, nil)
	if err != nil {
		return ""
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return ""
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return ""
	}
	var vres versionResponse
	if json.NewDecoder(resp.Body).Decode(&vres) != nil {
		return ""
	}
	for _, p := range vres.RelatedProjects {
		if strings.ToUpper(p.RelationType) == "SOURCE_REPO" {
			return p.ProjectKey.ID
		}
	}
	return repoFromLinks(vres.Links)
}

func canonicalSystem(system string) string {
	switch strings.ToLower(system) {
	case "go", "golang":
		return "GO"
	case "rubygems", "gem":
		return "RUBYGEMS"
	case "npm":
		return "NPM"
	case "cargo":
		return "CARGO"
	case "maven":
		return "MAVEN"
	case "pypi":
		return "PYPI"
	case "nuget":
		return "NUGET"
	default:
		return strings.ToUpper(system)
	}
}

func usesRequirements(system string) bool {
	return system == "GO" || system == "RUBYGEMS" || system == "NUGET"
}

func repoFromLinks(links []struct {
	Label string `json:"label"`
	URL   string `json:"url"`
}) string {
	for _, link := range links {
		if strings.ToUpper(link.Label) == "SOURCE_REPO" {
			if repo := githubRepo(link.URL); repo != "" {
				return repo
			}
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
	return "github.com/" + parts[0] + "/" + strings.TrimSuffix(parts[1], ".git")
}
