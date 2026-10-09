# Windows helper verification record

Local verification: 10 October 2026, macOS ARM64. No Windows machine, physical pedal or Interception installation was available. This record distinguishes portable checks from hardware validation.

## Passed locally

| Check | Result and coverage |
| --- | --- |
| `npm run build` | React/TypeScript production website, extension bundle, prerendering and preview/source ZIP packaging succeeded. |
| Clean-checkout build | Exported only the staged repository files to a temporary directory, reused installed npm dependencies, and ran the production build and `npm test` successfully. No ignored local Windows host or .NET SDK was needed for website packaging; the versioned executable and download integrity checks passed. |
| `npm test` | Release permissions/assets/download integrity checks, 12 native-bridge tests, two executable/source integrity tests and native-worker integration fixture passed. Covers fixed command/action whitelists, malformed replies, stale connections, timeouts, heartbeat recovery messages, trusted extension senders, optional permission, concurrent WebHID/native-mode switching, no duplicate browser actions, no automatic recapture and rejection of changed sources/damaged binary snapshots. |
| Helper `--self-test` | 34 portable assertions passed using .NET 10.0.401. Covers exact hardware identity, foreign-device isolation, three-control learning, releases/chords/deduplication, action whitelist, neutral activation, lease expiry, framing limits and unmanaged structure sizes. No native Windows API or DLL execution asserted. |
| Windows x64 cross-publish | `dotnet publish native/windows -c Release -r win-x64 --self-contained false -o releases/windows/host` succeeded. Compiling a PE executable does not verify running it on Windows. |
| Native setup/browser fixture | 21 scenarios passed with Playwright WebKit and a virtual helper against the production website build. Covers permission denial, missing endpoint, explicit capture/learning, verification gates, pause versus stop, website repair-to-setup navigation, main-control entry link, direct fragment navigation, binary/source download conditions, HTTP 200 and ZIP bytes for the actual download, ordinary DOM right-click and layouts at 1100, 390 and 320 pixels. No physical suppression assertion. |
| Existing unit tests | 25 decoder, configuration, diagnostic observation and supported programming-protocol tests passed. Diagnostic timing observations are not used to suppress OS input. |
| Existing extension worker | Source isolation, arming, deduplication, focus/permissions, pause, disconnect and calibration fixture passed. |
| Existing browser regression suites | Website browser, tools and extension browser scenarios passed. Layout issue in the new repair link was fixed and rechecked at mobile widths. |
| Whitespace validation | `git diff --check` passed. |

The packaged helper is a framework-dependent developer preview, about 111 KiB including the .NET apphost license and notices. It requires the shared .NET 10 x64 Runtime and includes no Interception DLL or driver. Its generated release manifest records the exact ZIP size and SHA-256, and explicitly reports `physicalVerification: false`. The versioned executable snapshot contains only the four required host files plus a checksum manifest; embedded local debug paths are disabled. Runtime/driver installation size and CPU/RAM have not been measured. No deployment or driver installation was performed. The temporary production-preview server was stopped after browser verification.

## Prepared but not executed here

The Windows CI workflow runs both the freshly published and versioned executable's self-tests, including two additional Windows metadata checks, and the PowerShell installer fixture. The installer fixture checks parsing, checksum rejection, diagnostic installation without a DLL, Unicode/spaced paths, origin restriction, overwrite refusal and ownership-preserving removal. Its dummy DLL is used only as an installation file; it never loads a driver or captures input. The workflow has not been executed from this workspace.

## Remaining release gates

1. Establish the right-click source on the affected computer. Quit other remapping/transcription utilities and compare behavior outside Treadory. Inspect the real endpoint metadata. No matching mouse endpoint means this backend is not an established fix.
2. Confirm applicable Interception commercial licensing and driver support on the exact Windows version/security configuration. Windows 11, HVCI, Secure Boot and ARM64 compatibility are not established by the project's documented Windows XP–10 testing. ARM64 is refused by this preview.
3. On supported Windows x64 hardware, prove all original selected-pedal outputs are suppressed in native apps and browsers while simultaneous ordinary mouse input remains normal. Confirm other utilities do not independently inject clicks. Test all three controls, holds, chords and repeats.
4. Verify filter restoration for Stop, disconnect, helper/browser crash, lease expiry, unplug/replug, duplicate pedals, lock/unlock and sleep/wake. Verify no stuck inputs and the emergency chord. Portable lifecycle tests cannot establish driver crash cleanup.
5. Run clean-machine installer/uninstaller and Chrome/Edge/Brave native messaging tests. Establish signing and a production installer; measure resource use and action latency. Elevated apps and secure desktops remain outside the initial scope.

See [the sourced architecture decision](INPUT-ARCHITECTURE.md) and [setup/recovery instructions](../native/windows/README.md). Mac and Linux backends are not implemented or offered as downloads.
