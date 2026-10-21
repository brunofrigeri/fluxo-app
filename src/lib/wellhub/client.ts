// Thin client for Wellhub's Booking and Integration Setup APIs. SERVER ONLY.
//
// The token is the one Wellhub issues to Fluxo as a system. It comes from WELLHUB_API_TOKEN and is
// never stored in the database, never sent to the browser, and never logged. Without it the
// integration is simply off (`wellhubClientFromEnv` returns null).

export type WellhubEnvironment = "sandbox" | "production";

const BOOKING_BASE: Record<WellhubEnvironment, string> = {
  production: "https://api.partners.gympass.com",
  sandbox: "https://apitesting.partners.gympass.com",
};
// The docs list a production URL only for the Integration Setup API.
const SETUP_BASE = "https://api.partners-integrations.gympass.com";

export class WellhubError extends Error {
  constructor(readonly status: number, readonly path: string, readonly body: string) {
    super(`Wellhub ${status} on ${path}`);
  }
}

export type BookingStatus = "RESERVED" | "REJECTED" | "CANCELLED_BY_GYM";

export type WebhookSubscription = { event: string; url: string; secret: string };

type Deps = { token: string; environment?: WellhubEnvironment; fetch?: typeof fetch };

export class WellhubClient {
  private readonly token: string;
  private readonly bookingBase: string;
  private readonly fetchImpl: typeof fetch;

  constructor({ token, environment = "sandbox", fetch: f = fetch }: Deps) {
    if (!token) throw new Error("Wellhub token is missing.");
    this.token = token;
    this.bookingBase = BOOKING_BASE[environment];
    this.fetchImpl = f;
  }

  private async call<T>(base: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await this.fetchImpl(base + path, {
      method,
      headers: {
        Authorization: `Bearer ${this.token}`,
        Accept: "application/json",
        ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    if (!res.ok) throw new WellhubError(res.status, path, text.slice(0, 500));
    return (text ? JSON.parse(text) : undefined) as T;
  }

  // ---- Booking API

  products(gymId: number) {
    return this.call<{ products: { product_id: number; name: string; virtual: boolean }[] }>(this.bookingBase, "GET", `/setup/v1/gyms/${gymId}/products`);
  }

  categories(gymId: number, locale = "pt") {
    return this.call<{ results: { id: number; name: string }[] }>(this.bookingBase, "GET", `/booking/v1/gyms/${gymId}/categories?locale=${locale}`);
  }

  createClass(gymId: number, cls: { name: string; description: string; product_id: number; reference: string; categories?: number[] }) {
    return this.call<{ classes: { id: number; reference?: string }[] }>(this.bookingBase, "POST", `/booking/v1/gyms/${gymId}/classes`, {
      classes: [{ bookable: true, visible: true, ...cls }],
    });
  }

  createSlot(gymId: number, classId: number, slot: object) {
    return this.call<{ results: { id: number }[] }>(this.bookingBase, "POST", `/booking/v1/gyms/${gymId}/classes/${classId}/slots`, slot);
  }

  /** Keeps the places honest after any booking change. Only the two counters can be patched. */
  patchSlot(gymId: number, classId: number, slotId: number, counters: { total_booked?: number; total_capacity?: number }) {
    return this.call<void>(this.bookingBase, "PATCH", `/booking/v1/gyms/${gymId}/classes/${classId}/slots/${slotId}`, counters);
  }

  deleteSlot(gymId: number, classId: number, slotId: number) {
    return this.call<void>(this.bookingBase, "DELETE", `/booking/v1/gyms/${gymId}/classes/${classId}/slots/${slotId}`);
  }

  /** Must be sent within 15 minutes of `booking-requested`, or Wellhub rejects it on its own. */
  answerBooking(gymId: number, bookingNumber: string, answer: { status: BookingStatus; reason_category?: string; reason?: string }) {
    return this.call<void>(this.bookingBase, "PATCH", `/booking/v2/gyms/${gymId}/bookings/${encodeURIComponent(bookingNumber)}`, answer);
  }

  // ---- Integration Setup API

  /** Subscribes Wellhub's booking webhooks for a gym that picked Fluxo as its system. */
  subscribeGymWebhooks(gymId: number, hooks: WebhookSubscription[]) {
    return this.call<void>(SETUP_BASE, "POST", `/v1/systems/gyms/${gymId}/webhooks`, { webhooks: hooks });
  }

  /** Registers, once for the whole system, where Wellhub announces new gyms. */
  subscribeSystemWebhook(url: string, secret: string) {
    return this.call<void>(SETUP_BASE, "POST", "/v1/systems/gyms/notification-webhook", { type: "SYSTEM_INTEGRATION_REQUESTED", url, secret });
  }
}

/** The client, or null when this deployment has no Wellhub token (the feature is then off). */
export function wellhubClientFromEnv(env: Record<string, string | undefined> = process.env): WellhubClient | null {
  const token = env.WELLHUB_API_TOKEN?.trim();
  if (!token) return null;
  return new WellhubClient({ token, environment: env.WELLHUB_ENV === "production" ? "production" : "sandbox" });
}
