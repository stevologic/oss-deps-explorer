# Maintenance contract 1.1.1

This shared composite action lives in an existing owned repository. Consumers pin
`stevologic/oss-deps-explorer/actions/maintenance@<full-40-character-commit>`.
Changes ship as reviewed commits; update each consumer pin in its own draft PR.
There is no new repository, credential, access grant, subscription or budget.

## Pilot and authority

The only supported mode is `dry-run`. The action accepts repository-owned
`.github/maintenance.json`, inventories GitHub with GET requests, and writes
source-safe `plan.json` plus `summary.md`. It never executes configured commands,
checks out a PR head, merges, closes, deletes, deploys or runs model tools. No raw
source banks, issue bodies, credentials, saves or binaries are published in reports.
An incomplete/mismatched/stale inventory fails closed. This is a work queue;
repository checks, required reviews, security gates and owner acceptance still apply.

Feature branches target the existing `develop`/`development`. Preserve both sides
of divergence using a normal merge, resolve conflicts, run the repository's exact
build/test/security gates, then open the reviewed promotion PR to `main`. Existing
main deployment stays in charge. Never force-push or rename branches blindly.
The pilot drafts intentionally stop before integration and production deployment.

## Policy fields

| Field | Meaning |
| --- | --- |
| `schema_version`, `mode`, `repository` | Contract version 1; `dry-run`; verified owner/name |
| `default_branch`, `integration_branch` | Existing production and integration refs |
| `automation` | `merge`, `close`, `delete`, `deploy` must all be false |
| `required_checks`, `validation_commands` | Exact check names and owner-reviewed commands; commands are evidence/instructions, never executed by this action |
| `protected_patterns`, `active_branches`, `locked_prs` | Default/development/release/Pages refs, owner reservations, explicit review holds |
| `topic_prefixes` | Narrow topic namespace eligible for cleanup proposals |
| `cadences`, `supported_image_tracks` | Runtime/base-image weekly, tooling monthly, major review quarterly; supported tracks require release-note/EOL review and build/smoke validation |
| `custom_jobs` | Existing CVE/content/traffic/native jobs excluded from common ownership |
| `ai` | Current provider (`xai`, `openai`, `none`), explicitly enabled advisory flag and bounded output |

## Standard maintenance work

The read-only action is the first stage, not the full autonomous end state.
`actions/maintenance-operations` is a separately invoked action, preview by default.
Its CLI accepts a digest-bound, explicitly owner-approved operation allowlist and
existing owner authority. No write token, access grant or mutation workflow is
provisioned by the pilots. Apply from Actions is limited to a trusted default-
branch workflow_dispatch; PR events cannot invoke it.

Supported bounded operations are deletion of confirmed merged topic branches and
merge of a reviewed exact-head PR through feature→integration→main. Each repeats
fresh inventory and current checks/reviews/holds/base ancestry. Merges use the
head-match option without admin override/auto-merge/review dismissal, then require
the actual integration commit's CI before further promotion. Draft/failed/held PRs
remain blocked. Semantic issue fixes/obsolete closures require reviewed evidence;
the action will not invent closure authority from age or model advice. Dependency
fixes use native Dependabot and validated draft integration batches, and actionable
issue/build fixes land in normal feature PRs with repository tests.

The merge operator also requires existing strict required checks enforced for the
owner on the target branch. This lets GitHub reject a target advance after preflight.
Missing/inaccessible protection or unverified ruleset-only enforcement fails closed;
the pilot does not create or loosen protection. Keep integration under manual review
until that server gate is verified. See [GitHub strict status checks](https://docs.github.com/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches).

Deletion uses an atomic normal git push with a temporary pre-push guard. The guard
compares Git's advertised remote SHA with every approved expected SHA and rejects
any updated/extra/missing/duplicate ref or non-deletion operation. It preserves
existing pre-push hooks and their veto authority with the original arguments/input,
as well as
active/unmerged/default/development/release/Pages branches and repeats absence
readback. There is no force-push flag. The temporary hook path is verified to stay
inside the isolated checkout before cleanup. See [Git pre-push documentation](https://git-scm.com/docs/githooks#_pre_push).

Native Dependabot handles dependencies and Docker base-image version proposals.
Keep weekly runtime/container updates, monthly Actions tooling checks and quarterly
major-version review. Preserve advisory-driven security updates and PR/push scans.
Dependabot **security updates always target the default branch**; `target-branch`
routes version updates only. Bring security updates into an integration feature and
validate them before the production PR, without claiming the bot can route them.
Never close the original security PR before equivalent changes land and verify.

The PR queue names current-head failed/missing checks, pending/held workflows,
conflicts, review/security holds, requested reviewers and requested changes.
A cancelled run is superseded only by a newer successful run for the same exact
head, workflow, event and branch. A dispatch success cannot replace a PR run;
failed/approval-required runs and explicit holds remain blocked.
Reproduce actionable issues, propose a bounded fix in a draft feature PR and link
evidence. Close only items demonstrably fixed, duplicated or obsolete after fresh
readback; age alone is not proof. Combine compatible dependency proposals and
revalidate the combined tree; individually green heads are insufficient.

Cleanup candidates require a matching merged PR from the same repository, the
exact branch tip contained in **both** production and integration, no open PR or
active owner, and no protected/default/development/release/Pages ref. Squash-merged
or obsolete-but-unmerged topics remain preserved unless separately investigated.
Immediately before any user-authorized cleanup, repeat owner/open-PR/protection
reads and compare the exact expected SHA. The action cannot delete branches.

## Providers and cost

Pilot policies preserve xAI in stevo.ai/Shiba and no AI in OSS. All pilot AI flags
are false; no provider secret is passed. Deterministic work runs first. Optional
advice accepts an existing secret plus an account-verified economical model only
on default-branch dispatch/schedule. The fixed xAI Chat Completions or OpenAI
Responses endpoint receives a bounded queue with no tools. Missing access fails
without model/provider fallback. Premium work requires a targeted owner decision;
there is no automatic upgrade, budget/quota increase or invented model ID.
Custom CVE/content jobs retain their own providers and review/security policies.

Public standard GitHub-hosted Actions minutes are free. Cadence changes save
unwanted model tokens, runner activity and review/deployment churn; this contract
does not invent dollar savings. Larger runners, storage and model services have
separate terms.

## Checks and rollout

```sh
python -m unittest discover -s actions/maintenance -p 'test_*.py'
python actions/maintenance/maintenance.py --config .github/maintenance.json \
  --snapshot /path/to/fresh-complete-inventory.json --output /tmp/maintenance-pilot
```

The safety suite covers stale heads/statuses, action_required despite green
dispatch, review holds, divergent integration, active/protected/unmerged topics,
fork evidence, credential/provider boundaries and untrusted model advice.
The three pilot repositories must pass their own final-tree CI before adoption.
Other owners first reconcile instructions and `.agents/skills`, reserve a checkout,
identify exact checks/custom jobs and review the immutable pin. No archive/fork
cleanup and no concurrent edits of another owner's repository are included.

Winter Hunt adoption remains deferred: pinned Unity/URP native, packaged, hardware
and human gates remain mandatory; Luigi native jobs require exclusive coordination.
Raw licensed banks, saves and frozen ZIP/source identities remain private/preserved.
Arrowhead retains signed Karen review and write-token separation. Arizona retains
transaction/browser gates. Wire Hold retains PR11's explicit do-not-merge hold.

References: [Dependabot options](https://docs.github.com/en/code-security/reference/supply-chain-security/dependabot-options-reference),
[Actions billing](https://docs.github.com/en/billing/concepts/product-billing/github-actions),
[secure action pinning](https://docs.github.com/en/actions/reference/security/secure-use).
