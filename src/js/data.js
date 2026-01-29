// ========================================
// HARDCODED DATA
// Will be replaced by API data when USE_TABLE_STORAGE is enabled
// ========================================

export const PRODUCTION_TRAVELERS = [
  { id: "seth", name: "Seth", group: "guys", color: "#4a90d9", initials: "S" },
  { id: "katrina", name: "Katrina", group: "girls", color: "#d94a8c", initials: "K" },
  { id: "paul", name: "Paul", group: "guys", color: "#4a90d9", initials: "P" },
  { id: "sheri", name: "Sheri", group: "girls", color: "#d94a8c", initials: "F" }
];

export const PRODUCTION_HOTEL = {
  name: "Fresh Hotel Athens",
  address: "26 Sofokleous & Klisthenous Street",
  neighborhood: "Near Omonia Square",
  website: "https://www.freshhotel.gr",
  mapsLink: "https://maps.google.com/?q=Fresh+Hotel+Athens",
  checkIn: "2026-02-02",
  checkOut: "2026-02-06",
  nights: 4,
  highlights: "Rooftop pool with Acropolis views, Design Hotels member"
};

export const DESTINATIONS = {
  CMH: { name: "Columbus", city: "Columbus", country: "USA", timezone: "America/New_York", utcOffset: -5, lat: 39.9612, lon: -82.9988 },
  EWR: { name: "Newark", city: "Newark", country: "USA", timezone: "America/New_York", utcOffset: -5, lat: 40.6895, lon: -74.1745 },
  ATH: { name: "Athens", city: "Athens", country: "Greece", timezone: "Europe/Athens", utcOffset: 2, info: "Ancient history meets modern energy", lat: 37.9838, lon: 23.7275 },
  DXB: { name: "Dubai", city: "Dubai", country: "UAE", timezone: "Asia/Dubai", utcOffset: 4, lat: 25.2532, lon: 55.3657 },
  BLR: { name: "Bangalore", city: "Bengaluru", country: "India", timezone: "Asia/Kolkata", utcOffset: 5.5, info: "Garden City of India", lat: 12.9716, lon: 77.5946 }
};

export const CAROUSELS = {
  'leela-palace': {
    images: [
      { url: 'https://www.theleela.com/prod/content/assets/aio-banner/dekstop/The-Leela-Palace-Bengaluru-hero-image_0.webp', caption: 'The Leela Palace Bengaluru' },
      { url: 'https://www.theleela.com/prod/content/assets/aio-banner/dekstop/The-Leela-Palace-Bengaluru-port-cochere_0.webp', caption: 'Grand Entrance' }
    ]
  },
  'fresh-hotel': {
    images: [
      { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', caption: 'Rooftop Pool' },
      { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80', caption: 'Modern Design' }
    ]
  }
};

export const PRODUCTION_PHASES = {
  'together': { label: 'Together in Athens', dates: 'Feb 1-5', startDate: '2026-02-01', endDate: '2026-02-05', icon: '🇬🇷' },
  'diverge': { label: 'Paths Diverge', dates: 'Feb 6', startDate: '2026-02-06', endDate: '2026-02-06', icon: '✈️' },
  'india': { label: 'India Adventure', dates: 'Feb 7-12', startDate: '2026-02-07', endDate: '2026-02-12', icon: '🇮🇳' }
};

export const TEST_PHASES = {
  'test': { label: 'Test Phase', dates: 'Jan 1-3', startDate: '2025-01-01', endDate: '2025-01-03', icon: '🧪' }
};

export const TEST_TRIP_DATA = {
  travelers: [
    { id: "tester1", name: "Tester 1", group: "guys", color: "#4a90d9", initials: "T1" },
    { id: "tester2", name: "Tester 2", group: "girls", color: "#d94a8c", initials: "T2" }
  ],
  hotel: {
    name: "Test Hotel",
    address: "123 Test Street",
    neighborhood: "Test Town",
    website: "https://example.com",
    mapsLink: "https://maps.google.com",
    checkIn: "2025-01-01",
    checkOut: "2025-01-03",
    nights: 2,
    highlights: "Testing features"
  },
  days: [
    {
      date: "2025-01-01",
      dayNum: 1,
      label: "Wed, Jan 1",
      location: "TEST",
      theme: "Test Day 1",
      destination: "test",
      events: [
        { id: "test-1", time: "09:00", type: "activity", title: "Test Event 1", travelers: ["all"], status: "confirmed" },
        { id: "test-2", time: "12:00", type: "meal", title: "Test Lunch", travelers: ["all"], status: "confirmed" }
      ]
    }
  ]
};

// Production days - abbreviated for module size
// Full data will be loaded from API when USE_TABLE_STORAGE is enabled
export const PRODUCTION_DAYS = [
  {
    date: "2026-02-01", dayNum: 1, label: "Sun, Feb 1", location: "CMH", theme: "Departure Day", destination: "travel",
    events: [
      { id: "lounge-cmh", time: "15:00", endTime: "16:00", type: "activity", title: "Escape Lounge", subtitle: "Concourse B, Gate 32B", travelers: ["all"], status: "confirmed", where: "CMH Airport", badges: ["lounge"] },
      { id: "f1", time: "16:27", type: "flight", title: "CMH → EWR", subtitle: "United UA3675 • 1h 53m", travelers: ["all"], status: "confirmed", flightCode: "UA3675", airline: "united", from: "CMH", to: "EWR", miles: 462 },
      { id: "f2", time: "23:55", type: "flight", title: "EWR → ATH", subtitle: "Emirates EK210 • 9h 10m", travelers: ["all"], status: "confirmed", flightCode: "EK210", airline: "emirates", from: "EWR", to: "ATH", miles: 4927 }
    ]
  },
  {
    date: "2026-02-02", dayNum: 2, label: "Mon, Feb 2", location: "ATH", theme: "Athens Arrival", destination: "athens",
    events: [
      { id: "f2-arrive", time: "16:05", type: "flight", title: "Arrive Athens", travelers: ["all"], status: "confirmed", from: "EWR", to: "ATH" },
      { id: "hotel-checkin", time: "18:00", type: "hotel", title: "Fresh Hotel Check-in", subtitle: "Near Omonia Square", travelers: ["all"], status: "confirmed", carousel: "fresh-hotel" }
    ]
  },
  {
    date: "2026-02-03", dayNum: 3, label: "Tue, Feb 3", location: "ATH", theme: "Acropolis Day", destination: "athens",
    estimatedSteps: 15000,
    events: [
      { id: "breakfast-day3", time: "09:00", type: "meal", title: "Hotel Breakfast", travelers: ["all"], status: "confirmed" },
      { id: "acropolis-tour", time: "10:30", endTime: "14:00", type: "activity", title: "Acropolis & Museum", subtitle: "Skip-the-line guided tour", travelers: ["all"], status: "confirmed", walkingSteps: 8000 }
    ]
  }
  // Additional days loaded from API
];
