import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { SearchWidget } from "@/components/search-widget";
import { useCurrencyStore, useThemeStore } from "@/lib/store";
import { detectLocation } from "@/lib/geo.functions";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { TrendingDown, Globe, Bell, ShieldCheck } from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "FlightIQ — Smart Flight Tracking. Zero Markup." },
      {
        name: "description",
        content:
          "Find and track flights with real-time price drops, local currency support, and zero booking markup.",
      },
      { property: "og:title", content: "FlightIQ — Smart Flight Tracking" },
      {
        property: "og:description",
        content: "Find and track flights with price-drop alerts and local currency support.",
      },
      { property: "og:type", content: "website" },
    ],
  }),
  component: Index,
});

const FEATURES = [
  {
    icon: TrendingDown,
    title: "Price Drop Alerts",
    desc: "Get notified the moment fares drop below your target — via email or Telegram.",
  },
  {
    icon: Globe,
    title: "Local Currency",
    desc: "Prices auto-detect your location and display in your local currency.",
  },
  {
    icon: ShieldCheck,
    title: "Zero Markup",
    desc: "We never add fees. You book directly with the airline through Skyscanner.",
  },
];

function Index() {
  const { hydrate, setDetected } = useCurrencyStore();
  const { hydrate: hydrateTheme } = useThemeStore();

  useEffect(() => {
    hydrateTheme();
    hydrate();
    initAnalytics();
    trackPageView("/");

    detectLocation().then((geo) => {
      if (geo.country || geo.currency) {
        setDetected(geo);
      }
    });
  }, [hydrate, hydrateTheme, setDetected]);

  return (
    <div className="min-h-screen">
      <Navbar />

      <section className="relative overflow-hidden px-4 pb-20 pt-16 sm:px-6 sm:pt-24 lg:px-8">
        <div className="mx-auto max-w-5xl text-center">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-border bg-card/50 px-4 py-1.5 text-sm text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Live fare tracking across 30+ airports
          </div>

          <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-5xl lg:text-6xl">
            Smart Flight Tracking.
            <br />
            <span className="text-gradient-brand">Zero Markup.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Search flights, track price drops, and book directly with the airline. No hidden fees,
            no middleman — just the best fares in your local currency.
          </p>
        </div>

        <div className="mx-auto mt-10 max-w-3xl">
          <SearchWidget />
        </div>
      </section>

      <section className="px-4 pb-20 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-5xl grid-cols-1 gap-4 sm:grid-cols-3">
          {FEATURES.map((feature) => (
            <div key={feature.title} className="glass-panel rounded-xl p-5">
              <div className="mb-3 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
                <feature.icon className="h-5 w-5 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground">{feature.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{feature.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <footer className="border-t border-border px-4 py-8 text-center text-sm text-muted-foreground sm:px-6 lg:px-8">
        <p>
          FlightIQ — Flight discovery and price tracking. Fares are indicative and for comparison
          purposes.
        </p>
      </footer>
    </div>
  );
}
