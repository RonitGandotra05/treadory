# Windows computer-wide helper — developer preview

This preview replaces original mouse-class strokes from one identity-checked VEC `05f3:00ff` endpoint with configured computer-wide actions. It does not prove that your IN-USB-3 exposes that endpoint. If it is not listed, do not select another mouse: investigate another remapping utility first. Ordinary mice are never selected by name, timestamps or button guesses.

Not physically verified on Windows. Use a test computer before production deployment. Windows x64 only; no ARM64 support claimed. No Mac/Linux binaries are included. The helper cannot suppress another utility's device-independent injected click; disable that conflicting mapping at source.

## Inspect first without a driver

Install the .NET 10 x64 Runtime and unzip the built Windows preview. Run `install.ps1 -ExtensionId YOUR_EXTENSION_ID` with your actual extension ID. This installs only the per-user host; no administrator access, Interception driver or DLL is needed for read-only inspection. In the extension, open Computer-wide control, connect the helper and inspect endpoints. The helper reads Windows device metadata without registering for mouse/key input. It reports whether VEC raw HID and/or mouse endpoints exist, without exposing hardware paths or serials. No matching mouse endpoint means this suppression backend cannot attribute the click; correct a conflicting utility mapping first.

If an eligible mouse endpoint is found and an OS fix is still needed, stop/disconnect and uninstall this diagnostic installation before reinstalling with your separately licensed DLL as below.

## Prerequisites for computer-wide replacement

1. Quit every other pedal/remapping/transcription utility, pause Treadory's browser actions and test the middle pedal in another app. If quitting a utility removes the click, fix that utility's mapping first. A native helper may then be unnecessary.
2. For a device-generated mouse click, independently obtain the [official Interception project](https://github.com/oblitum/Interception). Review its applicable license; commercial product use needs a commercial license. Treadory redistributes no Interception assets. Install its driver using its official administrator installer and reboot as instructed. Its compatibility with your Windows/security configuration must be checked. Do not turn off security protections to load a driver.
3. Install Microsoft's [.NET 10 x64 Runtime](https://dotnet.microsoft.com/en-us/download/dotnet/10.0) (console runtime, not the SDK). The lightweight preview package uses that shared runtime. A self-contained/signed production installer remains a release gate.
4. Unzip the Windows preview. Load the Treadory extension and copy its 32-letter ID from your browser's extensions page. Obtain the matching official **x64** `interception.dll` and independently check its SHA-256 against your trusted copy.
5. In ordinary x64 PowerShell, from the unzipped directory, run:

```powershell
.\install.ps1 -ExtensionId YOUR_EXTENSION_ID -InterceptionDll C:\path\to\x64\interception.dll -DllSha256 YOUR_VERIFIED_SHA256 -AcceptApplicableInterceptionLicense
```

The ID and hash above are placeholders: replace them with actual values. No administrator permission is required for Treadory's per-user host registration. Driver installation is separate and does require it. The installer refuses existing registrations and verifies the supplied DLL hash. It does not change execution policy or download software.

6. Open **Computer-wide control** in the extension. Explicitly allow native messaging, inspect the pedal, review the capture notice, then start an isolated test. Learn left, middle and right individually, including release. Choose their actions and activate computer-wide control. No auto-capture is saved. This mode disconnects the WebHID reader so browser mappings do not also execute.

## Test and recovery

While captured, all original strokes from the selected pedal are consumed, even when its configured actions are paused. Original mouse clicks return when capture stops or the helper disconnects. This is session remapping, not firmware programming. Release every pedal and mouse button before starting. Repeat learning after every new session.

Choose Space or F13 for the middle pedal and bind that key in your target app. Verify the middle pedal produces only that action in a native app and browser; simultaneously right-click using your normal mouse. Test every pedal, chords, holds, pause/resume, unplug/replug, lock/sleep and browser/host termination. Do not assert source resolution from a missing event alone. A selected driver endpoint is device-attributed evidence, not proof that other utilities cannot also inject clicks.

**Ctrl + Alt + Shift + F12** stops capture on a normal desktop. The UI also offers Stop and Disconnect. Native port EOF or a five-second heartbeat expiry closes the filter. Device inventory changes, unexpected pointer movement and unsupported packets stop capture. Stopping may restore the very unwanted output you were suppressing; this is deliberate recovery. If recovery fails, disconnect the pedal, exit the browser/helper, then follow the official driver uninstall procedure.

Actions are balanced key taps, media toggle or one scroll notch. No key combinations, arbitrary commands, hold actions or custom text. SendInput can be refused by elevated applications, UAC, secure desktops or target apps. Those cases are not supported by this preview.

Run `uninstall.ps1` after stopping/disconnecting to remove only Treadory's files and browser host registrations. Uninstall the separately obtained driver using its own official tool if desired.

## Build and verify

```sh
dotnet run --project native/windows -- --self-test
dotnet publish native/windows -c Release -r win-x64 --self-contained false -o releases/windows/host
npm run build:helper-snapshot
node scripts/package-helper.mjs
```

The package includes the built Windows executable, managed assembly/runtime configuration and setup/removal scripts. No Interception DLL or driver is bundled. The .NET apphost license notice is included. Normal website builds use the versioned `distribution/win-x64` snapshot and verify its source/binary checksums, so a clean checkout can supply the actual download without the .NET SDK. Commit a refreshed snapshot whenever native source changes. `TREADORY_HELPER_DIR` can explicitly select a different published host for development packaging. Test core policy on any .NET 10 machine; run native and installation tests on Windows with the real pedal. Pure tests do not verify the driver, DLL ABI execution, signing, registry installation or USB behavior.

If you downloaded the source ZIP instead of cloning the repository, open its extracted directory and run `dotnet run --project Treadory.Helper.csproj -- --self-test`, then `dotnet publish Treadory.Helper.csproj -c Release -r win-x64 --self-contained false -o host`. The included installer expects that `host` directory beside it. Build outputs and the compiler are not included in the source ZIP.

## Privacy and trust

No network listener or telemetry. Native messaging is allowed only for the installed extension origin and the extension never exposes it to websites. Full hardware IDs are used transiently for source isolation; the UI receives opaque session tokens and fixed model labels, not serials or paths. The helper checks device inventory and the emergency chord but records no ordinary mouse/key content. Mappings stay in browser-local extension storage. No process scanning, clipboard reading or automatic diagnostic uploads.
