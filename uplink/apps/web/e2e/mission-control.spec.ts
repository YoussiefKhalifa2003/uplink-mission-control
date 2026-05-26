import { test, expect } from "@playwright/test";

test("loads mission control with UPLINK branding", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("UPLINK")).toBeVisible();
  await expect(page.getByText(/LIVE|OFFLINE/)).toBeVisible();
});

test("shows observer panel with Dubai default", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("Observer")).toBeVisible();
  await expect(page.getByText("Dubai").first()).toBeVisible();
});

test("pass deep link page loads", async ({ page }) => {
  await page.goto("/pass/dubai/25544");
  await expect(page.getByText(/Passes over Dubai/i)).toBeVisible();
});

test("weather page loads global and local panels", async ({ page }) => {
  await page.goto("/weather");
  await expect(page.getByText("Space Weather Operations")).toBeVisible();
  await expect(page.getByText("Planetary K-index (global)")).toBeVisible();
  await expect(page.getByText(/Impact at Dubai/i)).toBeVisible();
});

test("switching city changes local impact but preserves global Kp label", async ({ page }) => {
  await page.goto("/weather?city=dubai");
  await expect(page.getByText(/Impact at Dubai/i)).toBeVisible();

  const kpBefore = await page.getByText("Planetary K-index (global)").locator("..").locator("..").textContent();

  await page.getByPlaceholder("Change observer city…").fill("Tokyo");
  await page.getByRole("button", { name: /Tokyo/i }).click();

  await expect(page.getByText(/Impact at Tokyo/i)).toBeVisible({ timeout: 10000 });

  const kpAfter = await page.getByText("Planetary K-index (global)").locator("..").locator("..").textContent();
  expect(kpAfter).toContain("Planetary K-index (global)");
  expect(kpBefore).toContain("Planetary K-index (global)");
});

test("share URL preserves city on weather page", async ({ page }) => {
  await page.goto("/weather?city=tokyo");
  await expect(page.getByText(/Impact at Tokyo/i)).toBeVisible({ timeout: 10000 });
});
