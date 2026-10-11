import { chromium } from "playwright-core";

const BASE = "http://localhost:4173";
const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

const probe = () => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      margin: cs.margin, padding: cs.padding, gap: cs.gap,
      borderRadius: cs.borderRadius, display: cs.display,
      gridTemplate: cs.gridTemplateColumns?.slice(0, 160),
      transform: cs.transform, fontFamily: cs.fontFamily?.slice(0, 40),
    };
  };
  return { f, q };
};

// ---------- HOME (rail collapsed) ----------
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const home = await page.evaluate(() => {
  const { f, q } = (() => {
    const q = (s) => document.querySelector(s);
    const f = (el) => {
      if (!el) return null;
      const cs = getComputedStyle(el);
      const r = el.getBoundingClientRect();
      return {
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
        margin: cs.margin, padding: cs.padding, gap: cs.gap,
        borderRadius: cs.borderRadius, display: cs.display,
        gridTemplate: cs.gridTemplateColumns?.slice(0, 160),
        transform: cs.transform,
      };
    };
    return { f, q };
  })();
  const cards = [...document.querySelectorAll(".card")].slice(0, 5).map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  });
  return {
    shellClass: q(".shell")?.className,
    header: f(q(".header")),
    main: f(q(".main")),
    sidebar: f(q(".sidebar")),
    sideItems: [...document.querySelectorAll(".side-item")].map((s) => s.textContent.trim()),
    chips: f(q(".home-chips")),
    grid: f(q(".grid")),
    cards,
    cardTitle: f(q(".card__title")),
    cardMeta: f(q(".card__channel, .card__stats")),
    thumb: f(q(".thumb")),
    htmlScrollbar: {
      gutter: getComputedStyle(document.documentElement).scrollbarGutter,
      width: getComputedStyle(document.documentElement).scrollbarWidth,
    },
    heroCount: document.querySelectorAll(".hero").length,
    fontLoaded: document.fonts.check('14px "SF Pro Display"'),
  };
});
console.log("HOME-rail:", JSON.stringify(home, null, 1));

// expand guide
await page.locator(".header__menu").click();
await page.waitForTimeout(700);
const homeExpanded = await page.evaluate(() => {
  const m = document.querySelector(".main")?.getBoundingClientRect();
  const c = document.querySelector(".card")?.getBoundingClientRect();
  return {
    mainX: m ? Math.round(m.x) : null,
    firstCardX: c ? Math.round(c.x) : null,
    sidebarW: Math.round(document.querySelector(".sidebar")?.getBoundingClientRect().width ?? 0),
  };
});
console.log("HOME-expanded:", JSON.stringify(homeExpanded));
await page.screenshot({ path: "scripts/shots/ours-home-expanded.png" });
await page.locator(".header__menu").click();
await page.waitForTimeout(600);
await page.screenshot({ path: "scripts/shots/ours-home-rail.png" });

// ---------- SEARCH ----------
await page.goto(BASE + "/results?search_query=adele", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const search = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      color: cs.color, borderRadius: cs.borderRadius, gap: cs.gap,
    };
  };
  const rows = [...document.querySelectorAll(".row--search")].slice(0, 4).map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  });
  return {
    main: f(q(".main")),
    results: f(q(".search-results")),
    row: f(q(".row--search")),
    thumb: f(q(".row--search .row__media .thumb") || q(".row--search .row__media")),
    title: f(q(".row--search .row__title")),
    channel: f(q(".row--search .row__channel")),
    stats: f(q(".row--search .row__stats")),
    rows,
  };
});
console.log("SEARCH:", JSON.stringify(search, null, 1));
await page.screenshot({ path: "scripts/shots/ours-search.png" });

// ---------- CHANNEL GRID ----------
await page.goto(BASE + "/@lofigirl", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(800);
const channel = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      gap: cs.gap, rowGap: cs.rowGap, columnGap: cs.columnGap,
      gridTemplate: cs.gridTemplateColumns?.slice(0, 160),
      borderRadius: cs.borderRadius,
    };
  };
  const items = [...document.querySelectorAll(".grid .card")].slice(0, 5).map((el) => {
    const r = el.getBoundingClientRect();
    return [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)];
  });
  return { grid: f(q(".grid")), items, title: f(q(".card__title")), thumb: f(q(".thumb")) };
});
console.log("CHANNEL:", JSON.stringify(channel, null, 1));

// ---------- WATCH ----------
await page.goto(BASE + "/watch?v=dQw4w9WgXcQ", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1200);
const watch = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    return {
      rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
      fontSize: cs.fontSize, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
      padding: cs.padding, gap: cs.gap,
      gridTemplate: cs.gridTemplateColumns?.slice(0, 160),
      transform: cs.transform, display: cs.display,
    };
  };
  return {
    shellClass: q(".shell")?.className,
    main: f(q(".main")),
    sidebar: f(q(".sidebar")),
    player: f(q(".player")),
    watch: f(q(".watch")),
    rail: f(q(".watch__rail")),
    title: f(q(".watch__title")),
    playerBarCount: document.querySelectorAll(".player-bar").length,
  };
});
console.log("WATCH:", JSON.stringify(watch, null, 1));
await page.screenshot({ path: "scripts/shots/ours-watch.png" });

// guide opened on watch (overlay)
await page.locator(".header__menu").click();
await page.waitForTimeout(700);
const watchGuide = await page.evaluate(() => {
  const p = document.querySelector(".player")?.getBoundingClientRect();
  const s = document.querySelector(".sidebar")?.getBoundingClientRect();
  return {
    playerX: p ? Math.round(p.x) : null,
    sidebarX: s ? Math.round(s.x) : null,
    sidebarVisible: s ? s.x >= 0 && s.width > 100 : false,
  };
});
console.log("WATCH-guide-open:", JSON.stringify(watchGuide));
await page.screenshot({ path: "scripts/shots/ours-watch-guide.png" });

// ---------- SHORTS ----------
await page.goto(BASE + "/shorts/jNQXAC9IVRw", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(1500);
const shorts = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const f = (el) => {
    if (!el) return null;
    const r = el.getBoundingClientRect();
    return { rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)] };
  };
  return {
    shorts: f(q(".shorts")),
    feed: f(q(".shorts__feed")),
    stage: f(q(".short.is-active .short__stage")),
    nav: f(q(".shorts__nav")),
    railCount: document.querySelectorAll(".shorts__rail").length,
    hintCount: document.querySelectorAll(".shorts__hint").length,
  };
});
console.log("SHORTS:", JSON.stringify(shorts, null, 1));
await page.screenshot({ path: "scripts/shots/ours-shorts.png" });

await browser.close();
console.log("done");
