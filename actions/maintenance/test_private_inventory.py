import io
import json
import unittest
import urllib.error

import maintenance as m
from test_maintenance import S, policy, pull, snapshot


class LimitedAPI:
    def __init__(self, private=True, code=403, message=m.PRIVATE_RULESETS_MESSAGE, remaining="100"):
        self.private, self.code, self.message, self.remaining = private, code, message, remaining

    def get(self, path):
        if path == "": return {"default_branch": "main", "private": self.private}
        if path.startswith("/compare/"): return {"behind_by": 0, "ahead_by": 0, "status": "identical"}
        raise AssertionError(path)

    def pages(self, path, key=None):
        if path == "/rulesets":
            raise urllib.error.HTTPError("https://api.github.com/repos/stevologic/example/rulesets",
                self.code, "Denied", {"X-RateLimit-Remaining": self.remaining},
                io.BytesIO(json.dumps({"message": self.message}).encode()))
        if path == "/branches": return snapshot()["branches"]
        if path == "/pulls?state=closed": return snapshot()["merged_prs"]
        return []


def partial():
    data = snapshot()
    data.update(complete=False, private=True, data_complete=True, rulesets=None,
                evidence_gaps=[m.PRIVATE_RULESETS_GAP])
    data["prs"] = [pull()]
    return data


class PrivateInventory(unittest.TestCase):
    def test_successful_public_ruleset_inventory_stays_complete(self):
        class CompleteAPI(LimitedAPI):
            def pages(self, path, key=None):
                return [] if path == "/rulesets" else super().pages(path, key)
        data = m.collect(policy(), CompleteAPI(private=False))
        self.assertTrue(data["complete"])
        self.assertEqual(data["rulesets"], [])
        self.assertTrue(m.plan(policy(), data)["evidence_complete"])

    def test_exact_private_feature_limit_yields_only_partial_read_only_report(self):
        data = m.collect(policy(), LimitedAPI())
        self.assertFalse(data["complete"])
        self.assertTrue(data["data_complete"])
        self.assertIsNone(data["rulesets"])
        report = m.plan(policy(), data)
        self.assertFalse(report["evidence_complete"])
        self.assertEqual(report["mutations"], [])
        self.assertEqual(report["branch_cleanup_candidates"], [])
        self.assertEqual(report["preserved_branches"], ["codex/merged"])

    def test_other_errors_public_repos_and_rate_limits_still_fail_closed(self):
        for kwargs in ({"private": False}, {"code": 401}, {"code": 500},
                       {"message": "Resource not accessible by integration"}, {"remaining": "0"}):
            with self.subTest(kwargs=kwargs), self.assertRaises(urllib.error.HTTPError):
                m.collect(policy(), LimitedAPI(**kwargs))

    def test_partial_report_blocks_every_pr_and_ai_even_with_existing_key(self):
        p = policy()
        p["ai"]["enabled"] = True
        report = m.plan(p, partial())
        self.assertIn("protection inventory incomplete", report["pull_requests"][0]["blockers"])
        self.assertFalse(report["pull_requests"][0]["merge_authorized"])
        def forbidden(*args, **kwargs): raise AssertionError("No model request with incomplete evidence")
        result = m.advise(p, report, {"GITHUB_EVENT_NAME": "schedule", "GITHUB_REF": "refs/heads/main",
            "MAINTENANCE_AI_KEY": "offline-fixture", "MAINTENANCE_AI_MODEL": "existing"}, forbidden)
        self.assertIn("incomplete", result["status"])

    def test_unknown_missing_data_and_forged_complete_gaps_are_rejected(self):
        for changes in ({"data_complete": False}, {"private": False},
                        {"evidence_gaps": ["unknown"]}, {"complete": True}):
            data = partial()
            data.update(changes)
            with self.assertRaises(ValueError): m.plan(policy(), data)

