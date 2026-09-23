/**
 * Capture demo frames with a real Chromium window at 1280x720.
 * Avoids Cursor IDE browser CDP Emulation duplication artifact.
 */
import { chromium } from "playwright";
import { mkdirSync, rmSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FRAMES = join(__dirname, "frames");
const BASE = "http://127.0.0.1:5173";

async function shot(page, name) {
  const path = join(FRAMES, name);
  await page.waitForTimeout(800);
  await page.screenshot({ path, fullPage: false });
  console.log("saved", name);
}

async function main() {
  rmSync(FRAMES, { recursive: true, force: true });
  mkdirSync(FRAMES, { recursive: true });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1280, height: 720 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();

  // 01 — home
  await page.goto(`${BASE}/`, { waitUntil: "networkidle" });
  await shot(page, "01.png");

  // 02 — public calendar
  await page.goto(`${BASE}/lich`, { waitUntil: "networkidle" });
  const propBtn = page.getByRole("button").filter({ hasText: /Chọn|Khách sạn|Riverside/ }).first();
  if (await propBtn.count()) {
    const label = await propBtn.innerText();
    if (label.includes("Chọn") || label.includes("—")) {
      await propBtn.click();
      const hotel = page.getByRole("option").filter({ hasText: /Khách sạn|Riverside/ }).first();
      if (await hotel.count()) await hotel.click();
      else {
        // Custom Select may use buttons/divs
        const opt = page.locator("text=Khách sạn Mini Riverside").first();
        if (await opt.count()) await opt.click();
      }
    }
  }
  await shot(page, "02.png");

  // 03 — login
  await page.goto(`${BASE}/admin/login`, { waitUntil: "networkidle" });
  await page.getByLabel("Email").fill("admin@example.com");
  await page.getByLabel("Mật khẩu").fill("admin123");
  await shot(page, "03.png");

  // login submit
  await page.getByRole("button", { name: "Đăng nhập" }).click();
  await page.waitForURL("**/admin**", { timeout: 15000 });
  await page.waitForTimeout(1000);

  // 04 — dashboard
  await page.goto(`${BASE}/admin`, { waitUntil: "networkidle" });
  await shot(page, "04.png");

  // 05 — rooms
  await page.goto(`${BASE}/admin/rooms`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  // select property if needed
  const roomProp = page.locator("button").filter({ hasText: /Chọn|hotel|Khách sạn/ }).first();
  if (await roomProp.count()) {
    const t = await roomProp.innerText();
    if (t.includes("Chọn") || t.includes("—")) {
      await roomProp.click();
      const o = page.locator("text=Khách sạn Mini Riverside").first();
      if (await o.count()) await o.click();
      await page.waitForTimeout(500);
    }
  }
  await shot(page, "05.png");

  // 06 — calendar
  await page.goto(`${BASE}/admin/calendar`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "06.png");

  // 07 — finance invoices (top)
  await page.goto(`${BASE}/admin/finance`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1000);
  await page.evaluate(() => window.scrollTo(0, 0));
  await shot(page, "07.png");

  // 08 — finance expenses
  await page.evaluate(() => {
    const h = [...document.querySelectorAll("h2")].find((x) =>
      x.textContent?.includes("Chi phí"),
    );
    if (h) h.scrollIntoView({ block: "start" });
  });
  await page.waitForTimeout(400);
  await shot(page, "08.png");

  // 09 — assets
  await page.goto(`${BASE}/admin/assets`, { waitUntil: "networkidle" });
  await page.waitForTimeout(800);
  await shot(page, "09.png");

  await browser.close();
  console.log("done");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
