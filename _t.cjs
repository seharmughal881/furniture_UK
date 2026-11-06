const { chromium } = require("playwright");
(async () => {
  const b = await chromium.launch({ channel: "chrome" });
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } });
  let navs = 0;
  p.on("framenavigated", (f) => { if (f === p.mainFrame()) navs++; });
  await p.goto("http://localhost:3031/planner", { waitUntil: "domcontentloaded", timeout: 180000 }).catch(() => {});
  await p.waitForTimeout(10000);
  const has = await p.evaluate(() => ({ modes: document.querySelectorAll('[aria-label="Furniture display"] button').length,
    canvas: !!document.querySelector("canvas"), bodyText: document.body.innerText.slice(0, 60).replace(/\n/g, " | ") })).catch((e) => ({ err: e.message.slice(0,50) }));
  console.log("AI_MODELS=false  navigations:", navs, " ", JSON.stringify(has));
  await b.close();
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
