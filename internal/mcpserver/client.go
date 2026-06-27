package mcpserver

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strconv"
	"strings"
	"time"
)

const DefaultAPIBase = "http://localhost:8080"

var SupportedManagers = []string{
	"npm",
	"pypi",
	"go",
	"maven",
	"cargo",
	"rubygems",
	"nuget",
	"composer",
}

var supportedManagerSet = func() map[string]struct{} {
	out := make(map[string]struct{}, len(SupportedManagers))
	for _, manager := range SupportedManagers {
		out[manager] = struct{}{}
	}
	return out
}()

type ExplorerClient interface {
	SearchPackages(ctx context.Context, manager, query string) ([]PackageSuggestion, error)
	Versions(ctx context.Context, manager, namespace, name string) (*VersionInfo, error)
	Lookup(ctx context.Context, query LookupQuery) (*LookupResponse, error)
	RepoMetadata(ctx context.Context, repo string) (map[string]interface{}, error)
}

type HTTPExplorerClient struct {
	BaseURL    string
	HTTPClient *http.Client
}

type LookupQuery struct {
	Manager         string
	Namespace       string
	Name            string
	Version         string
	Recursive       bool
	Vulnerabilities bool
	Scorecard       bool
}

type PackageSuggestion struct {
	Namespace string `json:"namespace,omitempty"`
	Name      string `json:"name"`
	Version   string `json:"version,omitempty"`
}

type VersionInfo struct {
	Namespace string   `json:"namespace,omitempty"`
	Name      string   `json:"name"`
	Latest    string   `json:"latest,omitempty"`
	Versions  []string `json:"versions"`
}

type VulnerabilityStatus struct {
	Status        string `json:"status"`
	Checked       bool   `json:"checked"`
	AdvisoryCount int    `json:"advisory_count"`
	Error         string `json:"error,omitempty"`
}

type LookupResponse struct {
	Dependencies        map[string]interface{}              `json:"dependencies"`
	Parents             map[string][]string                 `json:"parents"`
	Repositories        map[string]string                   `json:"repositories"`
	ResolvedVersion     string                              `json:"resolved_version"`
	Vulnerabilities     map[string][]map[string]interface{} `json:"vulnerabilities"`
	VulnerabilityStatus map[string]VulnerabilityStatus      `json:"vulnerability_status"`
	Scorecards          map[string]map[string]interface{}   `json:"scorecards"`
	Errors              []string                            `json:"errors"`
	Raw                 map[string]interface{}              `json:"-"`
}

func NewHTTPExplorerClient(baseURL string, timeout time.Duration) *HTTPExplorerClient {
	if strings.TrimSpace(baseURL) == "" {
		baseURL = DefaultAPIBase
	}
	baseURL = strings.TrimRight(baseURL, "/")
	if timeout <= 0 {
		timeout = 30 * time.Second
	}
	return &HTTPExplorerClient{
		BaseURL: baseURL,
		HTTPClient: &http.Client{
			Timeout: timeout,
		},
	}
}

func (c *HTTPExplorerClient) SearchPackages(ctx context.Context, manager, query string) ([]PackageSuggestion, error) {
	data, err := c.get(ctx, "/api/suggest/"+url.PathEscape(manager)+"/"+url.PathEscape(query), nil)
	if err != nil {
		return nil, err
	}
	var out []PackageSuggestion
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *HTTPExplorerClient) Versions(ctx context.Context, manager, namespace, name string) (*VersionInfo, error) {
	q := url.Values{}
	q.Set("manager", manager)
	q.Set("name", name)
	if namespace != "" {
		q.Set("namespace", namespace)
	}
	data, err := c.get(ctx, "/api/versions", q)
	if err != nil {
		return nil, err
	}
	var out VersionInfo
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return &out, nil
}

func (c *HTTPExplorerClient) Lookup(ctx context.Context, query LookupQuery) (*LookupResponse, error) {
	q := url.Values{}
	q.Set("manager", query.Manager)
	q.Set("name", query.Name)
	q.Set("version", query.Version)
	q.Set("recursive", strconv.FormatBool(query.Recursive))
	q.Set("vuln", strconv.FormatBool(query.Vulnerabilities))
	q.Set("scorecard", strconv.FormatBool(query.Scorecard))
	if query.Namespace != "" {
		q.Set("namespace", query.Namespace)
	}
	data, err := c.get(ctx, "/api/lookup", q)
	if err != nil {
		return nil, err
	}
	var out LookupResponse
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err == nil {
		out.Raw = raw
	}
	out.ensureMaps()
	return &out, nil
}

func (c *HTTPExplorerClient) RepoMetadata(ctx context.Context, repo string) (map[string]interface{}, error) {
	data, err := c.get(ctx, "/api/repo/"+url.PathEscape(repo), nil)
	if err != nil {
		return nil, err
	}
	var out map[string]interface{}
	if err := json.Unmarshal(data, &out); err != nil {
		return nil, err
	}
	return out, nil
}

func (c *HTTPExplorerClient) get(ctx context.Context, path string, q url.Values) ([]byte, error) {
	endpoint := c.BaseURL + path
	if len(q) > 0 {
		endpoint += "?" + q.Encode()
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("User-Agent", "oss-deps-explorer-mcp/1.0")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
		msg := strings.TrimSpace(string(body))
		if msg == "" {
			msg = http.StatusText(resp.StatusCode)
		}
		return nil, fmt.Errorf("oss-deps API %s returned %d: %s", path, resp.StatusCode, msg)
	}
	return io.ReadAll(resp.Body)
}

func (r *LookupResponse) ensureMaps() {
	if r.Dependencies == nil {
		r.Dependencies = map[string]interface{}{}
	}
	if r.Parents == nil {
		r.Parents = map[string][]string{}
	}
	if r.Repositories == nil {
		r.Repositories = map[string]string{}
	}
	if r.Vulnerabilities == nil {
		r.Vulnerabilities = map[string][]map[string]interface{}{}
	}
	if r.VulnerabilityStatus == nil {
		r.VulnerabilityStatus = map[string]VulnerabilityStatus{}
	}
	if r.Scorecards == nil {
		r.Scorecards = map[string]map[string]interface{}{}
	}
	if r.Raw == nil {
		r.Raw = map[string]interface{}{}
	}
}
