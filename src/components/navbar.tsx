import { Link } from "@tanstack/react-router";
import { Plane, Sun, Moon, ChevronDown, MapPin, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
  TooltipProvider,
} from "@/components/ui/tooltip";
import { useCurrencyStore, useThemeStore } from "@/lib/store";
import { CURRENCIES } from "@/lib/currency";
import { trackCurrencyChanged } from "@/lib/analytics";
import { cn } from "@/lib/utils";

export function Navbar() {
  const { currency, detectedCountry, detectedCity, setCurrency } =
    useCurrencyStore();
  const { theme, toggle } = useThemeStore();

  const detectedLabel =
    detectedCity && detectedCountry
      ? `${detectedCity}, ${detectedCountry}`
      : detectedCountry
        ? detectedCountry
        : null;

  return (
    <header className="sticky top-0 z-40 w-full">
      <div className="glass-panel mx-auto flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link to="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent shadow-md">
            <Plane className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight text-gradient-brand">
            FlightIQ
          </span>
        </Link>

        <div className="flex items-center gap-1.5 sm:gap-3">
          <TooltipProvider delayDuration={200}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5 px-2 sm:px-3"
                    >
                      <span className="text-base leading-none">
                        {CURRENCIES[currency]?.flag}
                      </span>
                      <span className="hidden text-sm font-semibold sm:inline">
                        {currency}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent
                    align="end"
                    className="w-64 p-2"
                  >
                    <div className="mb-2 flex items-center gap-1.5 px-2 py-1 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {detectedLabel
                        ? `Detected: ${detectedLabel}`
                        : "Click to change currency"}
                    </div>
                    <div className="max-h-64 overflow-y-auto">
                      {Object.values(CURRENCIES).map((c) => (
                        <button
                          key={c.code}
                          onClick={() => {
                            const change = setCurrency(c.code);
                            trackCurrencyChanged({
                              from_currency: change.from,
                              to_currency: change.to,
                              detected_country: change.detectedCountry,
                            });
                          }}
                          className={cn(
                            "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                            c.code === currency && "bg-accent/50 font-medium",
                          )}
                        >
                          <span className="text-base">{c.flag}</span>
                          <span className="font-semibold">{c.code}</span>
                          <span className="text-muted-foreground">
                            {c.label}
                          </span>
                          <span className="ml-auto text-muted-foreground">
                            {c.symbol}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </TooltipTrigger>
              <TooltipContent>
                {detectedLabel
                  ? `Detected location: ${detectedLabel} — Click to change`
                  : "Click to change currency"}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>

          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            aria-label="Toggle theme"
          >
            {theme === "dark" ? (
              <Sun className="h-4 w-4" />
            ) : (
              <Moon className="h-4 w-4" />
            )}
          </Button>

          <Button asChild variant="outline" size="sm" className="gap-1.5">
            <Link to="/deals">
              <Bell className="h-4 w-4" />
              <span className="hidden sm:inline">My Tracked Deals</span>
            </Link>
          </Button>
        </div>
      </div>
    </header>
  );
}
