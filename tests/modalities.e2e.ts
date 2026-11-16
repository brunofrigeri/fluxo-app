import { test } from "@e2e-dev/web";
import { expect } from "e2e";
import { newAccount, signUp, untilSaved, open } from "./helpers";

// A modality is only shown anywhere in the app while the studio has it switched on.

test("a modality the studio has not switched on is nowhere in the app, and appears once it is", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());

  // New studios start with Pilates only.
  await open(page, "/clientes/novo");
  await expect(screen.getByRole("checkbox", "Pilates")).toBeVisible();
  await expect(screen.getByRole("checkbox", "Acupuntura")).toBeHidden();

  await open(page, "/configuracoes");
  await untilSaved(page, /configuracoes/, () => screen.getByRole("switch", "Acupuntura").click());
  await expect(screen.getByRole("switch", "Acupuntura")).toBeChecked();

  await open(page, "/clientes/novo");
  await expect(screen.getByRole("checkbox", "Acupuntura")).toBeVisible();
  await open(page, "/usuarios");
  await screen.getByRole("button", "Convidar usuário").click();
  await expect(screen.getByRole("checkbox", "Acupuntura")).toBeVisible();
});

test("switching a modality off hides it again", async (page) => {
  const { screen } = page;
  await signUp(page, newAccount());
  await open(page, "/configuracoes");
  await untilSaved(page, /configuracoes/, () => screen.getByRole("switch", "Acupuntura").click());
  await expect(screen.getByRole("switch", "Acupuntura")).toBeChecked();
  await untilSaved(page, /configuracoes/, () => screen.getByRole("switch", "Acupuntura").click());
  await expect(screen.getByRole("switch", "Acupuntura")).toBeChecked({ checked: false });

  await open(page, "/clientes/novo");
  await expect(screen.getByRole("checkbox", "Pilates")).toBeVisible();
  await expect(screen.getByRole("checkbox", "Acupuntura")).toBeHidden();
});
