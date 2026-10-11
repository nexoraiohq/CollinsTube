import { chromium } from "playwright-core";

const BASE = "http://localhost:4173";
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.setDefaultTimeout(12000);

async function watermark(pg, file) {
  await pg.evaluate((label) => {
    let el = document.getElementById("__shotmark");
    if (!el) {
      el = document.createElement("div");
      el.id = "__shotmark";
      el.style.cssText =
        "position:fixed;top:6px;right:6px;z-index:2147483647;background:#ff0000;color:#fff;font:bold 14px monospace;padding:4px 8px;border-radius:4px;pointer-events:none";
      document.body.appendChild(el);
    }
    el.textContent = "SHOT:" + label;
  }, file);
}

async function shot(path, file, waitFor) {
  await page.goto(BASE + path, { waitUntil: "domcontentloaded", timeout: 15000 });
  if (waitFor) await page.locator(waitFor).first().waitFor({ state: "visible", timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(2600);
  await watermark(page, file);
  await page.screenshot({ path: `scripts/shots/${file}` });
  const fontOk = await page.evaluate(() => document.fonts.check('14px "SF Pro Display"'));
  console.log("shot", file, "->", page.url(), "| sfpro:", fontOk);
}

await shot("/", "01-home-dark.png", ".card__title");
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "light"));
await page.waitForTimeout(600);
await watermark(page, "02-home-light.png");
await page.screenshot({ path: "scripts/shots/02-home-light.png" });
await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
await page.waitForTimeout(400);
await shot("/watch?v=dQw4w9WgXcQ", "03-watch.png", ".watch__title");
await shot("/results?search_query=adele", "04-search.png", ".search-results .row");
await shot("/@3blue1brown", "05-channel.png", ".page--channel .card__title");
await shot("/shorts/jNQXAC9IVRw", "06-shorts.png", ".short.is-active .short__title");
await shot("/feed/trending", "07-trending.png", ".trend-item");
await shot("/playlist?list=WL", "08-playlist.png", ".page");
await shot("/feed/library", "09-library.png", ".library-card");
await shot("/completely/bogus", "10-404.png", ".empty");

await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
await page.keyboard.press("Control+k");
await page.waitForTimeout(600);
await page.keyboard.type("queen");
await page.waitForTimeout(500);
await watermark(page, "11-palette.png");
await page.screenshot({ path: "scripts/shots/11-palette.png" });
await page.keyboard.press("Escape");

await page.locator(".header__create").click();
await page.waitForTimeout(800);
await watermark(page, "12-upload.png");
await page.screenshot({ path: "scripts/shots/12-upload.png" });
await page.keyboard.press("Escape");

await page.goto(BASE + "/watch?v=kJQP7kiw5Fk", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.goto(BASE + "/watch?v=60ItHLz5WEA", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.locator(".pill", { hasText: /^\s*Save\s*$/ }).click();
await page.waitForTimeout(500);
await page.goto(BASE + "/feed/history", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await watermark(page, "13-history.png");
await page.screenshot({ path: "scripts/shots/13-history.png" });

await page.goto(BASE + "/playlist?list=WL", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2200);
await watermark(page, "14-watchlater.png");
await page.screenshot({ path: "scripts/shots/14-watchlater.png" });

await page.goto(BASE + "/watch?v=9bZkp7q19f0", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
await page.keyboard.press("t");
await page.waitForTimeout(900);
await watermark(page, "15-theater.png");
await page.screenshot({ path: "scripts/shots/15-theater.png" });

await page.goto(BASE + "/watch?v=aircAruvnKk", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1800);
await page.evaluate(() => window.scrollTo(0, 700));
await page.waitForTimeout(900);
await watermark(page, "16-comments.png");
await page.screenshot({ path: "scripts/shots/16-comments.png" });

const m = await browser.newPage({ viewport: { width: 390, height: 844 } });
await m.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(2500);
await watermark(m, "17-mobile-home.png");
await m.screenshot({ path: "scripts/shots/17-mobile-home.png" });
await m.goto(BASE + "/watch?v=JGwWNGJdvx8", { waitUntil: "domcontentloaded" });
await m.waitForTimeout(2500);
await watermark(m, "18-mobile-watch.png");
await m.screenshot({ path: "scripts/shots/18-mobile-watch.png" });
await m.locator(".header__menu").click();
await m.waitForTimeout(900);
await watermark(m, "19-mobile-drawer.png");
await m.screenshot({ path: "scripts/shots/19-mobile-drawer.png" });

await browser.close();
console.log("shots done");
