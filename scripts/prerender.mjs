import { build, loadEnv } from 'vite';
import { readFile, writeFile, rm } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const root = process.cwd();
const temporary = resolve(root, '.prerender');
const environment = {...loadEnv('production',root,''),...process.env};
const configuredUrl = environment.VITE_SITE_URL?.trim();
let canonical;
if (configuredUrl) {
  const url = new URL(configuredUrl);
  if (url.protocol !== 'https:' || url.username || url.password || url.search || url.hash || /^(localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])$/.test(url.hostname)) {
    throw new Error('VITE_SITE_URL must be the real public HTTPS URL, without credentials, a query or a fragment.');
  }
  canonical = url.href.endsWith('/') ? url.href : `${url.href}/`;
}
const privacyUrl=canonical?new URL('privacy/',canonical).href:null;
const escapeAttribute = value => value.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
try {
  await build({build:{ssr:'src/prerender.tsx',outDir:temporary,emptyOutDir:true},logLevel:'warn'});
  const {render} = await import(pathToFileURL(resolve(temporary,'prerender.js')).href);
  const htmlPath = resolve(root,'dist/index.html');
  let html = await readFile(htmlPath,'utf8');
  if (!html.includes('<div id="root"></div>')) throw new Error('The HTML entry is missing its prerender target.');
  html = html.replace('<div id="root"></div>',()=>`<div id="root">${render()}</div>`);
  if (canonical) {
    html = html.replace('</head>',`<link rel="canonical" href="${escapeAttribute(canonical)}" /><meta property="og:url" content="${escapeAttribute(canonical)}" /></head>`);
    // Attach only the real deployment URL; never invent a domain or index localhost.
    html = html.replace(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/,(_match,json)=>{
      const data = JSON.parse(json);data.url=canonical;
      return `<script type="application/ld+json">${JSON.stringify(data).replace(/</g,'\\u003c')}</script>`;
    });
    await writeFile(resolve(root,'dist/sitemap.xml'),`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"><url><loc>${escapeAttribute(canonical)}</loc></url><url><loc>${escapeAttribute(privacyUrl)}</loc></url></urlset>\n`);
    await writeFile(resolve(root,'dist/robots.txt'),`User-agent: *\nAllow: /\nSitemap: ${new URL('sitemap.xml',canonical).href}\n`);
  } else {
    await writeFile(resolve(root,'dist/robots.txt'),'User-agent: *\nAllow: /\n');
  }
  const privacyPath=resolve(root,'dist/privacy/index.html');
  let privacy=await readFile(privacyPath,'utf8');
  if(privacyUrl)privacy=privacy.replace('</head>',`<link rel="canonical" href="${escapeAttribute(privacyUrl)}" /></head>`);
  await writeFile(privacyPath,privacy);
  await writeFile(htmlPath,html);
  console.log(`Static HTML rendered. ${canonical?'Canonical URL and sitemap generated.':'Set VITE_SITE_URL when publishing to generate the canonical URL and sitemap.'}`);
} finally { await rm(temporary,{recursive:true,force:true}); }
