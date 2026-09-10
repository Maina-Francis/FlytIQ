import { createFileRoute, useSearch } from "@tanstack/react-router";
import { useMemo, useState, useEffect } from "react";
import { Navbar } from "@/components/navbar";
import { FlightCard } from "@/components/flight-card";
import { AlertModal } from "@/components/alert-modal";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { generateOffers, formatDuration, type FlightOffer, type SearchParams } from "@/lib/flights";
import { useCurrencyStore, useThemeStore } from "@/lib/store";
import { initAnalytics, trackPageView } from "@/lib/analytics";
import { findAirport } from "@/lib/airports";
import { formatPrice, getCurrency } from "@/lib/currency";
import { ArrowLeft, Filter, SlidersHorizontal } from "lucide-react";
import { Link } from "@tanstack/react-router";

export const Route = createFileRoute("/search")({
  head: () => ({
    meta: [
      { title: "Search Results — FlightIQ" },
      {
        name: "description",
        content: "Compare flight fares and track price drops for your route.",
      },
    ],
  }),
  component: SearchPage,
});

type SearchQuery = {
  origin: string;
  destination: string;
  departureDate: string;
  returnDate?: string;
  tripType: "round" | "oneway";
  adults: number;
  cabin: SearchParams["cabin"];
};

const SORT_OPTIONS = [
  { value: "price", label: "Cheapest First" },
  { value: "duration", label: "Shortest Flight" },
  { value: "departure", label: "Earliest Departure" },
  { value: "drop", label: "Biggest Price Drop" },
] as const;

type SortValue = (typeof SORT_OPTIONS)[number]["value"];

function SearchPage() {
  const search = useSearch({ from: "/search" }) as SearchQuery;
  const { currency } = useCurrencyStore();
  const { hydrate: hydrateTheme } = useThemeStore();

  const searchParams: SearchParams = useMemo(
    () => ({
      origin: search.origin,
      destination: search.destination,
      departureDate: search.departureDate,
      returnDate: search.returnDate ?? null,
      tripType: search.tripType,
      adults: search.adults,
      cabin: search.cabin,
    }),
    [search],
  );

  const offers = useMemo(() => generateOffers(searchParams), [searchParams]);

  const [sortBy, setSortBy] = useState<SortValue>("price");
  const [maxStops, setMaxStops] = useState(2);
  const [selectedAirlines, setSelectedAirlines] = useState<Set<string>>(new Set());
  const [priceRange, setPriceRange] = useState<[number, number]>([0, 0]);
  const [showFilters, setShowFilters] = useState(false);
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertOffer, setAlertOffer] = useState<FlightOffer | null>(null);

  useEffect(() => {
    hydrateTheme();
    initAnalytics();
    trackPageView("/search");
  }, [hydrateTheme]);

  useEffect(() => {
    if (offers.length > 0) {
      const prices = offers.map((o) => o.priceUsd);
      const min = Math.floor(Math.min(...prices));
      const max = Math.ceil(Math.max(...prices));
      setPriceRange([min, max]);
      setSelectedAirlines(new Set());
      setMaxStops(2);
    }
  }, [offers]);

  const airlines = useMemo(() => {
    const set = new Map<string, string>();
    offers.forEach((o) => set.set(o.airlineCode, o.airline));
    return Array.from(set.entries());
  }, [offers]);

  const filtered = useMemo(() => {
    let result = offers.filter((o) => {
      if (o.stops > maxStops) return false;
      if (
        selectedAirlines.size > 0 &&
        !selectedAirlines.has(o.airlineCode)
      )
        return false;
      const convertedPrice = o.priceUsd * getCurrency(currency).rate;
      if (convertedPrice < priceRange[0] || convertedPrice > priceRange[1])
        return false;
      return true;
    });

    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "duration":
          return a.durationMinutes - b.durationMinutes;
        case "departure":
          return a.departTime.localeCompare(b.departTime);
        case "drop":
          return b.dropPercent - a.dropPercent;
        default:
          return a.priceUsd - b.priceUsd;
      }
    });

    return result;
  }, [offers, maxStops, selectedAirlines, priceRange, sortBy, currency]);

  const maxPrice = useMemo(() => {
    if (offers.length === 0) return 1000;
    return Math.ceil(Math.max(...offers.map((o) => o.priceUsd * getCurrency(currency).rate)));
  }, [offers, currency]);

  function toggleAirline(code: string) {
    setSelectedAirlines((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code);
      else next.add(code);
      return next;
    });
  }

  function handleTrackPrice(offer: FlightOffer) {
    setAlertOffer(offer);
    setAlertOpen(true);
  }

  const originAirport = findAirport(search.origin);
  const destAirport = findAirport(search.destination);

  return (
    <div className="min-h-screen">
      <Navbar />

      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button asChild variant="ghost" size="sm">
              <Link to="/">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Link>
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-lg font-bold text-foreground">
                {search.origin} → {search.destination}
              </h1>
              <p className="text-sm text-muted-foreground">
                {originAirport?.city} to {destAirport?.city} ·{" "}
                {search.adults} {search.adults === 1 ? "adult" : "adults"} ·{" "}
                {search.cabin}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="lg:hidden"
            onClick={() => setShowFilters((s) => !s)}
          >
            <Filter className="h-4 w-4" />
            Filters
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[260px_1fr]">
          <aside
            className={`${
              showFilters ? "block" : "hidden"
            } lg:block`}
          >
            <div className="glass-panel sticky top-20 rounded-xl p-5">
              <div className="mb-4 flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                <h2 className="text-sm font-semibold">Filters</h2>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Max Stops
                  </label>
                  <div className="mt-2 flex gap-2">
                    {[0, 1, 2].map((n) => (
                      <button
                        key={n}
                        onClick={() => setMaxStops(n)}
                        className={`flex-1 rounded-md border px-2 py-1.5 text-xs font-medium transition-colors ${
                          maxStops === n
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-input text-muted-foreground hover:bg-accent"
                        }`}
                      >
                        {n === 0 ? "Nonstop" : `${n}+`}
                      </button>
                    ))}
                  </div>
                </div>

                <Separator />

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Price Range ({currency})
                  </label>
                  <div className="mt-3">
                    <Slider
                      minStepsBetweenValues={1}
                      max={maxPrice}
                      step={Math.max(1, Math.floor(maxPrice / 100))}
                      value={priceRange}
                      onValueChange={(v) =>
                        setPriceRange([v[0] ?? 0, v[1] ?? maxPrice] as [number, number])
                      }
                    />
                    <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                      <span>
                        {getCurrency(currency).symbol}
                        {priceRange[0].toLocaleString()}
                      </span>
                      <span>
                        {getCurrency(currency).symbol}
                        {priceRange[1].toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                <Separator />

                <div>
                  <label className="text-xs font-medium text-muted-foreground">
                    Airlines
                  </label>
                  <div className="mt-2 space-y-2">
                    {airlines.map(([code, name]) => (
                      <label
                        key={code}
                        className="flex cursor-pointer items-center gap-2 text-sm"
                      >
                        <Checkbox
                          checked={selectedAirlines.has(code)}
                          onCheckedChange={() => toggleAirline(code)}
                        />
                        <span className="font-medium">{code}</span>
                        <span className="text-muted-foreground">{name}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </aside>

          <div>
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "flight" : "flights"}{" "}
                found
              </p>
              <Select
                value={sortBy}
                onValueChange={(v) => setSortBy(v as SortValue)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SORT_OPTIONS.map((opt) => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="glass-panel rounded-xl p-8 text-center">
                  <p className="text-muted-foreground">
                    No flights match your filters. Try adjusting them.
                  </p>
                </div>
              ) : (
                filtered.map((offer) => (
                  <FlightCard
                    key={offer.id}
                    offer={offer}
                    searchParams={searchParams}
                    currency={currency}
                    onTrackPrice={handleTrackPrice}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </div>

      {alertOffer && (
        <AlertModal
          open={alertOpen}
          onOpenChange={setAlertOpen}
          origin={search.origin}
          destination={search.destination}
          currency={currency}
          currentPriceUsd={alertOffer.priceUsd}
        />
      )}
    </div>
  );
}
