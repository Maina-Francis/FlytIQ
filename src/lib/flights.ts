import { findAirport } from "./airports";
import { buildSkyscannerDeepLink } from "./affiliate";

export type SearchParams = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType: "round" | "oneway";
  adults: number;
  cabin: "economy" | "premium" | "business" | "first";
  cabinClass?: string;
  currency?: string;
};

/** Maps our internal cabin keys to Kiwi selected_cabins codes (M=Economy, W=Premium Economy, C=Business, F=First). */
export const CABIN_TO_KIWI: Record<SearchParams["cabin"], string> = {
  economy: "M",
  premium: "W",
  business: "C",
  first: "F",
};

export type FlightOffer = {
  id: string;
  airline: string;
  airlineCode: string;
  /** Base price in USD; converted at render time to the active currency. */
  priceUsd: number;
  /** Typical price for this route in USD, used to show price drops. */
  baselineUsd: number;
  dropPercent: number;
  departTime: string;
  arriveTime: string;
  durationMinutes: number;
  stops: number;
  origin: string;
  destination: string;
  bestLocalFare: boolean;
  skyscanner_link?: string;
  deepLink?: string;
};

// ─── Kiwi Raw Response Types ──────────────────────────────────────────────────

export type KiwiRoute = {
  flyFrom: string;
  flyTo: string;
  local_departure: string; // "2024-10-01T10:00:00.000Z"
  local_arrival: string;
  airline: string;
  operating_carrier?: string;
  vehicle_type?: string;
};

export type KiwiRawOffer = {
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
    return?: number | null;
    total?: number;
  };
  quality?: number;
  deep_link?: string;
};

function formatKiwiTime(isoDatetime: string): string {
  const timePart = isoDatetime.split("T")[1] ?? "";
  return timePart.slice(0, 5);
}

/**
 * Normalizes a raw Kiwi offer into FlightIQ's FlightOffer interface.
 * Discards Kiwi's native booking links and attaches Skyscanner deep link as `skyscanner_link`.
 */
export function normalizeKiwiOffer(
  offer: KiwiRawOffer,
  searchParams: SearchParams,
  index = 0,
): FlightOffer {
  const airlineCode = offer.airlines?.[0] ?? offer.route?.[0]?.airline ?? "??";
  const firstSeg = offer.route?.[0];
  const lastSeg = offer.route?.[offer.route.length - 1];

  // Discard Kiwi's native booking links. Instead, generate Skyscanner deep link.
  const returnDate =
    offer.route && offer.route.length > 0 && lastSeg?.local_arrival
      ? lastSeg.local_arrival
      : undefined;

  const skyscannerLink = buildSkyscannerDeepLink({
    origin: offer.flyFrom,
    destination: offer.flyTo,
    departureDate: offer.local_departure,
    returnDate,
    adults: searchParams.adults,
    cabinClass: searchParams.cabinClass ?? searchParams.cabin,
    currency: searchParams.currency,
    mediaPartnerId:
      typeof process !== "undefined"
        ? process.env?.["VITE_SKYSCANNER_PARTNER_ID"]
        : undefined,
  });

  const durationMinutes = Math.round((offer.duration?.departure ?? 0) / 60);
  const departTime = firstSeg
    ? formatKiwiTime(firstSeg.local_departure)
    : formatKiwiTime(offer.local_departure);
  const arriveTime = lastSeg
    ? formatKiwiTime(lastSeg.local_arrival)
    : formatKiwiTime(offer.local_arrival);
  const stops = Math.max(0, (offer.route?.length ?? 1) - 1);

  const matchedAirline = AIRLINES.find((a) => a.code === airlineCode);
  const airline = matchedAirline ? matchedAirline.name : airlineCode;

  return {
    id: offer.id ?? `kiwi-${index}`,
    airline,
    airlineCode,
    priceUsd: Math.round(offer.price),
    baselineUsd: Math.round(offer.price),
    dropPercent: 0,
    departTime,
    arriveTime,
    durationMinutes,
    stops,
    origin: offer.flyFrom,
    destination: offer.flyTo,
    bestLocalFare: false,
    skyscanner_link: skyscannerLink,
    deepLink: skyscannerLink,
  };
}

/**
 * Normalizes an array of raw Kiwi API offers.
 */
export function normalizeKiwiOffers(
  rawOffers: KiwiRawOffer[],
  searchParams: SearchParams,
): FlightOffer[] {
  const normalized = rawOffers.map((offer, idx) =>
    normalizeKiwiOffer(offer, searchParams, idx),
  );
  normalized.sort((a, b) => a.priceUsd - b.priceUsd);
  if (normalized[0]) {
    normalized[0].bestLocalFare = true;
  }
  return normalized;
}


const AIRLINES = [
  { name: "Kenya Airways", code: "KQ" },
  { name: "Emirates", code: "EK" },
  { name: "Qatar Airways", code: "QR" },
  { name: "Turkish Airlines", code: "TK" },
  { name: "Ethiopian Airlines", code: "ET" },
  { name: "British Airways", code: "BA" },
  { name: "KLM", code: "KL" },
  { name: "Lufthansa", code: "LH" },
  { name: "Air France", code: "AF" },
  { name: "Qantas", code: "QF" },
];

const CABIN_MULTIPLIER: Record<SearchParams["cabin"], number> = {
  economy: 1,
  premium: 1.6,
  business: 2.9,
  first: 4.4,
};

/** Deterministic pseudo-random generator so the same search always shows the same fares. */
function seeded(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return () => {
    h += 0x6d2b79f5;
    let t = h;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function routeDistanceFactor(origin: string, destination: string) {
  const a = findAirport(origin);
  const b = findAirport(destination);
  if (!a || !b) return 1;
  return a.country === b.country ? 0.35 : a.city === b.city ? 0.3 : 1;
}

function minutesToLabel(mins: number) {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

export function formatDuration(mins: number) {
  return minutesToLabel(mins);
}

export function generateOffers(params: SearchParams): FlightOffer[] {
  const rand = seeded(
    `${params.origin}${params.destination}${params.departureDate}${params.returnDate ?? ""}${params.cabin}`,
  );
  const base = 180 + rand() * 520;
  const factor = routeDistanceFactor(params.origin, params.destination);
  const cabinMult = CABIN_MULTIPLIER[params.cabin] ?? 1;
  const count = 8 + Math.floor(rand() * 5);

  const offers: FlightOffer[] = [];
  for (let i = 0; i < count; i++) {
    const airline = AIRLINES[Math.floor(rand() * AIRLINES.length)]!;
    const stops = rand() < 0.45 ? 0 : rand() < 0.85 ? 1 : 2;
    const priceUsd = Math.round(
      base * factor * cabinMult * (0.82 + rand() * 0.55) * (stops === 0 ? 1.12 : 1),
    );
    const dropPercent = rand() < 0.55 ? Math.round(4 + rand() * 24) : 0;
    const baselineUsd = dropPercent ? Math.round(priceUsd / (1 - dropPercent / 100)) : priceUsd;
    const departHour = Math.floor(rand() * 24);
    const departMinute = Math.floor(rand() * 4) * 15;
    const durationMinutes = Math.round((120 + rand() * 600) * (1 + stops * 0.35) * factor + 60);
    const arrive = new Date(2024, 0, 1, departHour, departMinute + durationMinutes);

    offers.push({
      id: `${airline.code}-${i}-${params.origin}${params.destination}`,
      airline: airline.name,
      airlineCode: airline.code,
      priceUsd,
      baselineUsd,
      dropPercent,
      departTime: `${String(departHour).padStart(2, "0")}:${String(departMinute).padStart(2, "0")}`,
      arriveTime: `${String(arrive.getHours()).padStart(2, "0")}:${String(arrive.getMinutes()).padStart(2, "0")}`,
      durationMinutes,
      stops,
      origin: params.origin,
      destination: params.destination,
      bestLocalFare: false,
    });
  }

  offers.sort((a, b) => a.priceUsd - b.priceUsd);
  if (offers[0]) offers[0].bestLocalFare = true;
  return offers;
}
