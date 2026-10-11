import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

async function open(url, waitFor) {
  await page.goto(url, { waitUntil: "domcontentloaded", timeout: 60000 });
  for (const label of ["Accept all", "Reject all", "No thanks"]) {
    try {
      const b = page.locator(`button:has-text("${label}")`).first();
      if (await b.isVisible({ timeout: 1000 })) {
        await b.click();
        await page.waitForTimeout(1000);
      }
    } catch {}
  }
  if (waitFor) {
    for (let i = 0; i < 15; i++) {
      if ((await page.locator(waitFor).count()) > 0) break;
      await page.waitForTimeout(1000);
    }
  }
  await page.waitForTimeout(1500);
}

// ---- WATCH: secondary rail rows, chips, like/dislike ----
await open("https://www.youtube.com/watch?v=dQw4w9WgXcQ", "#movie_player");
const watch = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const f = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], display: cs.display, fontSize: cs.fontSize };
  };
  const compact = q("ytd-compact-video-renderer");
  return {
    secondary: f(q("#secondary")),
    compactRow: f(compact),
    compactThumb: f(compact?.querySelector("#thumbnail")),
    // filter chips in secondary?
    secondaryChips: qa("#secondary ytd-pill-renderer, #secondary ytd-chip-cloud-chip-renderer, #secondary yt-chip-cloud-chip-renderer, #secondary #filter-button, ytd-watch-next-secondary-results-renderer ytd-toggle-button-renderer").map((e) => (e.textContent || "").trim().slice(0, 40)).filter(Boolean),
    chipLikeCount: qa("#secondary yt-chip-cloud-chip-renderer, #secondary ytd-pill-renderer").length,
    // like/dislike structure
    segmented: !!q("ytd-menu-renderer #segmented-like-button, ytd-watch-metadata #like-button ytd-toggle-button-renderer"),
    likeBtn: f(q("ytd-watch-metadata #like-button")),
    dislikeBtn: f(q("ytd-watch-metadata #dislike-button")),
    likeText: (q("ytd-watch-metadata #like-button")?.textContent || "").trim().slice(0, 30),
    // player above title
    title: f(q("h1.ytd-watch-metadata")),
    // rail heading
    upnext: (q("#secondary #title, #secondary h3, #secondary ytd-watch-next-secondary-results #title")?.textContent || "").trim().slice(0, 50),
  };
});
console.log("WATCH2:", JSON.stringify(watch, null, 1));

// ---- SEARCH: toolbar structure ----
await open("https://www.youtube.com/results?search_query=adele", "ytd-video-renderer");
const search = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const f = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  };
  return {
    chips: qa("ytd-search-persistent-results-renderer #chips yt-chip-cloud-chip-renderer, #chips yt-chip-cloud-chip-renderer, yt-chip-cloud-chip-renderer").slice(0, 10).map((c) => (c.textContent || "").trim().slice(0, 25)),
    chipsRect: f(q("#chips")),
    filterBtn: f(q("#filter-button")),
    filterBtnText: (q("#filter-button")?.textContent || "").trim().slice(0, 30),
    // channel shelf
    channelRenderer: (() => {
      const c = q("ytd-channel-renderer");
      if (!c) return null;
      const buttons = [...c.querySelectorAll("ytd-button-renderer, yt-button-renderer")].map((b) => (b.textContent || "").trim().slice(0, 20)).filter(Boolean);
      const videos = c.querySelectorAll("ytd-thumbnail-renderer, ytd-video-thumbnail-renderer").length;
      const r = c.getBoundingClientRect();
      return {
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        borderRadius: getComputedStyle(c).borderRadius,
        background: getComputedStyle(c).backgroundColor,
        buttons,
        videoThumbs: videos,
        name: (c.querySelector("#channel-title, #title")?.textContent || "").trim().slice(0, 40),
      };
    })(),
    titleHasNumber: [...document.querySelectorAll("ytd-video-renderer #video-title")].slice(0, 3).map((t) => (t.textContent || "").trim().slice(0, 15)),
  };
});
console.log("SEARCH2:", JSON.stringify(search, null, 1));

// ---- CHANNEL: banner + head + rich item meta ----
await open("https://www.youtube.com/@MrBeast/videos", "ytd-rich-item-renderer");
const channel = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const qa = (s) => [...document.querySelectorAll(s)];
  const f = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)], borderRadius: cs.borderRadius, display: cs.display };
  };
  const item = q("ytd-rich-item-renderer");
  return {
    banner: f(q("#header ytd-c4-tabbed-header-renderer, #header-banner, ytd-channel-header-renderer #banner")),
    bannerImg: f(q("ytd-c4-tabbed-header-renderer #banner, #header-banner img, ytd-channel-header-renderer img#banner")),
    // find banner candidates
    banners: qa("#banner, ytd-c4-tabbed-header-renderer #banner, #header-banner").slice(0, 4).map((e) => ({
      tag: e.tagName, ...f(e),
    })),
    tabbedHeader: f(q("ytd-c4-tabbed-header-renderer")),
    channelName: f(q("#channel-name, ytd-c4-tabbed-header-renderer #channel-name")),
    avatar: f(q("ytd-c4-tabbed-header-renderer #avatar")),
    tabs: qa("yt-tab-shape").slice(0, 8).map((t) => (t.textContent || "").trim().slice(0, 15)),
    // rich item metadata: avatar present?
    itemChannelName: item ? (item.querySelector("#channel-name, ytd-channel-name")?.textContent || "").trim().slice(0, 30) : null,
    itemAvatarCount: item ? item.querySelectorAll("#avatar img, ytd-thumbnail img#img").length : 0,
    itemMeta: item ? (item.querySelector("#metadata-line")?.textContent || "").trim().slice(0, 60) : null,
    itemThumb: f(item?.querySelector("#thumbnail")),
  };
});
console.log("CHANNEL2:", JSON.stringify(channel, null, 1));

await browser.close();
console.log("done");
