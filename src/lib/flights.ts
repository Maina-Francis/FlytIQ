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

  const airline = AIRLINES[airlineCode] ?? airlineCode;

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


const AIRLINES: Record<string, string> = {
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

export function formatDuration(mins: number): string {
  return `${Math.floor(mins / 60)}h ${String(mins % 60).padStart(2, "0")}m`;
}

