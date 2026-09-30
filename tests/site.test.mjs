import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { findStyleProblems } from './style-rules.mjs';

const site = new URL('../site/', import.meta.url);
const read = (f) => readFileSync(new URL(f, site), 'utf8');
const index = read('index.html');
const notFound = read('404.html');
const cv = JSON.parse(readFileSync(new URL('../cv/cv.json', import.meta.url), 'utf8'));
const ORIGIN = 'https://gauravraiji.vercel.app';

const decode = (s) => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&nbsp;/g, ' ');

/** Visible text split at every tag, plus the attributes a reader or screen reader sees. */
function visibleText(html) {
  const body = html.replace(/<script[\s\S]*?<\/script>/g, '').replace(/<style[\s\S]*?<\/style>/g, '').replace(/<!--[\s\S]*?-->/g, '');
  const chunks = body.split(/<[^>]+>/).map((t) => decode(t).replace(/\s+/g, ' ').trim()).filter(Boolean);
  const attrs = [...html.matchAll(/\s(?:alt|aria-label|title)="([^"]*)"/g)].map((m) => decode(m[1]));
  const metas = [...html.matchAll(/<meta (?:name|property)="(?:description|og:title|og:description)" content="([^"]*)"/g)].map((m) => decode(m[1]));
  const title = [...html.matchAll(/<title>([^<]*)<\/title>/g)].map((m) => decode(m[1]));
  return [...chunks, ...attrs, ...metas, ...title];
}

for (const [name, html] of [['index.html', index], ['404.html', notFound]]) {
  test(`${name} copy follows the writing rules`, () => {
    const problems = visibleText(html).flatMap((t) => findStyleProblems(t).map((p) => `${p}: "${t}"`));
    assert.deepEqual(problems, []);
  });

  test(`${name} has the basics a page needs`, () => {
    assert.match(html, /<html lang="en-AU">/);
    assert.match(html, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
    assert.equal((html.match(/<h1[\s>]/g) ?? []).length, 1, 'exactly one h1');
    assert.match(html, /<title>[^<]{10,70}<\/title>/);
  });

  test(`${name} only loads files that exist in the site folder`, () => {
    const refs = [...html.matchAll(/\s(?:href|src)="(\/[^"#?]*)"/g)].map((m) => m[1]).filter((r) => r !== '/');
    for (const r of refs) assert.ok(existsSync(new URL(`.${r}`, site)), `missing ${r}`);
    const assets = [
      ...[...html.matchAll(/<link [^>]*rel="(?:stylesheet|preload|icon)"[^>]*>/g)].map((m) => m[0]),
      ...[...html.matchAll(/<script [^>]*src="[^"]*"[^>]*>/g)].map((m) => m[0]),
    ];
    for (const tag of assets) assert.doesNotMatch(tag, /(?:src|href)="https?:/, `third party asset: ${tag}`);
  });
}

test('the meta description is a sensible length', () => {
  const d = index.match(/<meta name="description" content="([^"]*)"/)[1];
  assert.ok(d.length >= 70 && d.length <= 170, `${d.length} characters`);
});

test('every in page link points at a real section', () => {
  const ids = new Set([...index.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]));
  for (const [, target] of index.matchAll(/href="#([^"]+)"/g)) assert.ok(ids.has(target), `#${target}`);
});

test('links that open elsewhere are safe', () => {
  for (const [tag] of index.matchAll(/<a [^>]*target="_blank"[^>]*>/g)) assert.match(tag, /rel="[^"]*noopener/);
});

test('structured data describes Gaurav correctly', () => {
  const json = JSON.parse(index.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  assert.equal(json['@type'], 'Person');
  assert.equal(json.name, 'Gaurav Rai');
  assert.equal(json.email, 'mailto:gauravraiau@gmail.com');
  assert.equal(json.url, `${ORIGIN}/`);
  assert.ok(json.sameAs.includes('https://www.linkedin.com/in/gauravraiji'));
});

test('the site address is the same everywhere', () => {
  assert.match(index, new RegExp(`<link rel="canonical" href="${ORIGIN}/">`));
  assert.match(index, new RegExp(`<meta property="og:url" content="${ORIGIN}/">`));
  assert.match(index, new RegExp(`<meta property="og:image" content="${ORIGIN}/og-image.png">`));
  assert.match(read('robots.txt'), new RegExp(`Sitemap: ${ORIGIN}/sitemap.xml`));
  assert.match(read('sitemap.xml'), new RegExp(`<loc>${ORIGIN}/</loc>`));
  assert.ok(cv.links.includes(ORIGIN.replace('https://', '')), 'the CV points at the same address');
  const everything = index + read('robots.txt') + read('sitemap.xml') + JSON.stringify(cv);
  assert.doesNotMatch(everything, /gaurav-rai\.vercel\.app/, 'that address belongs to someone else');
});

test('experience on the site matches the CV', () => {
  for (const job of cv.experience) {
    assert.ok(index.includes(job.company), job.company);
    for (const role of job.roles) {
      assert.ok(index.includes(`${role.title} <span>${role.dates}</span>`), `${role.title}, ${role.dates}`);
    }
  }
});

test('the CV download is there and linked', () => {
  assert.ok(existsSync(new URL('Gaurav_Rai_CV.pdf', site)));
  assert.match(index, /href="\/Gaurav_Rai_CV\.pdf" download/);
});

test('only the CV email address is used, and no photos are published', () => {
  const files = readdirSync(site, { recursive: true }).map(String);
  assert.deepEqual(files.filter((f) => /\.(jpe?g|webp|heic)$/i.test(f)), [], 'no photos');
  assert.doesNotMatch(index + notFound, /raigaurav733|thecelestialmismatch@gmail\.com/);
  assert.match(index, /mailto:gauravraiau@gmail\.com/);
});

test('security headers are set for every page', () => {
  const config = JSON.parse(read('vercel.json'));
  const all = config.headers.find((h) => h.source === '/(.*)').headers;
  const header = (k) => all.find((h) => h.key === k)?.value ?? '';
  assert.match(header('Content-Security-Policy'), /script-src 'none'/);
  assert.match(header('Content-Security-Policy'), /frame-ancestors 'none'/);
  assert.equal(header('X-Content-Type-Options'), 'nosniff');
  assert.ok(header('Referrer-Policy'));
});
