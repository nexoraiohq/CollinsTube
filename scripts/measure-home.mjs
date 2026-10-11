import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
for (const label of ["Accept all", "Reject all", "No thanks"]) {
  try {
    const b = page.locator(`button:has-text("${label}")`).first();
    if (await b.isVisible({ timeout: 1200 })) { await b.click(); await page.waitForTimeout(1000); }
  } catch {}
}

// search + open a video to give the account some history
try {
  await page.locator("input#search, input[name='search_query']").first().fill("music");
  await page.keyboard.press("Enter");
  await page.waitForTimeout(3500);
  await page.locator("ytd-video-renderer a#video-title, a#video-title").first().click();
  await page.waitForTimeout(5000);
} catch (e) { console.log("history warm-up failed:", e.message); }

// now home
await page.goto("https://www.youtube.com/", { waitUntil: "domcontentloaded", timeout: 60000 });
let n = 0;
for (let i = 0; i < 20; i++) {
  n = await page.locator("ytd-rich-item-renderer").count();
  if (n > 3) break;
  await page.waitForTimeout(1000);
}
await page.waitForTimeout(2000);
console.log("rich items:", n);

const data = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      padding: cs.padding, margin: cs.margin, gap: cs.gap, rowGap: cs.rowGap, columnGap: cs.columnGap,
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      borderRadius: cs.borderRadius, display: cs.display, background: cs.backgroundColor, color: cs.color,
      gridTemplate: cs.gridTemplateColumns?.slice(0, 160),
    };
  };
  const items = [...document.querySelectorAll("ytd-rich-item-renderer")].slice(0, 12).map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  });
  const chipBar = q("ytd-feed-filter-chip-bar-renderer");
  const chips = [...document.querySelectorAll("yt-chip-cloud-chip-renderer")].slice(0, 4).map((c) => {
    const cs = getComputedStyle(c);
    const r = c.getBoundingClientRect();
    const label = c.querySelector(".yt-chip-cloud-chip-renderer-text")?.textContent || c.textContent?.trim().slice(0, 20);
    return { label, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], bg: cs.backgroundColor, radius: cs.borderRadius, fontSize: cs.fontSize };
  });
  return {
    contents: f(q("ytd-rich-grid-renderer #contents")),
    shelf: f(q("ytd-rich-shelf-renderer")),
    items,
    chipBar: f(chipBar),
    chips,
    title: f(q("ytd-rich-grid-media #video-title")),
    meta: f(q("#metadata-line span")),
    thumbBox: f(q("ytd-rich-grid-media #thumbnail")),
    owner: f(q("#channel-name")),
    headerH: q("ytd-masthead")?.getBoundingClientRect().height,
  };
});
console.log(JSON.stringify(data, null, 1));
await page.screenshot({ path: "scripts/shots/yt-home-ref.png" });
await browser.close();
