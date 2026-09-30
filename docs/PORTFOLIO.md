# Portfolio, CV and cover letter

This repo holds three things that all say the same thing about me:

1. The GitHub profile README (`README.md`).
2. A one page portfolio site in `site/`, meant for **https://gauravraiji.vercel.app**.
3. The CV and a base cover letter, built from `cv/cv.json` and `cv/cover-letter.json`.

Change a fact in `cv/cv.json` first. The tests then tell you if the site has fallen out of step.

## Layout

```
cv/cv.json              CV content. The only place to edit the CV.
cv/cover-letter.json    Base cover letter with [Role] and [Company] placeholders.
cv/build.mjs            Builds the CV and cover letter as Word and PDF files.
site/                   The portfolio. Plain HTML and CSS, no scripts, no trackers.
site/Gaurav_Rai_CV.pdf  Public CV for the site. No phone number.
site/vercel.json        Security headers and caching for Vercel.
tests/                  Checks for the CV, the cover letter and the site.
.github/workflows/      Runs the tests on every pull request.
```

## Writing rules

The CV, cover letter and site copy follow the same rules, and `tests/style-rules.mjs` enforces them:

- No colons, semicolons, hyphens or dashes in the copy. Email addresses and links are the only exception.
- Single spaces only, and no space before a comma or full stop.
- None of the stock phrases that make a CV read as machine written, such as "leveraged", "robust", "seamless" or "results driven". The full list is in `tests/style-rules.mjs`.
- Bold only for names, headings and employer lines.
- The CV stays on one page. The build fails if it runs to two.

## Build the CV and cover letter

```sh
npm ci
npm run build:cv
```

That writes public copies, with no phone number, to `dist/`. For the copies you send to employers, add the phone number at build time so it never lands in this public repo:

```sh
CV_PHONE="+61 4XX XXX XXX" npm run build:cv -- --out ~/Documents/CV
```

After changing `cv/cv.json`, refresh the public PDF on the site:

```sh
npm run build:cv -- --out site --only cv-pdf
```

Before sending the cover letter, replace `[Role]` and `[Company]` and add one sentence about why that company.

The build uses Playwright's Chromium to make the PDFs. If it isn't installed, run `npx playwright install chromium` once.

## Run the tests

```sh
npm test
```

They check the writing rules, one email address everywhere, dates in the same format, roles newest first, the site's links and files, that the site's experience matches the CV, the site address, security headers, and that no photos or phone numbers are published.

## Deploy the site

The site is plain files, so Vercel serves them as they are.

1. Go to vercel.com/new and import `thecelestialmismatch/Gaurav-Rai`.
2. Set **Project Name** to `gauravraiji`. That gives the address gauravraiji.vercel.app, which the CV and site already use. (gaurav-rai.vercel.app belongs to someone else.)
3. Set **Root Directory** to `site`.
4. Leave **Framework Preset** as Other and the build command empty.
5. Deploy.

From then on, every push to `main` redeploys the site and every pull request gets a preview link.

If you ever use a different address, change it in `site/index.html`, `site/robots.txt`, `site/sitemap.xml` and `cv/cv.json`. The tests fail until all four match.

## After the site is live

- LinkedIn: add https://gauravraiji.vercel.app as a website in Contact info and as the custom button.
- Share the link once on LinkedIn to check the preview card shows `site/og-image.png`.
