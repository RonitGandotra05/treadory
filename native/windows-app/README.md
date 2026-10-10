# Treadory Windows app — standalone developer preview

Download Treadory.exe, place it in a writable folder and open it. This is a portable, self-contained Windows x64 application: no Chrome extension, browser, PowerShell registration or separate .NET runtime installation is required. It includes Microsoft runtime licensing notices under Setup & recovery → License notices. Closing the app stops capture. No auto-start, service, administrator launch or automatic capture is configured.

Computer-wide actions are balanced Space/Enter/F13–F24 taps, media play/pause and one-notch scrolling in normal desktop apps, including supported Windows browsers. Website-specific DOM actions still belong to the optional Chrome extension. Pause/disconnect any browser pedal reader and other pedal utilities before using this app to prevent duplicate desired actions. This EXE cannot run on macOS or Linux and does not supply Safari/macOS support.

## Inspect before changing input

Choose Inspect pedal. Read-only Windows metadata inspection requires no driver. Only a uniquely identified VEC 05f3:00ff mouse-class endpoint is eligible. No matching endpoint means this backend cannot attribute or suppress the click. Quit other transcription/remapping tools first: if the unwanted click disappears, correct that utility instead. Ordinary mice are never selected by friendly names, timing or button guesses.

## Optional driver integration

Original-output replacement still needs the independently obtained, appropriately licensed Interception driver from https://github.com/oblitum/Interception. Treadory does not bundle or download its driver/DLL. Commercial use requires reviewing the applicable commercial license. Install the driver with its official administrator tool and reboot as instructed. Check Windows/security compatibility; do not disable protections to force installation.

In Setup & recovery, choose your trusted official x64 interception.dll, enter its independently verified SHA-256 and confirm that your use is licensed. Treadory verifies the checksum and x64 DLL header before copying it beside Treadory.exe, and checks its checksum again before loading. The folder must be writable. Existing DLL files are not overwritten. Restart after changing a DLL. A matching hash verifies your selected trusted copy, not publisher authenticity or driver compatibility. The driver is installed separately; importing a DLL does not install a driver.

## Configure and verify

1. Inspect the pedal again after driver setup.
2. Review the recovery checkbox. Release every mouse button and pedal, then Start isolated test. Original outputs from only the selected eligible pedal are consumed during learning and while paused.
3. Learn left, middle and right individually: press and completely release each physical pedal. Repeat learning each new capture session.
4. Select actions and Save actions. Only mappings, the optional guard scope and the accepted DLL checksum persist locally under %LOCALAPPDATA%/Treadory/settings.json. Endpoint identities, learned inputs and capture/activation are never persisted.
5. Test that original outputs are absent in other apps and that your ordinary mouse still works, then check both verification boxes and Activate. Do not activate solely because an event appears absent.
6. Pause actions retains suppression; Stop capture restores original input. Ctrl+Alt+Shift+F12 is the emergency chord on the normal desktop. Closing, locking, sleeping, device-inventory changes, unsupported packets, action failure or a five-second UI heartbeat loss stops capture. Inspect and learn again to restart.

No automatic diagnostics, network listener, page reading, clipboard access or telemetry. Ordinary mice remain outside selected-driver capture; enabling the timing guard can still cancel their clicks. Elevated apps, UAC/secure desktops, unsupported endpoint types and pedal pointer movement are excluded. Other utilities' independent injections cannot be attributed to the selected pedal. Learned mappings are software settings, not pedal firmware programming.

## Remove and recover

Stop capture, close the app and delete Treadory.exe and its imported DLL. Use Clear saved settings before closing, or delete %LOCALAPPDATA%/Treadory/settings.json. Uninstall the separately installed driver with its official removal tool if desired. If recovery fails, unplug the pedal, terminate the app and follow the driver removal instructions. No Chrome host registration is created by this app; an older helper installation must be removed with its original uninstall.ps1 separately.

## Release limitations and build

Unsigned developer preview; physical Windows/pedal validation is pending. Do not bypass security warnings or disable protections. Signing, clean-machine GUI/runtime testing, driver compatibility, real ordinary-mouse isolation and resource measurements remain release gates. Compile-time checks and mock tests cannot prove physical suppression.

Build with .NET 10: dotnet publish native/windows-app -c Release -r win-x64 -o releases/windows-app
Portable tests: dotnet run --project native/windows-app-tests
Windows executable tests: Treadory.exe --self-test
The release contains only Treadory.exe; runtime libraries self-extract as required by Microsoft's single-file deployment. No third-party input-driver assets are embedded.

## Optional 250 ms OS click guard (0.3.0)

Before capture, choose Off (default), All buttons (left, middle, right, X1 and X2), or Right-click only. The preference is local; older settings migrate to Off. This is complementary to selected-pedal suppression, which remains active during capture even when the guard is off. In this preview the decoded source still requires the eligible driver endpoint; the hook alone cannot detect a generic HID pedal.

A decoded physical press edge arms a monotonic TickCount64 deadline before the action runs, including No action. The window for new downs is exactly `[detection, detection + 250 ms)`. Repeated physical edges renew it; held repeat packets do not. The dedicated low-level mouse hook can cancel normal-desktop mouse messages from any source during the window, including ordinary-mouse clicks and external injections. It has no physical device identity. Own tagged SendInput actions are exempt; that marker does not identify pedal-generated external input. Wheel, movement and keyboard events are excluded.

A canceled down owns its up for at most five seconds, even beyond the 250 ms window. An observed down before the window and its release remain allowed, preserving an existing drag. An unknown up also passes. Disabling/pause/stop clears protection immediately; no canceled input is replayed and no ordinary click is delayed. A late orphan release can then reach an up-only handler. The five-second failsafe lets an unusually long canceled hold's up pass rather than retaining blocking indefinitely. Additional buttons beyond Windows X1/X2 are unsupported by WH_MOUSE_LL.

This is not a universal Raw Input/HID/security-desktop filter. Windows may silently remove a hook after a timeout; a dedicated short callback reduces that risk but cannot prove ongoing protection. Process exit removes user-space hooks; real driver/crash cleanup remains a manual gate. A click already delivered before pedal detection or hook activation cannot be undone. Measure both stream ordering and click visibility with hardware; do not assign the original right-click's cause by timing.

Windows CI includes `--guard-test`, a synthetic SendInput test of the actual hook and own-action exemption, separately from `--self-test` and `--ui-test`. These do not exercise the physical pedal or driver. Physical keyboard modifiers and Windows scroll-under-pointer settings can affect action routing. Seeking/rewinding requires an application's supported binding (for example one of F13–F24); arbitrary shortcut combinations and a universal rewind are not implemented.
