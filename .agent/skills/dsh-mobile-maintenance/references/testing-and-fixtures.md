# Test and fixture reliability

Use this reference when tests acquire files, ports, profiles, processes or Workers, mutate shared state, or exercise late asynchronous results. It supplements the repository's checks; it does not make every change require the full runtime or device matrix.

## Choose evidence for the changed behavior

[CONTRIBUTING](../../../../CONTRIBUTING.md#select-behavior-checks) owns commands and check selection. Read the current [package scripts](../../../../package.json), [Vitest configuration](../../../../vitest.config.ts) and [CI workflow](../../../../.github/workflows/ci.yml) when execution topology or time budgets matter. DSH core's coverage, snapshot and pre-push rules are not this plugin's testing policy.

Keep source and artifact checks explicit. Source tests exercise the implementation; distribution claims require the actual tarball, installed resolution and built entry. Reuse the [packed-profile helpers](../../../../scripts/packed-profile.mjs) and [shared mobile fixture](../../../../scripts/mobile-boot-fixture.mjs), rather than replacing a user's installation or silently substituting checkout files.

Match assertions to the consumer. A healthy HTTP endpoint does not prove that scripts execute, modules register or Workspace streams recover. Browser checks should observe the mounted DSH interface and affected authenticated requests; retention claims should compare the actual document, editor and draft. A loopback proxy, simulated bridge or USB reverse remains isolated evidence, not a public-route result.

A mounted shell and Workspace stream baseline can legitimately contain no workspaces or open conversation. Before testing editor or draft retention, create an owned Workspace and Session through the real services/actions and observe its exact conversation identity. Do not infer a composer fixture from Landing, inject a substitute editor, or increase waits for a missing setup step. The [customization smoke](../../../../scripts/smoke-mobile-custom-assets.mjs) and [attachment smoke](../../../../scripts/smoke-mobile-attachments.mjs) establish these prerequisites without submitting a model request.

Android JVM gate tests and source-wiring checks do not execute an Activity or physical WebView. Build and lint evidence also does not establish keyboard, system Back, rotation or foreground/background behavior on a device. Follow the [App build guide](../../../../apps/mobile/README.md#build) and the [runtime/device guidance](runtime-ui-android.md#android-and-adb) for the affected native surface; do not replace formal signing or pairings to make a test runnable.

## Isolate acquired resources

- For ordinary network fixtures, bind loopback with `listen(0)` and read the port after the listening event; do not find a free port and claim it later. When a particular port or binding collision is the test subject, retain that input and explicitly own the competing listeners rather than using a user's running service. Literal addresses used only as parser inputs are not listeners.
- TCP allocation does not reserve the same UDP port, and Gateway startup permits broadcast discovery to degrade. Protocol/credential/CA tests use [an explicitly mapped UDP transport](../../../../tests/udp-discovery-fixture.ts): TCP and UDP each bind their own OS-assigned port and remain held, the production bind request must still name the advertised HTTP port, and the query driver uses the real UDP address. This proves real packet handling and advertised metadata, not a same-number TCP/UDP bind. Keep actual same-port failure and running-socket degradation tests on the normal path. The adapter is instance-local, restores socket/property ownership after startup, and fails on unexpected hooks, binding, notification or cleanup errors; [its tests](../../../../tests/udp-discovery-fixture.test.ts) own these checks. Never mask packet/assertion failure by reallocating, increasing an arbitrary candidate count, skipping the consumer or widening its receive deadline.
- Allocate private temporary roots and unique per-run namespaces. Register cleanup immediately after acquisition, including a fallback for assertions that fail during setup. Delete only validated owned roots; do not traverse projected links into outside data.
- Separate profile paths do not necessarily isolate installed files. The shared fixture's copied package files and the [file-metadata guidance](runtime-ui-android.md#connectivity-and-remote-performance) address pnpm hardlinks; do not change a user's package-manager settings as a fixture repair.
- Restore process environment, global Fetch interception, clocks and other shared mutations to their exact previous state. Limit interception to the owned operation and await its completion before restoring hooks. A serial test runner does not isolate other test processes or host resources.

## Control asynchronous timing

Wait for an observable readiness or completion signal: a listening event, real handshake, baseline, settled request, stream closure or process exit. Bound the wait with a timeout, but do not use a fixed sleep or a returned Promise's truthiness as evidence that the state was reached.

For a race, hold the old operation at an explicit barrier, change its owner, then release it and observe what it can still do. Verify that stale success, failure and queued callbacks cannot mutate the new owner, and that current work still completes. The [download cancellation tests](../../../../tests/component-download.test.ts) and [native restore-gate tests](../../../../apps/mobile/android/app/src/test/java/io/github/sayach/dshmobile/RestoreAttemptGateTest.kt) provide repository examples without requiring real credentials.

Use the owning lane's case and hook budgets. A deadline regression needs an outer wait that cannot race the deadline under test. Report timeout, signal and exit independently: a terminated process can return zero, and a nonzero exit can come from setup rather than the intended fault.

## Clean up and verify failures

Stop new work and detach callbacks before teardown; await the owned close, exit or termination signal before removing its resources. Calling `abort()`, `destroy()` or `kill()` alone does not prove cleanup completed. Cover resources rejected before a consumer takes ownership, as described in [runtime stream cleanup](runtime-ui-android.md#connection-ownership-and-security).

Negative controls must fail for the deliberately introduced condition, not an install error, missing browser, generic timeout or teardown fault. Independently observe that condition, and emit an expected-failure marker only when required evidence capture and cleanup have succeeded. The [existing negative-control guidance](../../../../CONTRIBUTING.md#select-behavior-checks) and [diagnostic helper tests](../../../../tests/mobile-boot-diagnostics.test.ts) own these acceptance details; do not treat any nonzero exit or an early marker in a later aggregate error as passing.

The shared [negative-control helper](../../../../scripts/negative-control.mjs) emits a terminal receipt only after successful cleanup; CI checks the complete receipt line, not a substring in an error stack. [Its CLI tests](../../../../tests/negative-control.test.ts) distinguish the expected rejection from nested cleanup failures. Flatten aggregated failures before deciding that only the deliberate fault remains.

Verify effects rather than self-reports. For a rejected response, observe cancellation or stream closure and listener release, not merely HTTP 500. For an interrupted operation, distinguish withdrawn callbacks from already completed writes; cancellation is not rollback and does not justify automatic replay.

## Investigate without masking the failure

Keep the failing artifact, runtime and configuration stable while changing one suspected resource owner. Start with the smallest relevant topology; run independent processes concurrently when the claimed fix is cross-process isolation. Repeated successful runs cannot replace a controlled race or erase an earlier unexplained failure.

Do not make a deterministic regression pass by adding blind retries, sleeps, broad serialization or weaker assertions. A documented transient provider retry and a measured, bounded Windows file-handle retry belong to their owning implementations; they are not permission to retry arbitrary test failures.

Record redacted evidence and the commands actually run, including skips, pending CI and physical-device limits. Keep candidate versions, hashes, timings and one-off results in local evidence or release records, not this skill. After a relevant change, earlier passing evidence applies only to the unchanged surface.
