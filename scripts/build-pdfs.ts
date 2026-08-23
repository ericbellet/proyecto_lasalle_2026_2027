import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { marked } from "marked";
import puppeteer from "puppeteer-core";

/**
 * Turns the three project briefs into print PDFs.
 *
 * Source of truth stays Markdown so the briefs can be edited without opening
 * a layout tool. This script only paints them.
 */

const ROOT = resolve(process.cwd());
const DOCS = resolve(ROOT, "docs/projects");

const FILES = [
  "RA1_Data_Lake_Project.md",
  "RA2_Data_Warehouse_ML_Project.md",
  "RA3_AI_Agents_Project.md",
] as const;

function chromePath(): string {
  const fromEnv = process.env.CHROME_PATH;
  if (fromEnv) return fromEnv;
  const candidates = [
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
  ];
  return candidates.find((path) => {
    try {
      readFileSync(path);
      return true;
    } catch {
      return false;
    }
  }) ?? candidates[0]!;
}

function splitFrontmatter(source: string): { meta: Record<string, string>; body: string } {
  if (!source.startsWith("---")) return { meta: {}, body: source };
  const end = source.indexOf("\n---", 3);
  if (end < 0) return { meta: {}, body: source };
  const raw = source.slice(4, end);
  const body = source.slice(end + 4).trim();
  const meta: Record<string, string> = {};
  for (const line of raw.split("\n")) {
    const colon = line.indexOf(":");
    if (colon < 0) continue;
    meta[line.slice(0, colon).trim()] = line.slice(colon + 1).trim().replace(/^"|"$/g, "");
  }
  return { meta, body };
}

function pageHtml(title: string, subtitle: string, area: string, html: string): string {
  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${title}</title>
  <style>
    @page { size: A4; margin: 22mm 18mm 24mm; }
    :root {
      --ink: #16181f;
      --muted: #5b6170;
      --rule: #d8dce6;
      --paper: #fbfaf6;
      --accent: #8a6c2c;
      --navy: #141824;
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; padding: 0; }
    body {
      font-family: "Iowan Old Style", "Palatino Linotype", Palatino, "Times New Roman", serif;
      color: var(--ink);
      background: var(--paper);
      font-size: 11pt;
      line-height: 1.55;
    }
    .masthead {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2px solid var(--navy);
      padding-bottom: 10px;
      margin-bottom: 22px;
    }
    .brand { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 9pt; letter-spacing: 0.16em; text-transform: uppercase; color: var(--accent); }
    .area { font-family: ui-monospace, Menlo, monospace; font-size: 9pt; color: var(--muted); }
    h1 { font-size: 22pt; line-height: 1.15; margin: 0 0 6px; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 11pt; margin: 0 0 22px; }
    h2 { font-size: 13.5pt; margin: 26px 0 8px; border-top: 1px solid var(--rule); padding-top: 14px; }
    h3 { font-size: 11.5pt; margin: 18px 0 6px; }
    p { margin: 0 0 10px; }
    blockquote {
      margin: 14px 0;
      padding: 10px 14px;
      border-left: 3px solid var(--accent);
      background: #f4efe3;
      color: var(--navy);
    }
    blockquote p { margin: 0; }
    ul, ol { margin: 0 0 12px; padding-left: 1.2em; }
    li { margin-bottom: 4px; }
    code, pre { font-family: ui-monospace, "SF Mono", Menlo, monospace; font-size: 8.8pt; }
    code { background: #eef0f5; padding: 0.1em 0.35em; border-radius: 3px; }
    pre {
      background: var(--navy);
      color: #e8ecf4;
      padding: 12px 14px;
      border-radius: 6px;
      overflow: hidden;
      white-space: pre-wrap;
      page-break-inside: avoid;
    }
    pre code { background: none; color: inherit; padding: 0; }
    table { width: 100%; border-collapse: collapse; font-size: 9.4pt; margin: 0 0 14px; }
    th, td { border-bottom: 1px solid var(--rule); padding: 6px 8px; text-align: left; vertical-align: top; }
    th { font-family: ui-sans-serif, system-ui, sans-serif; font-size: 8pt; letter-spacing: 0.06em; text-transform: uppercase; color: var(--muted); }
    a { color: inherit; }
    .footer-note { margin-top: 28px; font-size: 9pt; color: var(--muted); border-top: 1px solid var(--rule); padding-top: 10px; }
  </style>
</head>
<body>
  <header class="masthead">
    <div class="brand">Value Investing Challenge</div>
    <div class="area">${area}</div>
  </header>
  <h1>${title}</h1>
  <p class="subtitle">${subtitle}</p>
  ${html}
  <p class="footer-note">Every prediction must be recorded before we know the outcome. · ${title}</p>
</body>
</html>`;
}

async function main() {
  mkdirSync(DOCS, { recursive: true });
  const executablePath = chromePath();
  console.log(`Using Chrome at ${executablePath}`);

  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-gpu"],
  });

  try {
    for (const file of FILES) {
      const source = readFileSync(resolve(DOCS, file), "utf8");
      const { meta, body } = splitFrontmatter(source);
      const html = await marked.parse(body, { gfm: true });
      const document = pageHtml(
        meta.title ?? file,
        meta.subtitle ?? "Value Investing Challenge",
        meta.area ?? "",
        html,
      );
      const htmlPath = resolve(DOCS, file.replace(/\.md$/, ".html"));
      writeFileSync(htmlPath, document, "utf8");

      const page = await browser.newPage();
      await page.setContent(document, { waitUntil: "load" });
      const pdfPath = resolve(DOCS, file.replace(/\.md$/, ".pdf"));
      await page.pdf({
        path: pdfPath,
        format: "A4",
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate: `<div></div>`,
        footerTemplate: `
          <div style="font-size:8px;width:100%;padding:0 18mm;color:#5b6170;display:flex;justify-content:space-between;font-family:ui-monospace,monospace;">
            <span>Value Investing Challenge</span>
            <span class="pageNumber"></span>
          </div>`,
        margin: { top: "18mm", bottom: "18mm", left: "16mm", right: "16mm" },
      });
      await page.close();
      console.log(`  wrote ${pdfPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
