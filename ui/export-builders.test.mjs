import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const loadHooks = async () => {
  const source = await readFile(new URL("./app.js", import.meta.url), "utf8");
  const sandbox = {
    React: { createElement: () => ({}) },
    URL,
    URLSearchParams,
    console,
  };
  vm.createContext(sandbox);
  vm.runInContext(source, sandbox, { filename: "ui/app.js" });
  return sandbox.__ossDepsExplorerTestHooks;
};

const sampleResult = {
  repository: "acme/project",
  source: "github_dependency_graph_sbom",
};

const sampleSkipped = [
  {
    display: "actions/checkout",
    name: "actions/checkout",
    version: "v4",
    purl: "pkg:github/actions/checkout@v4",
    license_declared: "MIT",
    spdx_id: "SPDXRef-actions-checkout",
    external_refs: [
      "https://github.com/actions/checkout",
      "pkg:github/actions/checkout@v4",
    ],
  },
  {
    name: "ghcr.io/acme/runtime",
    version: "sha256:abc",
    purl: "pkg:oci/runtime@sha256:abc",
    license_concluded: "NOASSERTION",
    spdx_id: "SPDXRef-container",
    external_refs: ["https://github.com/acme/runtime"],
  },
  {
    name: "internal/tooling",
    version: "2026.07",
    purl: "pkg:generic/internal/tooling@2026.07",
    external_refs: [],
  },
];

test("skipped dependency queue export includes policy metadata", async () => {
  const hooks = await loadHooks();
  // JSON round-trip so vm-realm objects compare cleanly with deepEqual.
  const queue = JSON.parse(JSON.stringify(hooks.buildGithubRepoSkippedDependencyQueueExport({
    result: sampleResult,
    unsupportedPackages: sampleSkipped,
    filteredUnsupportedPackages: sampleSkipped.slice(1),
    activeFilterLabel: 'skipped dependencies matching "runtime"',
    filterQuery: " runtime ",
    generatedAt: "2026-07-08T00:00:00.000Z",
  })));

  assert.equal(queue.schema, "oss-deps-explorer/skipped-dependency-queue/v1");
  assert.equal(queue.repository, "acme/project");
  assert.equal(queue.generated_at, "2026-07-08T00:00:00.000Z");
  assert.deepEqual(queue.active_filter, {
    label: 'skipped dependencies matching "runtime"',
    query: "runtime",
  });
  assert.equal(queue.total_skipped_count, 3);
  assert.equal(queue.filtered_skipped_count, 2);
  assert.equal(queue.skipped_dependencies[0].license_policy, "review");
  assert.equal(queue.skipped_dependencies[0].license_policy_label, "Needs review");
  assert.match(
    queue.skipped_dependencies[0].license_policy_detail,
    /custom, proprietary, or unresolved/,
  );
  assert.equal(queue.skipped_dependencies[1].license_policy, "missing");
  assert.equal(queue.skipped_dependencies[1].license_policy_label, "Missing SPDX");
});

test("skipped dependency CSV export has stable compliance columns", async () => {
  const hooks = await loadHooks();
  const csv = hooks.buildGithubRepoSkippedDependencyCsvExport({
    result: sampleResult,
    filteredUnsupportedPackages: sampleSkipped,
  });
  const lines = csv.split("\n");

  assert.equal(
    lines[0],
    '"repository","name","version","purl","license","license_concluded","license_declared","license_policy","license_policy_label","license_policy_detail","spdx_id","external_refs","skipped_reason"',
  );
  assert.match(lines[1], /"MIT","permissive","Permissive"/);
  assert.match(lines[1], /"https:\/\/github.com\/actions\/checkout;pkg:github\/actions\/checkout@v4"/);
  assert.match(lines[2], /"NOASSERTION","NOASSERTION","","review","Needs review"/);
  assert.match(lines[3], /"","","","missing","Missing SPDX"/);
});

test("skipped dependency Markdown brief carries review labels", async () => {
  const hooks = await loadHooks();
  const brief = hooks.buildGithubRepoSkippedDependencyBriefExport({
    result: sampleResult,
    unsupportedPackages: sampleSkipped,
    filteredUnsupportedPackages: sampleSkipped,
    filterQuery: "",
  });

  assert.match(brief, /^# OSS dependency skipped-item brief: acme\/project/m);
  assert.match(brief, /- Skipped dependencies: 3 of 3/);
  assert.match(brief, /actions\/checkout@v4 - MIT \(Permissive\)/);
  assert.match(brief, /ghcr\.io\/acme\/runtime@sha256:abc - NOASSERTION \(Needs review\)/);
  assert.match(brief, /internal\/tooling@2026\.07 - Missing SPDX \(Missing SPDX\)/);
  assert.match(
    brief,
    /Review skipped package URLs or ecosystems before treating the imported graph as complete/,
  );
});
