import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { newAccount, signUp, open } from "./helpers";

test("someone can be added to the wait list and filtered by period", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());
  await open(page, "/espera");
  await expect(screen.getByText("Ninguém na lista de espera")).toBeVisible();

  await screen.getByLabel("Nome").fill("Carla Mendes");
  await screen.getByLabel("Telefone").fill("(11) 91234-5678");
  await screen.getByLabel("Período do dia").selectOption("Manhã");
  await screen.getByRole("button", "Adicionar").click();

  await expect(screen.getByText("Carla Mendes")).toBeVisible();
  await expect(screen.getByText("Manhã (1)")).toBeVisible();

  await screen.getByRole("link", "Noite (0)").click();
  await expect(screen.getByText("Ninguém na lista para este período")).toBeVisible();
});

test("the wait list rejects an incomplete entry", async (page) => {
  const { screen, browser } = page;
  await signUp(page, newAccount());
  await open(page, "/espera");
  await screen.getByLabel("Nome").fill("Só Nome");
  await screen.getByLabel("Telefone").fill("123");
  await screen.getByLabel("Período do dia").selectOption("Noite");
  await screen.getByRole("button", "Adicionar").click();
  await expect(browser.locator(".errmsg")).toContainText("telefone válido");
  await expect(screen.getByText("Só Nome")).toBeHidden();
});
