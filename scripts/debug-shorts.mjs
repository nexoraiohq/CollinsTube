import { chromium } from "playwright-core";

const browser = await chromium.launch({
  executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  headless: true,
});
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => m.type() === "error" && console.log("CONSOLE:", m.text()));
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));

await page.goto("http://localhost:4173/shorts/jNQXAC9IVRw", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(2500);

const info = await page.evaluate(() => {
  const q = (s) => document.querySelector(s);
  const rect = (s) => {
    const el = q(s);
    if (!el) return "missing";
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    return {
      x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height),
      display: cs.display, visibility: cs.visibility, opacity: cs.opacity, overflow: cs.overflow,
      zIndex: cs.zIndex, bg: cs.backgroundColor,
    };
  };
  return {
    windowScrollY: window.scrollY,
    docScrollH: document.documentElement.scrollHeight,
    winH: window.innerHeight,
    shorts: rect(".shorts"),
    feed: rect(".shorts__feed"),
    feedScroll: q(".shorts__feed") ? { scrollTop: q(".shorts__feed").scrollTop, scrollH: q(".shorts__feed").scrollHeight, clientH: q(".shorts__feed").clientHeight } : null,
    activeSection: rect(".short.is-active"),
    stage: rect(".short.is-active .short__stage"),
    meta: rect(".short.is-active .short__meta"),
    player: rect(".short.is-active .short__player"),
    iframeSrc: q(".short.is-active iframe")?.getAttribute("src"),
    sectionCount: document.querySelectorAll(".short").length,
    mainRect: rect(".main"),
    bodyBg: getComputedStyle(document.body).backgroundColor,
  };
});
console.log(JSON.stringify(info, null, 2));
await browser.close();
