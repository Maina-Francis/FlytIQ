import { findAirport } from "./airports";

export type SearchParams = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null;
  tripType: "round" | "oneway";
  adults: number;
  cabin: "economy" | "premium" | "business" | "first";
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
  deepLink?: string;
};

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
