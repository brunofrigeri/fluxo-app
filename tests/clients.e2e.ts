import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { createClient, newAccount, newDocument, signUp, open } from "./helpers";

test("a new client shows up in the list and can be found by name", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());
  await createClient(page, "Ana Beatriz Lima");

  await open(page, "/clientes");
  await expect(screen.getByText("Ana Beatriz Lima")).toBeVisible();

  await screen.getByLabel("Buscar por nome ou documento").fill("beatriz");
  await screen.getByLabel("Buscar por nome ou documento").press("Enter");
  await expect(screen.getByText("Ana Beatriz Lima")).toBeVisible();

  await screen.getByLabel("Buscar por nome ou documento").fill("zzz-ninguem");
  await screen.getByLabel("Buscar por nome ou documento").press("Enter");
  await expect(screen.getByText("Ana Beatriz Lima")).toBeHidden();
});

test("a client needs a name and a document", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await open(page, "/clientes/novo");
  await screen.getByRole("button", "Salvar").click();
  // Still on the form: nothing was created.
  await expect(browser).toHaveURL(/\/clientes\/novo/);

  await screen.getByLabel("Documento").fill(newDocument());
  await screen.getByPlaceholder("Nome completo").fill("A");
  await screen.getByRole("button", "Salvar").click();
  await expect(browser.locator(".errmsg")).toContainText("Informe o nome");
});

test("two clients cannot share a document", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  const document = newDocument();

  for (const name of ["Primeira Cliente", "Segunda Cliente"]) {
    await open(page, "/clientes/novo");
    await screen.getByLabel("Documento").fill(document);
    await screen.getByPlaceholder("Nome completo").fill(name);
    await screen.getByRole("button", "Salvar").click();
  }
  await expect(browser.locator(".errmsg")).toBeVisible();
});
