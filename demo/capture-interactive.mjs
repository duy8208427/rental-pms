/**
 * Interactive demo recording via Playwright recordVideo (1280x720).
 * Shows real clicks / typing / navigation — not a static slideshow.
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync, readdirSync, renameSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const RAW = join(__dirname, "raw");
const BASE = "http://127.0.0.1:5173";

async function pause(page, ms = 1600) {
  await page.waitForTimeout(ms);
}

async function installCursor(page) {
  await page.addInitScript(() => {
    const style = document.createElement("style");
    style.textContent = `
      #demo-cursor {
        position: fixed;
        width: 18px;
        height: 18px;
        margin-left: -9px;
        margin-top: -9px;
        border: 2px solid #0d7377;
        background: rgba(13, 115, 119, 0.35);
        border-radius: 50%;
        pointer-events: none;
        z-index: 2147483647;
        left: 0;
        top: 0;
        transition: transform 0.05s linear, width 0.12s, height 0.12s, background 0.12s;
      }
      #demo-cursor.clicking {
        width: 28px;
        height: 28px;
        margin-left: -14px;
        margin-top: -14px;
        background: rgba(13, 115, 119, 0.55);
      }
    `;
    document.documentElement.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    document.documentElement.appendChild(cursor);
    window.__moveDemoCursor = (x, y, clicking) => {
      const el = document.getElementById("demo-cursor");
      if (!el) return;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.classList.toggle("clicking", !!clicking);
    };
  });
}

async function ensureCursor(page) {
  await page.evaluate(() => {
    if (document.getElementById("demo-cursor")) return;
    const style = document.createElement("style");
    style.textContent = `
      #demo-cursor {
        position: fixed; width: 18px; height: 18px;
        margin-left: -9px; margin-top: -9px;
        border: 2px solid #0d7377; background: rgba(13, 115, 119, 0.35);
        border-radius: 50%; pointer-events: none; z-index: 2147483647;
        left: 0; top: 0;
        transition: transform 0.05s linear, width 0.12s, height 0.12s, background 0.12s;
      }
      #demo-cursor.clicking {
        width: 28px; height: 28px; margin-left: -14px; margin-top: -14px;
        background: rgba(13, 115, 119, 0.55);
      }
    `;
    document.documentElement.appendChild(style);
    const cursor = document.createElement("div");
    cursor.id = "demo-cursor";
    document.documentElement.appendChild(cursor);
    window.__moveDemoCursor = (x, y, clicking) => {
      const el = document.getElementById("demo-cursor");
      if (!el) return;
      el.style.left = `${x}px`;
      el.style.top = `${y}px`;
      el.classList.toggle("clicking", !!clicking);
    };
  });
}

async function moveTo(page, locator) {
  await ensureCursor(page);
  const box = await locator.boundingBox();
  if (!box) throw new Error("No bounding box for locator");
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y, { steps: 18 });
  await page.evaluate(
    ([cx, cy]) => window.__moveDemoCursor?.(cx, cy, false),
    [x, y],
  );
  await pause(page, 250);
  return { x, y };
}

async function clickLoc(page, locator) {
  const { x, y } = await moveTo(page, locator);
  await page.evaluate(
    ([cx, cy]) => window.__moveDemoCursor?.(cx, cy, true),
    [x, y],
  );
  await page.mouse.down();
  await pause(page, 120);
  await page.mouse.up();
  await page.evaluate(
    ([cx, cy]) => window.__moveDemoCursor?.(cx, cy, false),
    [x, y],
  );
  await pause(page, 400);
}

async function typeSlow(page, locator, text) {
  await clickLoc(page, locator);
  await locator.fill("");
  await locator.pressSequentially(text, { delay: 45 });
  await pause(page, 400);
}

async function selectPropertyIfNeeded(page) {
  const propBtn = page
    .getByRole("button")
    .filter({ hasText: /Chọn|Khách sạn|Riverside|hotel/i })
    .first();
  if (!(await propBtn.count())) return;
  const label = await propBtn.innerText();
  if (!/Chọn|—/.test(label) && /Riverside|hotel/i.test(label)) return;
  await clickLoc(page, propBtn);
  await pause(page, 300);
  const opt = page.locator("text=Khách sạn Mini Riverside").first();
  if (await opt.count()) await clickLoc(page, opt);
  await pause(page, 800);
}

async function main() {
  rmSync(RAW, { recursive: true, force: true });
  mkdirSync(RAW, { recursive: true });

  const browser = await chromium.launch({
    headless: true,
    slowMo: 350,
  });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
    recordVideo: {
      dir: RAW,
      size: { width: 1280, height: 720 },
    },
  });
  const page = await context.newPage();
  await installCursor(page);

  // Home
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await ensureCursor(page);
  await pause(page, 2400);

  // Click Lịch phòng
  await clickLoc(page, page.getByRole("link", { name: "Lịch phòng", exact: true }));
  await page.waitForURL("**/lich**");
  await ensureCursor(page);
  await pause(page, 1600);
  await selectPropertyIfNeeded(page);
  await pause(page, 2200);

  // Quản trị → login
  await clickLoc(page, page.getByRole("link", { name: "Quản trị" }));
  await page.waitForURL("**/admin/login**");
  await ensureCursor(page);
  await pause(page, 1400);

  await typeSlow(page, page.getByLabel("Email"), "admin@example.com");
  await typeSlow(page, page.getByLabel("Mật khẩu"), "admin123");
  await clickLoc(page, page.getByRole("button", { name: "Đăng nhập" }));
  await page.waitForURL("**/admin**", { timeout: 15000 });
  await ensureCursor(page);
  await pause(page, 2400);

  // Sơ đồ phòng
  await clickLoc(page, page.getByRole("link", { name: "Sơ đồ phòng", exact: true }));
  await page.waitForURL("**/admin/rooms**");
  await ensureCursor(page);
  await pause(page, 1200);
  await selectPropertyIfNeeded(page);
  await pause(page, 2200);

  // Lịch cho thuê
  await clickLoc(page, page.getByRole("link", { name: "Lịch cho thuê", exact: true }));
  await page.waitForURL("**/admin/calendar**");
  await ensureCursor(page);
  await pause(page, 2400);

  // Tài chính
  await clickLoc(page, page.getByRole("link", { name: "Tài chính", exact: true }));
  await page.waitForURL("**/admin/finance**");
  await ensureCursor(page);
  await pause(page, 2000);
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) =>
      x.textContent?.includes("Chi phí"),
    );
    if (h) h.scrollIntoView({ block: "start", behavior: "smooth" });
  });
  await pause(page, 1400);
  const addExp = page.getByRole("button", { name: "+ Thêm chi phí" });
  if (await addExp.count()) {
    await moveTo(page, addExp);
    await pause(page, 1400);
  }

  // Tài sản
  await clickLoc(page, page.getByRole("link", { name: "Tài sản", exact: true }));
  await page.waitForURL("**/admin/assets**");
  await ensureCursor(page);
  await pause(page, 2600);

  const video = page.video();
  await context.close();
  await browser.close();

  if (video) {
    const src = await video.path();
    const dest = join(RAW, "interactive.webm");
    try {
      renameSync(src, dest);
    } catch {
      // already named
      console.log("video at", src);
    }
    console.log("saved", dest);
  }

  const files = readdirSync(RAW).filter((f) => f.endsWith(".webm"));
  console.log("webm files:", files.join(", "));
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
