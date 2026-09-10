import { createServerFn } from "@tanstack/react-start";
import { getRequestHeader } from "@tanstack/react-start/server";
import { currencyForCountry } from "./currency";

export type GeoResult = {
  country: string | null;
  city: string | null;
  currency: string;
};

const PRIVATE_IP = /^(10\.|127\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1|localhost)/;

function clientIp(): string | null {
  const forwarded = getRequestHeader("x-forwarded-for");
  const cf = getRequestHeader("cf-connecting-ip" as never) as string | undefined;
  const real = getRequestHeader("x-real-ip" as never) as string | undefined;
  const ip = (cf || forwarded?.split(",")[0] || real || "").trim();
  if (!ip || PRIVATE_IP.test(ip)) return null;
  return ip;
}

async function lookupIpapi(ip: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      country_code?: string;
      city?: string;
      currency?: string;
      error?: boolean;
    };
    if (data.error || !data.country_code) return null;
    return {
      country: data.country_code,
      city: data.city ?? null,
      currency: currencyForCountry(data.country_code),
    };
  } catch {
    return null;
  }
}

async function lookupIpinfo(ip: string): Promise<GeoResult | null> {
  try {
    const res = await fetch(`https://ipinfo.io/${ip}/json`, {
      headers: { accept: "application/json" },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { country?: string; city?: string };
    if (!data.country) return null;
    return {
      country: data.country,
      city: data.city ?? null,
      currency: currencyForCountry(data.country),
    };
  } catch {
    return null;
  }
}

/** Detects the visitor's country/currency from their IP (ipapi.co, ipinfo.io fallback). */
export const detectLocation = createServerFn({ method: "GET" }).handler(
  async (): Promise<GeoResult> => {
    const ip = clientIp();
    const headerCountry = (getRequestHeader("cf-ipcountry" as never) as string | undefined) ?? null;

    if (!ip) {
      return headerCountry
        ? { country: headerCountry, city: null, currency: currencyForCountry(headerCountry) }
        : { country: null, city: null, currency: currencyForCountry(headerCountry) };
    }

    const result = (await lookupIpapi(ip)) ?? (await lookupIpinfo(ip));
    if (result) return result;

    return {
      country: headerCountry,
      city: null,
      currency: currencyForCountry(headerCountry),
    };
  },
);
