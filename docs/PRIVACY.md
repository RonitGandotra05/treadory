# Treadory privacy

Effective October 10, 2026.

Treadory has no accounts, backend, advertising, analytics or telemetry. Neither the website nor extension sends pedal reports, mappings, press history or typed content to a server.

The website saves configuration in browser localStorage. The extension uses browser-local extension storage for mappings, optional site presets, selected USB device metadata and learned input fingerprints. Website and extension settings are separate. Uninstalling the extension removes its local storage; reset is also available in its settings.

Recent press history holds up to 50 decoded pedal presses and computer timestamps in memory, not an uploaded log. It clears when the page or extension worker restarts. The extension reads only the USB device the user authorizes; it does not continuously collect ordinary keyboard or mouse input.

Website access is granted explicitly for one site or all HTTP/HTTPS sites. When a browser action runs, the extension accesses only the DOM information needed for scrolling, media, a configured element, a website shortcut or insertion into a focused plain text field. It does not read password values. Browser settings and protected pages are excluded. Browser mode does not change hardware output or suppress OS clicks; the optional native mode is described below.

JSON exports may include custom text, website origins and device names. Exports occur only at the user’s request. Review these files before sharing them. No secrets should be placed in mappings.

Opening an external source/manufacturer link makes a normal request to that third-party website, subject to its own policy. Static hosting and browser-store distribution may have their own request logs; Treadory itself does not add tracking.

Report questions through the [Treadory GitHub repository](https://github.com/RonitGandotra05/treadory/issues). Do not include sensitive configuration or personal information in a public issue.

The canonical policy for the current website and extension is available at https://treadory.netlify.app/privacy/. It includes the local data categories, user controls, hosting provider and Chrome Web Store Limited Use disclosure.


## Optional Windows helper

The optional Windows helper requires explicit native-messaging permission and a per-user installation restricted to your extension ID. It remaps only an explicitly selected pedal endpoint. No network listener or telemetry is used. Device hardware IDs are checked transiently and are not sent to websites. The helper checks input-device inventory and the recovery chord but records no ordinary mouse or keyboard content. Computer-wide mappings stay in local extension storage. Disconnecting releases capture; uninstall the helper and its separately licensed driver using their own removal instructions.

## Standalone Windows app

The independent Windows EXE does not use Chrome/native messaging. It stores only chosen action mappings and the accepted DLL checksum in `%LOCALAPPDATA%/Treadory/settings.json`; captured identity, learned controls and activation are session-only. The imported, user-supplied DLL is copied beside the executable after license acknowledgment and integrity/architecture checks. No driver is downloaded or installed by Treadory. The UI polls recovery and inventory state, and no normal keyboard/mouse history, page content, telemetry or network listener is recorded. Close/stop restores original input. App settings and browser/legacy helper settings are separate.
