/**
 * kiwi.ts
 * Server-side Kiwi Tequila API service.
 *
 * Responsibilities:
 *  1. Flight search via GET /v2/search (API key authentication).
 *  2. Query param mapping from TanStack Router state (fly_from, fly_to, date_from, date_to, adults, selected_cabins, curr).
 *  3. Kiwi response -> FlightOffer[] mapping with direct Skyscanner deep-link builder integration.
 *  4. Price-drop detection via the Supabase flight_price_cache table.
 */

import type { SearchParams, FlightOffer, KiwiRawOffer } from "./flights";
import { CABIN_TO_KIWI, normalizeKiwiOffers } from "./flights";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Config ───────────────────────────────────────────────────────────────────

const KIWI_BASE = "https://api.tequila.kiwi.com";
const API_KEY = process.env.KIWI_TEQUILA_API_KEY ?? process.env["KIWI_TEQUILA_API_KEY"];

type KiwiSearchResponse = {
  data: KiwiRawOffer[];
  currency: string;
  _results: number;
};

// ─── Date Formatting ──────────────────────────────────────────────────────────

/** "2024-10-01" -> "01/10/2024" (Kiwi's DD/MM/YYYY format) */
export function toKiwiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

// ─── Price Drop Detection ─────────────────────────────────────────────────────

async function computePriceDrops(
  offers: { priceUsd: number; origin: string; destination: string }[],
  departureDate: string,
): Promise<Map<string, number>> {
  const dropMap = new Map<string, number>();

  try {
    const routeKeys = [
      ...new Set(
        offers.map((o) => `${o.origin}-${o.destination}-${departureDate}`),
      ),
    ];

    const { data: cached } = await supabaseAdmin
      .from("flight_price_cache")
      .select("route_key, cheapest_price")
      .in("route_key", routeKeys);

    const cachedMap = new Map(
      (cached ?? []).map((r) => [r.route_key, r.cheapest_price]),
    );

    // Find cheapest price per route from current results
    const currentCheapest = new Map<string, number>();
    for (const offer of offers) {
      const key = `${offer.origin}-${offer.destination}-${departureDate}`;
      const existing = currentCheapest.get(key) ?? Infinity;
      if (offer.priceUsd < existing) currentCheapest.set(key, offer.priceUsd);
    }

    const upserts: {
      route_key: string;
      cheapest_price: number;
      currency: string;
      skyscanner_link: string;
      updated_at: string;
    }[] = [];

    for (const [key, currentPrice] of currentCheapest.entries()) {
      const cachedPrice = cachedMap.get(key);

      if (cachedPrice && cachedPrice > currentPrice) {
        const drop = Math.round(
          ((cachedPrice - currentPrice) / cachedPrice) * 100,
        );
        if (drop >= 3) dropMap.set(key, drop);
      }

      upserts.push({
        route_key: key,
        cheapest_price: currentPrice,
        currency: "USD",
        skyscanner_link: `https://www.skyscanner.net/transport/flights/${key}/`,
        updated_at: new Date().toISOString(),
      });
    }

    // Fire-and-forget cache upsert
    supabaseAdmin
      .from("flight_price_cache")
      .upsert(upserts, { onConflict: "route_key" })
      .then(({ error }) => {
        if (error)
          console.error("[Kiwi] Cache upsert failed:", error.message);
      });
  } catch (err) {
    console.warn("[Kiwi] Price drop detection failed:", err);
  }

  return dropMap;
}

// ─── Main Search Function ─────────────────────────────────────────────────────

/**
 * Fetches live flight offers from the Kiwi Tequila API and maps them to FlightOffer[].
 * Integrates directly with the Skyscanner deep link builder.
 *
 * Throws if KIWI_TEQUILA_API_KEY is not set.
 */
export async function fetchKiwiFlights(
  params: SearchParams,
): Promise<FlightOffer[]> {
  if (!API_KEY) {
    throw new Error(
      "[Kiwi] KIWI_TEQUILA_API_KEY is not set in the environment.",
    );
  }

  const requestedCurrency = params.currency ?? "USD";

  const query = new URLSearchParams({
    fly_from: params.origin,
    fly_to: params.destination,
    date_from: toKiwiDate(params.departureDate),
    date_to: toKiwiDate(params.departureDate),
    adults: String(params.adults),
    selected_cabins: CABIN_TO_KIWI[params.cabin] ?? "M",
    curr: requestedCurrency,
    limit: "15",
    sort: "price",
    asc: "1",
    vehicle_type: "aircraft",
  });

  if (params.returnDate) {
    query.set("return_from", toKiwiDate(params.returnDate));
    query.set("return_to", toKiwiDate(params.returnDate));
  }

  const res = await fetch(`${KIWI_BASE}/v2/search?${query.toString()}`, {
    headers: {
      apikey: API_KEY,
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(
      `[Kiwi] Flight search failed (${res.status}): ${body.slice(0, 300)}`,
    );
  }

  const json = (await res.json()) as KiwiSearchResponse;
  const kiwiOffers = json.data ?? [];

  if (kiwiOffers.length === 0) return [];

  // ── Normalize Kiwi offers -> FlightOffer[] with direct Skyscanner deep link ──
  const mapped = normalizeKiwiOffers(kiwiOffers, params);


  // ── Price drop detection ──────────────────────────────────────────────────
  const dropMap = await computePriceDrops(mapped, params.departureDate);

  for (const offer of mapped) {
    const key = `${offer.origin}-${offer.destination}-${params.departureDate}`;
    const drop = dropMap.get(key) ?? 0;
    offer.dropPercent = drop;
    if (drop > 0) {
      offer.baselineUsd = Math.round(offer.priceUsd / (1 - drop / 100));
    }
  }

  // ── Mark cheapest as Best Local Fare ─────────────────────────────────────
  mapped.sort((a, b) => a.priceUsd - b.priceUsd);
  if (mapped[0]) mapped[0].bestLocalFare = true;

  return mapped;
}

/** Returns true when the Kiwi API key is configured in the environment. */
export function kiwiEnabled(): boolean {
  return Boolean(API_KEY);
}
