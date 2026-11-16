import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { createClient, newAccount, signUp, open } from "./helpers";

test("an evolution keeps the spaces typed in it and is saved on the client", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await createClient(page, "Beatriz Alves");
  const clientUrl = new URL(await browser.url());
  const clientId = clientUrl.pathname.split("/")[2];

  await open(page, `/clientes/${clientId}/evolucoes/nova`);
  const note = screen.getByLabel(/Detalhes/);
  await note.click();
  await note.pressSequentially("Footwork com 3 molas, 3 séries de 12");
  // Regression: the space key used to be swallowed while typing.
  await expect(note).toHaveValue("Footwork com 3 molas, 3 séries de 12");

  await screen.getByText("MMII").click();
  await screen.getByRole("button", "Salvar evolução").click();

  await expect(screen.getByText("Footwork com 3 molas, 3 séries de 12")).toBeVisible();
});

test("an empty evolution is not saved", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await createClient(page, "Camila Ramos");
  const clientId = new URL(await browser.url()).pathname.split("/")[2];

  await open(page, `/clientes/${clientId}/evolucoes/nova`);
  await expect(screen.getByText("Preencha ao menos um campo da evolução.")).toBeVisible();
  await screen.getByRole("button", "Salvar evolução").click();
  await expect(browser.locator(".errmsg")).toBeVisible();
});
