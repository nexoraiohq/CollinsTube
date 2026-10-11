import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const pick = (el) => {
  if (!el) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  return {
    rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    padding: cs.padding,
    margin: cs.margin,
    gap: cs.gap,
    rowGap: cs.rowGap,
    columnGap: cs.columnGap,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    lineHeight: cs.lineHeight,
    borderRadius: cs.borderRadius,
    background: cs.backgroundColor,
    color: cs.color,
    display: cs.display,
    gridTemplate: cs.gridTemplateColumns?.slice(0, 160),
  };
};

async function open(url, waitFor) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (const label of ["Accept all", "Reject all", "No thanks"]) {
    try {
      const b = page.locator(`button:has-text("${label}")`).first();
      if (await b.isVisible({ timeout: 1200 })) {
        await b.click();
        await page.waitForTimeout(1200);
      }
    } catch {}
  }
  if (waitFor) {
    for (let i = 0; i < 15; i++) {
      if ((await page.locator(waitFor).count()) > 0) break;
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForTimeout(1200);
}

// ---------- SEARCH RESULTS ----------
await open("https://www.youtube.com/results?search_query=adele", "ytd-video-renderer");
const search = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      margin: cs.margin, padding: cs.padding, borderRadius: cs.borderRadius, color: cs.color,
      display: cs.display,
    };
  };
  const vr = q("ytd-video-renderer");
  const vrStyle = vr ? getComputedStyle(vr) : null;
  return {
    resultsRect: f(q("ytd-search-persistent-results-renderer #contents") || q("#contents")),
    videoRenderer: vr ? { padding: vrStyle.padding, margin: vrStyle.margin, display: vrStyle.display, rect: f(vr).rect } : null,
    thumb: f(q("ytd-video-renderer #thumbnail") || q("ytd-video-renderer ytd-thumbnail")),
    title: f(q("ytd-video-renderer #video-title")),
    titleText: q("ytd-video-renderer #video-title")?.textContent?.trim().slice(0, 40),
    meta: f(q("ytd-video-renderer #metadata-line span")),
    channel: f(q("ytd-video-renderer #channel-name")),
    desc: f(q("ytd-video-renderer #description-text")),
    rows: [...document.querySelectorAll("ytd-video-renderer")].slice(0, 4).map((el) => {
      const r = el.getBoundingClientRect();
      return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
    }),
  };
});
console.log("SEARCH:", JSON.stringify(search, null, 1));
await page.screenshot({ path: "scripts/shots/yt-search-ref.png" });

// ---------- CHANNEL VIDEOS GRID ----------
await open("https://www.youtube.com/@MrBeast/videos", "ytd-rich-item-renderer, ytd-rich-grid-media");
const channel = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      margin: cs.margin, padding: cs.padding, gap: cs.gap, rowGap: cs.rowGap, columnGap: cs.columnGap,
      borderRadius: cs.borderRadius, gridTemplate: cs.gridTemplateColumns?.slice(0, 160), display: cs.display,
    };
  };
  const contents = q("#contents.ytd-rich-grid-renderer") || q("ytd-rich-grid-renderer #contents");
  const items = [...document.querySelectorAll("ytd-rich-item-renderer")].slice(0, 10).map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  });
  return {
    contents: f(contents),
    items,
    title: f(q("ytd-rich-grid-media #video-title") || q("#video-title")),
    meta: f(q("#metadata-line span")),
    thumbImg: f(q("ytd-rich-grid-media img#img") || q("ytd-rich-grid-media #thumbnail img")),
    thumbBox: f(q("ytd-rich-grid-media #thumbnail") || q("#thumbnail")),
  };
});
console.log("CHANNEL:", JSON.stringify(channel, null, 1));
await page.screenshot({ path: "scripts/shots/yt-channel-ref.png" });

// ---------- WATCH ----------
await open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "#movie_player");
const watchBefore = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      padding: cs.padding, margin: cs.margin, display: cs.display,
      gridTemplate: cs.gridTemplateColumns?.slice(0, 160), gap: cs.gap,
    };
  };
  return {
    player: f(q("#movie_player")),
    primary: f(q("#primary")),
    secondary: f(q("#secondary")),
    above: f(q("#above-the-fold")),
    title: f(q("h1.ytd-watch-metadata yt-formatted-string") || q("h1")),
    primaryInner: f(q("#primary-inner")),
    secondaryInner: f(q("#secondary-inner")),
    watchFlexy: f(q("ytd-watch-flexy")),
    pageManager: f(q("#page-manager")),
  };
});
console.log("WATCH-before:", JSON.stringify(watchBefore, null, 1));
await page.screenshot({ path: "scripts/shots/yt-watch-ref.png" });

// toggle guide on watch
try {
  await page.locator("#guide-button button").first().click({ timeout: 4000 });
  await page.waitForTimeout(1200);
} catch (e) {
  console.log("watch guide toggle failed:", e.message);
}
const watchAfter = await page.evaluate(() => {
  const el = document.querySelector("#primary");
  const r = el?.getBoundingClientRect();
  const guide = document.querySelector("#guide");
  const scrim = document.querySelector("#guide-scrrim, #guide-scrim");
  return {
    primaryX: r ? Math.round(r.x) : null,
    guideVisible: guide ? getComputedStyle(guide).display !== "none" && guide.getBoundingClientRect().width > 0 : null,
    scrim: !!scrim,
  };
});
console.log("WATCH-after-toggle:", JSON.stringify(watchAfter));
await page.screenshot({ path: "scripts/shots/yt-watch-guide-ref.png" });

await browser.close();
console.log("done");
