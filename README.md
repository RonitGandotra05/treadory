<p align="center"><img src="docs/assets/treadory-banner.svg" alt="Treadory. Your pedal, working your way." width="100%"></p>

<p align="center"><strong>Hands free. Full control.</strong><br>A local foot-pedal workbench and a compact browser extension.</p>

<p align="center"><a href="#get-started">Get started</a> · <a href="docs/EXTENSION.md">Extension guide</a> · <a href="#computer-wide-windows-preview">Computer-wide control</a> · <a href="https://treadory.netlify.app/privacy/">Privacy</a> · <a href="docs/DEVICE-PROGRAMMING.md">Device programming</a></p>

**Website:** [treadory.netlify.app](https://treadory.netlify.app/) · **Privacy policy:** [treadory.netlify.app/privacy/](https://treadory.netlify.app/privacy/)

Treadory helps you understand what your USB pedal sends, assign each physical control, and take those mappings to the websites you allow. The cream, charcoal and burnt-orange interface keeps advanced tools tucked away until you need them. No account, backend, analytics or remote fonts.

| Website | Browser extension |
| --- | --- |
| Choose your model; learn accessible raw inputs | Connect a readable USB pedal once |
| Simulate pedals without hardware | Left, middle, right and optional fourth control |
| Diagnose inputs in one compact dialog | Scroll, media, tabs, navigation and site buttons |
| Last 50 presses with computer timestamps | Default mappings plus per-site overrides |
| Model-specific hardware programming guidance | Optional access to one site or all normal websites |
| Limited checked PCsensor programming flow | Pause, learn inputs, export and import settings |

## Get started

Requires Node.js 22+ and Python 3 for packaging.

```sh
git clone https://github.com/RonitGandotra05/treadory.git
cd treadory
npm ci
npm run dev
```

Open the local URL printed by Vite (normally `http://127.0.0.1:5173`). Stop it with **Ctrl+C**. The website’s **Demo / Simulate** mode works without hardware.

### Install the extension

Open [Treadory on Chrome Web Store](https://chromewebstore.google.com/detail/treadory-%E2%80%94-foot-pedal-con/kkgfhpnkicjkkiignanfgceldfhlicfl) and choose **Add to Chrome**. No ZIP download or Developer mode is needed for normal installation.

1. Disconnect the pedal from the website. Open the extension and choose **Browser websites** under Control mode.
2. Choose **Connect**, then **Choose USB pedal** in the setup tab, authorize its readable USB interface, and click **Done**.
3. Allow the current website or all normal websites, choose each pedal’s action, and save.
4. Close the popup and release all pedals once. Mappings follow the active tab while the browser is focused.

Use **Learn pedal inputs** when controls need assigning or reassignment. Learning saves how Treadory interprets the input; it does not reset the pedal or rewrite its firmware. Browser websites needs no native helper and does not suppress an extra operating-system mouse click.

For normal desktop-app actions or selective replacement of a supported pedal’s original outputs, download the independent [Windows app](native/windows-app/README.md). It configures and runs its own actions without Chrome or the extension. Extension 0.1.9 retains removal of the old native-messaging helper integration; computer-wide mappings live only in the standalone app. Stop/disconnect browser pedal readers before standalone capture.

If presses appear but actions do not run, close the popup, release every pedal, then press on an allowed website. Reopen **Settings & help → Copy diagnostics** and share that report. It includes the last 50 press outcomes and failure categories, without website URLs, page content, device names, custom text, selectors or shortcut keys. Scroll diagnostics include requested and observed movement; a completed scroll means the position changed. Reports stay in memory and are never uploaded automatically.

Chrome requires **117+** and readable USB pedal input. Firefox and Safari lack the required WebHID API. Compatible Edge/Brave browsers and physical pedals still need manual verification; development QA used virtual HID and WebKit.

`public/downloads/treadory-extension.zip` is the generated package for a **maintainer’s Chrome Web Store update**, not the website’s user-install route. The website directs users to the Store listing above. Source builds can still be loaded unpacked for development; see the [extension guide](docs/EXTENSION.md). A Git push updates the website through hosting but does not upload or publish an extension update in the Store.

## What support means

- Known VEC Infinity and selected X-keys XK-3 raw HID modes have identity-checked decoders. Other readable USB pedals can be learned using stable press/release reports.
- Keyboard/mouse-only, Bluetooth keyboard, analog, MIDI and gamepad pedals cannot be identified as a specific pedal by this implementation. They need a suitable desktop bridge or another adapter.
- Browser mappings control the **active permitted website**, not desktop applications. Protected browser pages, extension stores and inaccessible cross-origin players are excluded. Website shortcuts and element clicks are simulated; sites may ignore them.
- Browser mode does **not** rewrite stored outputs or suppress OS clicks. The independent Windows app preview can consume original mouse-class input from one uniquely identified VEC endpoint and perform configured computer-wide actions. Correct conflicting utility mappings first; no matching endpoint means this backend cannot suppress the click. See [computer-wide feasibility](docs/INPUT-ARCHITECTURE.md) and [Windows app setup and recovery](native/windows-app/README.md).
- The website has a separate, narrowly checked PCsensor hardware programming flow. Other models receive manufacturer-specific guidance. Input decoder support does not establish device programmability. See [programming support](docs/DEVICE-PROGRAMMING.md).

## Build and verify

```sh
npm run build
npm test
npm run preview
```

The build creates the static website in `dist/`, the unpacked Manifest V3 extension in `dist-extension/`, and the upload ZIP. CI verifies production assets, package paths and permission boundaries. Portable native-mode fixtures are in `verification/`; local browser screenshots and test output are excluded from this public repository.

Settings stay in the website’s localStorage or the extension’s local storage. Their formats are separate; neither silently overwrites the other. USB permission must be granted separately. Press history stays in memory and is cleared when its page or worker restarts. Exported settings may contain your custom text and website presets—review them before sharing. Read the [privacy policy](docs/PRIVACY.md).

### Deploy the website

Deploy `dist/` to a static HTTPS host. For public search metadata, set your actual domain when building:

```sh
VITE_SITE_URL=https://your-real-domain.example/ npm run build
```

Replace that example with the real URL. The build prerenders HTML and generates canonical, sharing and sitemap URLs only when a valid public domain is supplied. The generated `robots.txt` allows public pages and rendering assets, and points to the canonical sitemap. `agents.txt` is an optional public product reference, not a Google indexing requirement. Hosting serves download/reference files with `X-Robots-Tag: noindex` and redirects duplicate index-file URLs. SEO build checks validate rendered content and metadata; see [SEO setup and Search Console verification](docs/SEO.md). Submit the sitemap through Search Console after deployment. Localhost is not searchable, and indexing/rankings cannot be guaranteed.

## Inside the project

| Path | Purpose |
| --- | --- |
| `src/` | React workbench, shared HID decoding, calibration and device support |
| `extension/` | Compact popup, background USB reader and website actions |
| `scripts/` | Static prerendering, reproducible ZIP packaging and release checks |
| `docs/` | Support boundaries, privacy, installation and technical references |
| `.github/workflows/build.yml` | Production build checks and packaged extension artifact |

The extension follows Chrome’s documented [WebHID service-worker flow](https://developer.chrome.com/docs/extensions/how-to/web-platform/webhid): user authorization in the popup, authorized input reading in the worker. Website access is [optional and requested by the user](https://developer.chrome.com/docs/extensions/develop/concepts/declare-permissions). No remote executable code or telemetry is included.

<p align="center"><sub>Your pedal. Your preference. Local first.</sub></p>

## Automatic hosting

The production site is a static Netlify deployment linked to this repository through Netlify’s GitHub App. Each push to `main` runs `npm run build && npm test` and publishes only after those checks pass. GitHub Actions separately verifies pull requests and offers a manual check. Netlify deploy previews and branch deploys are disabled. There are no server functions, paid analytics or duplicate GitHub builds on pushes to `main`.

Deployment configuration is in `netlify.toml`, including the real public URL for canonical metadata and the sitemap. No Netlify credential is stored in GitHub. Netlify’s production-deployment and traffic usage remain subject to the team’s plan; automatic deployments cannot eliminate per-production-deploy credits on credit-based plans.

## Standalone Windows app

Choose **System-wide** in the website’s shared control card or use the Computer-wide entry beneath Connect. It offers **Download Windows app (.exe)** and a separately labeled macOS preview. `/downloads/Treadory-0.3.0-windows-x64-preview.exe` is a portable, self-contained Windows x64 app, not a helper ZIP. Download it into a writable folder and open it; its .NET runtime is included, with license notices embedded. No Chrome extension, browser, PowerShell registration, service or administrator app launch is required. It is an unsigned developer preview; physical Windows testing is still pending.

The app provides inspection, left/middle/right learning, local action settings, explicit testing/verification/activation, pause, stop and recovery. It runs balanced keys (Space, Enter, F13–F24), media toggle and scrolling in normal Windows desktop apps and browsers. Website-specific DOM actions remain available through the optional Chrome extension. Stop/disconnect the extension and other pedal readers to avoid duplicate desired actions.

Original mouse-output suppression still requires an independently obtained, appropriately licensed Interception driver plus a trusted x64 DLL. Treadory distributes neither. Driver installation needs administrator access and a reboot as officially instructed; app inspection needs neither. Only one uniquely identified VEC `05f3:00ff` mouse endpoint is eligible; ordinary mice are excluded. No matching endpoint means this backend cannot suppress the click, and another utility’s injected click must be fixed at source. Windows ARM64 is unavailable. A macOS arm64 prototype and Linux isolation package have separate limitations below. See [standalone setup, recovery and removal](native/windows-app/README.md).

Settings persist only mappings and the accepted DLL checksum under `%LOCALAPPDATA%/Treadory/settings.json`; capture, learned inputs and device identity never persist. The driver DLL is copied beside the EXE after license acknowledgment, exact SHA-256 and x64 DLL checks, and its integrity is checked before integration. Start and activation are explicit every session. Stop, exit, recovery chord, device changes, lock/sleep, action failure and five-second settings-window heartbeat loss release capture. Pause retains original-output suppression.

Normal website builds package the versioned source-hash-checked standalone snapshot under `native/windows-app/distribution/win-x64`. Netlify needs no .NET SDK. To change the app, run `dotnet run --project native/windows-app-tests`, publish with `dotnet publish native/windows-app -c Release -r win-x64 -o releases/windows-app`, then `npm run build:app-snapshot` and `npm run build`. Commit the refreshed EXE/snapshot with its source. `npm test` verifies the bundled x64 GUI binary, download hash and source freshness. Windows CI is configured for executable and initial GUI smoke tests; driver/pedal tests remain manual release gates. The old helper sources and integrity tests are retained as historical development material; the current extension does not request nativeMessaging, connect to a helper or include its setup page.

Created by [Ronit Gandotra](https://github.com/RonitGandotra05) · [LinkedIn](https://www.linkedin.com/in/ronitgandotra). The website footer and search metadata include the same creator attribution.

### Optional 250 ms click guard

Extension 0.1.9 offers **Unwanted clicks**, with **All buttons** (left, middle, right and page-supported additional buttons) or **Right-click only**. It is off by default. An already-enabled older right-click setting migrates to Right-click only; no silent broad blocking. Allow the website, close setup and release pedals before testing. New physical press edges arm a monotonic deadline before configured actions, including Do nothing; held reports do not renew it. Repeated presses update the deadline. An older/expired injection cannot extend or clear a newer guard.

Windows app 0.3.0 and the macOS prototype have separate opt-in OS guards. Their device-specific capture remains stronger and available with the guard off. Timing protection cannot identify the click's device: legitimate ordinary-mouse clicks in the selected scope can also be blocked. Movement/wheel and configured actions remain available. Canceled downs keep their releases canceled for up to five seconds; a preexisting drag can finish. Pause/stop/disconnect clears protection; unusually late or cleared orphan releases may pass. No ordinary-click delay or canceled-input replay is implemented.

Extension protection is only within permitted frames. Chrome toolbar/protected pages and all other apps are outside its scope. Keyboard context menus with nonmouse button identity and synthetic actions pass; a contextmenu without an observed down passes to preserve existing/keyboard sequences. Actions or handlers already executed cannot be undone. Injection latency/navigation/inaccessible frames can prevent protection. OS hooks/taps likewise cannot undo an already-delivered click, and do not cover all Raw Input/HID/security-desktop consumers. The affected user's source is unresolved; no physical fix is claimed.

### macOS and Linux preview status

[macOS setup](native/macos/README.md): `Treadory-0.3.0-macos-arm64-preview.zip` contains an AppKit .app, built for macOS 14+ arm64 only. Pure policy and GUI startup checks ran on the macOS host; HID seizure, TCC grants, event-tap suppression and physical pedals remain unverified. Ad-hoc signing is not Developer ID signing/notarization; those are public-release gates. Only one eligible two-byte VEC HID service is accepted. Configure supported Quartz scroll/key taps locally; media seeking needs an app binding. No Intel download exists.

[Linux setup](native/linux/README.md): `native/platform-distributions/Treadory-0.3.0-linux-all-preview.deb` is a real dependency-declaring Python/Tk/evdev package for maintainer testing. Runtime/desktop verification is pending on a Linux runner, so the website does not offer its download. It isolates only one eligible button-only VEC node and uses uinput for supported actions. **Linux OS timing guard is unavailable**; no ordinary-mouse grab/forwarding worker is implemented. Narrow udev grants and systemd-logind are required; never run the GUI as root. X11/Wayland and crash recovery require real OS tests. No auto-capture or telemetry.

See [audit findings and reproduction](docs/AUDIT-2026-10-10.md), [current sourced feasibility matrix](docs/PLATFORM-FEASIBILITY.md), and [verification record](docs/VERIFICATION-2026-10-10.md). Rebuild native platform snapshots with `python3 scripts/package-platforms.py macos --gui-test` and `python3 scripts/package-platforms.py linux` before website packaging. Normal Node builds validate hashes without compiling desktop runtimes.

### Extension 0.1.9: independent desktop configuration

The extension no longer requests nativeMessaging. Its popup links to the standalone app download and disconnects its USB reader first. Install and configure the Windows app separately; stop app capture before reconnecting the browser extension. No nativeMessaging justification is needed in the Chrome Web Store submission for this version.

Guard clearing in the extension is best effort when website permission has already been revoked or a frame becomes inaccessible. A remaining listener still has the original finite 250 ms new-click deadline and five-second sequence cleanup; it cannot block new clicks indefinitely.
