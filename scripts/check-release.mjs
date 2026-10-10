import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('dist-extension/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.minimum_chrome_version,'117');
assert.deepEqual(manifest.permissions,['storage','scripting','activeTab']);assert.ok(!manifest.host_permissions&&!manifest.externally_connectable);
assert.ok(!manifest.optional_permissions?.includes('nativeMessaging'));
for(const file of ['background.js','popup.js'])assert.ok(!(await readFile(`dist-extension/${file}`,'utf8')).includes('connectNative'));
for(const file of ['native.html','native.css','native.js'])await assert.rejects(access(`dist-extension/${file}`));
for(const file of [manifest.background.service_worker,manifest.action.default_popup,'popup.js','popup.css','privacy.html','connect.html','connect.css','connect.js',...Object.values(manifest.icons)])await access(`dist-extension/${file}`);
for(const file of ['background.js','popup.js','connect.js']){const source=await readFile(`dist-extension/${file}`,'utf8');assert.ok(!source.includes('eval('));assert.ok(!source.includes('sourceMappingURL'));}
const html=await readFile('dist/index.html','utf8');assert.ok(html.includes('Your pedal. Across the web.'));assert.ok(html.includes('https://chromewebstore.google.com/detail/treadory-%E2%80%94-foot-pedal-con/kkgfhpnkicjkkiignanfgceldfhlicfl'));assert.ok(!html.includes('/downloads/treadory-extension.zip'));assert.ok(!html.includes('Developer mode')&&!html.includes('Load unpacked'));
await access('dist/downloads/treadory-extension.zip');console.log('Production website, Manifest V3 extension, package paths and permission boundaries verified.');

const privacy=await readFile("dist/privacy/index.html","utf8");assert.ok(privacy.includes("<h1>Privacy policy.</h1>"));assert.ok(privacy.includes("Chrome Web Store Limited Use"));assert.ok(html.includes('href="/privacy/"'));await access("dist/privacy-policy.css");
if(process.env.VITE_SITE_URL){const url=new URL("privacy/",process.env.VITE_SITE_URL).href;assert.ok(privacy.includes(`rel="canonical" href="${url}"`));const sitemap=await readFile("dist/sitemap.xml","utf8");assert.ok(sitemap.includes(url));}
console.log("Public privacy page, footer link and production privacy canonical verified.");

assert.ok(html.includes('id="computer-wide"'));assert.ok(!html.includes('treadory-windows-helper-source.zip'));assert.ok(!html.includes('treadory-windows-helper-preview.zip'));
assert.ok(html.includes('id="control-options"')&&html.includes('aria-label="Pedal control scope"')&&html.includes('Website-wide')&&html.includes('System-wide'));
const release=JSON.parse(await readFile('dist/downloads/app-release.json','utf8'));
assert.equal(release.format,1);assert.equal(release.platform,'windows-x64');assert.equal(release.preview,true);assert.equal(release.physicalVerification,false);
assert.equal(release.available,true);assert.equal(release.selfContained,true);assert.equal(release.standalone,true);
assert.ok(html.includes('href="#computer-wide"'),'Computer-wide control must be discoverable from the main controls.');
assert.equal(release.download,'/downloads/Treadory-0.3.0-windows-x64-preview.exe');
const {createHash}=await import('node:crypto');const exe=await readFile(`dist${release.download}`);assert.equal(exe.length,release.bytes);assert.equal(createHash('sha256').update(exe).digest('hex'),release.sha256);
console.log('Standalone EXE, runtime inclusion, truthful preview status and download integrity verified.');

const storeRelease=JSON.parse(await readFile('dist/downloads/extension-release.json','utf8'));assert.equal(storeRelease.version,manifest.version);assert.equal(storeRelease.nativeMessaging,false);assert.equal(storeRelease.file,`Treadory-${manifest.version}-chrome-web-store-upload.zip`);const storeBytes=await readFile(`dist/downloads/${storeRelease.file}`);assert.equal(storeBytes.length,storeRelease.bytes);assert.equal(createHash('sha256').update(storeBytes).digest('hex'),storeRelease.sha256);
console.log('Named Chrome Web Store upload ZIP and checksum metadata verified.');
