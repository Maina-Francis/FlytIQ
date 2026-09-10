/**
 * flights.functions.ts
 * TanStack Start server function: fetches live flight offers from the Kiwi
 * Tequila API.
 *
 * If credentials are missing or the request fails, an error is thrown so the UI
 * can notify the user via toast and inline error banners rather than displaying mock data.
 */

import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import type { FlightOffer } from "./flights";

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
  cabinClass: z.string().optional(),
  currency: z.string().optional(),
});

export type FlightSearchParams = z.infer<typeof searchParamsSchema>;

// ─── Server Function ──────────────────────────────────────────────────────────

export const searchFlights = createServerFn({ method: "GET" })
  .validator((raw: unknown) => searchParamsSchema.parse(raw))
  .handler(async ({ data: params }): Promise<FlightOffer[]> => {
    // Dynamic import keeps kiwi.ts (and its secrets) out of the client bundle
    const { fetchKiwiFlights, kiwiEnabled } = await import("./kiwi");

    if (!kiwiEnabled()) {
      throw new Error(
        "Live flight search is unavailable: KIWI_TEQUILA_API_KEY is not configured in environment variables.",
      );
    }

    try {
      return await fetchKiwiFlights(params);
    } catch (err) {
      console.error("[FlightIQ] Live Kiwi flight search failed:", err);
      const message =
        err instanceof Error
          ? err.message
          : "Unable to retrieve live flight offers from Kiwi Tequila.";
      throw new Error(message);
    }
  });
