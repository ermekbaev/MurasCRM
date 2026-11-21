// Сквозная проверка muras-crm (22.11): вход, все разделы на телефоне и компьютере, без ошибок страницы,
// без ответов сервера 5xx и без обрезания вёрстки за краем экрана (overflow-x скрывает обрезание, поэтому
// считаем по getBoundingClientRect, а не по scrollWidth).
// Запуск:  BASE=https://crm.muras-brand.kg EMAIL=demo@muras.ru PASS=demo node e2e/smoke-e2e.cjs
//          (по умолчанию демо; снимки в e2e/out)
const puppeteer = require("C:/Users/adile/Desktop/iq-smeta/node_modules/puppeteer");
const fs = require("fs");
const path = require("path");

const BASE = process.env.BASE || "https://crm.muras-brand.kg";
const EMAIL = process.env.EMAIL || "demo@muras.ru";
const PASS = process.env.PASS || "demo";
const OUT = path.join(__dirname, "out");
fs.mkdirSync(OUT, { recursive: true });
let bad = 0;
const ok = (c, m) => { console.log((c ? "  ✓ " : "  ✗ ") + m); if (!c) bad++; };

const PAGES = [
  "/dashboard", "/orders", "/clients", "/tasks", "/money", "/invoices", "/waybills", "/acts", "/defects", "/consumables",
  "/files", "/chats", "/analytics", "/help", "/changelog", "/trash",
  "/settings", "/settings/company", "/settings/equipment", "/settings/templates", "/settings/users", "/settings/backups",
  "/settings/client-sources", "/settings/expense-categories", "/settings/order-types", "/settings/suppliers",
];

// элементы, вышедшие за край окна (кроме лежащих в прокручиваемых полосах и закреплённых)
const clipped = (W) => {
  const out = [];
  const scrollable = (el) => {
    for (let e = el.parentElement; e && e !== document.body; e = e.parentElement) {
      const o = getComputedStyle(e).overflowX;
      if (o === "auto" || o === "scroll" || o === "hidden") return true;
    }
    return false;
  };
  for (const el of document.querySelectorAll("body *")) {
    const cs = getComputedStyle(el);
    if (cs.position === "fixed" || cs.display === "none" || cs.visibility === "hidden") continue;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (r.right > W + 1 || r.left < -1) {
      if (scrollable(el)) continue;
      const own = [...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim());
      if (!own && !["BUTTON", "A", "INPUT", "IMG"].includes(el.tagName)) continue;
      out.push(`${el.tagName.toLowerCase()} «${(el.textContent || "").trim().slice(0, 28)}» right=${Math.round(r.right)}`);
    }
  }
  return [...new Set(out)].slice(0, 6);
};

(async () => {
  const b = await puppeteer.launch();

  console.log("— страница входа");
  {
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport({ width: 1440, height: 900 });
    await p.goto(BASE + "/login", { waitUntil: "networkidle2", timeout: 120000 });
    const t = await p.evaluate(() => document.body.innerText);
    ok(/От заявки/.test(t) && !!(await p.$("svg[aria-hidden=true]")), "на компьютере: заголовок и иллюстрация");
    await p.screenshot({ path: `${OUT}/login-1440.png` });
    await p.setViewport({ width: 390, height: 844, isMobile: true });
    await p.reload({ waitUntil: "networkidle2" });
    ok(!(await p.evaluate(() => [...document.querySelectorAll("h2")].some((h) => h.offsetParent !== null && /От заявки/.test(h.textContent)))), "на телефоне иллюстрации нет, форма на месте");
    ok((await p.evaluate(clipped, 390)).length === 0, "на телефоне форма не обрезана");
    await p.screenshot({ path: `${OUT}/login-390.png` });
    await p.type("input[type=email]", EMAIL);
    await p.type("input[type=password]", PASS + "x");
    await p.click("button[type=submit]");
    await p.waitForFunction(() => /Неверный email или пароль/.test(document.body.innerText), { timeout: 30000 }).catch(() => {});
    ok(/Неверный email или пароль/.test(await p.evaluate(() => document.body.innerText)), "неверный пароль: «Неверный email или пароль»");
    await ctx.close();
  }

  for (const [label, vp] of [["компьютер", { width: 1440, height: 900 }], ["телефон", { width: 390, height: 844, isMobile: true, hasTouch: true }]]) {
    console.log(`— разделы, ${label}`);
    const ctx = await b.createBrowserContext();
    const p = await ctx.newPage();
    await p.setViewport(vp);
    p.setDefaultNavigationTimeout(120000);
    const errors = [];
    const fives = [];
    p.on("pageerror", (e) => errors.push(String(e.message).slice(0, 120)));
    p.on("response", (r) => { if (r.status() >= 500) fives.push(`${r.status()} ${r.url().replace(BASE, "")}`); });
    await p.goto(BASE + "/login", { waitUntil: "networkidle2" });
    await p.type("input[type=email]", EMAIL);
    await p.type("input[type=password]", PASS);
    await Promise.all([p.waitForNavigation({ waitUntil: "networkidle2" }), p.click("button[type=submit]")]);
    ok(new URL(p.url()).pathname === "/dashboard", "вошли, открылся /dashboard");
    for (const path_ of PAGES) {
      errors.length = 0; fives.length = 0;
      await p.goto(BASE + path_, { waitUntil: "networkidle2" }).catch(() => {});
      await new Promise((r) => setTimeout(r, 700));
      const body = await p.evaluate(() => document.body.innerText);
      const redirected = new URL(p.url()).pathname !== path_ && !/^\/(login)?$/.test(new URL(p.url()).pathname) ? new URL(p.url()).pathname : "";
      const broken = /Application error|Something went wrong|This page couldn.t load|Internal Server Error|Ошибка сервера/i.test(body);
      const clip = await p.evaluate(clipped, vp.width);
      const good = !broken && !errors.length && !fives.length && !clip.length && new URL(p.url()).pathname !== "/login";
      ok(good, `${path_}${redirected ? " → " + redirected : ""}${broken ? " [ошибка на странице]" : ""}${errors.length ? " [js: " + errors[0] + "]" : ""}${fives.length ? " [" + fives[0] + "]" : ""}${clip.length ? " [обрезано: " + clip.join("; ") + "]" : ""}`);
      if (path_ === "/dashboard" || !good) await p.screenshot({ path: `${OUT}/${label === "телефон" ? "m" : "d"}${path_.replace(/\W+/g, "_")}.png` });
    }
    await ctx.close();
  }

  await b.close();
  console.log(bad ? `ОШИБОК: ${bad}` : "ВСЁ ЗЕЛЁНОЕ");
  process.exit(bad ? 1 : 0);
})();
