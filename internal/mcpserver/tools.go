package mcpserver

func toolDescriptors() []map[string]interface{} {
	return []map[string]interface{}{
		{
			"name":        "search_packages",
			"title":       "Search Packages",
			"description": "Search a supported package ecosystem for package coordinates before deeper analysis.",
			"inputSchema": objectSchema(
				map[string]interface{}{
					"manager": managerProperty(),
					"query": map[string]interface{}{
						"type":        "string",
						"description": "Package search text, for example react, requests, log4j-core, or Newtonsoft.Json.",
						"minLength":   1,
					},
				},
				[]string{"manager", "query"},
			),
			"annotations": readOnlyAnnotations(),
		},
		{
			"name":        "research_dependencies",
			"title":       "Research Dependencies",
			"description": "Resolve direct and transitive dependencies, OSV vulnerability status, parent paths, and optional OpenSSF Scorecard data for a package.",
			"inputSchema": objectSchema(
				map[string]interface{}{
					"manager":   managerProperty(),
					"namespace": namespaceProperty(),
					"name":      packageNameProperty(),
					"version": map[string]interface{}{
						"type":        "string",
						"description": "Package version. Use latest or omit to resolve the registry latest version.",
					},
					"recursive": map[string]interface{}{
						"type":        "boolean",
						"description": "Resolve transitive dependencies. Defaults to true.",
						"default":     true,
					},
					"vulnerabilities": map[string]interface{}{
						"type":        "boolean",
						"description": "Query OSV for the root package and resolved dependencies. Defaults to true.",
						"default":     true,
					},
					"scorecard": map[string]interface{}{
						"type":        "boolean",
						"description": "Include OpenSSF Scorecard data when repositories are known. Defaults to false to avoid extra network calls.",
						"default":     false,
					},
					"max_packages": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum dependency rows returned in the dependency list. The summary still counts the full API result.",
						"minimum":     1,
						"default":     250,
					},
					"include_raw": map[string]interface{}{
						"type":        "boolean",
						"description": "Include the raw oss-deps-explorer lookup payload for downstream tooling.",
						"default":     false,
					},
				},
				[]string{"manager", "name"},
			),
			"annotations": readOnlyAnnotations(),
		},
		{
			"name":        "assess_package_reputation",
			"title":       "Assess Package Reputation",
			"description": "Inspect GitHub repository metadata and OpenSSF Scorecard signals for a package or repository.",
			"inputSchema": objectSchema(
				map[string]interface{}{
					"repository": map[string]interface{}{
						"type":        "string",
						"description": "Optional GitHub repository as owner/repo, github.com/owner/repo, or URL. If omitted, package coordinates are used to discover the repository.",
					},
					"manager":   managerProperty(),
					"namespace": namespaceProperty(),
					"name":      packageNameProperty(),
					"version": map[string]interface{}{
						"type":        "string",
						"description": "Optional package version. Use latest or omit to resolve the registry latest version.",
					},
					"scorecard": map[string]interface{}{
						"type":        "boolean",
						"description": "Include OpenSSF Scorecard data for package-backed repositories. Defaults to true.",
						"default":     true,
					},
				},
				nil,
			),
			"annotations": readOnlyAnnotations(),
		},
		{
			"name":        "plan_vulnerability_remediation",
			"title":       "Plan Vulnerability Remediation",
			"description": "Create an agent-friendly remediation plan from OSV advisories, dependency parent paths, fixed versions, and ecosystem-specific upgrade commands.",
			"inputSchema": objectSchema(
				map[string]interface{}{
					"manager":   managerProperty(),
					"namespace": namespaceProperty(),
					"name":      packageNameProperty(),
					"current_version": map[string]interface{}{
						"type":        "string",
						"description": "Current package version under review.",
					},
					"version": map[string]interface{}{
						"type":        "string",
						"description": "Alias for current_version for clients that already use version.",
					},
					"target_version": map[string]interface{}{
						"type":        "string",
						"description": "Optional desired target version. Defaults to the latest known version for root upgrades.",
					},
					"include_transitive": map[string]interface{}{
						"type":        "boolean",
						"description": "Include transitive dependency findings and parent paths. Defaults to true.",
						"default":     true,
					},
					"scorecard": map[string]interface{}{
						"type":        "boolean",
						"description": "Also request Scorecard data during lookup. Defaults to false.",
						"default":     false,
					},
					"max_findings": map[string]interface{}{
						"type":        "integer",
						"description": "Maximum vulnerable packages to include in the action list.",
						"minimum":     1,
						"default":     250,
					},
				},
				[]string{"manager", "name"},
			),
			"annotations": readOnlyAnnotations(),
		},
	}
}

func objectSchema(properties map[string]interface{}, required []string) map[string]interface{} {
	schema := map[string]interface{}{
		"type":                 "object",
		"properties":           properties,
		"additionalProperties": false,
	}
	if len(required) > 0 {
		schema["required"] = required
	}
	return schema
}

func managerProperty() map[string]interface{} {
	return map[string]interface{}{
		"type":        "string",
		"description": "Package manager ecosystem.",
		"enum":        SupportedManagers,
	}
}

func namespaceProperty() map[string]interface{} {
	return map[string]interface{}{
		"type":        "string",
		"description": "Optional namespace such as npm scope, Maven groupId, Composer vendor, or Go module prefix.",
	}
}

func packageNameProperty() map[string]interface{} {
	return map[string]interface{}{
		"type":        "string",
		"description": "Package name or artifact name. For scoped ecosystems, use namespace separately when possible.",
		"minLength":   1,
	}
}

func readOnlyAnnotations() map[string]interface{} {
	return map[string]interface{}{
		"readOnlyHint":    true,
		"idempotentHint":  true,
		"destructiveHint": false,
		"openWorldHint":   true,
	}
}
