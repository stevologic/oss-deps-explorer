# Maintenance pilot

This feature targets existing `development`, preserving its history and the ten
main commits missing there. It batches compatible PR25–31 changes, including
packageurl-go 0.1.7 and x/mod 0.41.0; their lockfile conflict is resolved with both
new versions. Old individual green checks are evidence, not validation of this
combined tree. Original PRs and branches stay open until reviewed integration and
main promotion establish equivalence. Main and development are unchanged by this draft.

The reusable [contract 1.1.0](../actions/maintenance/README.md) is hosted here,
with repository-local JSON policies and full-SHA consumers in stevo.ai/Shiba.
The action supports only read-only dry-run. Python safety tests and the three
offline pilots pass; no model credential or request is used. No source banks,
private state, downloaded binaries or raw issue bodies are emitted.

The official registry manifests confirm `golang:1.26-alpine3.24` and
`alpine:3.24.2`. Both build/runtime stages use Alpine 3.24. The prior 3.21 main
support expires November 1, 2026; 3.24 main/community support continues until
June 1, 2028. [Alpine release policy](https://alpinelinux.org/releases/).
The container build remains a required PR check before this change can integrate.

| Work | Before | Pilot |
| --- | --- | --- |
| OSS Go updates / CodeQL | weekly | retain weekly |
| OSS Actions versions | weekly | monthly |
| OSS container monitoring | absent | weekly supported-image review/Dependabot |
| OSS Docker publication | PR/push with registry configured | successful build then trusted main push only; PR tests/build retained |
| stevo project sync/deploy | daily plus main push | weekly plus main push; traffic remains within its 14-day window |
| stevo critique | weekly | monthly; successful content/prompt/model hash skips unchanged API work |
| stevo growth | dispatch-only; README said weekly | retain dispatch-only, correct README |
| Shiba traffic | daily green no-op without configuration | weekly, bounded/concurrent-safe |
| Shiba Grok strategy | weekly | monthly, same xAI provider/model policy |
| Shiba vulnerability mode | part of weekly strategy/manual | explicit weekly vulnerability audit; manual urgency and PR/push gates retained |
| Shiba promotion wait | up to 40 × 15 seconds, then green warning while held | report actual PR state; trusted CI/approval/merge wake-up validates main merge before dispatch |

Native Dependabot version updates target existing development. **Security updates
remain default-main targeted**, independent of version cadence; no routing claim or
advisory delay is implied. Runtime and supported container proposals are weekly,
tooling monthly, majors require quarterly review and normal validation.

Local checks: common safety suite (32 tests, including a real local Git stale-tip
rejection and exact-tip deletion fixture), OSS UI tests (3), complete metadata
dry-runs for all three repositories (no mutations), YAML parsing and diff checks.
Go vet/test and Docker build run on the isolated GitHub PR runner because Luigi
does not have Go installed and shared Docker resources are reserved. Their final
status is green on the published combined tree, with registry publication skipped
on the PR. Recheck final draft head before integration; never infer it from the
older individual dependency PRs. Existing default CodeQL scheduling stays intact.

The plan is the first stage. A separate operator-approved operations action/CLI
supports exact-head reviewed integration/promotion and confirmed merged-topic
cleanup, with no force push/admin bypass and fresh owner/ref/check/review evidence.
The pilots do not enable unattended writes or provision new write credentials.
New common config/code still needs draft review before main activation. Remaining
semantic issue closure, owner-specific gates and wider rollout need staged review;
do not claim the read-only pilot fulfills that entire autonomous end state.

Other owners were contacted before adoption: Security Recipes, Arrowhead, Arizona,
Winter Hunt/game and tracker, and Wire Hold. They retain their own instructions,
custom CVE/content jobs, provider routing and explicit review/security/native gates.
Adoption on their repositories awaits review of the tested immutable source pin.
Archives/forks/unresolved repository identities are excluded.

Cost claims concern unnecessary API tokens and workflow/PR/deployment churn.
[Standard public Actions minutes are free](https://docs.github.com/en/billing/concepts/product-billing/github-actions);
there are no invented dollar savings, new purchases, credentials, access grants,
budget/quota increases, force pushes or branch renames.
