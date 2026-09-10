# FlightIQ

# FlightIQ (flightiq.app) – System Architecture & Product Requirements Document

## Executive Summary & Full Technology Stack

FlightIQ operates on a zero-friction, free-to-use affiliate monetization model. It monetizes user intent via Skyscanner referral links managed on Impact.com, earning Cost-Per-Click (CPC) and Cost-Per-Acquisition (CPA) commissions without paywalls.

### Core Engineering Tech Stack
* **Frontend Web App:** Next.js (App Router, SSR, Client Components) + Tailwind CSS + Shadcn UI + Zustand (Global Currency/Search State).
* **Backend API Server:** Express.js (Node.js) handling route caching, geolocation lookup, and affiliate link engine.
* **Database & Auth:** Supabase (PostgreSQL with Row Level Security, Realtime Subscriptions).
* **Geolocation & Currency:** IP Geolocation API (`ipapi.co` / `ipinfo.io`) fallback logic + Zustand LocalStorage/Cookie persistence.
* **Transactional Email:** ZeptoMail API (Zoho) for low-latency HTML price drop alerts.
* **Chat Ecosystem:** Telegram Bot API (`@FlightIQBot`) running webhooks.
* **Affiliate Management:** Impact.com API / Skyscanner Partner Deeplinks (`mediaPartnerId`).
* **Analytics & Tracking:** Google Analytics 4 (`@next/third-parties/google`) with custom conversion events.

---

## 2. Geolocation, Currency & Analytics Specification

### 2.1 IP Geolocation & Local Currency Middleware
1. **Client IP Detection:** Express.js backend intercepts the incoming request header (`x-forwarded-for` or `cf-connecting-ip`).
2. **Location Lookup:** Queries IP metadata to fetch ISO Country Code and default national currency (e.g., `KE` -> `KES`, `US` -> `USD`, `GB` -> `GBP`, `EU` -> `EUR`).
3. **State Persistence & Navbar Override:**
   * If a user selects a currency in the top navbar dropdown, set cookie `flightiq_currency` and update Zustand state.
   * Local Storage / Cookie values strictly override IP geolocation detection.
   * All flight cards automatically re-render prices based on the globally active currency code.

### 2.2 Google Analytics 4 (GA4) Event Engine

| Event Name | Trigger Condition | Payload Parameters |
| :--- | :--- | :--- |
| `flight_search` | User submits flight search query | `origin`, `destination`, `departure_date`, `currency` |
| `currency_changed` | User manually overrides navbar dropdown | `from_currency`, `to_currency`, `detected_country` |
| `affiliate_click` | User clicks "Select Deal" on flight card | `airline`, `price`, `currency`, `skyscanner_deep_link` |
| `price_alert_created` | User submits email/Telegram alert modal | `route`, `target_price`, `channel` (email/telegram) |

---

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/746487fb-dcd9-4a62-a870-4b571ce87038).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
