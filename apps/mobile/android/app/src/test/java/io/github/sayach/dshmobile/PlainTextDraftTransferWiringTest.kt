package io.github.sayach.dshmobile

import org.junit.Assert.*
import org.junit.Test
import java.io.File

class PlainTextDraftTransferWiringTest {
    private fun source(name: String): String = File("src/main/java/io/github/sayach/dshmobile/$name.kt").readText().replace("\r\n", "\n")

    @Test fun restorationAndReadonlyVerificationMustPrecedeFinalSourceValidation() {
        val text = source("PlainTextDraftTransfer")
        val restore = text.indexOf("p.restore(\u0024json)")
        val verify = text.indexOf("p.verify(\u0024json)")
        val validate = text.indexOf("p.validate(\u0024json)")
        assertTrue(restore >= 0 && verify > restore && validate > verify)
        assertTrue(text.indexOf("onCommit()") > validate)
        assertTrue(text.contains("intact != \"true\" || !current()"))
        assertTrue(text.contains("p.rollback(\u0024json)"))
        assertTrue(text.contains("handler.postDelayed(rollbackDeadline, 1500)"))
        assertTrue(text.contains("handler.postDelayed(deadline, 30_000L)"))
        assertTrue(text.contains("toByteArray(Charsets.UTF_8).size <= 256 * 1024"))
    }

    @Test fun stagedBrowserIsPromotedWithoutReloadAndHasDedicatedSecurityClient() {
        val text = source("MainActivity")
        val start = text.indexOf("private fun stagePlainTextTransfer")
        val stage = text.substring(start, text.indexOf("private fun trySameHostFallback", start))
        assertTrue(stage.contains("SecureWebViewClient(targetOrigin, requested.caCertificate"))
        assertTrue(stage.contains("MIXED_CONTENT_NEVER_ALLOW"))
        assertFalse(stage.contains("NativeBridge("))
        assertTrue(stage.contains("generation == restoreGeneration"))
        assertTrue(stage.contains("lifecycleOwner == sameHostGate.generation"))
        assertTrue(stage.contains("PairedDeviceStatusPolicy.mayApplyResult(it, saved)"))
        assertTrue(stage.contains("target.destroy(); parent.removeView(shield)"))
        assertTrue(text.contains("if (stagedBrowser == null) browser.loadUrl(initialUrl)"))
    }

    @Test fun microphoneGrantsBlockMigrationUntilDocumentNavigationOrTeardown() {
        val text = source("MainActivity")
        assertTrue(text.contains("audioCaptureGrantedBrowser = pending.owner"))
        assertTrue(text.contains("audioCaptureGrantedBrowser = browser"))
        assertTrue(text.contains("audioCaptureGrantedBrowser !== browser"))
        assertTrue(text.contains("audioCaptureGrantedBrowser !== source"))
        assertTrue(text.contains("if (audioCaptureGrantedBrowser === browser) audioCaptureGrantedBrowser = null"))
        assertTrue(text.contains("pendingAudioPermission = null\n        audioCaptureGrantedBrowser = null"))
    }

    @Test fun retainedPageFeedbackIsForegroundAndSourceOwnedOnly() {
        val text = source("MainActivity")
        val abort = text.substring(text.indexOf("}, onAbort = {"), text.indexOf("}, onCommit = {"))
        assertTrue(abort.contains("sameHostGate.foreground"))
        assertTrue(abort.contains("generation == restoreGeneration && webView === source"))
        assertTrue(abort.contains("R.string.same_host_migration_retained"))
        assertFalse(abort.contains("R.string.same_host_switched"))
    }

    @Test fun nativePendingWorkAndMissingPluginCannotSilentlyDiscardDraft() {
        val text = source("MainActivity")
        assertTrue(text.contains("!webFileChooser.active"))
        assertTrue(text.contains("nativeBridge?.hasPendingTransferBlockers() != true"))
        assertTrue(text.contains("if (captured == null) confirm() else connect()"))
        val auth = text.indexOf("if (onAuthenticated != null)")
        assertTrue(text.indexOf("return@installNativeSession", auth) < text.indexOf("if (deferActivation)", auth))
    }
}
