import { useState, useRef, useEffect } from "react";
import { searchAirports, type Airport } from "@/lib/airports";
import { cn } from "@/lib/utils";
import { Plane, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (iata: string) => void;
  placeholder?: string;
  label?: string;
};

export function AirportAutocomplete({
  value,
  onChange,
  placeholder = "Search city or airport",
  label,
}: Props) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<Airport[]>([]);
  const [highlight, setHighlight] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setResults(searchAirports(query, 8));
      setHighlight(0);
    }
  }, [query, open]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function selectAirport(airport: Airport) {
    onChange(airport.iata);
    setQuery("");
    setOpen(false);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        setOpen(true);
        return;
      }
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter" && results[highlight]) {
      e.preventDefault();
      selectAirport(results[highlight]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {label && (
        <label className="mb-1 block text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      {value ? (
        <div className="flex h-11 items-center justify-between rounded-lg border border-input bg-transparent px-3">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-primary/15 px-2 py-0.5 text-sm font-bold text-primary">
              {value}
            </span>
            <span className="text-sm text-muted-foreground">
              {searchAirports(value, 1)[0]?.city ?? ""}
            </span>
          </div>
          <button
            onClick={() => {
              onChange("");
              setOpen(true);
            }}
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <input
          type="text"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="flex h-11 w-full rounded-lg border border-input bg-transparent px-3 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
        />
      )}
      {open && !value && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-72 overflow-y-auto rounded-lg border bg-popover p-1 shadow-lg">
          {results.length === 0 ? (
            <div className="px-3 py-4 text-center text-sm text-muted-foreground">
              No airports found
            </div>
          ) : (
            results.map((airport, i) => (
              <button
                key={airport.iata}
                onMouseDown={(e) => {
                  e.preventDefault();
                  selectAirport(airport);
                }}
                onMouseEnter={() => setHighlight(i)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left text-sm transition-colors",
                  i === highlight && "bg-accent",
                )}
              >
                <Plane className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <span className="w-10 font-bold text-primary">
                  {airport.iata}
                </span>
                <span className="flex-1">
                  <span className="font-medium">{airport.city}</span>
                  <span className="ml-1.5 text-muted-foreground">
                    {airport.country}
                  </span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
