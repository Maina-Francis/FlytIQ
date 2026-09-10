import { useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { format, addDays } from "date-fns";
import { ArrowLeftRight, Calendar, Search, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar as CalendarComponent } from "@/components/ui/calendar";
import { AirportAutocomplete } from "@/components/airport-autocomplete";
import { cn } from "@/lib/utils";
import { trackFlightSearch } from "@/lib/analytics";
import { useCurrencyStore } from "@/lib/store";
import type { SearchParams } from "@/lib/flights";
import { toast } from "sonner";

const TRIP_TYPES: { value: "round" | "oneway"; label: string }[] = [
  { value: "round", label: "Round Trip" },
  { value: "oneway", label: "One Way" },
];

const CABINS: { value: SearchParams["cabin"]; label: string }[] = [
  { value: "economy", label: "Economy" },
  { value: "premium", label: "Premium" },
  { value: "business", label: "Business" },
  { value: "first", label: "First" },
];

export function SearchWidget() {
  const navigate = useNavigate();
  const { currency } = useCurrencyStore();

  const [tripType, setTripType] = useState<"round" | "oneway">("round");
  const [origin, setOrigin] = useState("");
  const [destination, setDestination] = useState("");
  const [departureDate, setDepartureDate] = useState(
    format(addDays(new Date(), 1), "yyyy-MM-dd"),
  );
  const [returnDate, setReturnDate] = useState(
    format(addDays(new Date(), 8), "yyyy-MM-dd"),
  );
  const [adults, setAdults] = useState(1);
  const [cabin, setCabin] = useState<SearchParams["cabin"]>("economy");
  const [departCalOpen, setDepartCalOpen] = useState(false);
  const [returnCalOpen, setReturnCalOpen] = useState(false);

  function handleSearch() {
    if (!origin || !destination) {
      toast.error("Please select both origin and destination airports.");
      return;
    }
    if (origin === destination) {
      toast.error("Origin and destination cannot be the same.");
      return;
    }
    if (!departureDate) {
      toast.error("Please select a departure date.");
      return;
    }
    if (tripType === "round" && !returnDate) {
      toast.error("Please select a return date.");
      return;
    }

    trackFlightSearch({
      origin,
      destination,
      departure_date: departureDate,
      currency,
    });

    navigate({
      to: "/search",
      search: {
        origin,
        destination,
        departureDate,
        returnDate: tripType === "round" ? returnDate : undefined,
        tripType,
        adults,
        cabin,
      },
    });
  }

  function swapAirports() {
    setOrigin(destination);
    setDestination(origin);
  }

  return (
    <div className="glass-panel rounded-2xl p-5 sm:p-6">
      <div className="mb-5 flex gap-2">
        {TRIP_TYPES.map((tt) => (
          <button
            key={tt.value}
            onClick={() => setTripType(tt.value)}
            className={cn(
              "rounded-full px-4 py-1.5 text-sm font-medium transition-all",
              tripType === tt.value
                ? "bg-primary text-primary-foreground shadow-md"
                : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
            )}
          >
            {tt.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-[1fr_auto_1fr]">
        <AirportAutocomplete
          value={origin}
          onChange={setOrigin}
          label="From"
          placeholder="Origin city or airport"
        />

        <div className="flex items-end justify-center pb-1">
          <button
            onClick={swapAirports}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-input bg-background transition-colors hover:bg-accent"
            aria-label="Swap origin and destination"
          >
            <ArrowLeftRight className="h-4 w-4" />
          </button>
        </div>

        <AirportAutocomplete
          value={destination}
          onChange={setDestination}
          label="To"
          placeholder="Destination city or airport"
        />
      </div>

      <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Departure
          </label>
          <Popover open={departCalOpen} onOpenChange={setDepartCalOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                className="h-11 w-full justify-start gap-2 font-normal"
              >
                <Calendar className="h-4 w-4 text-muted-foreground" />
                {departureDate
                  ? format(new Date(departureDate), "MMM d, yyyy")
                  : "Select date"}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <CalendarComponent
                mode="single"
                selected={
                  departureDate ? new Date(departureDate) : undefined
                }
                onSelect={(date) => {
                  if (date) {
                    setDepartureDate(format(date, "yyyy-MM-dd"));
                    setDepartCalOpen(false);
                  }
                }}
                disabled={{ before: new Date() }}
              />
            </PopoverContent>
          </Popover>
        </div>

        {tripType === "round" && (
          <div>
            <label className="mb-1 block text-xs font-medium text-muted-foreground">
              Return
            </label>
            <Popover open={returnCalOpen} onOpenChange={setReturnCalOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className="h-11 w-full justify-start gap-2 font-normal"
                >
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  {returnDate
                    ? format(new Date(returnDate), "MMM d, yyyy")
                    : "Select date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <CalendarComponent
                  mode="single"
                  selected={returnDate ? new Date(returnDate) : undefined}
                  onSelect={(date) => {
                    if (date) {
                      setReturnDate(format(date, "yyyy-MM-dd"));
                      setReturnCalOpen(false);
                    }
                  }}
                  disabled={{
                    before: departureDate
                      ? new Date(departureDate)
                      : new Date(),
                  }}
                />
              </PopoverContent>
            </Popover>
          </div>
        )}

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Passengers
          </label>
          <Select
            value={String(adults)}
            onValueChange={(v) => setAdults(Number(v))}
          >
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 4, 5, 6].map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n} {n === 1 ? "Adult" : "Adults"}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-muted-foreground">
            Cabin
          </label>
          <Select value={cabin} onValueChange={(v) => setCabin(v as SearchParams["cabin"])}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CABINS.map((c) => (
                <SelectItem key={c.value} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Button
        onClick={handleSearch}
        size="lg"
        className="glow-cta mt-4 w-full text-base"
      >
        <Search className="h-5 w-5" />
        Search Flights
      </Button>
    </div>
  );
}
