import { launch } from "./browser";

/**
 * Reports every element that sticks out past the viewport at a given width.
 *
 *   npx tsx scripts/overflow.ts 390 /leaderboard
 */
const width = Number(process.argv[2] ?? 390);
const path = process.argv[3] ?? "/";
const baseUrl = process.env.SCREENSHOT_BASE_URL ?? "http://localhost:3001";

const browser = await launch();
const page = await browser.newPage();
await page.setViewport({ width, height: 900 });
await page.goto(`${baseUrl}${path}`, { waitUntil: "networkidle0", timeout: 60_000 });

const offenders = await page.evaluate(() => {
  const rows: string[] = [];
  document.querySelectorAll<HTMLElement>("body *").forEach((element) => {
    const rect = element.getBoundingClientRect();
    if (rect.right > window.innerWidth + 1) {
      rows.push(
        `${element.tagName.toLowerCase()} w=${Math.round(rect.width)} left=${Math.round(rect.left)} right=${Math.round(rect.right)} :: ${String(element.className).slice(0, 100)}`,
      );
    }
  });
  return {
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    rows: rows.slice(0, 15),
  };
});

console.log(`${path} @ ${width}px — scrollWidth ${offenders.scrollWidth} vs clientWidth ${offenders.clientWidth}`);
console.log(offenders.rows.join("\n") || "no offenders");

await browser.close();
