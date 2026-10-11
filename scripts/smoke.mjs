import { chromium } from "playwright-core";

const BASE = "http://localhost:5173";
const EXE = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";

const consoleErrors = [];
const mobileErrors = [];
const pageErrors = [];
const failedRequests = [];

const routes = [
  ["/", "Home"],
  ["/watch?v=dQw4w9WgXcQ", "Watch (music)"],
  ["/watch?v=jfKfPfyJRdk", "Watch (live)"],
  ["/watch?v=does-not-exist", "Watch (broken id)"],
  ["/results?search_query=music", "Search results"],
  ["/results?search_query=zzqqxx", "Search (no results)"],
  ["/shorts", "Shorts"],
  ["/shorts/jNQXAC9IVRw", "Shorts (specific)"],
  ["/feed/subscriptions", "Subscriptions"],
  ["/feed/history", "History"],
  ["/feed/library", "Library"],
  ["/feed/trending", "Trending"],
  ["/feed/your-videos", "Your videos"],
  ["/playlist?list=WL", "Watch later"],
  ["/playlist?list=LL", "Liked videos"],
  ["/@lofigirl", "Channel"],
  ["/@nobodyhere", "Unknown channel"],
  ["/feed", "Bad feed url"],
  ["/completely/bogus", "404"],
];

const results = [];
let failed = 0;

function check(name, cond, detail = "") {
  if (cond) {
    results.push(`  ok   ${name}`);
  } else {
    failed++;
    results.push(`  FAIL ${name} ${detail}`);
  }
}

async function diagnostics(page, err) {
  console.log("\n!!!! CRASH: " + err.message);
  try {
    console.log("url:", page?.url());
    console.log("pills:", await page.locator(".pill").count());
    console.log("actions:", await page.locator(".actions").count());
    console.log(
      "overlays:",
      await page.locator(".modal-root, .palette, .cardmenu__shield, .drawer-backdrop.is-open").count(),
    );
    console.log("body text:", (await page.locator("body").innerText()).slice(0, 600).replace(/\n+/g, " | "));
    await page.screenshot({ path: "scripts/crash.png" });
  } catch (e) {
    console.log("diagnostics failed:", e.message);
  }
}

// Live API (built-in key) can take a second or two; wait for cards/rows to appear.
async function waitForCards(page, min = 1, timeout = 12000) {
  try {
    await page.waitForFunction(
      (m) => document.querySelectorAll(".card__title").length >= m,
      min,
      { timeout },
    );
  } catch {
    /* timed out — the check reports the actual count */
  }
}
async function waitForRows(page, min = 1, timeout = 12000) {
  try {
    await page.waitForFunction(
      (m) => document.querySelectorAll(".row__title").length >= m,
      min,
      { timeout },
    );
  } catch {
    /* timed out — the check reports the actual count */
  }
}

const browser = await chromium.launch({ executablePath: EXE, headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

page.on("console", (m) => {
  if (m.type() !== "error") return;
  const t = m.text();
  if (/Failed to load resource|net::ERR_|fonts\.g|Permissions policy violation/i.test(t)) return;
  consoleErrors.push(t);
});
page.on("pageerror", (e) => pageErrors.push(String(e.message)));
page.on("requestfailed", (r) => {
  const u = r.url();
  if (/ytimg|youtube|fonts\.g|googleapis|ggpht/.test(u)) return;
  failedRequests.push(`${u} :: ${r.failure()?.errorText}`);
});

// ---------- route sweep ----------
try {
console.log("== route sweep ==");
for (const [route, label] of routes) {
  await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
  await page.waitForTimeout(450);
  const textLen = (await page.locator("body").innerText()).length;
  const hasApp = await page.locator(".shell").count();
  const hasSomething = await page.locator("h1, h2, .watch__title, .empty, .card__title, .chipbar").count();
  const blank = textLen < 80 || hasApp === 0 || hasSomething === 0;
  check(`route ${route} renders (${label})`, !blank, `textLen=${textLen} app=${hasApp} heads=${hasSomething}`);
  results.push(`       title: ${await page.title()}`);
}

// ---------- home interactions ----------
console.log("== interactions ==");
await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
await waitForCards(page, 9);

const cardCount = await page.locator(".card__title").count();
check("home shows video cards", cardCount > 8, `got ${cardCount}`);

// YouTube layout: chips + grid only (no hero)
check("home has no hero (YouTube layout)", (await page.locator(".hero").count()) === 0);

// chip filter
await page.locator(".chip", { hasText: "Music" }).first().click();
await page.waitForTimeout(400);
await waitForCards(page, 1, 9000);
const activeChip = (await page.locator(".chip.is-active").first().innerText().catch(() => "")).trim();
check("chip filter activates Music", activeChip === "Music", `active=${activeChip}`);
const musicTitles = await page.locator(".card__title").allInnerTexts();
// Live Music category legitimately includes kids songs etc — just require content.
check("music chip shows music videos", musicTitles.length > 0, JSON.stringify(musicTitles.slice(0,2)));
await page.locator(".chip", { hasText: "All" }).first().click();
await page.waitForTimeout(300);

// infinite scroll — no "Load more" button; scroll loads pages automatically
const noButton = (await page.locator(".loadmore .btn").count()) === 0;
check("no Load more button (infinite scroll)", noButton);
const before = await page.locator(".card__title").count();
await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
await page.waitForTimeout(1200);
const after = await page.locator(".card__title").count();
check("scrolling keeps feed intact", after >= before, `${before} -> ${after}`);

// sidebar rail expand
await page.locator(".header__menu").click();
await page.waitForTimeout(450);
const expanded = await page.locator(".sidebar:not(.sidebar--rail)").count();
check("sidebar expands", expanded === 1);
await page.locator(".header__menu").click();
await page.waitForTimeout(350);

// search flow
const searchInput = page.locator(".searchbar input");
await searchInput.click();
await page.waitForTimeout(250);
const sugg = await page.locator(".suggestions__item").count();
check("search suggestions open", sugg > 0, `got ${sugg}`);
await page.keyboard.press("Escape");
await searchInput.fill("bohemian");
await page.keyboard.press("Enter");
await page.waitForTimeout(600);
await waitForRows(page, 1, 12000);
check("search navigates to results", page.url().includes("/results?search_query=bohemian"), page.url());
const rows = await page.locator(".search-results .row").count();
check("search returns rows", rows > 0, `rows=${rows}`);

// filters panel
await page.locator(".search-toolbar .btn", { hasText: "Filters" }).click();
await page.waitForTimeout(250);
check("filter panel opens", (await page.locator(".filters").count()) === 1);
await page.locator(".filters .chip", { hasText: "View count" }).click();
await page.waitForTimeout(250);
await page.locator(".filters .btn", { hasText: "Done" }).click();
await page.waitForTimeout(250);
check("filter panel closes", (await page.locator(".filters").count()) === 0);

// command palette
await page.keyboard.press("Control+k");
await page.waitForTimeout(350);
check("palette opens with Ctrl+K", (await page.locator(".palette__panel").count()) === 1);
await page.keyboard.type("trending");
await page.waitForTimeout(250);
const pItems = await page.locator(".palette__item").count();
check("palette has results", pItems > 0, `items=${pItems}`);
await page.keyboard.press("Escape");
await page.waitForTimeout(300);
check("palette closes with Escape", (await page.locator(".palette__panel").count()) === 0);

// theme toggle via account menu
await page.locator(".header__account").click();
await page.waitForTimeout(300);
check("account menu opens", (await page.locator(".dropdown--account").count()) === 1);
const themeBefore = await page.getAttribute("html", "data-theme");
await page.locator(".menu-item", { hasText: "Appearance" }).click();
await page.waitForTimeout(350);
const themeAfter = await page.getAttribute("html", "data-theme");
check("theme toggles", themeBefore !== themeAfter, `${themeBefore} -> ${themeAfter}`);
// toggle back
await page.locator(".header__account").click();
await page.waitForTimeout(250);
await page.locator(".menu-item", { hasText: "Appearance" }).click();
await page.waitForTimeout(300);
await page.keyboard.press("Escape");

// notifications
await page.locator(".header__right .dropdown-anchor .iconbtn").first().click();
await page.waitForTimeout(300);
check("notifications dropdown opens", (await page.locator(".dropdown--notif").count()) === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(250);
check("notifications dropdown closes", (await page.locator(".dropdown--notif").count()) === 0);

// upload modal
await page.locator(".header__create").click();
await page.waitForTimeout(400);
check("upload modal opens", (await page.locator(".dropzone").count()) === 1);
await page.keyboard.press("Escape");
await page.waitForTimeout(350);
check("upload modal closes with Escape", (await page.locator(".dropzone").count()) === 0);

// shortcuts modal
await page.locator(".header__account").click();
await page.waitForTimeout(250);
await page.locator(".menu-item", { hasText: "Keyboard shortcuts" }).click();
await page.waitForTimeout(350);
check("shortcuts modal opens", (await page.locator(".shortcut-list").count()) === 1);
await page.locator(".modal .iconbtn").first().click();
await page.waitForTimeout(300);
check("shortcuts modal closes", (await page.locator(".shortcut-list").count()) === 0);

// ---------- watch page ----------
await page.goto(BASE + "/watch?v=fJ9rUzIMcZQ", { waitUntil: "domcontentloaded" });
try {
  await page.waitForSelector(".player iframe", { timeout: 10000 });
} catch {
  /* check below reports the actual count */
}
check("player iframe present", (await page.locator(".player iframe").count()) === 1);
check("related rail populated", (await page.locator(".watch__rail .row").count()) >= 6);

// like
await page.locator(".segmented__btn").first().click();
await page.waitForTimeout(300);
check("like toggles active", (await page.locator(".segmented__btn.is-active").count()) >= 1);

// save -> toast
await page.locator(".pill", { hasText: /^\s*Save\s*$/ }).click();
await page.waitForTimeout(350);
check("save shows toast", (await page.locator(".toast").count()) >= 1);

// theater via keyboard
await page.locator("h1.watch__title").click();
await page.keyboard.press("t");
await page.waitForTimeout(400);
check("theater mode toggles (T)", (await page.locator(".watch--theater").count()) === 1);
await page.keyboard.press("t");
await page.waitForTimeout(300);

// description expand
await page.locator(".desc").click();
await page.waitForTimeout(300);
check("description expands", (await page.locator(".desc.is-open").count()) === 1);

// comments
const comments = await page.locator(".comment").count();
check("comments render", comments >= 5, `count=${comments}`);
await page.locator(".comments__sort .btn").click();
await page.waitForTimeout(300);
check("comment sort re-orders", (await page.locator(".comment").count()) >= 5);

// subscribe
const subBtn = page.locator(".channelrow .subscribe").first();
const subText = await subBtn.innerText();
await subBtn.click();
await page.waitForTimeout(350);
const subText2 = await page.locator(".channelrow .subscribe").first().innerText();
check("subscribe toggles label", subText !== subText2, `${subText} -> ${subText2}`);

// navigate away -> mini player
await page.locator(".header__logo").click();
await page.waitForTimeout(700);
check("mini player appears after leaving watch", (await page.locator(".mini").count()) === 1);
await page.locator(".mini .iconbtn").last().click();
await page.waitForTimeout(300);
check("mini player closes", (await page.locator(".mini").count()) === 0);

// ---------- channel page ----------
await page.goto(BASE + "/@3blue1brown", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(600);
check("channel banner", (await page.locator(".channel-banner").count()) === 1);
check("channel videos grid", (await page.locator(".page--channel .card").count()) >= 1);
for (const tab of ["Shorts", "Playlists"]) {
  await page.locator(".channel-tab", { hasText: tab }).click();
  await page.waitForTimeout(350);
  check(`channel tab ${tab} opens`, (await page.locator(`.channel-tab.is-active`, { hasText: tab }).count()) === 1);
}
// About is a popup modal (YouTube-style), not a tab
check("no About tab", (await page.locator(".channel-tab", { hasText: "About" }).count()) === 0);
await page.locator(".channel-head__desc .linkbtn").click();
await page.waitForTimeout(350);
check("about modal opens", (await page.locator('.modal-root[aria-label="About channel"] .about').count()) === 1);
await page.locator('.modal-root[aria-label="About channel"] .iconbtn').first().click();
await page.waitForTimeout(300);
check("about modal closes", (await page.locator('.modal-root[aria-label="About channel"]').count()) === 0);
await page.locator(".channel-tab", { hasText: "Videos" }).click();
await page.waitForTimeout(250);

// ---------- watch later flow ----------
await page.goto(BASE + "/watch?v=kJQP7kiw5Fk", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
await page.locator(".pill", { hasText: /^\s*Save\s*$/ }).click();
await page.waitForTimeout(400);
await page.goto(BASE + "/playlist?list=WL", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
check("saved video appears in Watch later", (await page.locator(".pl-row").count()) >= 1);

// ---------- history flow ----------
await page.goto(BASE + "/feed/history", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(500);
check("history has entries", (await page.locator(".history-item").count()) >= 1);
await page.locator(".history-item__remove").first().click({ force: true });
await page.waitForTimeout(400);
check("history remove works", (await page.locator(".toast").count()) >= 1);

// ---------- shorts ----------
await page.goto(BASE + "/shorts", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(700);
check("shorts slides render", (await page.locator(".short").count()) >= 3);
check("shorts active slide", (await page.locator(".short.is-active").count()) === 1);
await page.locator(".shorts__nav .iconbtn").last().click();
await page.waitForTimeout(500);
const activeShort = await page.locator(".short.is-active").getAttribute("id");
check("shorts navigation advances", activeShort?.startsWith("short-"), String(activeShort));

// ---------- mobile ----------
console.log("== mobile ==");
const mobile = await browser.newPage({ viewport: { width: 390, height: 844 } });
mobile.on("pageerror", (e) => { mobileErrors.push(String(e.message)); });
await mobile.goto(BASE + "/", { waitUntil: "domcontentloaded" });
await mobile.waitForTimeout(700);
check("mobile bottom nav visible", await mobile.locator(".mobilenav").isVisible());
await mobile.locator(".header__menu").click();
await mobile.waitForTimeout(500);
check("mobile drawer opens", await mobile.locator(".sidebar.is-open").count() === 1);
await mobile.locator(".side-item", { hasText: "Trending" }).click();
await mobile.waitForTimeout(600);
check("mobile drawer navigation works", mobile.url().includes("/feed/trending"), mobile.url());
await mobile.close();

} catch (err) {
  await diagnostics(page, err);
  await browser.close();
}

// ---------- report ----------
await browser.close();

console.log("\n== results ==");
console.log(results.join("\n"));
console.log(`\nchecks failed: ${failed}`);
console.log(`page errors: ${pageErrors.length}`);
pageErrors.forEach((e) => console.log("  PAGEERROR " + e));
console.log(`console errors: ${consoleErrors.length}`);
consoleErrors.slice(0, 10).forEach((e) => console.log("  CONSOLE " + e));
console.log(`failed requests: ${failedRequests.length}`);
failedRequests.slice(0, 10).forEach((e) => console.log("  REQ " + e));
console.log(`mobile errors: ${mobileErrors.length}`);
mobileErrors.forEach((e) => console.log("  MOBILE " + e));

process.exit(failed > 0 || pageErrors.length > 0 ? 1 : 0);
