"""Explicit operator-approved maintenance operations, separate from the read-only plan.

Existing credentials only. No automatic apply, force push, admin override or model tools.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shlex
import subprocess
import sys
import tempfile
import urllib.parse

from maintenance import API, SHA, cleanup_queue, collect, review_queue, validate


def run(*args, cwd=None):
    result = subprocess.run(args, cwd=cwd, capture_output=True, text=True, encoding="utf-8")
    if result.returncode:
        # Never propagate provider/credential-bearing stderr into an artifact.
        raise ValueError("Command failed: " + args[0] + " (exit " + str(result.returncode) + ")")
    return result.stdout.strip()


class GhAPI(API):
    def __init__(self, repository):
        super().__init__(repository, "")
        self.repository = repository

    def get(self, path):
        return json.loads(run("gh", "api", "repos/" + self.repository + path))


def validate_intent(config, intent):
    if intent.get("schema_version") != 1 or intent.get("repository") != config["repository"]:
        raise ValueError("Intent repository/version mismatch")
    if intent.get("approved_by") != config["repository"].split("/")[0] or not intent.get("approval_source"):
        raise ValueError("An explicit owner approval record is required")
    if intent.get("operation") not in ("delete-merged-branches", "merge-reviewed-pr"):
        raise ValueError("Unsupported operation; issue closure requires separate semantic evidence/review")
    if intent["operation"] == "delete-merged-branches":
        branches = intent.get("branches", [])
        if not branches or len(branches) > 10 or len({b["branch"] for b in branches}) != len(branches):
            raise ValueError("A bounded unique branch allowlist is required")
        if any(not SHA.fullmatch(b.get("expected_sha", "")) for b in branches):
            raise ValueError("Each deletion needs an exact expected SHA")
    else:
        if not isinstance(intent.get("pr_number"), int) or not SHA.fullmatch(intent.get("expected_sha", "")):
            raise ValueError("Merge intent needs PR number and exact head")
        if not SHA.fullmatch(intent.get("expected_base_sha", "")):
            raise ValueError("Merge intent needs exact current integration/production base")


def deletion_preflight(config, intent, snapshot):
    validate_intent(config, intent)
    candidates, _ = cleanup_queue(config, snapshot)
    eligible = {(x["branch"], x["expected_sha"]) for x in candidates}
    if any((b["branch"], b["expected_sha"]) not in eligible for b in intent["branches"]):
        raise ValueError("Deletion allowlist changed or lacks merged/current-owner/protection/ancestry evidence")
    return intent["branches"]


def collect_cleanup(config, intent, api):
    """Cleanup needs refs/open heads/merged proof, not every PR's paid/CI queue."""
    repo = api.get("")
    if repo.get("default_branch") != config["default_branch"]:
        raise ValueError("Actual default branch changed")
    # Operator deletion also needs actual ruleset visibility. The read-only
    # partial-report exception must never become a mutation exception.
    rulesets = api.pages("/rulesets")
    branches = api.pages("/branches")
    pulls = api.pages("/pulls?state=open")
    merged = [p for p in api.pages("/pulls?state=closed") if p.get("merged_at")]
    snapshot = {"complete": True, "repository": config["repository"], "branches": branches,
                "prs": pulls, "merged_prs": merged, "ancestry": {}, "rulesets": rulesets}
    wanted = {b["branch"]: b["expected_sha"] for b in intent["branches"]}
    for branch in branches:
        if branch["name"] not in wanted:
            continue
        sha = branch["commit"]["sha"]
        if sha != wanted[branch["name"]]:
            raise ValueError("Approved branch tip changed")
        snapshot["ancestry"][sha] = {}
        for target in (config["default_branch"], config["integration_branch"]):
            import urllib.parse
            comparison = api.get("/compare/" + sha + "..." + urllib.parse.quote(target, safe=""))
            snapshot["ancestry"][sha][target] = comparison.get("behind_by") == 0
    return snapshot


def merge_preflight(config, intent, snapshot):
    validate_intent(config, intent)
    if snapshot.get("complete") is not True or snapshot.get("evidence_gaps"):
        raise ValueError("Complete protection inventory is required for operator merges")
    pull = next((p for p in snapshot["prs"] if p["number"] == intent["pr_number"]), None)
    if pull is None or pull["head"]["sha"] != intent["expected_sha"]:
        raise ValueError("PR missing or head changed")
    if (pull["head"].get("repo") or {}).get("full_name") != config["repository"]:
        raise ValueError("Cross-repository PR execution is not supported")
    base, head = pull["base"]["ref"], pull["head"]["ref"]
    if base != config["integration_branch"] and not (base == config["default_branch"] and head == config["integration_branch"]):
        raise ValueError("Required feature -> integration -> main route was not followed")
    if pull["base"]["sha"] != intent["expected_base_sha"]:
        raise ValueError("Base changed; combined tree must be revalidated")
    if review_queue(config, pull)["blockers"]:
        raise ValueError("Current-head checks/reviews/security/mergeability gates remain blocked")
    return pull


def require_merge_protection(config, protection):
    """The server must reject a base advance after our read and before merge."""
    required = protection.get("required_status_checks") or {}
    contexts = set(required.get("contexts", []))
    contexts.update(row.get("context") for row in required.get("checks", []))
    if (required.get("strict") is not True or
            (protection.get("enforce_admins") or {}).get("enabled") is not True or
            not set(config["required_checks"]).issubset(contexts)):
        raise ValueError("Merge requires verified strict required checks enforced for the owner; preserve manual review until that gate is verified")


def guarded_delete(config, intent, checkout):
    remote = run("git", "remote", "get-url", "origin", cwd=checkout)
    if remote != "https://github.com/" + config["repository"] + ".git":
        raise ValueError("Checkout remote does not match verified owned repository")
    for row in intent["branches"]:
        run("git", "check-ref-format", "refs/heads/" + row["branch"], cwd=checkout)
    original_hook = Path(run("git", "rev-parse", "--git-path", "hooks/pre-push", cwd=checkout))
    if not original_hook.is_absolute():
        original_hook = checkout / original_hook
    # pre-push receives the advertised remote object ID. Git's ref transaction
    # rejects a further remote change after advertisement; the hook rejects a
    # change between the approval/preflight and advertisement. No force flag.
    with tempfile.TemporaryDirectory(prefix="maintenance-deletion-", dir=checkout) as temp:
        folder = Path(temp)
        if folder.resolve().parent != checkout.resolve() or folder.is_symlink():
            raise ValueError("Temporary hook directory escaped the verified checkout")
        guard = Path(__file__).with_name("deletion_guard.py").read_text(encoding="utf-8")
        (folder / "guard.py").write_bytes(guard.encode())
        (folder / "intent.json").write_bytes(json.dumps(intent).encode())
        python = shlex.quote(Path(sys.executable).as_posix())
        stdin_file = shlex.quote((folder / "push-input").as_posix())
        original = shlex.quote(original_hook.as_posix())
        # Existing pre-push gates receive the same arguments/input and retain
        # veto authority; the temporary guard must never replace a security gate.
        hook = ("#!/bin/sh\ncat > " + stdin_file + "\n"
                + "if [ -x " + original + " ]; then " + original + " \"$@\" < " + stdin_file + " || exit $?; fi\n"
                + "exec " + python + " " + shlex.quote((folder / "guard.py").as_posix()) + " "
                + shlex.quote((folder / "intent.json").as_posix()) + " < " + stdin_file + "\n")
        (folder / "pre-push").write_bytes(hook.encode())
        (folder / "pre-push").chmod(0o700)
        output = run("git", "-c", "core.hooksPath=" + str(folder), "push", "--porcelain", "--atomic", "origin", "--delete", *(r["branch"] for r in intent["branches"]), cwd=checkout)
    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--config", required=True)
    parser.add_argument("--intent", required=True)
    parser.add_argument("--intent-sha256", required=True)
    parser.add_argument("--checkout", default=".")
    parser.add_argument("--apply", action="store_true", help="Only after explicit operator approval; no unattended caller")
    args = parser.parse_args()
    raw = Path(args.intent).read_bytes()
    if hashlib.sha256(raw).hexdigest() != args.intent_sha256:
        raise ValueError("Approved intent digest mismatch")
    config = validate(json.loads(Path(args.config).read_text(encoding="utf-8")))
    if os.getenv("GITHUB_ACTIONS") == "true":
        if os.getenv("GITHUB_REPOSITORY") != config["repository"]:
            raise ValueError("Workflow repository/policy mismatch")
        if args.apply and (os.getenv("GITHUB_EVENT_NAME") != "workflow_dispatch" or
                           os.getenv("GITHUB_REF") != "refs/heads/" + config["default_branch"]):
            raise ValueError("Apply is restricted to trusted default-branch operator dispatch")
    intent = json.loads(raw)
    validate_intent(config, intent)
    login = run("gh", "api", "user", "--jq", ".login")
    if login != intent["approved_by"]:
        raise ValueError("Existing authenticated account is not the approved owner")
    api = GhAPI(config["repository"])
    snapshot = collect_cleanup(config, intent, api) if intent["operation"] == "delete-merged-branches" else collect(config, api)
    # Preserve all default/development/release/Pages refs, active owner reservations,
    # open PR heads, explicit holds, failed checks and unknown evidence.
    if intent["operation"] == "delete-merged-branches":
        deletion_preflight(config, intent, snapshot)
    else:
        pull = merge_preflight(config, intent, snapshot)
        target = api.get("/git/ref/heads/" + pull["base"]["ref"])["object"]["sha"]
        if target != intent["expected_base_sha"]:
            raise ValueError("Target changed since validation")
        combined = api.get("/compare/" + target + "..." + intent["expected_sha"])
        if combined.get("behind_by") != 0:
            raise ValueError("PR head does not contain the current target; revalidate integration")
        protection = api.get("/branches/" + urllib.parse.quote(pull["base"]["ref"], safe="") + "/protection")
        require_merge_protection(config, protection)
        decision = json.loads(run("gh", "pr", "view", str(intent["pr_number"]), "--repo", config["repository"], "--json", "reviewDecision,mergeStateStatus"))
        if decision.get("reviewDecision") == "REVIEW_REQUIRED" or decision.get("mergeStateStatus") != "CLEAN":
            raise ValueError("Repository review/security/integration gate remains blocked")
    if not args.apply:
        print(json.dumps({"mode": "preview", "operation": intent["operation"], "gates_passed": True, "mutations": []}))
        return
    if intent["operation"] == "delete-merged-branches":
        guarded_delete(config, intent, Path(args.checkout).resolve())
        remaining = {b["name"] for b in api.pages("/branches")}
        if any(r["branch"] in remaining for r in intent["branches"]):
            raise ValueError("Deletion readback incomplete; inspect state before retry")
        print(json.dumps({"operation": intent["operation"], "deleted": intent["branches"], "verified_absent": True}))
    else:
        # Never --admin, --auto, force push, delete-branch or review dismissal.
        run("gh", "pr", "merge", str(intent["pr_number"]), "--repo", config["repository"], "--merge", "--match-head-commit", intent["expected_sha"])
        merged = api.get("/pulls/" + str(intent["pr_number"]))
        if not merged.get("merged_at"):
            raise ValueError("Merge readback not confirmed")
        print(json.dumps({"operation": intent["operation"], "pr": intent["pr_number"], "merge_commit": merged["merge_commit_sha"], "next_step": "Read exact merged integration CI before any main promotion"}))


if __name__ == "__main__":
    main()
