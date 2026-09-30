import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { findStyleProblems, strings } from './style-rules.mjs';

const cv = JSON.parse(readFileSync(new URL('../cv/cv.json', import.meta.url), 'utf8'));
const letter = JSON.parse(readFileSync(new URL('../cv/cover-letter.json', import.meta.url), 'utf8'));

// Links and the email address are allowed to keep their own characters.
const isAddress = (path) => /\.(email|link)$|\.links\[\d+\]$/.test(path);

test('every line of the CV follows the writing rules', () => {
  const problems = [];
  for (const [path, text] of strings(cv)) {
    if (isAddress(path)) continue;
    for (const p of findStyleProblems(text)) problems.push(`${path} ${p}: "${text}"`);
  }
  assert.deepEqual(problems, []);
});

const MOBILE = /\+?61\s?4\d{2}|04\d{2}\s?\d{3}\s?\d{3}/;

test('the public CV data holds no phone number', () => {
  assert.doesNotMatch(JSON.stringify(cv), MOBILE);
});

test('no public text file holds a real mobile number', () => {
  for (const file of ['../README.md', '../docs/PORTFOLIO.md', '../site/index.html', '../site/404.html']) {
    assert.doesNotMatch(readFileSync(new URL(file, import.meta.url), 'utf8'), MOBILE, file);
  }
});

test('the CV uses the one CV email address', () => {
  assert.equal(cv.email, 'gauravraiau@gmail.com');
});

const DATE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}$/;
const RANGE = /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} to ((Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}|present)$/;

test('dates read as "Mon YYYY to Mon YYYY" everywhere', () => {
  const ranges = [
    ...cv.experience.flatMap((e) => e.roles.map((r) => r.dates)),
    ...cv.projects.map((p) => p.dates),
    ...cv.education.map((e) => e.dates),
  ];
  for (const d of ranges) assert.match(d, RANGE, d);
  for (const c of cv.certifications) assert.match(c.date, DATE, c.date);
});

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const start = (range) => {
  const [m, y] = range.split(' ');
  return Number(y) * 12 + MONTHS.indexOf(m);
};

test('roles are listed newest first', () => {
  const starts = cv.experience.flatMap((e) => e.roles.map((r) => start(r.dates)));
  assert.deepEqual(starts, [...starts].sort((a, b) => b - a));
});

test('every bullet is a full sentence of sensible length', () => {
  const bullets = [
    ...cv.experience.flatMap((e) => e.roles.flatMap((r) => r.bullets)),
    ...cv.projects.flatMap((p) => p.bullets),
    ...cv.education.flatMap((e) => e.bullets),
  ];
  for (const b of bullets) {
    assert.match(b, /^[A-Z0-9]/, `starts with a capital: ${b}`);
    assert.match(b, /\.$/, `ends with a full stop: ${b}`);
    assert.ok(b.length <= 320, `too long for one bullet: ${b}`);
  }
});

test('job titles match the titles Gaurav confirmed', () => {
  const titles = Object.fromEntries(cv.experience.map((e) => [e.company, e.roles.map((r) => r.title)]));
  assert.deepEqual(titles['eClerx'], ['Senior IT Support Analyst', 'IT Support Analyst']);
  assert.deepEqual(titles['Oceaneering International Services'], ['IT Support Analyst, contract']);
  assert.deepEqual(titles['Future Work Technologies'], ['Team Lead']);
  assert.deepEqual(titles['Bendigo Telco'], ['Reporting Analyst, Customer Experience', 'CX Enablement Intern']);
});

test('the CV points to the portfolio and LinkedIn, and lists references', () => {
  assert.ok(cv.links.includes('gauravraiji.vercel.app'), 'portfolio link');
  assert.ok(cv.links.includes('linkedin.com/in/gauravraiji'), 'LinkedIn link');
  assert.equal(cv.references, 'Available on request.');
});

test('the WhatsApp, Messenger and Instagram work sits under Bendigo Telco', () => {
  const bendigo = cv.experience.find((e) => e.company === 'Bendigo Telco');
  const text = bendigo.roles.flatMap((r) => r.bullets).join(' ');
  for (const channel of ['WhatsApp', 'Facebook Messenger', 'Instagram', 'Amazon Connect']) assert.ok(text.includes(channel), channel);
});

test('the cover letter follows the writing rules', () => {
  const problems = [];
  for (const [path, text] of strings(letter)) {
    for (const p of findStyleProblems(text)) problems.push(`${path} ${p}: "${text}"`);
  }
  assert.deepEqual(problems, []);
});

test('the cover letter keeps its placeholders and holds no phone number', () => {
  const body = letter.paragraphs.join(' ');
  assert.match(body, /\[Role\]/);
  assert.match(body, /\[Company\]/);
  assert.doesNotMatch(JSON.stringify(letter), /\+?61\s?4\d{2}|04\d{2}\s?\d{3}\s?\d{3}/);
});
