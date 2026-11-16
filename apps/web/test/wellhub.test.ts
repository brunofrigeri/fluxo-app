import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { createHmac } from "node:crypto";
import { connectionCodeOf, bookingRequested, systemIntegrationRequested } from "@/lib/wellhub/events";
import { sign, verifySignature } from "@/lib/wellhub/signature";
import { buildSlot, instantOf, localISO, type BookingRules } from "@/lib/wellhub/slots";
import { WellhubClient, WellhubError, wellhubClientFromEnv } from "@/lib/wellhub/client";

describe("signature", () => {
  const body = '{"event_type":"booking-requested","event_data":{"slot":{"id":1}}}';
  const secret = "s3cret-s3cret-s3cret";

  test("is the upper-case HMAC-SHA1 of the raw body", () => {
    assert.equal(sign(body, secret), createHmac("sha1", secret).update(body).digest("hex").toUpperCase());
  });

  test("accepts the right signature, with or without the 0X prefix and in any case", () => {
    const s = sign(body, secret);
    assert.ok(verifySignature(body, secret, s));
    assert.ok(verifySignature(body, secret, "0X" + s));
    assert.ok(verifySignature(body, secret, s.toLowerCase()));
  });

  test("rejects a changed body, a wrong secret, and a missing or empty header or secret", () => {
    const s = sign(body, secret);
    assert.ok(!verifySignature(body + " ", secret, s));
    assert.ok(!verifySignature(body, "another-secret-value", s));
    assert.ok(!verifySignature(body, secret, null));
    assert.ok(!verifySignature(body, secret, ""));
    assert.ok(!verifySignature(body, "", s));
    assert.ok(!verifySignature(body, secret, s.slice(0, -2)), "a shorter value must not throw");
  });
});

describe("events", () => {
  test("parses Wellhub's booking-requested example", () => {
    const e = bookingRequested.parse({
      event_type: "booking-requested",
      event_data: {
        user: { unique_token: "123456789012", name: "Firstname Lastname", email: "user@email.com" },
        slot: { id: 1234567, gym_id: 12345, class_id: 654321, booking_number: "BK_A1B2C3" },
        timestamp: 1560983373378,
        event_id: "7e8cbb0f-9681-4d3e-8c36-2b3dd6ecbadb",
      },
    });
    assert.equal(e.event_data.slot.booking_number, "BK_A1B2C3");
  });

  test("rejects a booking without a booking number", () => {
    assert.ok(!bookingRequested.safeParse({ event_type: "booking-requested", event_data: { user: { unique_token: "1" }, slot: { id: 1, gym_id: 1 } } }).success);
  });

  test("reads the connection code from the custom fields, whatever the event type's spelling", () => {
    const e = systemIntegrationRequested.parse({
      event_type: "SYSTEM_INTEGRATION_REQUESTED",
      event_data: {
        gym_id: 7, gym_name: "Studio", partner_id: "2cff9739-5cd2-4299-8753-ba56aafb9c92",
        custom_fields: [{ key: "cnpj", value: "1234567" }, { key: "cms_id", value: " ab12cd34ef56 " }],
      },
    });
    assert.equal(connectionCodeOf(e), "ab12cd34ef56");
    assert.equal(connectionCodeOf(e, "other_key"), null);
  });

  test("a numeric custom field value is accepted, and no custom fields means no code", () => {
    const e = systemIntegrationRequested.parse({ event_type: "system-integration-requested", event_data: { gym_id: 7, gym_name: "S", custom_fields: [{ key: "cms_id", value: 123 }] } });
    assert.equal(connectionCodeOf(e), "123");
    const none = systemIntegrationRequested.parse({ event_type: "system-integration-requested", event_data: { gym_id: 7, gym_name: "S" } });
    assert.equal(connectionCodeOf(none), null);
  });
});

describe("slots", () => {
  const rules: BookingRules = { opensDaysBefore: 7, closesHoursBefore: 2, cancelHoursBefore: 3 };
  const slot = { startTime: "07:00:00", durationMinutes: 50, capacity: 4 };
  const now = new Date("2026-02-27T12:00:00Z");

  test("studio wall-clock times round-trip, with São Paulo's -03:00 offset", () => {
    assert.equal(instantOf("2026-03-02", "07:00").toISOString(), "2026-03-02T10:00:00.000Z");
    assert.equal(localISO(instantOf("2026-03-02", "07:00")), "2026-03-02T07:00:00-03:00");
    assert.equal(localISO(new Date("2026-03-02T02:30:00Z")), "2026-03-01T23:30:00-03:00", "crosses midnight");
  });

  test("builds Wellhub's slot from the studio's booking rules", () => {
    const s = buildSlot({ slot, date: "2026-03-02", occupancy: 1, rules, productId: 905264, now })!;
    assert.deepEqual(s, {
      occur_date: "2026-03-02T07:00:00-03:00",
      length_in_minutes: 50,
      total_capacity: 4,
      total_booked: 1,
      product_id: 905264,
      status: 1,
      booking_window: { opens_at: "2026-02-23T07:00:00-03:00", closes_at: "2026-03-02T05:00:00-03:00" },
      cancellable_until: "2026-03-02T04:00:00-03:00",
    });
  });

  test("caps free cancellation at 24 hours, like Wellhub does", () => {
    const s = buildSlot({ slot, date: "2026-03-02", occupancy: 0, rules: { ...rules, cancelHoursBefore: 48 }, productId: 1, now })!;
    assert.equal(s.cancellable_until, "2026-03-01T07:00:00-03:00");
  });

  test("a hand-overbooked class reads as full, never above capacity", () => {
    assert.equal(buildSlot({ slot, date: "2026-03-02", occupancy: 6, rules, productId: 1, now })!.total_booked, 4);
    assert.equal(buildSlot({ slot, date: "2026-03-02", occupancy: -1, rules, productId: 1, now })!.total_booked, 0);
  });

  test("a time that already started is not listed", () => {
    assert.equal(buildSlot({ slot, date: "2026-02-27", occupancy: 0, rules, productId: 1, now: new Date("2026-02-27T11:00:00-03:00") }), null);
  });

  test("room and instructor are optional extras", () => {
    const s = buildSlot({ slot, date: "2026-03-02", occupancy: 0, rules, productId: 1, now, room: "Sala 1", instructorName: "Izabela" })!;
    assert.equal(s.room, "Sala 1");
    assert.deepEqual(s.instructors, [{ name: "Izabela", substitute: false }]);
  });
});

describe("client", () => {
  const TOKEN = "test-token-not-real";

  function fake(status = 200, body = "{}") {
    const calls: { url: string; init: RequestInit }[] = [];
    const f = (async (url: string, init: RequestInit) => {
      calls.push({ url, init });
      return new Response(status === 204 ? null : body, { status });
    }) as unknown as typeof fetch;
    return { calls, f };
  }

  test("is off without a token in the environment, on with one", () => {
    assert.equal(wellhubClientFromEnv({}), null);
    assert.equal(wellhubClientFromEnv({ WELLHUB_API_TOKEN: "  " }), null);
    assert.ok(wellhubClientFromEnv({ WELLHUB_API_TOKEN: TOKEN }) instanceof WellhubClient);
    assert.throws(() => new WellhubClient({ token: "" }));
  });

  test("sends the bearer token and targets the sandbox by default", async () => {
    const { calls, f } = fake(200, '{"classes":[{"id":9}]}');
    const c = new WellhubClient({ token: TOKEN, fetch: f });
    await c.createClass(123, { name: "Pilates", description: "d", product_id: 1, reference: "r" });
    assert.equal(calls[0].url, "https://apitesting.partners.gympass.com/booking/v1/gyms/123/classes");
    assert.equal((calls[0].init.headers as Record<string, string>).Authorization, `Bearer ${TOKEN}`);
    assert.deepEqual(JSON.parse(calls[0].init.body as string).classes[0].bookable, true);
  });

  test("uses the production hosts when asked, and the setup API for webhooks", async () => {
    const { calls, f } = fake(204);
    const c = new WellhubClient({ token: TOKEN, environment: "production", fetch: f });
    await c.patchSlot(1, 2, 3, { total_booked: 4 });
    await c.subscribeGymWebhooks(1, [{ event: "booking-requested", url: "https://x/y", secret: "s" }]);
    assert.equal(calls[0].url, "https://api.partners.gympass.com/booking/v1/gyms/1/classes/2/slots/3");
    assert.equal(calls[0].init.method, "PATCH");
    assert.equal(calls[1].url, "https://api.partners-integrations.gympass.com/v1/systems/gyms/1/webhooks");
  });

  test("answers a booking on the v2 endpoint with the booking number encoded", async () => {
    const { calls, f } = fake(204);
    await new WellhubClient({ token: TOKEN, fetch: f }).answerBooking(1, "BK/1 2", { status: "REJECTED", reason_category: "CLASS_IS_FULL" });
    assert.ok(calls[0].url.endsWith("/booking/v2/gyms/1/bookings/BK%2F1%202"));
  });

  test("an error carries the status but never the token", async () => {
    const { f } = fake(401, "unauthorized");
    const err = await new WellhubClient({ token: TOKEN, fetch: f }).products(1).catch((e: unknown) => e);
    assert.ok(err instanceof WellhubError);
    assert.equal((err as WellhubError).status, 401);
    assert.ok(!JSON.stringify({ m: (err as Error).message, b: (err as WellhubError).body }).includes(TOKEN));
  });
});
