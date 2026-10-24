# Agent maintenance

DSH Mobile is a standalone community plugin and Android App. Keep plugin work in this repository. DSH source and installed frontend artifacts are read-only: inspect them to diagnose failures, but do not patch or rewrite them to implement a Mobile fix. Use documented plugin extension points or retain an isolated upstream reproduction when the owning behavior cannot be repaired here. Upgrading a user's DSH installation remains a separate operation.

For implementation, DSH compatibility, PR/issue review, device debugging or release work, read [dsh-mobile-maintenance](.agent/skills/dsh-mobile-maintenance/SKILL.md), then only the references relevant to the task. [CONTRIBUTING.md](CONTRIBUTING.md) owns the check commands and release procedure; the skill supplies maintenance-specific decision guidance. For a documentation-only edit, consult the affected guide and run the documentation check.

Preserve original contributor commits, unrelated local changes, stored pairings and the established Android signer. A request to inspect does not authorize merging, replying, closing issues, replacing a user's installed software/profile or publishing; preparation is not publication. Owned isolated test installations are diagnostic fixtures, not changes to the user's normal installation.

Maintain the skill when demonstrated behavior invalidates its guidance or reveals a reusable maintenance lesson. Link the owning source, test or guide; replace superseded advice rather than accumulating contradictory rules. Keep current versions, pending tasks and one-off test results in their existing owners, not in the skill. Do not add a new rule for a purely local or mechanical edit.

Agents that do not read `AGENTS.md` automatically should load the skill explicitly. This repository entrypoint does not install global agent settings or authorize background actions.

## Fork-specific branch policy

For `DescartHsu/dsh-mobile`, develop custom changes on `my-custom` or branches
based on it. Keep `main` an upstream-only mirror of `saya-ch/dsh-mobile:main`.
Check Git status before edits, preserve custom behavior and unrelated local work,
and review upstream diffs before integration. Ask about ambiguous business-logic
conflicts. Never force-push, hard-reset or discard custom changes without explicit
user confirmation. Report changed files, reasons and actual checks performed.
The daily sync creates review PRs, not automatic custom-branch merges; see
[Fork maintenance](.github/UPSTREAM_SYNC.md).
