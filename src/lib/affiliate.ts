/**
 * Skyscanner partner deep links.
 * Set VITE_SKYSCANNER_PARTNER_ID to your Impact.com mediaPartnerId.
 */
const PARTNER_ID =
  (import.meta.env["VITE_SKYSCANNER_PARTNER_ID"] as string | undefined) ?? "flightiq-pending";

export type DeepLinkInput = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string | null | undefined;
  adults: number;
  cabin: string;
  currency: string;
};

function compact(date: string) {
  // YYYY-MM-DD -> YYMMDD as used by Skyscanner transport routes
  const [y, m, d] = date.split("-");
  return `${(y ?? "").slice(2)}${m ?? ""}${d ?? ""}`;
}

export function buildSkyscannerDeepLink(input: DeepLinkInput): string {
  const legs = [
    input.origin.toLowerCase(),
    input.destination.toLowerCase(),
    compact(input.departureDate),
    input.returnDate ? compact(input.returnDate) : "",
  ]
    .filter(Boolean)
    .join("/");

  const params = new URLSearchParams({
    adults: String(input.adults),
    cabinclass: input.cabin.toLowerCase(),
    currency: input.currency,
    associateid: PARTNER_ID,
    utm_source: "flightiq",
    utm_medium: "affiliate",
  });

  return `https://www.skyscanner.net/transport/flights/${legs}/?${params.toString()}`;
}
