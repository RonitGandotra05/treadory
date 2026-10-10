# Verification record — 10 October 2026

## Executed locally on macOS arm64

- Read and audited the baseline input paths, repository/release/package instructions and primary platform documentation. See the audit and feasibility matrix.
- .NET 10 portable app policy/configuration tests: **80 checks passed**. Includes ambiguity, decoding, learning, hold/chords, ordinary-mouse forwarding mock, activation/recovery/failure, migration, guard boundaries/all five Windows buttons, prior held buttons, bounded sequence pairing, No action arming and arming before action execution. **These are unit/mocked checks, not Windows OS input.**
- Historical helper safety/ABI/protocol tests: **34 checks passed**, without physical device assertions.
- Cross-published the actual WinForms app and historical helper for Windows x64. The standalone EXE is a real self-contained GUI PE/.NET bundle; structural checks, bytes/checksum and declared-source freshness passed. No Windows runtime/driver/pedal executed locally.
- Compiled actual AppKit/IOHID/Quartz macOS source for arm64, deployment target macOS 14. Pure policy/decoder/settings tests passed. Packaged a real .app ZIP, ad-hoc signed and `codesign --verify --deep --strict` passed. GUI `--ui-test` ran with capture inactive; local screenshot reviewed and cream/orange light appearance corrected. Startup initializes the native manager but does not test exclusive device access, permissions or tap suppression. Developer ID/notarization absent. Local host startup does not verify every macOS 14+ release.
- Created a real Linux dependency-declaring `.deb` with runnable Python/Tk/evdev scripts and launcher. Pure Python policy tests: **4 test groups passed**; Python compilation and ar/tar/package/dependency/launcher structure checks passed. No Linux OS, compositor or installed GUI executed locally. Linux OS timing guard remains unavailable; package is a maintainer artifact, not a public download.
- Production `npm run build` and `npm test`: passed. **15 Node test groups** plus worker, Linux policy, SEO and release checks. Native snapshots reject changed source/damaged bytes; macOS Mach-O arm64/bundle and Linux archive/launcher checked. Canonical/privacy/sitemap/robots/agents and prerendered essential content verified; indexing is not guaranteed.
- Actual Chromium / Chrome-for-Testing mouse tests: all/right scopes, expiry, down/up crossing boundary, preexisting drag, double-click, wheel, synthetic clicks and immediate clearing passed. This uses actual browser input on a test page, **not USB hardware**. Measured direct page-arm processing rounded to 0.00 ms on this host; it does not measure HID-to-extension injection latency or prove event ordering for the affected user.
- Actual installed Chrome-for-Testing extension in an isolated temporary profile: service worker and popup startup, explicit opt-in scope persistence, legacy Right migration, no nativeMessaging and app link passed. No real HID input or live host-permission frame coverage asserted.
- Website: **16 scenarios passed**, including scope switching/keyboard navigation, app-download links and actual EXE retrieval, unavailable-metadata state, creator credits and no horizontal overflow at 1100/390/320 px. Popup mocked integration: app disconnect before download, failed disconnect, guard UI and narrow layouts passed. Screenshots inspected locally; temporary profiles and test browsers close in finally blocks.
- Updated Vite to 6.4.4 and esbuild to 0.25.12 after npm identified development-server advisories. `npm audit` subsequently reported **zero vulnerabilities**. These are build/development dependencies, not new application runtimes.

## Platform CI (separate evidence)

The updated workflow runs after the authorized push. At the time of the committed verification record these runs are **pending**, not asserted successful:

- Windows: portable policy checks, compile, freshly built and website snapshot EXE `--self-test`, `--ui-test`, and actual OS `--guard-test` with synthetic SendInput. The last tests the low-level hook and own-action marker; it does not test the driver or physical pedal.
- macOS arm64 runner: native compile/policy/signature/GUI startup and package upload.
- Linux runner: policy checks, real dpkg package inspection/install, Xvfb GUI startup, and evdev/uinput virtual-device grab/close/SIGKILL recovery API check **only if /dev/uinput exists**. An unavailable kernel interface is explicitly SKIP, not PASS. GUI startup alone does not establish a valid normal logind session or compositor action delivery.
- Chromium runner: production integrity tests, actual page guard mouse tests and installed-extension startup/settings checks.

Consult the workflow run tied to the final commit for results; do not infer success merely because the workflow exists. No driver installation or physical tests are automated. CI results after the push are reported separately to the user, without rewriting this record/history.

## Artifacts

- `public/downloads/Treadory-0.3.0-windows-x64-preview.exe`: current web-packaged EXE. A compatibility `Treadory.exe` alias remains; the website links the versioned name. Authoritative committed snapshot and SHA-256 are under `native/windows-app/distribution/win-x64`.
- `native/platform-distributions/Treadory-0.3.0-macos-arm64-preview.zip`: committed app ZIP, copied into public downloads after source/artifact validation. `macos-release.json` records hashes and signing/test status.
- `native/platform-distributions/Treadory-0.3.0-linux-all-preview.deb`: committed dependency-based maintainer package. `linux-release.json` explicitly says runtime unverified and OS guard unavailable. It is not copied into public downloads.
- `public/downloads/Treadory-0.1.9-chrome-web-store-upload.zip`: generated upload package with Manifest V3 0.1.9, no nativeMessaging/helper assets. `extension-release.json` records bytes/SHA-256. Store publication remains a manual action; the website's normal install route is the existing Store listing.

Hashes/byte counts are in generated release JSON files rather than duplicated here. Packaging fails on stale source or mismatched artifacts. Source-hash records are integrity evidence, not a reproducible-build attestation.

## Unverified / release blockers

No physical pedal or ordinary mouse paired with it was tested. The IN-USB-3 right-click cause and arrival ordering remain unknown; no fix is claimed. Windows driver license/modern OS/security compatibility, app signing, macOS exclusive HID/tap/TCC behavior and notarization, Linux real session/compositor input/crash tests, resource measurements and clean-machine installation/uninstall are gates. Linux broad guard and a global Linux emergency chord are unimplemented. Additional Windows buttons beyond X1/X2 are outside hook coverage. Fixed supported taps are implemented; arbitrary shortcuts and universal media seek/rewind are not.

Timing guards are user-controlled, source-agnostic and can cancel legitimate ordinary-mouse clicks. Earlier input cannot be canceled retroactively. New-down eligibility ends at exactly 250 ms; canceled release ownership has a separate five-second failsafe and may end early on stop/pause. Movement/wheel remain available. See the detailed manual checklist in INPUT-VERIFICATION.md before making production claims.
