const { chromium } = require("C:/Users/Sunny kumar/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/.pnpm/playwright@1.60.0/node_modules/playwright");

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.goto("http://127.0.0.1:5173", { waitUntil: "networkidle" });
  await page.evaluate(() => localStorage.setItem("lexa-theme", "light"));
  await page.reload({ waitUntil: "networkidle" });
  const stackPill = await page.locator(".status-pill").count();
  if (stackPill !== 0) throw new Error("Header stack pill is still visible");
  await page.getByRole("button", { name: "Analyze Text" }).click();
  await page.waitForFunction(() => document.querySelectorAll(".dot.done").length === 8, null, { timeout: 20000 });
  await page.locator(".verdict-badge", { hasText: /^Guilty$/ }).waitFor({ timeout: 5000 });
  await page.getByText("Final judgement statement").waitFor({ timeout: 5000 });
  const prosecutorText = await page.locator(".agent-card").nth(2).locator(".agent-output").innerText();
  if (prosecutorText.includes("{'facts'") || prosecutorText.includes("Evidence:")) {
    throw new Error("Prosecutor output still contains raw evidence formatting");
  }
  await page.getByRole("button", { name: "Dark" }).click();
  const darkTheme = await page.evaluate(() => document.documentElement.dataset.theme);
  if (darkTheme !== "dark") throw new Error("Dark mode did not activate");
  const rawBlocks = await page.locator("pre").count();
  if (rawBlocks !== 0) throw new Error("Agent panel is still rendering raw JSON blocks");
  await page.screenshot({ path: "manual-check.png", fullPage: true });
  const result = {
    title: await page.locator("h1").innerText(),
    agentsDone: await page.locator(".dot.done").count(),
    verdict: await page.locator(".verdict-badge").innerText(),
    theme: darkTheme,
    rawBlocks,
  };
  console.log(JSON.stringify(result));
  await browser.close();
})();
