import { TrendingDown, Sparkles, ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatPrice, getCurrency } from "@/lib/currency";
import { formatDuration, type FlightOffer, type SearchParams } from "@/lib/flights";
import { buildSkyscannerDeepLink } from "@/lib/affiliate";
import { trackAffiliateClick } from "@/lib/analytics";
import { cn } from "@/lib/utils";

type Props = {
  offer: FlightOffer;
  searchParams: SearchParams;
  currency: string;
  onTrackPrice: (offer: FlightOffer) => void;
};

export function FlightCard({ offer, searchParams, currency, onTrackPrice }: Props) {
  function handleSelectDeal() {
    const deepLink = buildSkyscannerDeepLink({
      origin: offer.origin,
      destination: offer.destination,
      departureDate: searchParams.departureDate,
      returnDate: searchParams.returnDate,
      adults: searchParams.adults,
      cabin: searchParams.cabin,
      currency,
    });
    trackAffiliateClick({
      airline: offer.airline,
      price: offer.priceUsd,
      currency,
      skyscanner_deep_link: deepLink,
    });
    window.open(deepLink, "_blank", "noopener,noreferrer");
  }

  const stopsLabel =
    offer.stops === 0 ? "Nonstop" : offer.stops === 1 ? "1 Stop" : `${offer.stops} Stops`;

  return (
    <div className="glass-panel group rounded-xl p-4 transition-all hover:shadow-lg sm:p-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
            {offer.airlineCode}
          </div>
          <div>
            <p className="font-semibold text-foreground">{offer.airline}</p>
            <p className="text-xs text-muted-foreground">{stopsLabel}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {offer.dropPercent > 0 && (
            <Badge className="gap-1 bg-success/15 text-success hover:bg-success/20">
              <TrendingDown className="h-3 w-3" />
              {offer.dropPercent}% Drop
            </Badge>
          )}
          {offer.bestLocalFare && (
            <Badge className="gap-1 bg-accent/15 text-accent hover:bg-accent/20">
              <Sparkles className="h-3 w-3" />
              Best Local Fare
            </Badge>
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{offer.departTime}</p>
          <p className="text-sm font-medium text-primary">{offer.origin}</p>
        </div>

        <div className="flex flex-1 flex-col items-center">
          <p className="text-xs text-muted-foreground">{formatDuration(offer.durationMinutes)}</p>
          <div className="relative my-1 h-px w-full bg-border">
            <div className="absolute left-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-muted-foreground" />
            <div className="absolute right-0 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground">{stopsLabel}</p>
        </div>

        <div className="text-center">
          <p className="text-lg font-bold text-foreground">{offer.arriveTime}</p>
          <p className="text-sm font-medium text-primary">{offer.destination}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          {offer.dropPercent > 0 && (
            <p className="text-sm text-muted-foreground line-through">
              {formatPrice(offer.baselineUsd, currency)}
            </p>
          )}
          <p className="text-2xl font-bold text-foreground">
            {formatPrice(offer.priceUsd, currency)}
          </p>
          <p className="text-xs text-muted-foreground">
            per passenger · {getCurrency(currency).code}
          </p>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onTrackPrice(offer)}
            className="gap-1.5"
          >
            <Bell className="h-3.5 w-3.5" />
            Track
          </Button>
          <Button onClick={handleSelectDeal} size="sm" className={cn("glow-cta gap-1.5")}>
            Select Deal
            <ArrowRight className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
