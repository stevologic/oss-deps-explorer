package mcpserver

import (
	"fmt"
	"sort"
	"strconv"
	"strings"
	"time"
)

type DependencyInsight struct {
	Package          string   `json:"package"`
	Version          string   `json:"version"`
	Relationship     string   `json:"relationship"`
	Parents          []string `json:"parents,omitempty"`
	PathsToRoot      []string `json:"paths_to_root,omitempty"`
	Repository       string   `json:"repository,omitempty"`
	OSVStatus        string   `json:"osv_status,omitempty"`
	AdvisoryCount    int      `json:"advisory_count,omitempty"`
	VulnerabilityIDs []string `json:"vulnerability_ids,omitempty"`
	HighestSeverity  string   `json:"highest_severity,omitempty"`
}

type AdvisorySummary struct {
	ID            string   `json:"id"`
	Aliases       []string `json:"aliases,omitempty"`
	Severity      string   `json:"severity,omitempty"`
	Description   string   `json:"description,omitempty"`
	FixedVersions []string `json:"fixed_versions,omitempty"`
	References    []string `json:"references,omitempty"`
}

type VulnerabilityFinding struct {
	Package          string            `json:"package"`
	Version          string            `json:"version"`
	Relationship     string            `json:"relationship"`
	Parents          []string          `json:"parents,omitempty"`
	PathsToRoot      []string          `json:"paths_to_root,omitempty"`
	AdvisoryCount    int               `json:"advisory_count"`
	HighestSeverity  string            `json:"highest_severity"`
	VulnerabilityIDs []string          `json:"vulnerability_ids"`
	Advisories       []AdvisorySummary `json:"advisories"`
}

type ScorecardSummary struct {
	Package       string                   `json:"package"`
	Repository    string                   `json:"repository,omitempty"`
	Score         *float64                 `json:"score,omitempty"`
	Date          string                   `json:"date,omitempty"`
	WeakestChecks []map[string]interface{} `json:"weakest_checks,omitempty"`
}

type RemediationAction struct {
	Package           string            `json:"package"`
	CurrentVersion    string            `json:"current_version"`
	Relationship      string            `json:"relationship"`
	HighestSeverity   string            `json:"highest_severity"`
	AdvisoryIDs       []string          `json:"advisory_ids"`
	FixedVersions     []string          `json:"fixed_versions,omitempty"`
	PathsToRoot       []string          `json:"paths_to_root,omitempty"`
	RecommendedAction string            `json:"recommended_action"`
	Commands          []string          `json:"commands,omitempty"`
	Notes             []string          `json:"notes,omitempty"`
	Advisories        []AdvisorySummary `json:"advisories,omitempty"`
}

func buildDependencyResearch(query LookupQuery, lookup *LookupResponse, maxPackages int, includeRaw bool) map[string]interface{} {
	if maxPackages <= 0 {
		maxPackages = 250
	}
	root := formatPackage(query.Manager, query.Namespace, query.Name)
	resolved := lookup.ResolvedVersion
	if resolved == "" {
		resolved = query.Version
	}
	rootStatus := lookup.VulnerabilityStatus[root]
	rootVulns := lookup.Vulnerabilities[root]
	rootInsight := DependencyInsight{
		Package:          root,
		Version:          resolved,
		Relationship:     "root",
		Repository:       lookup.Repositories[root],
		OSVStatus:        statusLabel(rootStatus, rootVulns),
		AdvisoryCount:    advisoryCount(rootStatus, rootVulns),
		VulnerabilityIDs: advisoryIdentifiers(rootVulns),
		HighestSeverity:  highestSeverity(rootVulns),
	}

	dependencies := dependencyInsights(root, lookup, maxPackages)
	findings := vulnerabilityFindings(root, resolved, lookup, maxPackages)
	scorecards := scorecardSummaries(lookup)
	summary := researchSummary(rootInsight, dependencies, findings, lookup, scorecards)

	out := map[string]interface{}{
		"coordinate":                 root,
		"manager":                    query.Manager,
		"namespace":                  query.Namespace,
		"name":                       query.Name,
		"requested_version":          query.Version,
		"resolved_version":           resolved,
		"recursive":                  query.Recursive,
		"osv_requested":              query.Vulnerabilities,
		"scorecard_requested":        query.Scorecard,
		"summary":                    summary,
		"root":                       rootInsight,
		"dependencies":               dependencies,
		"vulnerable_packages":        findings,
		"scorecards":                 scorecards,
		"errors":                     lookup.Errors,
		"dependency_results_limited": len(lookup.Dependencies) > len(dependencies),
	}
	if includeRaw {
		out["raw_lookup"] = lookup.Raw
	}
	return out
}

func dependencyInsights(root string, lookup *LookupResponse, maxPackages int) []DependencyInsight {
	names := make([]string, 0, len(lookup.Dependencies))
	for name := range lookup.Dependencies {
		names = append(names, name)
	}
	sort.Strings(names)
	if maxPackages > 0 && len(names) > maxPackages {
		names = names[:maxPackages]
	}
	out := make([]DependencyInsight, 0, len(names))
	for _, pkg := range names {
		version := fmt.Sprint(lookup.Dependencies[pkg])
		status := lookup.VulnerabilityStatus[pkg]
		vulns := lookup.Vulnerabilities[pkg]
		out = append(out, DependencyInsight{
			Package:          pkg,
			Version:          version,
			Relationship:     relationshipFor(pkg, lookup.Parents),
			Parents:          sortedStrings(lookup.Parents[pkg]),
			PathsToRoot:      pathsToRoot(root, pkg, lookup.Parents, 4),
			Repository:       lookup.Repositories[pkg],
			OSVStatus:        statusLabel(status, vulns),
			AdvisoryCount:    advisoryCount(status, vulns),
			VulnerabilityIDs: advisoryIdentifiers(vulns),
			HighestSeverity:  highestSeverity(vulns),
		})
	}
	return out
}

func vulnerabilityFindings(root, rootVersion string, lookup *LookupResponse, maxFindings int) []VulnerabilityFinding {
	names := make([]string, 0, len(lookup.Vulnerabilities))
	for name, vulns := range lookup.Vulnerabilities {
		if len(vulns) > 0 {
			names = append(names, name)
		}
	}
	sort.Strings(names)
	if maxFindings > 0 && len(names) > maxFindings {
		names = names[:maxFindings]
	}
	out := make([]VulnerabilityFinding, 0, len(names))
	for _, pkg := range names {
		version := rootVersion
		if pkg != root {
			version = fmt.Sprint(lookup.Dependencies[pkg])
		}
		vulns := lookup.Vulnerabilities[pkg]
		out = append(out, VulnerabilityFinding{
			Package:          pkg,
			Version:          version,
			Relationship:     relationshipFor(pkg, lookup.Parents),
			Parents:          sortedStrings(lookup.Parents[pkg]),
			PathsToRoot:      pathsToRoot(root, pkg, lookup.Parents, 6),
			AdvisoryCount:    len(vulns),
			HighestSeverity:  highestSeverity(vulns),
			VulnerabilityIDs: advisoryIdentifiers(vulns),
			Advisories:       advisorySummaries(vulns, 6),
		})
	}
	sort.SliceStable(out, func(i, j int) bool {
		ri := severityRank(out[i].HighestSeverity)
		rj := severityRank(out[j].HighestSeverity)
		if ri == rj {
			return out[i].Package < out[j].Package
		}
		return ri > rj
	})
	return out
}

func researchSummary(root DependencyInsight, deps []DependencyInsight, findings []VulnerabilityFinding, lookup *LookupResponse, scorecards []ScorecardSummary) map[string]interface{} {
	direct := 0
	transitive := 0
	checked := 0
	noAdvisory := 0
	unresolved := 0
	for _, dep := range deps {
		switch dep.Relationship {
		case "direct":
			direct++
		case "transitive":
			transitive++
		}
		switch dep.OSVStatus {
		case "no_advisory", "vulnerable":
			checked++
		case "unknown", "not_checked":
			unresolved++
		}
		if dep.OSVStatus == "no_advisory" {
			noAdvisory++
		}
	}
	if root.OSVStatus == "no_advisory" || root.OSVStatus == "vulnerable" {
		checked++
	}
	if root.OSVStatus == "unknown" || root.OSVStatus == "not_checked" {
		unresolved++
	}
	if root.OSVStatus == "no_advisory" {
		noAdvisory++
	}
	highOrCritical := 0
	for _, finding := range findings {
		if rank := severityRank(finding.HighestSeverity); rank >= severityRank("high") {
			highOrCritical++
		}
	}
	return map[string]interface{}{
		"total_packages":          len(lookup.Dependencies) + 1,
		"returned_dependencies":   len(deps),
		"direct_dependencies":     direct,
		"transitive_dependencies": transitive,
		"osv_checked":             checked,
		"osv_no_advisory":         noAdvisory,
		"osv_unresolved":          unresolved,
		"vulnerable_packages":     len(findings),
		"high_or_critical":        highOrCritical,
		"scorecards":              len(scorecards),
		"lookup_errors":           len(lookup.Errors),
	}
}

func buildReputationAssessment(query LookupQuery, lookup *LookupResponse, repo string, repoMeta map[string]interface{}) map[string]interface{} {
	root := formatPackage(query.Manager, query.Namespace, query.Name)
	resolved := lookup.ResolvedVersion
	if resolved == "" {
		resolved = query.Version
	}
	if repo == "" {
		repo = lookup.Repositories[root]
	}
	scorecards := scorecardSummaries(lookup)
	var rootScorecard *ScorecardSummary
	for _, summary := range scorecards {
		if summary.Package == root || summary.Repository == repo {
			s := summary
			rootScorecard = &s
			break
		}
	}
	flags := reputationFlags(repoMeta, rootScorecard)
	return map[string]interface{}{
		"coordinate":          root,
		"manager":             query.Manager,
		"namespace":           query.Namespace,
		"name":                query.Name,
		"version":             resolved,
		"repository":          repo,
		"repository_metadata": repoMeta,
		"scorecard":           rootScorecard,
		"risk_flags":          flags,
		"summary": map[string]interface{}{
			"stars":        repoMeta["stars"],
			"forks":        repoMeta["forks"],
			"open_issues":  repoMeta["open_issues"],
			"archived":     repoMeta["archived"],
			"license":      repoMeta["license"],
			"last_commit":  repoMeta["last_commit"],
			"scorecard_ok": rootScorecard != nil && rootScorecard.Score != nil && *rootScorecard.Score >= 7,
		},
	}
}

func buildRemediationPlan(query LookupQuery, versions *VersionInfo, lookup *LookupResponse, targetVersion string, maxFindings int) map[string]interface{} {
	root := formatPackage(query.Manager, query.Namespace, query.Name)
	resolved := lookup.ResolvedVersion
	if resolved == "" {
		resolved = query.Version
	}
	findings := vulnerabilityFindings(root, resolved, lookup, maxFindings)
	if targetVersion == "" {
		targetVersion = versions.Latest
	}
	actions := make([]RemediationAction, 0, len(findings))
	for _, finding := range findings {
		fixed := fixedVersionsFromAdvisories(finding.Advisories)
		actionTarget := targetVersion
		if finding.Package != root && len(fixed) > 0 {
			actionTarget = fixed[0]
		}
		action := RemediationAction{
			Package:           finding.Package,
			CurrentVersion:    finding.Version,
			Relationship:      finding.Relationship,
			HighestSeverity:   finding.HighestSeverity,
			AdvisoryIDs:       finding.VulnerabilityIDs,
			FixedVersions:     fixed,
			PathsToRoot:       finding.PathsToRoot,
			RecommendedAction: remediationText(query.Manager, root, finding, actionTarget),
			Commands:          remediationCommands(query.Manager, finding.Package, actionTarget, finding.Relationship),
			Notes:             remediationNotes(query.Manager, finding.Relationship),
			Advisories:        finding.Advisories,
		}
		actions = append(actions, action)
	}
	highOrCritical := 0
	for _, action := range actions {
		if severityRank(action.HighestSeverity) >= severityRank("high") {
			highOrCritical++
		}
	}
	return map[string]interface{}{
		"coordinate":       root,
		"manager":          query.Manager,
		"namespace":        query.Namespace,
		"name":             query.Name,
		"current_version":  query.Version,
		"resolved_version": resolved,
		"latest_version":   versions.Latest,
		"target_version":   targetVersion,
		"summary": map[string]interface{}{
			"vulnerable_packages": len(actions),
			"high_or_critical":    highOrCritical,
			"transitive_findings": countRelationship(actions, "transitive"),
			"direct_findings":     countRelationship(actions, "direct"),
			"root_findings":       countRelationship(actions, "root"),
			"lookup_errors":       len(lookup.Errors),
		},
		"actions": actions,
		"next_steps": []string{
			"Apply the smallest upgrade that removes the vulnerable package or moves it to a fixed version.",
			"Re-run research_dependencies with the proposed target version to confirm OSV status and dependency paths.",
			"Keep package-manager overrides temporary; prefer upgrading the direct dependency or root package when possible.",
		},
		"errors": lookup.Errors,
	}
}

func scorecardSummaries(lookup *LookupResponse) []ScorecardSummary {
	out := make([]ScorecardSummary, 0, len(lookup.Scorecards))
	for pkg, card := range lookup.Scorecards {
		score := numericPointer(card["score"])
		out = append(out, ScorecardSummary{
			Package:       pkg,
			Repository:    lookup.Repositories[pkg],
			Score:         score,
			Date:          stringValue(card["date"]),
			WeakestChecks: weakestChecks(card, 4),
		})
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Package < out[j].Package })
	return out
}

func weakestChecks(card map[string]interface{}, limit int) []map[string]interface{} {
	raw, ok := card["checks"].([]interface{})
	if !ok {
		return nil
	}
	checks := make([]map[string]interface{}, 0, len(raw))
	for _, item := range raw {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		checks = append(checks, map[string]interface{}{
			"name":   m["name"],
			"score":  m["score"],
			"reason": m["reason"],
		})
	}
	sort.SliceStable(checks, func(i, j int) bool {
		return numericValue(checks[i]["score"]) < numericValue(checks[j]["score"])
	})
	if limit > 0 && len(checks) > limit {
		return checks[:limit]
	}
	return checks
}

func reputationFlags(meta map[string]interface{}, scorecard *ScorecardSummary) []string {
	flags := []string{}
	if boolValue(meta["archived"]) {
		flags = append(flags, "repository is archived")
	}
	if scorecard == nil || scorecard.Score == nil {
		flags = append(flags, "OpenSSF Scorecard data unavailable")
	} else if *scorecard.Score < 5 {
		flags = append(flags, fmt.Sprintf("OpenSSF Scorecard is low (%.1f)", *scorecard.Score))
	}
	if strings.TrimSpace(stringValue(meta["license"])) == "" {
		flags = append(flags, "license metadata unavailable")
	}
	if staleLastCommit(stringValue(meta["last_commit"]), 365*24*time.Hour) {
		flags = append(flags, "last commit is older than one year")
	}
	return flags
}

func staleLastCommit(raw string, threshold time.Duration) bool {
	if raw == "" {
		return false
	}
	t, err := time.Parse(time.RFC3339, raw)
	if err != nil {
		return false
	}
	return time.Since(t) > threshold
}

func advisorySummaries(vulns []map[string]interface{}, limit int) []AdvisorySummary {
	out := make([]AdvisorySummary, 0, len(vulns))
	for _, vuln := range vulns {
		aliases := stringSlice(vuln["aliases"])
		refs := referenceURLs(vuln["references"], 4)
		out = append(out, AdvisorySummary{
			ID:            stringValue(vuln["id"]),
			Aliases:       aliases,
			Severity:      vulnerabilitySeverity(vuln),
			Description:   truncate(descriptionFor(vuln), 700),
			FixedVersions: fixedVersions(vuln),
			References:    refs,
		})
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func fixedVersionsFromAdvisories(advisories []AdvisorySummary) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, advisory := range advisories {
		for _, fixed := range advisory.FixedVersions {
			if _, ok := seen[fixed]; ok || fixed == "" {
				continue
			}
			seen[fixed] = struct{}{}
			out = append(out, fixed)
		}
	}
	sort.Strings(out)
	return out
}

func advisoryIdentifiers(vulns []map[string]interface{}) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, vuln := range vulns {
		for _, id := range append([]string{stringValue(vuln["id"])}, stringSlice(vuln["aliases"])...) {
			id = strings.TrimSpace(id)
			if id == "" {
				continue
			}
			if _, ok := seen[id]; ok {
				continue
			}
			seen[id] = struct{}{}
			out = append(out, id)
		}
	}
	if len(out) > 16 {
		return out[:16]
	}
	return out
}

func highestSeverity(vulns []map[string]interface{}) string {
	best := "unknown"
	for _, vuln := range vulns {
		sev := vulnerabilitySeverity(vuln)
		if severityRank(sev) > severityRank(best) {
			best = sev
		}
	}
	return best
}

func vulnerabilitySeverity(vuln map[string]interface{}) string {
	candidates := []string{}
	if db, ok := vuln["database_specific"].(map[string]interface{}); ok {
		candidates = append(candidates, stringValue(db["severity"]))
		candidates = append(candidates, stringValue(db["severity_name"]))
	}
	if eco, ok := vuln["ecosystem_specific"].(map[string]interface{}); ok {
		candidates = append(candidates, stringValue(eco["severity"]))
	}
	if raw, ok := vuln["severity"].([]interface{}); ok {
		for _, item := range raw {
			if m, ok := item.(map[string]interface{}); ok {
				candidates = append(candidates, stringValue(m["score"]))
				candidates = append(candidates, stringValue(m["type"]))
			}
		}
	}
	best := "unknown"
	for _, candidate := range candidates {
		normalized := normalizeSeverity(candidate)
		if severityRank(normalized) > severityRank(best) {
			best = normalized
		}
	}
	return best
}

func normalizeSeverity(value string) string {
	value = strings.ToLower(strings.TrimSpace(value))
	switch {
	case strings.Contains(value, "critical"):
		return "critical"
	case strings.Contains(value, "high"):
		return "high"
	case strings.Contains(value, "medium"), strings.Contains(value, "moderate"):
		return "medium"
	case strings.Contains(value, "low"):
		return "low"
	default:
		return "unknown"
	}
}

func severityRank(severity string) int {
	switch normalizeSeverity(severity) {
	case "critical":
		return 4
	case "high":
		return 3
	case "medium":
		return 2
	case "low":
		return 1
	default:
		return 0
	}
}

func fixedVersions(vuln map[string]interface{}) []string {
	seen := map[string]struct{}{}
	out := []string{}
	affected, ok := vuln["affected"].([]interface{})
	if !ok {
		return out
	}
	for _, affectedItem := range affected {
		affectedMap, ok := affectedItem.(map[string]interface{})
		if !ok {
			continue
		}
		ranges, ok := affectedMap["ranges"].([]interface{})
		if !ok {
			continue
		}
		for _, rangeItem := range ranges {
			rangeMap, ok := rangeItem.(map[string]interface{})
			if !ok {
				continue
			}
			events, ok := rangeMap["events"].([]interface{})
			if !ok {
				continue
			}
			for _, eventItem := range events {
				eventMap, ok := eventItem.(map[string]interface{})
				if !ok {
					continue
				}
				fixed := stringValue(eventMap["fixed"])
				if fixed == "" {
					continue
				}
				if _, exists := seen[fixed]; exists {
					continue
				}
				seen[fixed] = struct{}{}
				out = append(out, fixed)
			}
		}
	}
	sort.Strings(out)
	return out
}

func referenceURLs(raw interface{}, limit int) []string {
	items, ok := raw.([]interface{})
	if !ok {
		return nil
	}
	out := []string{}
	for _, item := range items {
		m, ok := item.(map[string]interface{})
		if !ok {
			continue
		}
		ref := stringValue(m["url"])
		if ref == "" {
			continue
		}
		out = append(out, ref)
		if limit > 0 && len(out) >= limit {
			break
		}
	}
	return out
}

func descriptionFor(vuln map[string]interface{}) string {
	for _, key := range []string{"summary", "details"} {
		if value := strings.TrimSpace(stringValue(vuln[key])); value != "" {
			return value
		}
	}
	return ""
}

func statusLabel(status VulnerabilityStatus, vulns []map[string]interface{}) string {
	if len(vulns) > 0 {
		return "vulnerable"
	}
	if status.Status != "" {
		return status.Status
	}
	return "not_checked"
}

func advisoryCount(status VulnerabilityStatus, vulns []map[string]interface{}) int {
	if len(vulns) > 0 {
		return len(vulns)
	}
	return status.AdvisoryCount
}

func relationshipFor(pkg string, parents map[string][]string) string {
	ps, ok := parents[pkg]
	if !ok || len(ps) == 0 {
		return "direct_or_unknown"
	}
	for _, parent := range ps {
		if parent == "" {
			return "direct"
		}
	}
	return "transitive"
}

func pathsToRoot(root, pkg string, parents map[string][]string, limit int) []string {
	if pkg == root {
		return []string{root}
	}
	out := []string{}
	var walk func(node string, path []string, seen map[string]struct{})
	walk = func(node string, path []string, seen map[string]struct{}) {
		if limit > 0 && len(out) >= limit {
			return
		}
		if _, ok := seen[node]; ok {
			return
		}
		seen[node] = struct{}{}
		ps := parents[node]
		if len(ps) == 0 {
			reversed := append([]string{}, path...)
			reverseStrings(reversed)
			out = append(out, strings.Join(append([]string{root}, reversed...), " -> "))
			return
		}
		for _, parent := range ps {
			if parent == "" {
				reversed := append([]string{}, path...)
				reverseStrings(reversed)
				out = append(out, strings.Join(append([]string{root}, reversed...), " -> "))
				continue
			}
			walk(parent, append(path, parent), copyStringSet(seen))
		}
	}
	walk(pkg, []string{pkg}, map[string]struct{}{})
	sort.Strings(out)
	return out
}

func remediationText(manager, root string, finding VulnerabilityFinding, target string) string {
	if finding.Relationship == "root" {
		if target != "" {
			return fmt.Sprintf("Upgrade %s from %s to %s, then re-run dependency and OSV analysis.", root, finding.Version, target)
		}
		return fmt.Sprintf("Upgrade %s to a non-vulnerable release, then re-run dependency and OSV analysis.", root)
	}
	directs := nearestDirectParents(finding.Package, finding.Parents, finding.PathsToRoot)
	targetText := "a fixed release"
	if target != "" {
		targetText = target
	}
	if len(directs) > 0 {
		return fmt.Sprintf("Upgrade the nearest direct dependency or parent chain that introduces %s. Start with %s; aim to move %s to %s.", finding.Package, strings.Join(directs, ", "), finding.Package, targetText)
	}
	return fmt.Sprintf("Identify the parent dependency that introduces %s and upgrade it so %s resolves to %s.", finding.Package, finding.Package, targetText)
}

func remediationCommands(manager, pkg, target, relationship string) []string {
	if target == "" {
		target = "<fixed-version>"
	}
	switch manager {
	case "npm":
		if relationship == "root" {
			return []string{"npm install " + pkg + "@" + target, "npm audit --production"}
		}
		return []string{"npm why " + pkg, "npm audit fix", "use package.json overrides only as a temporary control"}
	case "pypi":
		if relationship == "root" {
			return []string{"pip install --upgrade " + pkg + "==" + target, "pip-audit"}
		}
		return []string{"pip-audit", "upgrade the direct requirement that pulls " + pkg}
	case "go":
		return []string{"go get " + pkg + "@" + target, "go mod tidy", "govulncheck ./..."}
	case "maven":
		return []string{"update pom.xml or dependencyManagement to " + pkg + ":" + target, "mvn dependency:tree", "mvn test"}
	case "cargo":
		return []string{"cargo update -p " + pkg + " --precise " + target, "cargo audit"}
	case "rubygems":
		return []string{"bundle update " + pkg, "bundle audit check --update"}
	case "nuget":
		return []string{"dotnet add package " + pkg + " --version " + target, "dotnet list package --vulnerable --include-transitive"}
	case "composer":
		return []string{"composer update " + pkg + " --with-dependencies", "composer audit"}
	default:
		return nil
	}
}

func remediationNotes(manager, relationship string) []string {
	notes := []string{}
	if relationship == "transitive" {
		notes = append(notes, "Prefer upgrading the direct parent over forcing a transitive version.")
	}
	switch manager {
	case "npm":
		notes = append(notes, "For npm, package.json overrides can pin transitive dependencies temporarily.")
	case "maven":
		notes = append(notes, "For Maven, dependencyManagement can force versions but should be validated with dependency:tree.")
	case "go":
		notes = append(notes, "For Go, verify module compatibility after go get because minimal version selection may retain older transitive modules.")
	case "composer":
		notes = append(notes, "For Composer, validate the lockfile change and use --with-dependencies when parent constraints block the fix.")
	}
	return notes
}

func nearestDirectParents(pkg string, parents []string, paths []string) []string {
	seen := map[string]struct{}{}
	out := []string{}
	for _, parent := range parents {
		if parent == "" {
			out = append(out, pkg)
			continue
		}
		for _, path := range paths {
			parts := strings.Split(path, " -> ")
			if len(parts) >= 2 && parts[len(parts)-1] == pkg {
				candidate := parts[1]
				if _, ok := seen[candidate]; !ok {
					seen[candidate] = struct{}{}
					out = append(out, candidate)
				}
			}
		}
	}
	sort.Strings(out)
	return out
}

func countRelationship(actions []RemediationAction, relationship string) int {
	total := 0
	for _, action := range actions {
		if action.Relationship == relationship {
			total++
		}
	}
	return total
}

func formatPackage(manager, namespace, name string) string {
	switch manager {
	case "npm", "composer", "go":
		if namespace != "" {
			return namespace + "/" + name
		}
	case "maven":
		if namespace != "" {
			return namespace + ":" + name
		}
	}
	if namespace != "" {
		return namespace + "/" + name
	}
	return name
}

func sortedStrings(in []string) []string {
	out := append([]string{}, in...)
	sort.Strings(out)
	return out
}

func copyStringSet(in map[string]struct{}) map[string]struct{} {
	out := make(map[string]struct{}, len(in))
	for key, value := range in {
		out[key] = value
	}
	return out
}

func reverseStrings(in []string) {
	for i, j := 0, len(in)-1; i < j; i, j = i+1, j-1 {
		in[i], in[j] = in[j], in[i]
	}
}

func stringValue(value interface{}) string {
	switch v := value.(type) {
	case string:
		return v
	case fmt.Stringer:
		return v.String()
	case nil:
		return ""
	default:
		return fmt.Sprint(v)
	}
}

func stringSlice(value interface{}) []string {
	raw, ok := value.([]interface{})
	if !ok {
		if s := strings.TrimSpace(stringValue(value)); s != "" {
			return []string{s}
		}
		return nil
	}
	out := []string{}
	for _, item := range raw {
		if s := strings.TrimSpace(stringValue(item)); s != "" {
			out = append(out, s)
		}
	}
	return out
}

func boolValue(value interface{}) bool {
	switch v := value.(type) {
	case bool:
		return v
	case string:
		b, _ := strconv.ParseBool(v)
		return b
	default:
		return false
	}
}

func numericPointer(value interface{}) *float64 {
	if value == nil {
		return nil
	}
	n := numericValue(value)
	return &n
}

func numericValue(value interface{}) float64 {
	switch v := value.(type) {
	case float64:
		return v
	case float32:
		return float64(v)
	case int:
		return float64(v)
	case int64:
		return float64(v)
	case jsonNumber:
		n, _ := strconv.ParseFloat(string(v), 64)
		return n
	case string:
		n, _ := strconv.ParseFloat(v, 64)
		return n
	default:
		return 0
	}
}

type jsonNumber string

func truncate(value string, max int) string {
	if max <= 0 || len(value) <= max {
		return value
	}
	return strings.TrimSpace(value[:max]) + "..."
}
