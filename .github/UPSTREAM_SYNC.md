# Fork maintenance / Fork 维护

This fork uses `my-custom` as its default and development branch. Keep `main`
identical to upstream; do not put custom code or workflows there.

本 Fork 的默认分支和定制开发分支是 `my-custom`。`main` 仅接收原作者提交。

## Daily workflow / 每日同步

`Daily upstream sync` runs at 01:17 UTC (09:17 Asia/Shanghai) every day.
GitHub may delay scheduled runs. It fast-forwards `main` from
`saya-ch/dsh-mobile:main`, then opens or reuses a `main` → `my-custom` PR
when upstream commits have not been integrated. No updates means no new PR.
The workflow never force-pushes, automatically merges, creates tags or publishes releases.

每天北京时间 09:17 检查；GitHub 调度可能延迟。有更新时创建或复用同步 PR，
无更新时不创建 PR。分叉会停止同步，合并冲突会使检查失败，需要人工处理。
不会强制推送、自动合并或发布版本。

Before pushing upstream commits to `main`, a checksum-pinned Gitleaks scanner
checks the incoming history (including merge diffs) with its built-in rules.
Findings and scanner failures stop the push. Logs redact detected values; no
scan reports are uploaded. Test fixtures can produce false positives: inspect
each finding rather than excluding all test/config files. This is a detection
layer, not proof that every possible secret format will be recognized.

更新 `main` 前使用校验过下载哈希的 Gitleaks 扫描新增提交（含合并差异）。
命中疑似密钥或扫描失败就停止推送；日志隐藏具体值，不上传扫描报告。
测试样例误报需逐项核查，不整体排除测试和配置目录。扫描不能保证识别所有秘密格式。
定制提交和推送也必须遵守 `AGENTS.md` 中的敏感信息检查规则。

Integration validation tests the exact upstream SHA merged into the captured
custom SHA in an ephemeral runner. It runs `npm run verify`, Go tests/vet and
Android lint/unit tests/debug assembly. Project code runs with read-only
permissions and without persisted Git credentials. A separate job reports the
`upstream-sync/integration` status. This is not the entire existing cross-platform
and browser CI matrix, or a physical-device test.

检查包含临时合并、插件校验/测试/构建、Go 检查和 Android 调试构建；
结果写入 PR 提交的 `upstream-sync/integration` 状态。
它不等同于完整跨平台、浏览器或真机验证。

Review changes and preserve custom behavior before merging with **Create a merge
commit**. Do not squash/rebase sync PRs: upstream ancestry must remain intact.
Existing PR CI created by `GITHUB_TOKEN` may require **Approve workflows to run**.
After changing `my-custom` while a sync PR is open, rerun this workflow before
relying on its integration status. Its description records the tested custom SHA.

审核后选择 **Create a merge commit**，不要 squash/rebase 同步 PR。
如原有 CI 显示等待批准，请选择 **Approve workflows to run**。
若检查后又修改了 `my-custom`，应重新运行同步检查，核对被测提交。

## Manual run and recovery / 手动运行与恢复

Open Actions → Daily upstream sync → Run workflow on `my-custom`.
The default `run_checks: true` validates even with no pending upstream changes.
Scheduled runs skip validation when nothing is pending.

手动运行默认会执行检查，即使没有更新。日常定时运行在无待合并提交时跳过测试。

If `main` diverges, inspect the commits and preserve custom work in a separate
branch before deciding how to reconcile it. The workflow will not reset it.
Disable only this workflow in Actions to pause the schedule. Keep `my-custom`
as the default branch while scheduling is enabled. Public-repository schedules
can be disabled by GitHub after 60 days without repository activity; re-enable
the workflow from Actions when necessary.

若 `main` 分叉，先分析并保护独有提交；工作流不会重置它。
暂停时在 Actions 中禁用此工作流。定时运行期间保持默认分支为 `my-custom`。
公共仓库连续 60 天无活动时 GitHub 可能停用定时任务，届时需在 Actions 重新启用。
