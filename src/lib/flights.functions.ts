/**
 * flights.functions.ts
 * TanStack Start server function: fetches live flight offers from the Kiwi
 * Tequila API, falling back to the deterministic mock generator when the API
 * key is absent (e.g. during local development without credentials).
 *
 * Called from the client via useQuery — TanStack Start handles the
 * server/client boundary automatically.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { generateOffers, type FlightOffer } from "./flights";

// ─── Input Validation Schema ──────────────────────────────────────────────────

const searchParamsSchema = z.object({
  origin: z.string().min(2).max(4).toUpperCase(),
  destination: z.string().min(2).max(4).toUpperCase(),
  departureDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  returnDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  tripType: z.enum(["round", "oneway"]),
  adults: z.number().int().min(1).max(9),
  cabin: z.enum(["economy", "premium", "business", "first"]),
  currency: z.string().optional(),
});

export type FlightSearchParams = z.infer<typeof searchParamsSchema>;

// ─── Server Function ──────────────────────────────────────────────────────────

export const searchFlights = createServerFn({ method: "GET" })
  .validator((raw: unknown) => searchParamsSchema.parse(raw))
  .handler(async ({ data: params }): Promise<FlightOffer[]> => {
    // Dynamic import keeps kiwi.ts (and its secrets) out of the client bundle
    const { fetchKiwiFlights, kiwiEnabled } = await import("./kiwi");

    if (kiwiEnabled()) {
      try {
        const offers = await fetchKiwiFlights(params);
        if (offers.length > 0) return offers;
        // Kiwi returned 0 results (e.g. no flights for that route/date)
        console.warn("[FlightIQ] Kiwi returned 0 offers — using mock fallback.");
      } catch (err) {
        console.error("[FlightIQ] Kiwi search failed:", err);
        console.warn("[FlightIQ] Falling back to mock flight generator.");
      }
    }

    // Mock fallback — always works, no credentials needed
    return generateOffers(params);
  });
