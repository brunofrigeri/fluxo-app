import { z } from "zod";

// The webhook payloads Wellhub sends. Unknown extra fields are ignored; the fields we act on are strict.

const user = z.object({
  unique_token: z.string().min(1),
  name: z.string().optional(),
  email: z.string().optional(),
});

const slotRef = z.object({
  id: z.number().int(),
  gym_id: z.number().int(),
  class_id: z.number().int().optional(),
  booking_number: z.string().min(1),
});

const bookingEventData = z.object({
  user,
  slot: slotRef,
  timestamp: z.number().optional(),
  event_id: z.string().optional(),
});

export const bookingRequested = z.object({ event_type: z.literal("booking-requested"), event_data: bookingEventData });
export const bookingCanceled = z.object({ event_type: z.literal("booking-canceled"), event_data: bookingEventData });
export const bookingLateCanceled = z.object({ event_type: z.literal("booking-late-canceled"), event_data: bookingEventData });

export const systemIntegrationRequested = z.object({
  event_type: z.string().transform((s) => s.toLowerCase().replace(/_/g, "-")).pipe(z.literal("system-integration-requested")),
  event_data: z.object({
    gym_id: z.number().int(),
    gym_name: z.string(),
    partner_id: z.string().uuid().optional(),
    custom_fields: z.array(z.object({ key: z.string(), value: z.string().or(z.number()).transform(String) })).default([]),
    event_id: z.string().optional(),
    timestamp: z.number().optional(),
  }),
});

export type BookingRequested = z.infer<typeof bookingRequested>;
export type BookingCanceled = z.infer<typeof bookingCanceled>;
export type SystemIntegrationRequested = z.infer<typeof systemIntegrationRequested>;

/**
 * The connection code the studio typed on Wellhub's side. Wellhub fixes the custom-field keys per
 * system, so the key is configurable (WELLHUB_CODE_FIELD) and defaults to `cms_id`.
 */
export function connectionCodeOf(event: SystemIntegrationRequested, key = "cms_id"): string | null {
  const field = event.event_data.custom_fields.find((f) => f.key === key);
  const code = field?.value.trim();
  return code ? code : null;
}
