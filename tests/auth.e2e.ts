import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { newAccount, signIn, signUp, open } from "./helpers";

test("signing up creates a studio and shows the person's own name, not the email", async (page) => {
  const { screen, browser } = page;
  const account = newAccount("Marina Souza");
  await signUp(page, account);

  await expect(browser).toHaveURL(/\/$/);
  await expect(browser.locator("button.me")).toContainText("Marina Souza");
  await expect(screen.getByText(account.email.split("@")[0])).toBeHidden();
});

test("a wrong password is refused and a right one gets in", async (page) => {
  const { screen, browser } = page;
  const account = newAccount();
  await signUp(page, account);
  await browser.locator("button.me").click();
  await screen.getByRole("menuitem", "Sair").click();
  await expect(screen.getByRole("heading", "Entrar")).toBeVisible();

  await signIn(page, { email: account.email, password: "senha-errada-999" });
  await expect(browser.locator(".errmsg")).toContainText("E-mail ou senha incorretos");

  await signIn(page, account);
  await expect(screen.getByRole("link", "Agenda")).toBeVisible();
  await expect(browser).toHaveURL(/\/$/);
});

test("signed-out visitors cannot open any app page", async (page) => {
  const { screen } = page;
  for (const path of ["/", "/agenda", "/clientes", "/espera", "/usuarios", "/configuracoes"]) {
    await open(page, path);
    await expect(screen.getByRole("heading", "Entrar")).toBeVisible();
  }
});
