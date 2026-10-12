"""Git pre-push guard: only the approved advertised SHA may be deleted."""
import json
from pathlib import Path
import sys


def allowed(intent, rows):
    expected = {"refs/heads/" + b["branch"]: b["expected_sha"] for b in intent["branches"]}
    seen = set()
    for row in rows:
        fields = row.split()
        if len(fields) != 4:
            return False
        local_ref, local_oid, remote_ref, remote_oid = fields
        if local_oid != "0" * 40 or remote_oid != expected.get(remote_ref) or remote_ref in seen:
            return False
        seen.add(remote_ref)
    return seen == set(expected)


if __name__ == "__main__":
    intent = json.loads(Path(sys.argv[1]).read_text(encoding="utf-8"))
    if not allowed(intent, sys.stdin):
        print("Deletion rejected: advertised refs changed or push includes unapproved operations", file=sys.stderr)
        sys.exit(1)
