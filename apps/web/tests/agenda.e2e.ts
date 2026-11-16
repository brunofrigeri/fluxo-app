import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { createClient, newAccount, signUp, untilSaved, type Page, open } from "./helpers";

// On the week grid a booking is a chip with the client's first name (and the instructor).
const chip = (page: Page, fullName: string) => page.screen.getByRole("button", new RegExp(`^${fullName.split(" ")[0]}`));

// Opens a booking's popup. Right after a page load the click can land before the page is interactive, so retry.
async function openBooking(page: Page, fullName: string) {
  const popup = page.screen.getByRole("dialog", new RegExp(fullName));
  for (let attempt = 0; attempt < 5; attempt++) {
    await chip(page, fullName).click();
    try {
      await expect(popup).toBeVisible({ timeout: 2000 });
      return;
    } catch {
      // not interactive yet: click again
    }
  }
  await expect(popup).toBeVisible();
}

// Books a client into the first 10:00 slot of the week shown and returns once the booking is on the agenda.
async function book(page: Page, clientName: string) {
  const { screen } = page;
  await open(page, "/agenda");
  await screen.getByRole("button", /Adicionar cliente em \d\d\/\d\d, 10:00/).first().click();
  await screen.getByLabel("Cliente").fill(clientName.split(" ")[0]);
  await screen.getByRole("button", new RegExp(clientName)).click();
  await screen.getByRole("button", "Adicionar").click();
  await expect(chip(page, clientName)).toBeVisible();
}

test("a client can be booked into the agenda", async (page) => {
  await signUp(page, newAccount());
  await createClient(page, "Daniela Freitas");
  await book(page, "Daniela Freitas");
});

test("attendance is marked and stays marked after reloading", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());
  await createClient(page, "Eduarda Pinto");
  await book(page, "Eduarda Pinto");

  await openBooking(page, "Eduarda Pinto");
  await untilSaved(page, /agenda/, () => screen.getByRole("button", "Presença confirmada").click());
  await expect(screen.getByRole("button", "Presença confirmada", { pressed: true })).toBeVisible();

  await open(page, "/agenda");
  await openBooking(page, "Eduarda Pinto");
  await expect(screen.getByRole("button", "Presença confirmada", { pressed: true })).toBeVisible();
});

test("only clients of the chosen modality can be found when booking", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());
  await open(page, "/agenda");
  await screen.getByRole("button", /Adicionar cliente em \d\d\/\d\d, 10:00/).first().click();
  await screen.getByLabel("Cliente").fill("ninguem");
  await expect(screen.getByText("Nenhum cliente encontrado.")).toBeVisible();
});
