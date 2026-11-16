import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { newAccount, signUp, open } from "./helpers";

const NAV_LABELS = "nav[aria-label='Principal'] .lab-short";

async function noSideScroll(browser: { evaluate: (fn: () => boolean) => Promise<boolean> }) {
  return browser.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
}

for (const device of [
  { name: "phone", width: 390, height: 780 },
  { name: "small phone", width: 320, height: 640 },
  { name: "tablet", width: 820, height: 1180 },
]) {
  test(`the navigation is a bottom bar with every item readable on a ${device.name}`, async (page) => {
    const { screen, browser } = page;
    await browser.setViewport({ width: device.width, height: device.height });
    await signUp(page, newAccount());
    await open(page, "/usuarios");

    await expect(browser.locator(NAV_LABELS)).toHaveText(["Home", "Agenda", "Clientes", "Espera", "Usuários", "Ajustes"]);

    const bar = (await browser.locator("aside.side").boundingBox())!;
    expect(Math.round(bar.y + bar.height)).toBe(device.height);
    expect(Math.round(bar.width)).toBe(device.width);

    // The avatar is inside the bar, not pushed off the screen.
    const me = (await browser.locator("button.me").boundingBox())!;
    expect(me.x + me.width).toBeLessThanOrEqual(device.width);

    expect(await noSideScroll(browser)).toBe(true);
  });
}

test("Clientes and Usuários have different icons in the navigation", async (page) => {
  const { browser } = page;
  await signUp(page, newAccount());
  await open(page, "/usuarios");
  const clientes = await browser.locator("nav[aria-label='Principal'] a[href='/clientes'] .ic").getAttribute("class");
  const usuarios = await browser.locator("nav[aria-label='Principal'] a[href='/usuarios'] .ic").getAttribute("class");
  expect(clientes).not.toBe(usuarios);
});

test("the users list does not break on a phone", async (page) => {
  const { screen, browser } = page;
  await browser.setViewport({ width: 390, height: 780 });
  await signUp(page, newAccount("Marina Souza"));
  await open(page, "/usuarios");
  await expect(screen.getByText("Administrador")).toBeVisible();
  await expect(screen.getByRole("button", "Convidar usuário")).toBeVisible();
  expect(await noSideScroll(browser)).toBe(true);
});
