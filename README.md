<p align="center"><img src="docs/assets/treadory-banner.svg" alt="Treadory. Your pedal, working your way." width="100%"></p>

<p align="center"><strong>Hands free. Full control.</strong><br>A local foot-pedal workbench and a compact browser extension.</p>

<p align="center"><a href="#get-started">Get started</a> · <a href="docs/EXTENSION.md">Extension guide</a> · <a href="docs/PRIVACY.md">Privacy</a> · <a href="docs/DEVICE-PROGRAMMING.md">Device programming</a></p>

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

### Load the extension

```sh
npm run build
```

1. Open `chrome://extensions` and enable **Developer mode**.
2. Choose **Load unpacked**, then select this project’s `dist-extension` folder.
3. Disconnect the pedal from the website. Open the extension, choose **Connect**, and authorize its readable USB interface.
4. Allow the current website or all normal websites, choose each pedal’s action, and save.
5. Close the popup and release all pedals once. Mappings follow the active tab while the browser is focused.

The same unpacked package is intended for compatible desktop Edge/Brave versions. Chrome requires **117+**. Firefox and Safari lack the required WebHID API. Other browsers, native extension loading and physical pedals still need manual verification; development QA used virtual HID and WebKit, without launching Chrome.

`public/downloads/treadory-extension.zip` is the generated ZIP for a browser-store developer upload. A built ZIP is also attached to the GitHub preview release. It is **not yet published in any browser store**. See the [extension and store checklist](docs/EXTENSION.md).

## What support means

- Known VEC Infinity and selected X-keys XK-3 raw HID modes have identity-checked decoders. Other readable USB pedals can be learned using stable press/release reports.
- Keyboard/mouse-only, Bluetooth keyboard, analog, MIDI and gamepad pedals cannot be identified as a specific pedal by this implementation. They need a suitable desktop bridge or another adapter.
- Browser mappings control the **active permitted website**, not desktop applications. Protected browser pages, extension stores and inaccessible cross-origin players are excluded. Website shortcuts and element clicks are simulated; sites may ignore them.
- The extension does **not** rewrite stored device outputs or suppress a pedal’s existing OS mouse/keyboard output. A device that already emits right-click may need manufacturer software or a device-aware desktop remapper first.
- The website has a separate, narrowly checked PCsensor hardware programming flow. Other models receive manufacturer-specific guidance. Input decoder support does not establish device programmability. See [programming support](docs/DEVICE-PROGRAMMING.md).

## Build and verify

```sh
npm run build
npm test
npm run preview
```

The build creates the static website in `dist/`, the unpacked Manifest V3 extension in `dist-extension/`, and the upload ZIP. CI verifies production assets, package paths and permission boundaries. Local virtual-device fixtures, browser screenshots and test output are deliberately excluded from this public repository.

Settings stay in the website’s localStorage or the extension’s local storage. Their formats are separate; neither silently overwrites the other. USB permission must be granted separately. Press history stays in memory and is cleared when its page or worker restarts. Exported settings may contain your custom text and website presets—review them before sharing. Read the [privacy policy](docs/PRIVACY.md).

### Deploy the website

Deploy `dist/` to a static HTTPS host. For public search metadata, set your actual domain when building:

```sh
VITE_SITE_URL=https://your-real-domain.example/ npm run build
```

Replace that example with the real URL. The build prerenders HTML and generates canonical, sharing and sitemap URLs only when a valid public domain is supplied. Submit the sitemap through Search Console after deployment. Localhost is not searchable, and indexing/rankings cannot be guaranteed.

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
