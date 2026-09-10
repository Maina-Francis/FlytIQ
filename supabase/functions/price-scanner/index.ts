/**
 * supabase/functions/price-scanner/index.ts
 *
 * Deno-native Supabase Edge Function — Price Scanner & Alert Dispatcher.
 *
 * Responsibilities:
 *  1. Fetch all active price trackers from `price_trackers`
 *  2. For each tracker, check the latest cached price in `flight_price_cache`
 *  3. If cheapest_price <= target_price → dispatch alerts:
 *     • Email  (via ZeptoMail, if tracker.email is set)
 *     • Telegram (via Bot API, if tracker.telegram_chat_id is set)
 *  4. Mark the tracker as notified (set is_active = false) after a successful alert
 *     so the user isn't spammed continuously.
 *
 * Invoke manually:   supabase functions invoke price-scanner
 * Production cron:   configure via Supabase Dashboard → Edge Functions → Schedule
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Environment ──────────────────────────────────────────────────────────────

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const ZEPTO_API_KEY = Deno.env.get("ZEPTO_API_KEY");
const SKYSCANNER_PARTNER_ID = Deno.env.get("VITE_SKYSCANNER_PARTNER_ID") ?? "flytiq-pending";

// ─── Supabase Admin Client ────────────────────────────────────────────────────

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});

// ─── Skyscanner Affiliate Deep Link ──────────────────────────────────────────

function buildSkyscannerLink(
  origin: string,
  destination: string,
  departureDate: string,
  currency: string,
): string {
  // Compact date: YYYY-MM-DD → YYMMDD
  const [year, month, day] = departureDate.split("-");
  const compact = `${(year ?? "").slice(2)}${month ?? ""}${day ?? ""}`;

  const params = new URLSearchParams({
    adults: "1",
    cabinclass: "economy",
    currency,
    associateid: SKYSCANNER_PARTNER_ID,
    utm_source: "flytiq",
    utm_medium: "affiliate",
    utm_campaign: "price_alert",
  });

  return `https://www.skyscanner.net/transport/flights/${origin.toLowerCase()}/${destination.toLowerCase()}/${compact}/?${params.toString()}`;
}

// ─── Telegram Dispatch ────────────────────────────────────────────────────────

async function sendTelegramAlert(opts: {
  chatId: string;
  originIata: string;
  destinationIata: string;
  currency: string;
  newPrice: number;
  targetPrice: number;
  departureDate: string;
  skyscannerLink: string;
}): Promise<void> {
  if (!TELEGRAM_BOT_TOKEN) {
    console.warn("[price-scanner] TELEGRAM_BOT_TOKEN not set — skipping Telegram alert.");
    return;
  }

  const text =
    `🚨 *PRICE DROP ALERT!*\n\n` +
    `✈️ *${opts.originIata}* ➔ *${opts.destinationIata}*\n` +
    `💰 New Low Fare: *${opts.currency} ${opts.newPrice.toLocaleString()}*\n` +
    `🎯 Your Target: *${opts.currency} ${opts.targetPrice.toLocaleString()}*\n` +
    `📅 Departure: ${opts.departureDate}`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔗 Book on Skyscanner", url: opts.skyscannerLink }],
    ],
  };

  const res = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: opts.chatId,
        text,
        parse_mode: "Markdown",
        reply_markup: keyboard,
      }),
    },
  );

  if (!res.ok) {
    const body = await res.text();
    console.error(`[price-scanner] Telegram sendMessage failed (${res.status}): ${body}`);
  } else {
    console.log(`[price-scanner] Telegram alert sent to chat ${opts.chatId}`);
  }
}

// ─── Email Dispatch (ZeptoMail) ───────────────────────────────────────────────

async function sendEmailAlert(opts: {
  email: string;
  originIata: string;
  destinationIata: string;
  currency: string;
  newPrice: number;
  targetPrice: number;
  departureDate: string;
  skyscannerLink: string;
}): Promise<void> {
  if (!ZEPTO_API_KEY) {
    console.warn("[price-scanner] ZEPTO_API_KEY not set — skipping email alert.");
    return;
  }

  const res = await fetch("https://api.zeptomail.com/v1.1/email", {
    method: "POST",
    headers: {
      Authorization: `Zoho-enczapikey ${ZEPTO_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: { address: "alerts@flytiq.app", name: "FlytIQ Alerts" },
      to: [{ email_address: { address: opts.email } }],
      subject: `✈️ Price Drop: ${opts.originIata} → ${opts.destinationIata} — ${opts.currency} ${opts.newPrice.toLocaleString()}`,
      htmlbody: `
        <h2>🚨 Price Drop Alert!</h2>
        <p>
          A fare you're tracking has dropped below your target price:
        </p>
        <ul>
          <li><strong>Route:</strong> ${opts.originIata} ✈️ ${opts.destinationIata}</li>
          <li><strong>New Fare:</strong> ${opts.currency} ${opts.newPrice.toLocaleString()}</li>
          <li><strong>Your Target:</strong> ${opts.currency} ${opts.targetPrice.toLocaleString()}</li>
          <li><strong>Departure:</strong> ${opts.departureDate}</li>
        </ul>
        <p>
          <a href="${opts.skyscannerLink}" style="background:#0770e3;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;display:inline-block;font-weight:bold;">
            Book on Skyscanner →
          </a>
        </p>
        <p style="font-size:12px;color:#888;">You're receiving this because you set a fare alert on FlytIQ. Visit FlytIQ to manage your alerts.</p>
      `,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    console.error(`[price-scanner] ZeptoMail send failed (${res.status}): ${body}`);
  } else {
    console.log(`[price-scanner] Email alert sent to ${opts.email}`);
  }
}

// ─── Main Handler ─────────────────────────────────────────────────────────────

Deno.serve(async (_req) => {
  console.log("[price-scanner] Starting price scan run...");

  // 1. Fetch all active price trackers
  const { data: trackers, error: trackersError } = await supabase
    .from("price_trackers")
    .select("*")
    .eq("is_active", true);

  if (trackersError) {
    console.error("[price-scanner] Failed to fetch trackers:", trackersError.message);
    return new Response(JSON.stringify({ error: trackersError.message }), { status: 500 });
  }

  if (!trackers || trackers.length === 0) {
    console.log("[price-scanner] No active trackers found.");
    return new Response(JSON.stringify({ scanned: 0, alerted: 0 }), { status: 200 });
  }

  console.log(`[price-scanner] Found ${trackers.length} active tracker(s).`);

  let alerted = 0;
  const deactivateIds: string[] = [];

  for (const record of trackers) {
    const routeKey = `${record.origin_iata}-${record.destination_iata}-${record.departure_date}`;

    // 2. Look up cached price for this route
    const { data: cache } = await supabase
      .from("flight_price_cache")
      .select("cheapest_price, skyscanner_link, currency")
      .eq("route_key", routeKey)
      .maybeSingle();

    if (!cache) {
      console.log(`[price-scanner] No cached price for route ${routeKey} — skipping.`);
      continue;
    }

    const cachedPrice = cache.cheapest_price;
    const targetPrice = record.target_price;

    // 3. Check if price condition is met
    if (targetPrice !== null && cachedPrice > targetPrice) {
      console.log(
        `[price-scanner] Route ${routeKey}: ${cachedPrice} > target ${targetPrice} — no alert.`,
      );
      continue;
    }

    const currency = record.currency ?? cache.currency ?? "USD";
    const skyscannerLink =
      cache.skyscanner_link ||
      buildSkyscannerLink(
        record.origin_iata,
        record.destination_iata,
        record.departure_date,
        currency,
      );

    const alertOpts = {
      originIata: record.origin_iata,
      destinationIata: record.destination_iata,
      currency,
      newPrice: cachedPrice,
      targetPrice: targetPrice ?? cachedPrice,
      departureDate: record.departure_date,
      skyscannerLink,
    };

    // 4a. Telegram alert
    if (record.telegram_chat_id) {
      await sendTelegramAlert({ chatId: record.telegram_chat_id, ...alertOpts });
      alerted++;
    }

    // 4b. Email alert
    if (record.email) {
      await sendEmailAlert({ email: record.email, ...alertOpts });
      alerted++;
    }

    // Queue this tracker for deactivation so we don't spam
    deactivateIds.push(record.id);
  }

  // 5. Deactivate fired trackers
  if (deactivateIds.length > 0) {
    const { error: deactivateError } = await supabase
      .from("price_trackers")
      .update({ is_active: false })
      .in("id", deactivateIds);

    if (deactivateError) {
      console.error(
        "[price-scanner] Failed to deactivate trackers:",
        deactivateError.message,
      );
    } else {
      console.log(`[price-scanner] Deactivated ${deactivateIds.length} fired tracker(s).`);
    }
  }

  console.log(`[price-scanner] Scan complete. Alerted: ${alerted}/${trackers.length}.`);

  return new Response(
    JSON.stringify({ scanned: trackers.length, alerted }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
});
