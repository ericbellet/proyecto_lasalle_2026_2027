import { mkdirSync } from "node:fs";
import { resolve } from "node:path";

import { launch } from "./browser";

/**
 * Renders pages at several widths so responsive regressions are caught without
 * a manual pass through a device toolbar.
 *
 *   npx tsx scripts/screenshot.ts /leaderboard /students/student-01
 */

const BASE_URL = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3001";
const OUT_DIR = resolve(process.cwd(), ".screenshots");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 960 },
  { name: "tablet", width: 834, height: 1112 },
  { name: "mobile", width: 390, height: 844 },
];

const paths = process.argv.slice(2);
if (paths.length === 0) paths.push("/");

const browser = await launch();
mkdirSync(OUT_DIR, { recursive: true });

let failures = 0;

for (const path of paths) {
  for (const viewport of VIEWPORTS) {
    const page = await browser.newPage();
    await page.setViewport({ width: viewport.width, height: viewport.height, deviceScaleFactor: 1 });

    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(String((error as Error).message ?? error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });

    const response = await page.goto(`${BASE_URL}${path}`, {
      waitUntil: "networkidle0",
      timeout: 60_000,
    });

    // Horizontal overflow is the single most common responsive bug, so it is
    // measured rather than eyeballed.
    const overflow = await page.evaluate(() => ({
      scrollWidth: document.documentElement.scrollWidth,
      clientWidth: document.documentElement.clientWidth,
      widest: Array.from(document.querySelectorAll<HTMLElement>("body *"))
        .filter((element) => element.getBoundingClientRect().right > window.innerWidth + 1)
        .slice(0, 5)
        .map((element) => `${element.tagName.toLowerCase()}.${element.className.toString().slice(0, 60)}`),
    }));

    const slug = path === "/" ? "home" : path.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "");
    const file = `${OUT_DIR}/${slug}-${viewport.name}.png`;
    await page.screenshot({ path: file as `${string}.png`, fullPage: true });

    const overflowing = overflow.scrollWidth > overflow.clientWidth + 1;
    if (response?.status() !== 200 || errors.length > 0 || overflowing) failures += 1;

    console.log(
      [
        `${path} @ ${viewport.name}`.padEnd(38),
        `status=${response?.status() ?? "?"}`,
        overflowing ? `OVERFLOW ${overflow.scrollWidth}>${overflow.clientWidth} ${overflow.widest.join(" | ")}` : "ok",
        errors.length ? `errors=${errors.map((line) => line.split("\n")[0]).slice(0, 2).join(" ; ")}` : "",
      ]
        .filter(Boolean)
        .join("  "),
    );

    await page.close();
  }
}

await browser.close();
console.log(`\n${failures === 0 ? "All clean" : `${failures} viewport(s) with problems`} · ${OUT_DIR}`);
