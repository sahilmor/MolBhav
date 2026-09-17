export interface VendorPersona {
  id: string;
  name: string;
  gender: "Male" | "Female";
  ageBand: "young" | "middle-aged" | "elder";
  personality: string;
}

export interface MarketItem {
  id: string;
  name: string;
  askingPrice: number;
}

export interface Market {
  id: string;
  name: string;
  city: string;
  lat: number;
  lon: number;
  items: MarketItem[];
  vendors: VendorPersona[];
}

export const MARKETS: Market[] = [
  {
    id: "sarojini",
    name: "Sarojini Nagar Market",
    city: "Delhi",
    lat: 28.61,
    lon: 77.21,
    items: [
      { id: "jacket", name: "Leather Jacket", askingPrice: 2000 },
      { id: "kurti", name: "Printed Kurti", askingPrice: 800 },
    ],
    vendors: [
      { id: "ramesh", name: "Ramesh Bhai", gender: "Male", ageBand: "middle-aged", personality: "loud, theatrical, loves haggling as a sport" },
      { id: "sunita", name: "Sunita Didi", gender: "Female", ageBand: "young", personality: "sharp-tongued, quick comebacks, warm once a deal is close" },
    ],
  },
  {
    id: "colaba",
    name: "Colaba Causeway",
    city: "Mumbai",
    lat: 19.08,
    lon: 72.88,
    items: [
      { id: "sunglasses", name: "Designer-style Sunglasses", askingPrice: 1200 },
      { id: "bag", name: "Canvas Tote Bag", askingPrice: 600 },
    ],
    vendors: [
      { id: "irfan", name: "Irfan Bhai", gender: "Male", ageBand: "elder", personality: "calm, slow talker, uses guilt-trips about his family" },
      { id: "priya", name: "Priya Tai", gender: "Female", ageBand: "middle-aged", personality: "friendly but firm, quotes 'fixed price' often before folding" },
    ],
  },
  {
    id: "banjara",
    name: "Banjara Market",
    city: "Hyderabad",
    lat: 17.39,
    lon: 78.49,
    items: [
      { id: "bangles", name: "Lac Bangles Set", askingPrice: 500 },
      { id: "shawl", name: "Pashmina-style Shawl", askingPrice: 1500 },
    ],
    vendors: [
      { id: "abdul", name: "Abdul Chacha", gender: "Male", ageBand: "elder", personality: "storyteller, brings up his 'best customer ever' to flatter you" },
      { id: "fatima", name: "Fatima Baji", gender: "Female", ageBand: "young", personality: "playful, teases lowballers, quick to laugh" },
    ],
  },
];

export const CITY_TO_MARKET: Record<string, string> = {
  "delhi": "sarojini",
  "new delhi": "sarojini",
  "mumbai": "colaba",
  "bombay": "colaba",
  "hyderabad": "banjara",
};
