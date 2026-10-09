# Treadory extension

A compact Manifest V3 companion for readable USB pedals. It listens to the authorized device directly, rather than treating your ordinary keyboard or mouse as pedal input.

## Install

Open [Treadory on Chrome Web Store](https://chromewebstore.google.com/detail/treadory-%E2%80%94-foot-pedal-con/kkgfhpnkicjkkiignanfgceldfhlicfl) and choose **Add to Chrome**. Normal users do not need a ZIP or Developer mode. The Store listing ID is `kkgfhpnkicjkkiignanfgceldfhlicfl`; its current public version was not independently verified during these changes.

## Control mode

**Browser websites** performs scrolling, media, website shortcuts and other configured actions on permitted website tabs. No native helper is needed. **Learn pedal inputs** assigns physical controls in software; it does not reprogram firmware or remove an operating-system click.

**Computer-wide** opens the Windows helper’s setup for normal desktop-app actions and selective replacement of outputs from one supported pedal mouse endpoint. The helper and, for replacement, its separately licensed driver must be installed explicitly. There is no automatic capture, and no global right-click blocking. Switching back to Browser websites disconnects the helper and restores original pedal input; reconnect USB before using browser mappings. Pausing only the helper’s chosen actions keeps original outputs suppressed until capture stops. See [helper setup and recovery](../native/windows/README.md).

The popup reflects the actual connected mode. Opening Computer-wide setup does not activate it. If the installed Store version has no Computer-wide control, it needs a companion-enabled Store update; publishing the website alone cannot provide that update.

## Daily use

Click Connect in the popup to open a persistent setup tab, then click Choose USB pedal and select your device in the browser picker. Click Done to close setup. Reopen the popup on your website, allow it, assign actions and save. Close the popup to use the pedal. Opening the popup pauses action execution while you edit; a notice near the top makes this explicit. The USB setup tab pauses actions only while its chooser/connection attempt is active, and releases that pause immediately when the attempt finishes. Leaving a completed setup tab open does not pause your website controls. Release held pedals before resuming. Only the active HTTP/HTTPS tab in the focused browser window is controlled.

Choose **All allowed sites** for defaults or **This site** for an override. Scroll distance and media seek duration can be adjusted. Website button actions need a unique CSS selector; text insertion needs a focused plain text field. Website shortcuts are paired simulated key events, not native browser shortcuts. Password fields are excluded from DOM actions.

Known Infinity and selected XK-3 raw modes work directly. In **Device setup**, other readable USB devices can learn each physical control from a neutral report, stable hold and release. Learning changes the extension’s interpretation, not the pedal’s firmware. Unstable/overlapping inputs are rejected. Reconnect a physically stuck pedal or check its cable and switch.

## Access and privacy

Required permissions:

| Permission | Reason |
| --- | --- |
| `storage` | Save local mappings, learned inputs and chosen device metadata |
| `scripting` | Apply the requested action to an allowed website |
| `activeTab` | Identify the current website when the user opens the popup |

`nativeMessaging` is optional and requested only when the user connects the Windows helper.

HTTP/HTTPS host access is optional. **Allow this site** grants one origin; **Allow all websites** grants all normal websites. Access can be removed in Settings. USB authorization uses the browser’s separate WebHID chooser. There are no background network requests, analytics or external scripts. Recent presses retain at most 50 records in worker memory.

No content script continuously captures ordinary mouse clicks or keystrokes. Browser DOM events do not identify their physical source, so the extension cannot reliably prove that a specific pedal also emitted an OS mouse click. Browser mode does not intercept or suppress those existing outputs. Only the separately installed helper can attempt device-specific replacement after endpoint inspection.

## Developer installation

Run `npm ci` and `npm run build`. In `chrome://extensions` (or compatible `edge://extensions`), enable Developer mode, choose Load unpacked and select `dist-extension`. Alternatively download the preview release ZIP and unzip it first. Reload the extension after rebuilding.

Scrolling targets the visible nested feed when a website does not scroll its document, including vertical snap containers used for reels. Media controls prefer the visible video over off-screen preloaded videos. If scrolling is at a boundary or no scrollable content is found, the last action status explains it.

Chrome 117+ is required for WebHID in extension workers. Edge/Brave are compatibility targets, not separately verified releases. Firefox/Safari are unsupported by this raw USB implementation. Restricted browser pages, browser stores, file URLs and some embedded players are unavailable.

## Chrome Web Store upload

1. Build and use `public/downloads/treadory-extension.zip`. The ZIP contains `manifest.json` at its root; do not upload the repository ZIP.
2. Load it unpacked and test your actual pedal before submission. Verify each physical control, permissions, pause/resume, browser focus, reconnect, media, site overrides and popup editing.
3. Upload it as an update to listing `kkgfhpnkicjkkiignanfgceldfhlicfl` through your Chrome Web Store developer dashboard. Supply your own screenshots and listing assets. The packaged icons are included.
4. Describe the single purpose: map supported USB foot-pedal presses to actions on websites the user allows. Explain each permission using the table above.
5. Publish a public privacy-policy URL using `docs/PRIVACY.md`; the extension also contains an offline privacy page. Complete the store’s privacy disclosures accurately.
6. Increment `extension/manifest.json` version for every later upload, rebuild, and await store review. Git commits/pushes and Netlify deployments do not upload or publish the extension; the developer-dashboard update is a separate step. Keep the published Store version and privacy disclosures consistent with its actual capabilities, including the optional helper permission when releasing it.

## Validation status

Production builds and package/permission checks pass. Local virtual worker tests exercise source isolation, hold/release, permissions, focus, per-site actions, timestamps and generic calibration. WebKit verifies DOM actions and responsive popup/website UI with mocked extension APIs. These checks do not reproduce the native Chromium extension permission/service-worker environment. Physical hardware and a real unpacked Chrome installation still require the manual checks above.

Reference: [Chrome WebHID extension documentation](https://developer.chrome.com/docs/extensions/how-to/web-platform/webhid).
