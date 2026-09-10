export type Airport = {
  iata: string;
  city: string;
  name: string;
  country: string;
};

export const AIRPORTS: Airport[] = [
  { iata: "NBO", city: "Nairobi", name: "Jomo Kenyatta International", country: "Kenya" },
  { iata: "MBA", city: "Mombasa", name: "Moi International", country: "Kenya" },
  { iata: "KIS", city: "Kisumu", name: "Kisumu International", country: "Kenya" },
  { iata: "CPT", city: "Cape Town", name: "Cape Town International", country: "South Africa" },
  { iata: "JNB", city: "Johannesburg", name: "O. R. Tambo International", country: "South Africa" },
  { iata: "LHR", city: "London", name: "Heathrow", country: "United Kingdom" },
  { iata: "LGW", city: "London", name: "Gatwick", country: "United Kingdom" },
  { iata: "CDG", city: "Paris", name: "Charles de Gaulle", country: "France" },
  { iata: "AMS", city: "Amsterdam", name: "Schiphol", country: "Netherlands" },
  { iata: "FRA", city: "Frankfurt", name: "Frankfurt am Main", country: "Germany" },
  { iata: "IST", city: "Istanbul", name: "Istanbul Airport", country: "Türkiye" },
  { iata: "DXB", city: "Dubai", name: "Dubai International", country: "UAE" },
  { iata: "DOH", city: "Doha", name: "Hamad International", country: "Qatar" },
  { iata: "ADD", city: "Addis Ababa", name: "Bole International", country: "Ethiopia" },
  { iata: "LOS", city: "Lagos", name: "Murtala Muhammed", country: "Nigeria" },
  { iata: "ACC", city: "Accra", name: "Kotoka International", country: "Ghana" },
  { iata: "CAI", city: "Cairo", name: "Cairo International", country: "Egypt" },
  { iata: "JFK", city: "New York", name: "John F. Kennedy International", country: "United States" },
  { iata: "EWR", city: "New York", name: "Newark Liberty", country: "United States" },
  { iata: "LAX", city: "Los Angeles", name: "Los Angeles International", country: "United States" },
  { iata: "ORD", city: "Chicago", name: "O'Hare International", country: "United States" },
  { iata: "YYZ", city: "Toronto", name: "Pearson International", country: "Canada" },
  { iata: "BOM", city: "Mumbai", name: "Chhatrapati Shivaji Maharaj", country: "India" },
  { iata: "DEL", city: "Delhi", name: "Indira Gandhi International", country: "India" },
  { iata: "SIN", city: "Singapore", name: "Changi", country: "Singapore" },
  { iata: "HKG", city: "Hong Kong", name: "Hong Kong International", country: "Hong Kong" },
  { iata: "NRT", city: "Tokyo", name: "Narita International", country: "Japan" },
  { iata: "SYD", city: "Sydney", name: "Kingsford Smith", country: "Australia" },
  { iata: "GRU", city: "São Paulo", name: "Guarulhos International", country: "Brazil" },
  { iata: "MAD", city: "Madrid", name: "Adolfo Suárez Barajas", country: "Spain" },
];

export function findAirport(iata: string): Airport | undefined {
  return AIRPORTS.find((a) => a.iata === iata.toUpperCase());
}

export function searchAirports(query: string, limit = 6): Airport[] {
  const q = query.trim().toLowerCase();
  if (!q) return AIRPORTS.slice(0, limit);
  return AIRPORTS.filter(
    (a) =>
      a.iata.toLowerCase().includes(q) ||
      a.city.toLowerCase().includes(q) ||
      a.name.toLowerCase().includes(q) ||
      a.country.toLowerCase().includes(q),
  ).slice(0, limit);
}
