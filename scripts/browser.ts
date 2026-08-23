import { existsSync } from "node:fs";
import puppeteer, { type Browser } from "puppeteer-core";

/**
 * Locates an already-installed Chrome rather than downloading a second copy.
 *
 * `puppeteer-core` keeps `npm install` small, which matters because this
 * repository is cloned by students who never render a PDF.
 */
const CANDIDATES = [
  process.env.CHROME_PATH,
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/Applications/Chromium.app/Contents/MacOS/Chromium",
  "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge",
  "/usr/bin/google-chrome",
  "/usr/bin/google-chrome-stable",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
].filter((path): path is string => Boolean(path));

export function chromePath(): string {
  const found = CANDIDATES.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `No Chrome installation found. Set CHROME_PATH to a Chrome or Chromium binary.\nLooked in:\n${CANDIDATES.map((path) => `  ${path}`).join("\n")}`,
    );
  }
  return found;
}

export async function launch(): Promise<Browser> {
  return puppeteer.launch({
    executablePath: chromePath(),
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage", "--font-render-hinting=none"],
  });
}
