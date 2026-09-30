// Builds the CV and the cover letter as Word documents and PDFs.
//
//   npm run build:cv                                  public copies, no phone number, written to dist/
//   npm run build:cv -- --out site --only cv-pdf      public CV PDF for the portfolio
//   CV_PHONE="+61 ..." npm run build:cv -- --out ~/cv private copies with the phone number
//   CV_REFEREES=cv/referees.private.json ...          private copies with named referees
//
// Referee names and contact details are other people's personal data. They live only in
// cv/referees.private.json, which git ignores, and are used only when asked for explicitly.
//
// Sources are cv/cv.json and cv/cover-letter.json. The layout is one column of plain text,
// so applicant tracking systems read it cleanly. The CV build fails if it runs past one page.

import { readFileSync, writeFileSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  AlignmentType, BorderStyle, Document, ExternalHyperlink, LevelFormat, Packer, Paragraph, TextRun,
} from 'docx';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const cv = JSON.parse(readFileSync(resolve(root, 'cv/cv.json'), 'utf8'));
const letter = JSON.parse(readFileSync(resolve(root, 'cv/cover-letter.json'), 'utf8'));

const args = process.argv.slice(2);
const argValue = (flag) => {
  const i = args.indexOf(flag);
  return i >= 0 ? args[i + 1] : undefined;
};
const outDir = resolve(argValue('--out') ?? resolve(root, 'dist'));
const phone = argValue('--phone') ?? process.env.CV_PHONE ?? '';
const refereesPath = argValue('--referees') ?? process.env.CV_REFEREES;
const referees = refereesPath ? JSON.parse(readFileSync(resolve(refereesPath), 'utf8')) : [];
for (const r of referees) {
  for (const field of ['name', 'title', 'company']) {
    if (!r[field]) throw new Error(`Referee ${r.name ?? '?'} is missing ${field}`);
  }
  if (!r.phone && !r.email) throw new Error(`Referee ${r.name} needs a phone number or an email address`);
}
// One line per referee, so two referees still fit on one page. The title and company say how they know me.
const refereeLine = (r) => [`${r.name}, ${r.title}, ${r.company}`, r.phone, r.email].filter(Boolean).join(' | ');
const only = (argValue('--only') ?? 'cv-docx,cv-pdf,letter-docx,letter-pdf').split(',');
const MAX_CV_PAGES = Number(argValue('--max-pages') ?? 1);
mkdirSync(outDir, { recursive: true });

const AUTHOR = cv.name;
const BASE = cv.name.replace(/ /g, '_');
const contactParts = [cv.location, phone, cv.email, ...cv.links].filter(Boolean);
const isLink = (t) => t.includes('@') || /\.(com|app)\b/.test(t);
const href = (t) => (t.includes('@') ? `mailto:${t}` : `https://${t}`);
const today = new Date().toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' });

// ---------- Word ----------

const FONT = 'Calibri';
const heading = (text) => new Paragraph({
  keepNext: true,
  spacing: { before: 140, after: 60 },
  border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: '8A8A8A', space: 2 } },
  children: [new TextRun({ text: text.toUpperCase(), bold: true, size: 21 })],
});
const line = (runs, spacing = { before: 0, after: 30 }, keepNext = false) =>
  new Paragraph({ spacing, keepNext, keepLines: true, children: runs });
const bullet = (text) => new Paragraph({
  numbering: { reference: 'bullets', level: 0 }, spacing: { after: 20 }, keepLines: true, children: [new TextRun(text)],
});
const contactRuns = () => contactParts.flatMap((part, i) => [
  ...(i ? [new TextRun(' | ')] : []),
  isLink(part)
    ? new ExternalHyperlink({ link: href(part), children: [new TextRun({ text: part, color: '1F4E79' })] })
    : new TextRun(part),
]);
const nameBlock = () => [
  new Paragraph({ spacing: { after: 0 }, children: [new TextRun({ text: cv.name.toUpperCase(), bold: true, size: 36 })] }),
  line([new TextRun({ text: cv.headline, size: 22 })], { after: 20 }),
  line(contactRuns(), { after: 60 }),
];

const wordDoc = (children) => new Document({
  creator: AUTHOR,
  lastModifiedBy: AUTHOR,
  title: `${cv.name} CV`,
  subject: cv.headline,
  description: '',
  styles: { default: { document: { run: { font: FONT, size: 20 } } } },
  numbering: {
    config: [{
      reference: 'bullets',
      levels: [{
        level: 0, format: LevelFormat.BULLET, text: '•', alignment: AlignmentType.LEFT,
        style: { paragraph: { indent: { left: 340, hanging: 220 } } },
      }],
    }],
  },
  sections: [{
    properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 620, bottom: 620, left: 760, right: 760 } } },
    children,
  }],
});

function cvDocx() {
  return wordDoc([
    ...nameBlock(),
    heading('Summary'),
    line([new TextRun(cv.summary)]),
    heading('Skills'),
    ...cv.skills.map((s) => line([new TextRun({ text: s.group, bold: true }), new TextRun(` | ${s.items}`)])),
    heading('Experience'),
    ...cv.experience.flatMap((job) => [
      line([new TextRun({ text: job.company, bold: true }), new TextRun(` | ${job.location}`)], { before: 80, after: 10 }, true),
      ...job.roles.flatMap((role) => [
        line([new TextRun(role.title), new TextRun(` | ${role.dates}`)], { before: 20, after: 20 }, true),
        ...role.bullets.map(bullet),
      ]),
    ]),
    heading('Projects'),
    ...cv.projects.flatMap((p) => [
      line([
        new TextRun({ text: p.name, bold: true }),
        ...p.links.flatMap((l) => [new TextRun(' | '), new ExternalHyperlink({ link: href(l), children: [new TextRun({ text: l, color: '1F4E79' })] })]),
        new TextRun(` | ${p.dates}`),
      ], { before: 40, after: 20 }, true),
      ...p.bullets.map(bullet),
    ]),
    heading('Education'),
    ...cv.education.map((e) => line([new TextRun({ text: e.degree, bold: true }), new TextRun(` | ${e.school} | ${e.dates}`)])),
    heading('Certifications'),
    line([new TextRun(cv.certifications.map((c) => `${c.name}, ${c.issuer}, ${c.date}`).join(' | '))]),
    heading('References'),
    ...(referees.length
      ? referees.map((r) => line([new TextRun(refereeLine(r))]))
      : [line([new TextRun(cv.references)])]),
  ]);
}

function letterDocx() {
  return wordDoc([
    ...nameBlock(),
    line([new TextRun(today)], { before: 200, after: 200 }),
    line([new TextRun(letter.greeting)], { after: 160 }),
    ...letter.paragraphs.map((p) => line([new TextRun(p)], { after: 160 })),
    line([new TextRun(letter.closing)], { before: 80, after: 40 }),
    line([new TextRun(cv.name)]),
  ]);
}

// ---------- PDF ----------

const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const fontUrl = (f) => pathToFileURL(resolve(root, 'site/fonts', f)).href;
const css = `
@font-face{font-family:Plex;font-weight:400;src:url(${fontUrl('ibm-plex-sans-latin-400-normal.woff2')})}
@font-face{font-family:Plex;font-weight:600;src:url(${fontUrl('ibm-plex-sans-latin-600-normal.woff2')})}
@font-face{font-family:Plex;font-weight:700;src:url(${fontUrl('ibm-plex-sans-latin-700-normal.woff2')})}
@page{size:A4;margin:9mm 12mm}
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:Plex,Arial,sans-serif;font-size:9pt;line-height:1.3;color:#1b1f1e}
a{color:#1f4e79;text-decoration:none}
h1{font-size:16pt;font-weight:700}
.headline{font-size:10.5pt;margin-top:1pt}
.contact{font-size:8.8pt;margin-top:2pt}
h2{break-after:avoid;font-size:9.4pt;font-weight:700;text-transform:uppercase;border-bottom:.6pt solid #8a8a8a;padding-bottom:1pt;margin:6pt 0 2.5pt}
p{margin-bottom:1.5pt}
b{font-weight:600}
.company{margin-top:3pt}
ul{margin:1pt 0 0 12pt}
li{margin-bottom:1pt;padding-left:2pt}
.blk{break-inside:avoid}
.letter p{margin-bottom:9pt;font-size:10.2pt;line-height:1.45}
.letter .date{margin:14pt 0 12pt}`;

const contactHtml = () => contactParts.map((p) => (isLink(p) ? `<a href="${href(p)}">${esc(p)}</a>` : esc(p))).join(' | ');
const head = (title) => `<!doctype html><html lang="en-AU"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>
<h1>${esc(cv.name.toUpperCase())}</h1><div class="headline">${esc(cv.headline)}</div><div class="contact">${contactHtml()}</div>`;
const bullets = (list) => (list.length ? `<ul>${list.map((b) => `<li>${esc(b)}</li>`).join('')}</ul>` : '');

function cvHtml() {
  return `${head(`${cv.name} CV`)}
<h2>Summary</h2><p>${esc(cv.summary)}</p>
<h2>Skills</h2>${cv.skills.map((s) => `<p><b>${esc(s.group)}</b> | ${esc(s.items)}</p>`).join('')}
<h2>Experience</h2>${cv.experience.map((j) => j.roles.map((r, i) => `<div class="blk">${
  i === 0 ? `<p class="company"><b>${esc(j.company)}</b> | ${esc(j.location)}</p>` : ''}<p>${esc(r.title)} | ${esc(r.dates)}</p>${bullets(r.bullets)}</div>`).join('')).join('')}
<h2>Projects</h2>${cv.projects.map((p) => `<div class="blk"><p><b>${esc(p.name)}</b> | ${p.links.map((l) => `<a href="${href(l)}">${esc(l)}</a>`).join(' | ')} | ${esc(p.dates)}</p>${bullets(p.bullets)}</div>`).join('')}
<h2>Education</h2>${cv.education.map((e) => `<p><b>${esc(e.degree)}</b> | ${esc(e.school)} | ${esc(e.dates)}</p>`).join('')}
<h2>Certifications</h2><p>${cv.certifications.map((c) => esc(`${c.name}, ${c.issuer}, ${c.date}`)).join(' | ')}</p>
<h2>References</h2>${referees.length ? referees.map((r) => `<p>${esc(refereeLine(r))}</p>`).join('') : `<p>${esc(cv.references)}</p>`}
</body></html>`;
}

function letterHtml() {
  return `${head(`${cv.name} Cover Letter`)}<div class="letter">
<p class="date">${esc(today)}</p><p>${esc(letter.greeting)}</p>
${letter.paragraphs.map((p) => `<p>${esc(p)}</p>`).join('')}
<p>${esc(letter.closing)}<br>${esc(cv.name)}</p></div></body></html>`;
}

let browser;
async function pdfFrom(html, path, title) {
  const { chromium } = await import('playwright');
  const { PDFDocument } = await import('pdf-lib');
  browser ??= await chromium.launch();
  const tmp = resolve(outDir, `.render-${Date.now()}.html`);
  writeFileSync(tmp, html);
  const page = await browser.newPage();
  await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });
  await page.evaluate(() => document.fonts.ready);
  const raw = await page.pdf({ format: 'A4', preferCSSPageSize: true });
  await page.close();
  unlinkSync(tmp);
  // Author details only. No tool names in the file metadata.
  const pdf = await PDFDocument.load(raw, { updateMetadata: false });
  pdf.setTitle(title);
  pdf.setAuthor(AUTHOR);
  pdf.setSubject(cv.headline);
  pdf.setCreator(AUTHOR);
  pdf.setProducer(AUTHOR);
  pdf.setKeywords([]);
  writeFileSync(path, await pdf.save());
  return pdf.getPageCount();
}

const out = (name) => resolve(outDir, name);
if (only.includes('cv-docx')) {
  writeFileSync(out(`${BASE}_CV.docx`), await Packer.toBuffer(cvDocx()));
  console.log(`wrote ${out(`${BASE}_CV.docx`)}`);
}
if (only.includes('cv-pdf')) {
  const pages = await pdfFrom(cvHtml(), out(`${BASE}_CV.pdf`), `${cv.name} CV`);
  console.log(`wrote ${out(`${BASE}_CV.pdf`)} (${pages} page${pages > 1 ? 's' : ''})`);
  if (pages > MAX_CV_PAGES) {
    console.error(`The CV runs to ${pages} pages. The limit is ${MAX_CV_PAGES}. Shorten cv/cv.json.`);
    process.exitCode = 1;
  }
}
if (only.includes('letter-docx')) {
  writeFileSync(out(`${BASE}_Cover_Letter.docx`), await Packer.toBuffer(letterDocx()));
  console.log(`wrote ${out(`${BASE}_Cover_Letter.docx`)}`);
}
if (only.includes('letter-pdf')) {
  const pages = await pdfFrom(letterHtml(), out(`${BASE}_Cover_Letter.pdf`), `${cv.name} Cover Letter`);
  console.log(`wrote ${out(`${BASE}_Cover_Letter.pdf`)} (${pages} page${pages > 1 ? 's' : ''})`);
}
await browser?.close();
console.log(phone ? 'private copies, phone number included' : 'public copies, no phone number');
