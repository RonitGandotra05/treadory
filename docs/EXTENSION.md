# Treadory extension

A compact Manifest V3 companion for readable USB pedals. It listens to the authorized device directly, rather than treating your ordinary keyboard or mouse as pedal input.

## Daily use

Click Connect in the popup to open a persistent setup tab, then click Choose USB pedal and select your device in the browser picker. Click Done to close setup. Reopen the popup on your website, allow it, assign actions and save. Close the popup to use the pedal. Opening the popup pauses action execution while you edit. Release held pedals before resuming. Only the active HTTP/HTTPS tab in the focused browser window is controlled.

Choose **All allowed sites** for defaults or **This site** for an override. Scroll distance and media seek duration can be adjusted. Website button actions need a unique CSS selector; text insertion needs a focused plain text field. Website shortcuts are paired simulated key events, not native browser shortcuts. Password fields are excluded from DOM actions.

Known Infinity and selected XK-3 raw modes work directly. In **Device setup**, other readable USB devices can learn each physical control from a neutral report, stable hold and release. Learning changes the extension’s interpretation, not the pedal’s firmware. Unstable/overlapping inputs are rejected. Reconnect a physically stuck pedal or check its cable and switch.

## Access and privacy

Required permissions:

| Permission | Reason |
| --- | --- |
| `storage` | Save local mappings, learned inputs and chosen device metadata |
| `scripting` | Apply the requested action to an allowed website |
| `activeTab` | Identify the current website when the user opens the popup |

HTTP/HTTPS host access is optional. **Allow this site** grants one origin; **Allow all websites** grants all normal websites. Access can be removed in Settings. USB authorization uses the browser’s separate WebHID chooser. There are no background network requests, analytics or external scripts. Recent presses retain at most 50 records in worker memory.

No content script continuously captures ordinary mouse clicks or keystrokes. Browser DOM events do not identify their physical source, so the extension cannot reliably prove that a specific pedal also emitted an OS mouse click. It neither intercepts nor suppresses those existing outputs.

## Install locally

Run `npm ci` and `npm run build`. In `chrome://extensions` (or compatible `edge://extensions`), enable Developer mode, choose Load unpacked and select `dist-extension`. Alternatively download the preview release ZIP and unzip it first. Reload the extension after rebuilding.

Chrome 117+ is required for WebHID in extension workers. Edge/Brave are compatibility targets, not separately verified releases. Firefox/Safari are unsupported by this raw USB implementation. Restricted browser pages, browser stores, file URLs and some embedded players are unavailable.

## Chrome Web Store upload

1. Build and use `public/downloads/treadory-extension.zip`. The ZIP contains `manifest.json` at its root; do not upload the repository ZIP.
2. Load it unpacked and test your actual pedal before submission. Verify each physical control, permissions, pause/resume, browser focus, reconnect, media, site overrides and popup editing.
3. Upload it through your Chrome Web Store developer dashboard. Supply your own screenshots and listing assets. The packaged icons are included.
4. Describe the single purpose: map supported USB foot-pedal presses to actions on websites the user allows. Explain each permission using the table above.
5. Publish a public privacy-policy URL using `docs/PRIVACY.md`; the extension also contains an offline privacy page. Complete the store’s privacy disclosures accurately.
6. Increment `extension/manifest.json` version for every later upload, rebuild, and await store review. Treadory has not submitted or published a store listing.

## Validation status

Production builds and package/permission checks pass. Local virtual worker tests exercise source isolation, hold/release, permissions, focus, per-site actions, timestamps and generic calibration. WebKit verifies DOM actions and responsive popup/website UI with mocked extension APIs. These checks do not reproduce the native Chromium extension permission/service-worker environment. Physical hardware and a real unpacked Chrome installation still require the manual checks above.

Reference: [Chrome WebHID extension documentation](https://developer.chrome.com/docs/extensions/how-to/web-platform/webhid).
