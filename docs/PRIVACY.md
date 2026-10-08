# Treadory privacy

Effective October 8, 2026.

Treadory has no accounts, backend, advertising, analytics or telemetry. Neither the website nor extension sends pedal reports, mappings, press history or typed content to a server.

The website saves configuration in browser localStorage. The extension uses browser-local extension storage for mappings, optional site presets, selected USB device metadata and learned input fingerprints. Website and extension settings are separate. Uninstalling the extension removes its local storage; reset is also available in its settings.

Recent press history holds up to 50 decoded pedal presses and computer timestamps in memory, not an uploaded log. It clears when the page or extension worker restarts. The extension reads only the USB device the user authorizes; it does not continuously collect ordinary keyboard or mouse input.

Website access is granted explicitly for one site or all HTTP/HTTPS sites. When a pedal action runs, the extension accesses only the DOM information needed for scrolling, media, a configured element, a website shortcut or insertion into a focused plain text field. It does not read password values. Browser settings and protected pages are excluded. It does not change hardware output or suppress OS clicks.

JSON exports may include custom text, website origins and device names. Exports occur only at the user’s request. Review these files before sharing them. No secrets should be placed in mappings.

Opening an external source/manufacturer link makes a normal request to that third-party website, subject to its own policy. Static hosting and browser-store distribution may have their own request logs; Treadory itself does not add tracking.

Report questions through the [Treadory GitHub repository](https://github.com/RonitGandotra05/treadory/issues). Do not include sensitive configuration or personal information in a public issue.

The canonical policy for the current website and extension is available at https://treadory.netlify.app/privacy/. It includes the local data categories, user controls, hosting provider and Chrome Web Store Limited Use disclosure.
