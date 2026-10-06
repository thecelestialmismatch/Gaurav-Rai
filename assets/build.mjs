// Builds the animated profile SVGs in this folder. Run with `node assets/build.mjs`.
// Every SVG is self contained: fonts are inlined as base64 WOFF2, icons come from Simple Icons
// (CC0, https://simpleicons.org), and nothing is fetched when GitHub renders the image.
// Animation is CSS only, so prefers-reduced-motion can switch it off and the static frame stays readable.
import { readFileSync, writeFileSync } from 'node:fs';
import * as si from 'simple-icons';

const here = (p) => new URL(p, import.meta.url);
const font = (file) => readFileSync(here(`../site/fonts/${file}`)).toString('base64');

const C = { bg: '#070b16', card: '#0d1426', line: '#1c2742', blue: '#247bff', red: '#ff354f', text: '#eef2ff', dim: '#8a96b8' };

const FONTS = `
@font-face{font-family:D;font-weight:700;src:url(data:font/woff2;base64,${font('schibsted-grotesk-latin-700-normal.woff2')}) format('woff2')}
@font-face{font-family:M;font-weight:500;src:url(data:font/woff2;base64,${font('ibm-plex-mono-latin-500-normal.woff2')}) format('woff2')}
@font-face{font-family:S;font-weight:500;src:url(data:font/woff2;base64,${font('ibm-plex-sans-latin-500-normal.woff2')}) format('woff2')}`;

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Shell shared by every card: background, dot texture, gradient hairline border, fonts. */
function svg(ns, w, h, title, desc, css, body) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-labelledby="${ns}-t ${ns}-d">
<title id="${ns}-t">${esc(title)}</title>
<desc id="${ns}-d">${esc(desc)}</desc>
<defs>
<pattern id="${ns}-dots" width="22" height="22" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="${C.line}"/></pattern>
<linearGradient id="${ns}-edge" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${C.blue}"/><stop offset=".5" stop-color="${C.line}"/><stop offset="1" stop-color="${C.red}"/></linearGradient>
</defs>
<style>${FONTS}
.${ns} .d{font-family:D,sans-serif;font-weight:700;fill:${C.text}}
.${ns} .m{font-family:M,monospace;font-weight:500;fill:${C.dim};letter-spacing:.12em}
.${ns} .s{font-family:S,sans-serif;font-weight:500;fill:${C.text}}
.${ns} .in{animation:${ns}-in .8s cubic-bezier(.2,.8,.2,1) both}
@keyframes ${ns}-in{from{opacity:0;transform:translateY(14px)}}
${css}
@media (prefers-reduced-motion:reduce){.${ns} *{animation:none!important}}
</style>
<g class="${ns}">
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="28" fill="${C.bg}"/>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="28" fill="url(#${ns}-dots)" opacity=".55"/>
<rect x="1" y="1" width="${w - 2}" height="${h - 2}" rx="28" fill="none" stroke="url(#${ns}-edge)" stroke-width="1.5"/>
${body}
</g>
</svg>
`;
}

const header = (kicker, title, x = 56, y = 78) =>
  `<text class="m in" x="${x}" y="${y}" font-size="15">${esc(kicker)}</text>
<text class="d in" x="${x}" y="${y + 50}" font-size="46" style="animation-delay:.1s">${esc(title)}</text>`;

// ponytail: chip width from an average glyph width, swap for real text metrics if a label ever clips
const chipWidth = (label, size) => Math.round(label.length * size * 0.56 + 30);

function chips(groups, x0, y0, maxW, delay0) {
  let y = y0;
  let delay = delay0;
  const out = [];
  for (const [heading, labels] of groups) {
    out.push(`<text class="m in" x="${x0}" y="${y}" font-size="13" style="animation-delay:${delay.toFixed(2)}s">${esc(heading)}</text>`);
    y += 16;
    let x = x0;
    for (const label of labels) {
      const w = chipWidth(label, 15);
      if (x + w > x0 + maxW) { x = x0; y += 44; }
      delay += 0.05;
      out.push(`<g class="in" style="animation-delay:${delay.toFixed(2)}s"><rect x="${x}" y="${y}" width="${w}" height="34" rx="17" fill="${C.card}" stroke="${C.line}"/><text class="s" x="${x + w / 2}" y="${y + 22}" font-size="15" text-anchor="middle">${esc(label)}</text></g>`);
      x += w + 10;
    }
    y += 34 + 34;
  }
  return out.join('\n');
}

// ---------- stack.svg ----------

function icon(slug) {
  const key = `si${slug[0].toUpperCase()}${slug.slice(1)}`;
  const found = si[key];
  if (!found) throw new Error(`Simple Icons has no "${slug}"`);
  return found;
}

/** Visible colour for a brand mark on the navy background: near black marks switch to off white. */
function onDark(hex) {
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 70 ? C.text : `#${hex}`;
}

const ORBITS = [
  { r: 130, tilt: -14, secs: 26, dir: 1, slugs: ['typescript', 'python', 'javascript', 'postgresql'] },
  { r: 205, tilt: 8, secs: 38, dir: -1, slugs: ['react', 'nextdotjs', 'tailwindcss', 'nodedotjs', 'supabase'] },
  { r: 275, tilt: -4, secs: 52, dir: 1, slugs: ['terraform', 'docker', 'githubactions', 'claude', 'modelcontextprotocol'] },
];
const SQUASH = 0.5;

// Each icon rides a circle inside a tilted, squashed frame. The counter spin and the inverse frame
// below it cancel every rotation and squash, so the mark stays upright and round. Phase is a static
// rotate, which means a frame with no animation still spreads the icons around their orbit.
function orbit({ r, tilt, secs, dir, slugs }, i) {
  const frame = `rotate(${tilt}) scale(1 ${SQUASH})`;
  const inverse = `scale(1 ${1 / SQUASH}) rotate(${-tilt})`;
  const spin = dir > 0 ? 'st-cw' : 'st-ccw';
  const unspin = dir > 0 ? 'st-ccw' : 'st-cw';
  const ring = `<circle r="${r}" fill="none" stroke="${C.line}" stroke-width="1.2" vector-effect="non-scaling-stroke" transform="${frame}"/>`;
  const marks = slugs.map((slug, k) => {
    const ic = icon(slug);
    const phase = (360 / slugs.length) * k + i * 25;
    return `<g transform="${frame} rotate(${phase})"><g class="${spin}" style="animation-duration:${secs}s"><g transform="translate(${r} 0)"><g class="${unspin}" style="animation-duration:${secs}s"><g transform="rotate(${-phase}) ${inverse}">
<title>${esc(ic.title)}</title>
<circle r="25" fill="${C.card}" stroke="${C.line}"/>
<path d="${ic.path}" fill="${onDark(ic.hex)}" transform="translate(-12 -12)"/>
<text class="m" y="44" font-size="11" text-anchor="middle" style="letter-spacing:.04em">${esc(ic.title)}</text>
</g></g></g></g></g>`;
  });
  return `${ring}\n${marks.join('\n')}`;
}

function stack() {
  const w = 1000, h = 760;
  const css = `
.st .st-cw,.st .st-ccw{transform-origin:0 0;transform-box:view-box;animation:st-turn linear infinite}
.st .st-ccw{animation-direction:reverse}
@keyframes st-turn{to{transform:rotate(360deg)}}
.st .core{animation:st-pulse 3s ease-in-out infinite}
@keyframes st-pulse{50%{opacity:.55}}`;
  const body = `${header('THE STACK', 'What I build with')}
<g transform="translate(315 415)">
<circle r="46" fill="${C.card}" stroke="${C.blue}" stroke-width="1.5"/>
<circle class="core" r="58" fill="none" stroke="${C.red}" stroke-opacity=".5"/>
<text class="d" y="12" font-size="32" text-anchor="middle">GR</text>
${ORBITS.map(orbit).join('\n')}
</g>
${chips([
    ['LANGUAGES', ['TypeScript', 'Python', 'SQL', 'JavaScript']],
    ['DATA AND REPORTING', ['PostgreSQL', 'Supabase', 'DynamoDB', 'Power BI', 'MSPBots']],
    ['CLOUD AND CONTACT CENTRE', ['Amazon Connect', 'AWS Lambda', 'Terraform', 'Docker', 'GitHub Actions', 'Jenkins']],
    ['AI', ['Claude Code', 'Codex', 'OpenRouter', 'MCP']],
  ], 640, 200, 320, 0.3)}`;
  return svg('st', w, h, 'Gaurav Rai, tech stack',
    'Icons for TypeScript, Python, JavaScript, PostgreSQL, React, Next.js, Tailwind CSS, Node.js, Supabase, Terraform, Docker, GitHub Actions, Claude and MCP circle three tilted orbits, beside grouped stack chips.',
    css, body);
}

// ---------- about-life.svg ----------

const CAPABILITIES = [
  ['Amazon Connect', 'WhatsApp, Messenger and Instagram into production. A CRM panel in the CCP cut handle time 25%.'],
  ['AWS and Terraform', 'Lambda, DynamoDB, API Gateway, CloudWatch and CloudTrail, with Connect managed in Terraform.'],
  ['Data and reporting', 'SQL, Power BI and MSPBots dashboards for CSAT, AHT and SLA.'],
  ['Building with AI', 'Claude Code and Codex as coding agents, MCP to connect them to real tools.'],
];

const SLIDES = [
  { title: 'Building AI tools', line: 'HoundShield, RipoDoc and VibeFlow, built solo.', art: 'code' },
  { title: 'Cricket', line: 'Off the clock.', art: 'ball' },
  { title: 'Travel', line: 'Off the clock.', art: 'plane' },
];

const ART = {
  code: `<text class="d" x="0" y="20" font-size="96" text-anchor="middle" fill="${C.blue}" style="fill:${C.blue}">&lt;/&gt;</text>`,
  ball: `<circle r="56" fill="${C.red}"/><path d="M-20 -52 C 6 -20 6 20 -20 52 M20 -52 C -6 -20 -6 20 20 52" fill="none" stroke="${C.text}" stroke-width="3" stroke-dasharray="6 6"/>`,
  plane: `<path d="M-70 10 L70 -40 L10 60 L-5 18 Z" fill="${C.blue}"/><path d="M-5 18 L70 -40 L-20 30 Z" fill="${C.text}" opacity=".85"/>`,
};

/** Wraps text into lines of at most `max` characters. */
function wrap(text, max) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const last = lines.length - 1;
    if ((lines[last] + ' ' + word).trim().length > max) lines.push(word);
    else lines[last] = (lines[last] + ' ' + word).trim();
  }
  return lines;
}

function about() {
  const w = 1000, h = 560;
  const slideSecs = 4;
  const total = slideSecs * SLIDES.length;
  const window = 100 / SLIDES.length;
  const css = `
.ab .slide{animation:ab-show ${total}s linear infinite}
@keyframes ab-show{0%{opacity:0;transform:translateY(10px)}3%,${(window - 3).toFixed(2)}%{opacity:1;transform:none}${window.toFixed(2)}%,100%{opacity:0;transform:translateY(-10px)}}
.ab .slide.first{opacity:1}
.ab .slide.later{opacity:0}
${SLIDES.map((_, k) => `.ab .seg${k}{transform-box:fill-box;transform-origin:0 0;animation:ab-seg${k} ${total}s linear infinite}
@keyframes ab-seg${k}{0%,${(k * window).toFixed(2)}%{transform:scaleX(0)}${((k + 1) * window).toFixed(2)}%,99.9%{transform:scaleX(1)}100%{transform:scaleX(0)}}`).join('\n')}`;

  const caps = CAPABILITIES.map(([title, text], i) => {
    const y = 200 + i * 86;
    const lines = wrap(text, 52).map((l, j) => `<tspan x="80" dy="${j ? 21 : 0}">${esc(l)}</tspan>`).join('');
    return `<g class="in" style="animation-delay:${(0.2 + i * 0.12).toFixed(2)}s">
<rect x="56" y="${y - 22}" width="4" height="62" rx="2" fill="${i % 2 ? C.red : C.blue}"/>
<text class="d" x="80" y="${y}" font-size="21">${esc(title)}</text>
<text class="s" x="80" y="${y + 26}" font-size="15" style="fill:${C.dim}">${lines}</text>
</g>`;
  }).join('\n');

  const cx = 640, cw = 304, cy = 150, ch = 360;
  const slides = SLIDES.map((s, k) => {
    // Negative delays shift each slide into its own four second window from the very first frame.
    const delay = k ? -(total - k * slideSecs) : 0;
    return `<g class="slide ${k ? 'later' : 'first'}" style="animation-delay:${delay}s">
<g transform="translate(${cx + cw / 2} ${cy + 130})">${ART[s.art]}</g>
<text class="m" x="${cx + 28}" y="${cy + 250}" font-size="13">${String(k + 1).padStart(2, '0')} OF ${String(SLIDES.length).padStart(2, '0')}</text>
<text class="d" x="${cx + 28}" y="${cy + 286}" font-size="28">${esc(s.title)}</text>
<text class="s" x="${cx + 28}" y="${cy + 314}" font-size="15" style="fill:${C.dim}">${wrap(s.line, 30).map((l, j) => `<tspan x="${cx + 28}" dy="${j ? 20 : 0}">${esc(l)}</tspan>`).join('')}</text>
</g>`;
  }).join('\n');

  const segW = (cw - 56 - 8 * (SLIDES.length - 1)) / SLIDES.length;
  const bars = SLIDES.map((_, k) => {
    const x = cx + 28 + k * (segW + 8);
    return `<rect x="${x}" y="${cy + 24}" width="${segW}" height="4" rx="2" fill="${C.line}"/>
<rect class="seg${k}" x="${x}" y="${cy + 24}" width="${segW}" height="4" rx="2" fill="${k === 1 ? C.red : C.blue}"/>`;
  }).join('\n');

  const body = `${header('ABOUT', 'What I do, and what I like')}
${caps}
<g class="in" style="animation-delay:.4s">
<rect x="${cx}" y="${cy}" width="${cw}" height="${ch}" rx="22" fill="${C.card}" stroke="${C.line}"/>
${bars}
${slides}
</g>`;
  return svg('ab', w, h, 'Gaurav Rai, about and interests',
    'Four capabilities, Amazon Connect, AWS and Terraform, data and reporting, and building with AI, beside a carousel of interests that changes every four seconds. Building AI tools, cricket and travel.',
    css, body);
}

export const BUILDS = { 'stack.svg': stack, 'about-life.svg': about };

if (import.meta.url === `file://${process.argv[1]}`) {
  for (const [file, build] of Object.entries(BUILDS)) {
    writeFileSync(here(file), build());
    console.log(`wrote assets/${file}`);
  }
}
