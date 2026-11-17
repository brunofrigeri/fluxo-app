import type { App, Screen } from "e2e";
import type { Browser } from "@e2e-dev/web";

/** The fixtures every test gets. */
export type Page = { app: App; screen: Screen; browser: Browser };

export type Account = { name: string; email: string; password: string };

let counter = 0;

/** A brand-new account. Every test signs up its own, which creates its own empty studio, so tests never share data. */
export function newAccount(name = "Marina Souza"): Account {
  const id = `${Date.now().toString(36)}${(counter++).toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  return { name, email: `e2e-${id}@example.com`, password: "senha-e2e-123" };
}

/** A document number that is different on every call (clients need a unique one). */
export function newDocument(): string {
  // Random, not a counter: tests run in separate workers that would each start counting from zero.
  return Array.from({ length: 11 }, () => Math.floor(Math.random() * 10)).join("");
}

/** Creates the account through /signup and waits until the app has loaded (the studio is provisioned on that first load). */
export async function signUp(page: Page, account: Account): Promise<void> {
  const { screen } = page;
  await open(page, "/signup");
  await screen.getByLabel("Nome").fill(account.name);
  await screen.getByLabel("E-mail").fill(account.email);
  await screen.getByLabel("Senha").fill(account.password);
  await screen.getByRole("button", "Criar conta").click();
  await screen.getByRole("link", "Agenda").waitFor();
}

/** Signs in through /login. */
export async function signIn(page: Page, account: Pick<Account, "email" | "password">): Promise<void> {
  const { screen } = page;
  await open(page, "/login");
  await screen.getByLabel("E-mail").fill(account.email);
  await screen.getByLabel("Senha").fill(account.password);
  await screen.getByRole("button", "Entrar").click();
}

/** The day of the month it is in the studio's time zone: a payment day that falls due today. */
export function todayDay(): number {
  return Number(new Intl.DateTimeFormat("en-CA", { timeZone: "America/Sao_Paulo" }).format(new Date()).slice(8));
}

/** Creates a Pilates client from /clientes/novo and returns once the client page is open. */
export async function createClient(page: Page, name: string, billingDay = 10): Promise<void> {
  const { screen } = page;
  await open(page, "/clientes/novo");
  await screen.getByLabel("Documento").fill(newDocument());
  await screen.getByPlaceholder("Nome completo").fill(name);
  await screen.getByLabel("Dia do pagamento").fill(String(billingDay));
  await screen.getByRole("button", "Salvar").click();
  await screen.getByRole("heading", name).waitFor();
}

/**
 * Runs `action` and waits until the server has answered the save it triggers.
 * Switches and status changes in the app are optimistic (the screen updates at once, the save runs in the
 * background), so a test that navigates right after clicking would cancel the save. A person would not.
 */
export async function untilSaved({ browser }: Pick<Page, "browser">, path: RegExp, action: () => Promise<void>): Promise<void> {
  const answered = browser.waitForResponse(path);
  await action();
  await answered;
}

/**
 * Opens a page and waits until React has taken it over. Pages are rendered on the server first; a click that
 * lands before hydration finishes does nothing, which only shows up as a flaky test on a busy CI machine.
 */
export async function open({ app, browser }: Page, path: string): Promise<void> {
  await app.open(path);
  for (let attempt = 0; attempt < 100; attempt++) {
    const hydrated = await browser.evaluate(() =>
      Array.from(document.querySelectorAll("button, a, input, select, textarea")).some((el) => Object.keys(el).some((k) => k.startsWith("__reactProps$"))),
    );
    if (hydrated) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}
