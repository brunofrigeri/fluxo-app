import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { newAccount, signUp, open } from "./helpers";

test("the owner is the studio admin and can rename themselves; the new name shows everywhere", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount("Marina Souza"));
  await open(page, "/usuarios");
  await expect(screen.getByText(/Marina Souza \(você\)/)).toBeVisible();
  await expect(screen.getByText("Administrador")).toBeVisible();

  await screen.getByRole("button", "Editar").click();
  await screen.getByLabel("Nome").fill("Marina Souza Prado");
  await screen.getByRole("button", "Salvar").click();

  await expect(browser.locator("button.me")).toContainText("Marina Souza Prado");
});

test("an invite needs a valid email", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());
  await open(page, "/usuarios");
  await screen.getByRole("button", "Convidar usuário").click();
  await screen.getByLabel("Nome").fill("Pedro Instrutor");
  await screen.getByLabel("E-mail").fill("isto-nao-e-email");
  await screen.getByRole("button", "Enviar convite").click();
  // The browser blocks the submit: still on the dialog, nothing listed.
  await expect(screen.getByRole("button", "Enviar convite")).toBeVisible();
});
