/** GA4 event engine. Measurement ID comes from VITE_GA_MEASUREMENT_ID. */

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (...args: unknown[]) => void;
  }
}

const MEASUREMENT_ID = import.meta.env["VITE_GA_MEASUREMENT_ID"] as string | undefined;

let initialized = false;

export function initAnalytics() {
  if (typeof window === "undefined" || initialized || !MEASUREMENT_ID) return;
  initialized = true;

  const script = document.createElement("script");
  script.async = true;
  script.src = `https://www.googletagmanager.com/gtag/js?id=${MEASUREMENT_ID}`;
  document.head.appendChild(script);

  window.dataLayer = window.dataLayer || [];
  window.gtag = function gtag(...args: unknown[]) {
    window.dataLayer!.push(args);
  };
  window.gtag("js", new Date());
  window.gtag("config", MEASUREMENT_ID);
}

function track(event: string, params: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  window.gtag?.("event", event, params);
}

export function trackPageView(path: string) {
  track("page_view", { page_path: path });
}

export function trackFlightSearch(params: {
  origin: string;
  destination: string;
  departure_date: string;
  currency: string;
}) {
  track("flight_search", params);
}

export function trackCurrencyChanged(params: {
  from_currency: string;
  to_currency: string;
  detected_country: string | null;
}) {
  track("currency_changed", params);
}

export function trackAffiliateClick(params: {
  airline: string;
  price: number;
  currency: string;
  skyscanner_deep_link: string;
}) {
  track("affiliate_click", params);
}

export function trackPriceAlertCreated(params: {
  route: string;
  target_price: number;
  channel: "email" | "telegram";
}) {
  track("price_alert_created", params);
}
