import copy
import unittest

from deletion_guard import allowed
from operations import deletion_preflight, merge_preflight, validate_intent
from test_maintenance import S, policy, pull, snapshot


def intent():
    return {"schema_version": 1, "repository": "stevologic/example", "approved_by": "stevologic",
            "approval_source": "explicit user-approved scope and exact reviewed intent",
            "operation": "delete-merged-branches", "branches": [{"branch": "codex/merged", "expected_sha": S}]}


class Operations(unittest.TestCase):
    def test_only_exact_advertised_sha_deletion_is_allowed(self):
        self.assertTrue(allowed(intent(), [f"(delete) {'0'*40} refs/heads/codex/merged {S}"]))

    def test_race_extra_ref_update_missing_and_duplicate_push_rejected(self):
        valid = f"(delete) {'0'*40} refs/heads/codex/merged {S}"
        for rows in ([valid.replace(S, 'b'*40)], [valid.replace('0'*40, 'b'*40)],
                     [valid, valid.replace('codex/merged', 'main')], [], [valid, valid]):
            self.assertFalse(allowed(intent(), rows))

    def test_stale_active_or_unmerged_deletion_rejected(self):
        for change in ("sha", "active", "merged"):
            p, s, i = policy(), snapshot(), intent()
            if change == "sha": i["branches"][0]["expected_sha"] = 'b'*40
            if change == "active": p["active_branches"] = ['codex/merged']
            if change == "merged": s['merged_prs'] = []
            with self.assertRaises(ValueError): deletion_preflight(p, i, s)

    def test_bounded_owner_intent_required(self):
        for key, value in [("approved_by", "other"), ("approval_source", ""), ("repository", "other/repo"), ("branches", [])]:
            i = intent()
            i[key] = value
            with self.assertRaises(ValueError): validate_intent(policy(), i)

    def test_merge_requires_exact_head_base_and_review_checks(self):
        p = pull()
        p['base']['sha'] = 'b'*40
        p['head']['repo'] = {'full_name': 'stevologic/example'}
        s = snapshot()
        s['prs'] = [p]
        i = {**intent(), 'operation': 'merge-reviewed-pr', 'pr_number': 7, 'expected_sha': S, 'expected_base_sha': 'b'*40}
        self.assertEqual(merge_preflight(policy(), i, s)['number'], 7)
        for change in ('draft', 'failed', 'head', 'base', 'hold', 'main_route'):
            with self.subTest(change=change):
                c, ss = policy(), copy.deepcopy(s)
                if change == 'draft': ss['prs'][0]['draft'] = True
                if change == 'failed': ss['prs'][0]['checks'][0]['conclusion'] = 'failure'
                if change == 'head': ss['prs'][0]['head']['sha'] = 'c'*40
                if change == 'base': ss['prs'][0]['base']['sha'] = 'c'*40
                if change == 'hold': c['locked_prs'] = [7]
                if change == 'main_route': ss['prs'][0]['base']['ref'] = 'main'
                with self.assertRaises(ValueError): merge_preflight(c, i, ss)


if __name__ == '__main__':
    unittest.main()
