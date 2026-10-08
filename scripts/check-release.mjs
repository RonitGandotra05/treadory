import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
const manifest=JSON.parse(await readFile('dist-extension/manifest.json','utf8'));
assert.equal(manifest.manifest_version,3);assert.equal(manifest.minimum_chrome_version,'117');
assert.deepEqual(manifest.permissions,['storage','scripting','activeTab']);assert.ok(!manifest.host_permissions&&!manifest.externally_connectable);
for(const file of [manifest.background.service_worker,manifest.action.default_popup,'popup.js','popup.css','privacy.html','connect.html','connect.css','connect.js',...Object.values(manifest.icons)])await access(`dist-extension/${file}`);
for(const file of ['background.js','popup.js','connect.js']){const source=await readFile(`dist-extension/${file}`,'utf8');assert.ok(!source.includes('eval('));assert.ok(!source.includes('sourceMappingURL'));}
const html=await readFile('dist/index.html','utf8');assert.ok(html.includes('Your pedal. Across the web.'));assert.ok(html.includes('/downloads/treadory-extension.zip'));
await access('dist/downloads/treadory-extension.zip');console.log('Production website, Manifest V3 extension, package paths and permission boundaries verified.');

const privacy=await readFile("dist/privacy/index.html","utf8");assert.ok(privacy.includes("<h1>Privacy policy.</h1>"));assert.ok(privacy.includes("Chrome Web Store Limited Use"));assert.ok(html.includes('href="/privacy/"'));await access("dist/privacy-policy.css");
if(process.env.VITE_SITE_URL){const url=new URL("privacy/",process.env.VITE_SITE_URL).href;assert.ok(privacy.includes(`rel="canonical" href="${url}"`));const sitemap=await readFile("dist/sitemap.xml","utf8");assert.ok(sitemap.includes(url));}
console.log("Public privacy page, footer link and production privacy canonical verified.");
