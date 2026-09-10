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

import type { SearchParams, FlightOffer } from "./flights";
import { CABIN_TO_KIWI } from "./flights";
import { buildSkyscannerDeepLink } from "./affiliate";
import { getCurrency } from "./currency";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

// ─── Config ───────────────────────────────────────────────────────────────────

const KIWI_BASE = "https://api.tequila.kiwi.com";
const API_KEY = process.env.KIWI_TEQUILA_API_KEY ?? process.env["KIWI_TEQUILA_API_KEY"];

// ─── Airline Name Registry (supplements Kiwi's carrier codes) ─────────────────

const AIRLINE_NAMES: Record<string, string> = {
  KQ: "Kenya Airways",
  EK: "Emirates",
  QR: "Qatar Airways",
  TK: "Turkish Airlines",
  ET: "Ethiopian Airlines",
  BA: "British Airways",
  KL: "KLM",
  LH: "Lufthansa",
  AF: "Air France",
  QF: "Qantas",
  MS: "EgyptAir",
  AT: "Royal Air Maroc",
  SA: "South African Airways",
  WB: "RwandAir",
  LO: "LOT Polish Airlines",
  SQ: "Singapore Airlines",
  EY: "Etihad Airways",
  UA: "United Airlines",
  AA: "American Airlines",
  DL: "Delta Air Lines",
  FR: "Ryanair",
  U2: "easyJet",
  W6: "Wizz Air",
};

function airlineName(code: string): string {
  return AIRLINE_NAMES[code] ?? code;
}

// ─── Kiwi API Response Types ──────────────────────────────────────────────────

type KiwiRoute = {
  flyFrom: string;
  flyTo: string;
  local_departure: string; // "2024-10-01T10:00:00.000Z"
  local_arrival: string;
  airline: string;
  operating_carrier: string;
  vehicle_type: string;
};

type KiwiOffer = {
  id: string;
  flyFrom: string;
  flyTo: string;
  local_departure: string;
  local_arrival: string;
  airlines: string[];
  route: KiwiRoute[];
  price: number;
  duration: {
    departure: number; // seconds
    return: number | null;
    total: number; // seconds
  };
  quality?: number;
  deep_link?: string;
};

type KiwiSearchResponse = {
  data: KiwiOffer[];
  currency: string;
  _results: number;
};

// ─── Date Formatting ──────────────────────────────────────────────────────────

/** "2024-10-01" -> "01/10/2024" (Kiwi's DD/MM/YYYY format) */
export function toKiwiDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}

/** "2024-10-01T14:30:00.000Z" -> "14:30" */
function formatTime(isoDatetime: string): string {
  const timePart = isoDatetime.split("T")[1] ?? "";
  return timePart.slice(0, 5);
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

  // Currency rate conversion if response returned in non-USD
  const currencyRate = getCurrency(requestedCurrency).rate || 1;

  // ── Map Kiwi -> FlightOffer with direct Skyscanner deep-link builder integration ──
  const mapped: FlightOffer[] = kiwiOffers.map((o, idx) => {
    const airlineCode = o.airlines[0] ?? o.route[0]?.airline ?? "??";
    const firstSeg = o.route[0];
    const lastSeg = o.route[o.route.length - 1];

    // Calculate USD price accurately based on requested currency rate
    const rawPrice = o.price;
    const priceUsd =
      requestedCurrency.toUpperCase() === "USD"
        ? Math.round(rawPrice)
        : Math.round(rawPrice / currencyRate);

    // Kiwi duration in seconds for departure leg
    const durationMinutes = Math.round(o.duration.departure / 60);

    const departTime = firstSeg
      ? formatTime(firstSeg.local_departure)
      : formatTime(o.local_departure);

    const arriveTime = lastSeg
      ? formatTime(lastSeg.local_arrival)
      : formatTime(o.local_arrival);

    const stops = Math.max(0, o.route.length - 1);

    // Build affiliate Skyscanner deep link directly for this offer
    const deepLink = buildSkyscannerDeepLink({
      origin: o.flyFrom,
      destination: o.flyTo,
      departureDate: params.departureDate,
      returnDate: params.returnDate,
      adults: params.adults,
      cabin: params.cabin,
      currency: requestedCurrency,
    });

    return {
      id: o.id ?? `kiwi-${idx}`,
      airline: airlineName(airlineCode),
      airlineCode,
      priceUsd,
      baselineUsd: priceUsd,
      dropPercent: 0,
      departTime,
      arriveTime,
      durationMinutes,
      stops,
      origin: o.flyFrom,
      destination: o.flyTo,
      bestLocalFare: false,
      deepLink,
    };
  });

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
