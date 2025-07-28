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
	if !strings.HasSuffix(base, "/v3alpha") {
		base += "/v3alpha"
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
}

type versionResponse struct {
	RelatedProjects []struct {
		ProjectKey struct {
			ID string `json:"id"`
		} `json:"projectKey"`
		RelationType string `json:"relationType"`
	} `json:"relatedProjects"`
}

// GetDependencies retrieves dependency data and a repository URL for the package.
func (c *Client) GetDependencies(ctx context.Context, system, pkg, version string) (map[string]interface{}, string, error) {
	base := c.base()
	depURL := fmt.Sprintf("%s/systems/%s/packages/%s/versions/%s:dependencies", base, url.PathEscape(system), url.PathEscape(pkg), url.PathEscape(version))
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
		return nil, "", &StatusError{Code: resp.StatusCode}
	}
	var dres dependenciesResponse
	if err := json.NewDecoder(resp.Body).Decode(&dres); err != nil {
		return nil, "", err
	}
	deps := make(map[string]interface{})
	for _, e := range dres.Edges {
		if e.FromNode != 0 || e.ToNode >= len(dres.Nodes) {
			continue
		}
		node := dres.Nodes[e.ToNode]
		deps[node.VersionKey.Name] = node.VersionKey.Version
	}

	repo := ""
	verURL := fmt.Sprintf("%s/systems/%s/packages/%s/versions/%s", base, url.PathEscape(system), url.PathEscape(pkg), url.PathEscape(version))
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
				}
			}
		}
	}

	return map[string]interface{}{"dependencies": deps}, repo, nil
}
