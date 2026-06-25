package mcpserver

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"strings"
	"time"
)

const protocolVersion = "2025-06-18"

type Server struct {
	client  ExplorerClient
	timeout time.Duration
}

type rpcError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
}

type toolCallParams struct {
	Name      string          `json:"name"`
	Arguments json.RawMessage `json:"arguments"`
}

type searchPackagesArgs struct {
	Manager string `json:"manager"`
	Query   string `json:"query"`
}

type dependencyResearchArgs struct {
	Manager         string `json:"manager"`
	Namespace       string `json:"namespace,omitempty"`
	Name            string `json:"name"`
	Version         string `json:"version,omitempty"`
	Recursive       *bool  `json:"recursive,omitempty"`
	Vulnerabilities *bool  `json:"vulnerabilities,omitempty"`
	Scorecard       *bool  `json:"scorecard,omitempty"`
	MaxPackages     int    `json:"max_packages,omitempty"`
	IncludeRaw      bool   `json:"include_raw,omitempty"`
}

type reputationArgs struct {
	Repository string `json:"repository,omitempty"`
	Manager    string `json:"manager,omitempty"`
	Namespace  string `json:"namespace,omitempty"`
	Name       string `json:"name,omitempty"`
	Version    string `json:"version,omitempty"`
	Scorecard  *bool  `json:"scorecard,omitempty"`
}

type remediationArgs struct {
	Manager           string `json:"manager"`
	Namespace         string `json:"namespace,omitempty"`
	Name              string `json:"name"`
	Version           string `json:"version,omitempty"`
	CurrentVersion    string `json:"current_version,omitempty"`
	TargetVersion     string `json:"target_version,omitempty"`
	IncludeTransitive *bool  `json:"include_transitive,omitempty"`
	Scorecard         *bool  `json:"scorecard,omitempty"`
	MaxFindings       int    `json:"max_findings,omitempty"`
}

func New(client ExplorerClient) *Server {
	return &Server{
		client:  client,
		timeout: 60 * time.Second,
	}
}

func (s *Server) SetTimeout(timeout time.Duration) {
	if timeout > 0 {
		s.timeout = timeout
	}
}

func (s *Server) Serve(ctx context.Context, in io.Reader, out io.Writer) error {
	scanner := bufio.NewScanner(in)
	scanner.Buffer(make([]byte, 1024), 16*1024*1024)
	encoder := json.NewEncoder(out)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" {
			continue
		}
		var req map[string]json.RawMessage
		if err := json.Unmarshal([]byte(line), &req); err != nil {
			writeRPCError(encoder, []byte("null"), -32700, "parse error")
			continue
		}
		id, hasID := req["id"]
		method := rawString(req["method"])
		if method == "" {
			if hasID {
				writeRPCError(encoder, id, -32600, "invalid request")
			}
			continue
		}
		if !hasID {
			s.handleNotification(method)
			continue
		}
		result, rpcErr := s.handleRequest(ctx, method, req["params"])
		if rpcErr != nil {
			writeRPCError(encoder, id, rpcErr.Code, rpcErr.Message)
			continue
		}
		writeRPCResult(encoder, id, result)
	}
	return scanner.Err()
}

func (s *Server) handleNotification(method string) {
	switch method {
	case "notifications/initialized", "notifications/cancelled", "notifications/progress":
		return
	default:
		return
	}
}

func (s *Server) handleRequest(ctx context.Context, method string, params json.RawMessage) (interface{}, *rpcError) {
	switch method {
	case "initialize":
		return initializeResult(params), nil
	case "ping":
		return map[string]interface{}{}, nil
	case "tools/list":
		return map[string]interface{}{"tools": toolDescriptors()}, nil
	case "tools/call":
		var p toolCallParams
		if len(params) == 0 {
			return nil, &rpcError{Code: -32602, Message: "missing tools/call params"}
		}
		if err := json.Unmarshal(params, &p); err != nil || p.Name == "" {
			return nil, &rpcError{Code: -32602, Message: "invalid tools/call params"}
		}
		if len(p.Arguments) == 0 {
			p.Arguments = json.RawMessage(`{}`)
		}
		callCtx, cancel := context.WithTimeout(ctx, s.timeout)
		defer cancel()
		structured, err := s.callTool(callCtx, p.Name, p.Arguments)
		if err != nil {
			return toolResult(map[string]interface{}{"error": err.Error()}, true), nil
		}
		return toolResult(structured, false), nil
	default:
		return nil, &rpcError{Code: -32601, Message: "method not found"}
	}
}

func (s *Server) callTool(ctx context.Context, name string, raw json.RawMessage) (map[string]interface{}, error) {
	switch name {
	case "search_packages":
		var args searchPackagesArgs
		if err := decodeToolArgs(raw, &args); err != nil {
			return nil, err
		}
		if err := validateManager(args.Manager); err != nil {
			return nil, err
		}
		if strings.TrimSpace(args.Query) == "" {
			return nil, fmt.Errorf("query is required")
		}
		suggestions, err := s.client.SearchPackages(ctx, args.Manager, args.Query)
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{
			"manager":     args.Manager,
			"query":       args.Query,
			"suggestions": suggestions,
		}, nil
	case "research_dependencies":
		var args dependencyResearchArgs
		if err := decodeToolArgs(raw, &args); err != nil {
			return nil, err
		}
		query, err := s.lookupQuery(ctx, args.Manager, args.Namespace, args.Name, args.Version, boolDefault(args.Recursive, true), boolDefault(args.Vulnerabilities, true), boolDefault(args.Scorecard, false))
		if err != nil {
			return nil, err
		}
		lookup, err := s.client.Lookup(ctx, query)
		if err != nil {
			return nil, err
		}
		return buildDependencyResearch(query, lookup, args.MaxPackages, args.IncludeRaw), nil
	case "assess_package_reputation":
		var args reputationArgs
		if err := decodeToolArgs(raw, &args); err != nil {
			return nil, err
		}
		return s.assessReputation(ctx, args)
	case "plan_vulnerability_remediation":
		var args remediationArgs
		if err := decodeToolArgs(raw, &args); err != nil {
			return nil, err
		}
		version := args.CurrentVersion
		if version == "" {
			version = args.Version
		}
		query, err := s.lookupQuery(ctx, args.Manager, args.Namespace, args.Name, version, boolDefault(args.IncludeTransitive, true), true, boolDefault(args.Scorecard, false))
		if err != nil {
			return nil, err
		}
		versions, err := s.client.Versions(ctx, query.Manager, query.Namespace, query.Name)
		if err != nil {
			return nil, err
		}
		lookup, err := s.client.Lookup(ctx, query)
		if err != nil {
			return nil, err
		}
		return buildRemediationPlan(query, versions, lookup, args.TargetVersion, args.MaxFindings), nil
	default:
		return nil, fmt.Errorf("unknown tool %q", name)
	}
}

func (s *Server) assessReputation(ctx context.Context, args reputationArgs) (map[string]interface{}, error) {
	if args.Repository == "" && (args.Manager == "" || args.Name == "") {
		return nil, fmt.Errorf("provide either repository or manager and name")
	}
	if args.Repository != "" && (args.Manager == "" || args.Name == "") {
		meta, err := s.client.RepoMetadata(ctx, normalizeRepo(args.Repository))
		if err != nil {
			return nil, err
		}
		return map[string]interface{}{
			"repository":          normalizeRepo(args.Repository),
			"repository_metadata": meta,
			"risk_flags":          reputationFlags(meta, nil),
			"summary": map[string]interface{}{
				"stars":       meta["stars"],
				"forks":       meta["forks"],
				"open_issues": meta["open_issues"],
				"archived":    meta["archived"],
				"license":     meta["license"],
				"last_commit": meta["last_commit"],
			},
		}, nil
	}
	query, err := s.lookupQuery(ctx, args.Manager, args.Namespace, args.Name, args.Version, false, false, boolDefault(args.Scorecard, true))
	if err != nil {
		return nil, err
	}
	lookup, err := s.client.Lookup(ctx, query)
	if err != nil {
		return nil, err
	}
	root := formatPackage(query.Manager, query.Namespace, query.Name)
	repo := normalizeRepo(args.Repository)
	if repo == "" {
		repo = normalizeRepo(lookup.Repositories[root])
	}
	meta := map[string]interface{}{}
	if repo != "" {
		meta, err = s.client.RepoMetadata(ctx, repo)
		if err != nil {
			return nil, err
		}
	}
	return buildReputationAssessment(query, lookup, repo, meta), nil
}

func (s *Server) lookupQuery(ctx context.Context, manager, namespace, name, version string, recursive, vulnerabilities, scorecard bool) (LookupQuery, error) {
	if err := validateManager(manager); err != nil {
		return LookupQuery{}, err
	}
	if strings.TrimSpace(name) == "" {
		return LookupQuery{}, fmt.Errorf("name is required")
	}
	version = strings.TrimSpace(version)
	if version == "" || strings.EqualFold(version, "latest") {
		info, err := s.client.Versions(ctx, manager, namespace, name)
		if err != nil {
			return LookupQuery{}, err
		}
		version = info.Latest
		if version == "" && len(info.Versions) > 0 {
			version = info.Versions[0]
		}
	}
	if version == "" {
		return LookupQuery{}, fmt.Errorf("version is required and latest could not be resolved")
	}
	return LookupQuery{
		Manager:         manager,
		Namespace:       namespace,
		Name:            name,
		Version:         version,
		Recursive:       recursive,
		Vulnerabilities: vulnerabilities,
		Scorecard:       scorecard,
	}, nil
}

func initializeResult(params json.RawMessage) map[string]interface{} {
	requested := ""
	if len(params) > 0 {
		var p struct {
			ProtocolVersion string `json:"protocolVersion"`
		}
		if json.Unmarshal(params, &p) == nil {
			requested = p.ProtocolVersion
		}
	}
	version := protocolVersion
	if requested == protocolVersion {
		version = requested
	}
	return map[string]interface{}{
		"protocolVersion": version,
		"capabilities": map[string]interface{}{
			"tools": map[string]interface{}{
				"listChanged": false,
			},
		},
		"serverInfo": map[string]interface{}{
			"name":    "oss-deps-explorer-mcp",
			"title":   "OSS Dependency Explorer MCP",
			"version": "0.1.0",
		},
		"instructions": "Use these read-only tools to research open-source package dependencies, vulnerability status, repository reputation, and remediation options. Start with search_packages or research_dependencies when coordinates are uncertain.",
	}
}

func toolResult(structured map[string]interface{}, isError bool) map[string]interface{} {
	data, err := json.MarshalIndent(structured, "", "  ")
	text := string(data)
	if err != nil {
		text = fmt.Sprint(structured)
	}
	return map[string]interface{}{
		"content": []map[string]interface{}{
			{
				"type": "text",
				"text": text,
			},
		},
		"structuredContent": structured,
		"isError":           isError,
	}
}

func writeRPCResult(encoder *json.Encoder, id json.RawMessage, result interface{}) {
	_ = encoder.Encode(map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      json.RawMessage(id),
		"result":  result,
	})
}

func writeRPCError(encoder *json.Encoder, id json.RawMessage, code int, message string) {
	if len(id) == 0 {
		id = []byte("null")
	}
	_ = encoder.Encode(map[string]interface{}{
		"jsonrpc": "2.0",
		"id":      json.RawMessage(id),
		"error": map[string]interface{}{
			"code":    code,
			"message": message,
		},
	})
}

func decodeToolArgs(raw json.RawMessage, target interface{}) error {
	if len(raw) == 0 {
		raw = []byte(`{}`)
	}
	if err := json.Unmarshal(raw, target); err != nil {
		return fmt.Errorf("invalid tool arguments: %w", err)
	}
	return nil
}

func validateManager(manager string) error {
	if _, ok := supportedManagerSet[manager]; !ok {
		return fmt.Errorf("unsupported package manager %q", manager)
	}
	return nil
}

func boolDefault(value *bool, def bool) bool {
	if value == nil {
		return def
	}
	return *value
}

func rawString(raw json.RawMessage) string {
	var out string
	if len(raw) == 0 || json.Unmarshal(raw, &out) != nil {
		return ""
	}
	return out
}

func normalizeRepo(repo string) string {
	repo = strings.TrimSpace(repo)
	repo = strings.TrimSuffix(repo, ".git")
	repo = strings.TrimPrefix(repo, "git@github.com:")
	repo = strings.TrimPrefix(repo, "https://github.com/")
	repo = strings.TrimPrefix(repo, "http://github.com/")
	repo = strings.TrimPrefix(repo, "github.com/")
	repo = strings.Trim(repo, "/")
	if repo == "" {
		return ""
	}
	return "github.com/" + repo
}
