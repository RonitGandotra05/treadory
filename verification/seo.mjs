import assert from 'node:assert/strict';
import {readFile,access} from 'node:fs/promises';
import {loadEnv} from 'vite';
const html=await readFile('dist/index.html','utf8');
const privacy=await readFile('dist/privacy/index.html','utf8');
for(const page of [html,privacy]){
 assert.match(page,/<html lang="en"/);
 assert.equal((page.match(/<title>/g)||[]).length,1);
 assert.equal((page.match(/<h1[ >]/g)||[]).length,1);
 assert.match(page,/<meta name="description" content="[^"]{40,}"/);
 assert.match(page,/<meta name="robots" content="index,follow/);
 assert.ok(!/content="[^"\n]*noindex/.test(page));
}
assert.ok(!html.includes('<div id="root"></div>'),'Product content must be present before JavaScript runs.');
for(const content of ['Your pedal. Across the web.','Your pedal. Across your computer.','Windows helper','/privacy/'])assert.ok(html.includes(content));
assert.ok(!html.includes('No installation or account.'));
const structured=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map(match=>JSON.parse(match[1]));
assert.ok(structured.some(data=>data['@type']==='WebApplication'));
const agents=await readFile('dist/agents.txt','utf8');
assert.match(agents,/not a\s+crawler access policy or a Google indexing requirement/);
assert.match(agents,/Physical Windows\/pedal verification is pending/);
const environment={...loadEnv('production',process.cwd(),''),...process.env};
if(environment.VITE_SITE_URL?.trim()){
 const input=new URL(environment.VITE_SITE_URL.trim());const canonical=input.href.endsWith('/')?input.href:`${input.href}/`;
 const privacyUrl=new URL('privacy/',canonical).href;
 for(const [page,url] of [[html,canonical],[privacy,privacyUrl]]){
  const links=[...page.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(links.length,1);assert.equal(links[0][1],url);
 }
 const sitemap=await readFile('dist/sitemap.xml','utf8');
 assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(match=>match[1]),[canonical,privacyUrl]);
 const robots=await readFile('dist/robots.txt','utf8');
 assert.match(robots,/^User-agent: \*\nAllow: \/\n/);
 assert.ok(!robots.includes('Disallow:'));assert.ok(robots.includes(`Sitemap: ${new URL('sitemap.xml',canonical).href}`));
 assert.ok(html.includes(`property="og:url" content="${canonical}"`));
 const image=new URL('favicon.png',canonical).href;
 assert.ok(html.includes(`property="og:image" content="${image}"`));await access('dist/favicon.png');
 assert.ok(structured.some(data=>data['@type']==='WebSite'&&data.name==='Treadory'&&data.url===canonical));
 assert.ok(structured.some(data=>data['@type']==='WebApplication'&&data.url===canonical&&data.image===image));
}
console.log('SEO: static content, page metadata, structured data, canonical URLs, crawler rules, sitemap and agent reference verified.');
