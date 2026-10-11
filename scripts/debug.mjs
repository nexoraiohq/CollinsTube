import { chromium } from "playwright-core";
const browser = await chromium.launch({ executablePath: "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("pageerror", (e) => console.log("PAGEERROR:", e.message));
await page.goto("http://localhost:4173/watch?v=fJ9rUzIMcZQ", { waitUntil: "domcontentloaded" });
await page.waitForTimeout(900);
const pill = page.locator(".pill", { hasText: /^Save$/ });
console.log("count:", await pill.count());
console.log("texts:", JSON.stringify(await page.locator(".pill").allInnerTexts()));
try {
  await pill.click({ timeout: 8000 });
  console.log("CLICK OK");
} catch (e) {
  console.log("CLICK FAILED:", e.message.split("\n").slice(0,12).join(" / "));
  const box = await pill.boundingBox();
  console.log("box:", JSON.stringify(box));
  const top = await page.evaluate(() => {
    const el = [...document.querySelectorAll(".pill")].find(b => b.textContent.trim() === "Save");
    if (!el) return "no el";
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.x + r.width/2, r.y + r.height/2);
    return { rect: {x:r.x,y:r.y,w:r.width,h:r.height}, hit: hit ? hit.className + " <" + hit.tagName + ">" : null, anim: el.getAnimations().map(a=>a.animationName+":"+a.playState).join(",") };
  });
  console.log("probe:", JSON.stringify(top));
}
await browser.close();
