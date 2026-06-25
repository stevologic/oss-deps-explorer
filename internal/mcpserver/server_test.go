package mcpserver

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"strings"
	"testing"
)

type fakeExplorerClient struct {
	suggestions []PackageSuggestion
	versions    *VersionInfo
	lookup      *LookupResponse
	repo        map[string]interface{}
	lastLookup  LookupQuery
}

func (f *fakeExplorerClient) SearchPackages(ctx context.Context, manager, query string) ([]PackageSuggestion, error) {
	return f.suggestions, nil
}

func (f *fakeExplorerClient) Versions(ctx context.Context, manager, namespace, name string) (*VersionInfo, error) {
	if f.versions == nil {
		return &VersionInfo{Name: name, Latest: "1.0.0", Versions: []string{"1.0.0"}}, nil
	}
	return f.versions, nil
}

func (f *fakeExplorerClient) Lookup(ctx context.Context, query LookupQuery) (*LookupResponse, error) {
	f.lastLookup = query
	if f.lookup == nil {
		return &LookupResponse{}, nil
	}
	f.lookup.ensureMaps()
	return f.lookup, nil
}

func (f *fakeExplorerClient) RepoMetadata(ctx context.Context, repo string) (map[string]interface{}, error) {
	if f.repo == nil {
		return map[string]interface{}{}, nil
	}
	return f.repo, nil
}

func TestServeInitializeAndToolsList(t *testing.T) {
	server := New(&fakeExplorerClient{})
	input := strings.Join([]string{
		`{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}`,
		`{"jsonrpc":"2.0","method":"notifications/initialized","params":{}}`,
		`{"jsonrpc":"2.0","id":"tools","method":"tools/list","params":{}}`,
	}, "\n") + "\n"

	var out bytes.Buffer
	if err := server.Serve(context.Background(), strings.NewReader(input), &out); err != nil {
		t.Fatalf("Serve returned error: %v", err)
	}

	msgs := decodeRPCMessages(t, out.String())
	if len(msgs) != 2 {
		t.Fatalf("got %d responses, want 2: %s", len(msgs), out.String())
	}
	initResult := msgs[0]["result"].(map[string]interface{})
	if got := initResult["protocolVersion"]; got != protocolVersion {
		t.Fatalf("protocolVersion=%v want %s", got, protocolVersion)
	}
	toolsResult := msgs[1]["result"].(map[string]interface{})
	tools := toolsResult["tools"].([]interface{})
	if len(tools) != 4 {
		t.Fatalf("tool count=%d want 4", len(tools))
	}
}

func TestResearchDependenciesSummarizesTransitiveVulnerabilities(t *testing.T) {
	client := &fakeExplorerClient{
		lookup: sampleLookup(),
	}
	server := New(client)
	raw := json.RawMessage(`{
		"manager":"npm",
		"name":"root",
		"version":"1.2.3",
		"recursive":true,
		"vulnerabilities":true,
		"scorecard":true
	}`)

	result, err := server.callTool(context.Background(), "research_dependencies", raw)
	if err != nil {
		t.Fatalf("callTool returned error: %v", err)
	}
	if !client.lastLookup.Recursive || !client.lastLookup.Vulnerabilities || !client.lastLookup.Scorecard {
		t.Fatalf("lookup flags not propagated: %+v", client.lastLookup)
	}
	summary := result["summary"].(map[string]interface{})
	if got := summary["total_packages"]; got != 3 {
		t.Fatalf("total_packages=%v want 3", got)
	}
	if got := summary["vulnerable_packages"]; got != 1 {
		t.Fatalf("vulnerable_packages=%v want 1", got)
	}
	findings := result["vulnerable_packages"].([]VulnerabilityFinding)
	if len(findings) != 1 {
		t.Fatalf("findings=%d want 1", len(findings))
	}
	if findings[0].Package != "leaf" || findings[0].HighestSeverity != "high" {
		t.Fatalf("unexpected finding: %+v", findings[0])
	}
	if len(findings[0].PathsToRoot) == 0 || findings[0].PathsToRoot[0] != "root -> dep -> leaf" {
		t.Fatalf("unexpected paths: %+v", findings[0].PathsToRoot)
	}
}

func TestPlanVulnerabilityRemediationUsesFixedVersions(t *testing.T) {
	client := &fakeExplorerClient{
		versions: &VersionInfo{Name: "root", Latest: "2.0.0", Versions: []string{"2.0.0", "1.2.3"}},
		lookup:   sampleLookup(),
	}
	server := New(client)
	raw := json.RawMessage(`{
		"manager":"npm",
		"name":"root",
		"current_version":"1.2.3",
		"include_transitive":true
	}`)

	result, err := server.callTool(context.Background(), "plan_vulnerability_remediation", raw)
	if err != nil {
		t.Fatalf("callTool returned error: %v", err)
	}
	actions := result["actions"].([]RemediationAction)
	if len(actions) != 1 {
		t.Fatalf("actions=%d want 1", len(actions))
	}
	if actions[0].Package != "leaf" {
		t.Fatalf("action package=%s want leaf", actions[0].Package)
	}
	if len(actions[0].FixedVersions) != 1 || actions[0].FixedVersions[0] != "0.1.1" {
		t.Fatalf("fixed versions=%v want [0.1.1]", actions[0].FixedVersions)
	}
	if len(actions[0].Commands) == 0 || !strings.Contains(actions[0].Commands[0], "npm why leaf") {
		t.Fatalf("expected npm transitive command, got %v", actions[0].Commands)
	}
}

func sampleLookup() *LookupResponse {
	return &LookupResponse{
		Dependencies: map[string]interface{}{
			"dep":  "1.0.0",
			"leaf": "0.1.0",
		},
		Parents: map[string][]string{
			"dep":  {""},
			"leaf": {"dep"},
		},
		Repositories: map[string]string{
			"root": "github.com/example/root",
			"dep":  "github.com/example/dep",
		},
		ResolvedVersion: "1.2.3",
		Vulnerabilities: map[string][]map[string]interface{}{
			"leaf": {
				{
					"id":      "GHSA-leaf",
					"aliases": []interface{}{"CVE-2026-0001"},
					"summary": "leaf allows unsafe input handling",
					"database_specific": map[string]interface{}{
						"severity": "HIGH",
					},
					"affected": []interface{}{
						map[string]interface{}{
							"ranges": []interface{}{
								map[string]interface{}{
									"events": []interface{}{
										map[string]interface{}{"introduced": "0"},
										map[string]interface{}{"fixed": "0.1.1"},
									},
								},
							},
						},
					},
				},
			},
		},
		VulnerabilityStatus: map[string]VulnerabilityStatus{
			"root": {Status: "no_advisory", Checked: true},
			"dep":  {Status: "no_advisory", Checked: true},
			"leaf": {Status: "vulnerable", Checked: true, AdvisoryCount: 1},
		},
		Scorecards: map[string]map[string]interface{}{
			"root": {
				"score": 8.2,
				"checks": []interface{}{
					map[string]interface{}{"name": "Maintained", "score": 10.0, "reason": "recent activity"},
					map[string]interface{}{"name": "Pinned-Dependencies", "score": 4.0, "reason": "some dependencies are not pinned"},
				},
			},
		},
	}
}

func decodeRPCMessages(t *testing.T, output string) []map[string]interface{} {
	t.Helper()
	var msgs []map[string]interface{}
	scanner := bufio.NewScanner(strings.NewReader(output))
	for scanner.Scan() {
		var msg map[string]interface{}
		if err := json.Unmarshal(scanner.Bytes(), &msg); err != nil {
			t.Fatalf("invalid JSON-RPC response %q: %v", scanner.Text(), err)
		}
		msgs = append(msgs, msg)
	}
	if err := scanner.Err(); err != nil {
		t.Fatalf("scanner error: %v", err)
	}
	return msgs
}
