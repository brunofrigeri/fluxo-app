import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { createClient, newAccount, open, signUp, todayDay, untilSaved } from "./helpers";

// A client whose payment day is today has a due date today: it is listed, not late, and the studio records it by hand.

test("the studio records a payment as paid and it stays recorded", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await createClient(page, "Carla Pagadora", todayDay());

  await open(page, "/pagamentos");
  await expect(screen.getByText("Carla Pagadora")).toBeVisible();
  await expect(browser.locator(".pay-row .st-no")).toBeVisible();

  await untilSaved(page, /pagamentos/, async () => {
    await browser.locator(".pay-actions .seg button:first-child").click();
  });
  await expect(browser.locator(".pay-row .st-ok")).toBeVisible();

  await open(page, "/pagamentos");
  await expect(browser.locator(".pay-row .st-ok")).toBeVisible();
});

test("the client's payments tab lists the due date and a receipt can only be attached once it is recorded", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await createClient(page, "Dora Comprovante", todayDay());

  await browser.locator("a[href*='aba=pagamentos']").click();
  await expect(screen.getByText("Registre o pagamento para anexar um comprovante.")).toBeVisible();
  await untilSaved(page, /clientes/, async () => {
    await browser.locator(".pay-actions .seg button:first-child").click();
  });
  await expect(browser.locator("summary")).toContainText("Anexar comprovante");
});

test("the Pagamentos chip on the agenda shows who pays today", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await createClient(page, "Eva Agenda", todayDay());

  await open(page, "/agenda?vista=dia");
  await expect(browser.locator(".cchip[title^='Eva Agenda']")).toBeHidden();
  await screen.getByRole("button", /^Pagamentos/).click();
  await expect(browser.locator(".cchip[title^='Eva Agenda']")).toBeVisible();
});
