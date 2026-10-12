# Cancelled-run follow-up

After the reviewed1.1.0 rollout, stevo.ai PR45 rebased onto development. Its current
head had a successful PR-event run and an older cancelled run from that same
workflow/event/branch. The queue incorrectly treated that superseded cancellation
as a permanent hold even though the latest exact check was green.

Contract1.1.1 ignores only that narrowly matched cancelled run. Wrong head, branch,
workflow or event cannot supersede it. In particular a green dispatch cannot clear
a PR workflow, and failed/approval-required workflows and explicit holds remain
blocking. This changes queue accuracy without granting mutation authority.

All33 safety tests cover this case and the existing32 boundaries, including real
Git deletion guards. Review this separate feature on development before updating
consumers; their production1.1.0 immutable pin stays unchanged by this draft.
