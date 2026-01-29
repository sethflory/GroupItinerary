const {
  TABLES,
  ensureTable,
  upsertEntity,
  batchUpsert
} = require("../shared/tableStorage");
const {
  getHeaders,
  handleOptions,
  sendError,
  sendSuccess
} = require("../shared/validation");

// =============================================
// HARDCODED DATA FROM src/index.html
// This is the single source of truth for migration
// =============================================

const TRIPS = {
  'athens-bangalore-2026': {
    id: 'athens-bangalore-2026',
    name: 'Athens & Bangalore 2026',
    subtitle: 'Our Journey',
    dates: 'February 1 - 12, 2026',
    description: 'Athens together, then S&P continue to India',
    icon: '🇬🇷',
    badge: 'production',
    photoPrefix: '',
    startDate: '2026-02-01T16:27:00-05:00',
    endDate: '2026-02-12T23:59:00-05:00'
  },
  'test-trip': {
    id: 'test-trip',
    name: 'Test Trip',
    subtitle: 'Development Testing',
    dates: 'Jan 1 - 3, 2025',
    description: 'For testing features without affecting real trip',
    icon: '🧪',
    badge: 'test',
    photoPrefix: 'test-',
    startDate: '2025-01-01T09:00:00-05:00',
    endDate: '2025-01-03T23:59:00-05:00'
  }
};

const PRODUCTION_TRAVELERS = [
  { id: "seth", name: "Seth", group: "guys", color: "#4a90d9", initials: "F", accessCode: "seth2026" },
  { id: "katrina", name: "Katrina", group: "girls", color: "#d94a8c", initials: "K", accessCode: "kat2026" },
  { id: "paul", name: "Paul", group: "guys", color: "#4a90d9", initials: "P", accessCode: "paul2026" },
  { id: "sheri", name: "Sheri", group: "girls", color: "#d94a8c", initials: "S", accessCode: "sheri2026" }
];

const TEST_TRAVELERS = [
  { id: "tester1", name: "Tester 1", group: "guys", color: "#4a90d9", initials: "T1", accessCode: "test1" },
  { id: "tester2", name: "Tester 2", group: "girls", color: "#d94a8c", initials: "T2", accessCode: "test2" }
];

const PRODUCTION_HOTEL = {
  id: "fresh-hotel",
  name: "The Fresh Hotel",
  address: "26 Sophocleous & Klisthenous Street, Athens 10552",
  neighborhood: "Near Omonia Square, 8-min walk to Monastiraki",
  website: "https://freshhotel.gr/",
  mapsLink: "https://maps.google.com/?q=Fresh+Hotel+Athens",
  checkIn: "2026-02-02",
  checkOut: "2026-02-07",
  nights: 5,
  highlights: "Rooftop pool with Acropolis views, Air Lounge Bar-Restaurant, Design Hotels member"
};

const TEST_HOTEL = {
  id: "test-hotel",
  name: "Test Hotel",
  address: "123 Test Street",
  neighborhood: "Test Town",
  website: "https://example.com",
  mapsLink: "https://maps.google.com",
  checkIn: "2025-01-01",
  checkOut: "2025-01-03",
  nights: 2,
  highlights: "Testing features"
};

const DESTINATIONS = {
  "CMH": { name: "John Glenn Columbus", city: "Columbus", country: "USA", timezone: "America/New_York", utcOffset: -5, info: "Home base", lounge: "Escape Lounge - Concourse B, Gate 32B (Priority Pass, 5AM-8PM)", lat: 39.998, lon: -82.892 },
  "EWR": { name: "Newark Liberty", city: "Newark", country: "USA", timezone: "America/New_York", utcOffset: -5, info: "Gateway to the world", loungeB: "Virgin Atlantic Clubhouse / Art & Lounge - Terminal B", loungeC: "United Club - Terminal C", lat: 40.693, lon: -74.174 },
  "ATH": { name: "Athens International", city: "Athens", country: "Greece", timezone: "Europe/Athens", utcOffset: 2, info: "Birthplace of democracy, ancient ruins, Mediterranean charm. The Acropolis awaits!", localTip: "Try a freddo espresso - it's life-changing.", lat: 37.936, lon: 23.945 },
  "DXB": { name: "Dubai International", city: "Dubai", country: "UAE", timezone: "Asia/Dubai", utcOffset: 4, info: "Futuristic desert metropolis. Quick layover hub.", lat: 25.253, lon: 55.366 },
  "ORD": { name: "O'Hare International", city: "Chicago", country: "USA", timezone: "America/Chicago", utcOffset: -6, info: "Windy City connection", lat: 41.978, lon: -87.904 },
  "BLR": { name: "Kempegowda International", city: "Bangalore", country: "India", timezone: "Asia/Kolkata", utcOffset: 5.5, info: "India's tech hub meets garden city. Amazing food, vibrant culture, perfect weather.", localTip: "Don't miss the filter coffee and masala dosa.", lat: 13.199, lon: 77.706 }
};

const PRODUCTION_PHASES = {
  together: {
    name: 'Together',
    days: [0, 1, 2, 3, 4, 5],
    travelers: ['all', 'seth', 'katrina', 'paul', 'sheri']
  },
  india: {
    name: 'S&P India',
    days: [5, 6, 7, 8, 9, 10, 11],
    travelers: ['all', 'seth', 'paul']
  }
};

const TEST_PHASES = {
  together: {
    name: 'Test Phase',
    days: [0, 1, 2],
    travelers: ['all', 'tester1', 'tester2']
  }
};

const CAROUSELS = {
  'leela-palace': {
    images: [
      { url: 'https://www.theleela.com/prod/content/assets/aio-banner/dekstop/The-Leela-Palace-Bengaluru-hero-image_0.webp', caption: 'The Leela Palace Bengaluru' },
      { url: 'https://www.theleela.com/prod/content/assets/aio-banner/dekstop/The-Leela-Palace-Bengaluru-port-cochere_0.webp', caption: 'Grand Entrance' },
      { url: 'https://www.theleela.com/prod/content/assets/2026-01/Royal-Suite-The-Leela-Palace-Bengaluru.webp', caption: 'Royal Suite' },
      { url: 'https://www.theleela.com/prod/content/assets/styles/tl_full_screen_webp/public/2026-01/Zen-at-the-leela-palace-bengaluru.jpg', caption: 'Zen Restaurant' }
    ]
  },
  'fresh-hotel': {
    images: [
      { url: 'https://images.unsplash.com/photo-1566073771259-6a8506099945?w=600&q=80', caption: 'Rooftop Pool' },
      { url: 'https://images.unsplash.com/photo-1582719508461-905c673771fd?w=600&q=80', caption: 'Modern Design' },
      { url: 'https://images.unsplash.com/photo-1551882547-ff40c63fe5fa?w=600&q=80', caption: 'City Views' }
    ]
  },
  'tuktuk-athens': {
    images: [
      { url: 'https://www.civitatis.com/f/grecia/atenas/tour-tuk-tuk-atenas-589x392.jpg', caption: 'TukTuk Athens Tour' },
      { url: 'https://www.civitatis.com/f/grecia/atenas/galeria/tuk-tuk-atenas.jpg', caption: 'Cruising Through Athens' }
    ]
  },
  'parthenon-tour': {
    images: [
      { url: 'https://www.athens-walks.com/wp-content/uploads/2017/11/parthenon2.jpg', caption: 'The Parthenon' },
      { url: 'https://www.athens-walks.com/wp-content/uploads/2017/12/erechteum.jpg', caption: 'The Erechtheion' },
      { url: 'https://www.athens-walks.com/wp-content/uploads/2017/11/kariatides4-550x550.jpg', caption: 'Caryatid Statues' },
      { url: 'https://www.athens-walks.com/wp-content/uploads/2017/11/athena-nike-temple-550x400.jpg', caption: 'Temple of Athena Nike' }
    ]
  }
};

// Production days data (abbreviated - full data in actual migration)
const PRODUCTION_DAYS = [
  {
    date: "2026-02-01", dayNum: 1, label: "Sun, Feb 1", location: "CMH", theme: "Departure Day", destination: "travel",
    events: [
      { id: "lounge-cmh", time: "15:00", endTime: "16:00", type: "activity", title: "Escape Lounge", subtitle: "Concourse B, Gate 32B", travelers: ["all"], status: "confirmed", where: "CMH Airport", details: "Priority Pass accepted. Fresh food, wifi, quiet space before the journey begins.", badges: ["lounge"] },
      { id: "f1", time: "16:27", type: "flight", title: "CMH → EWR", subtitle: "United UA3675 • 1h 53m", travelers: ["all"], status: "confirmed", flightCode: "UA3675", airline: "united", from: "CMH", to: "EWR", miles: 462, details: "Arrives Newark ~6:20 PM. Terminal C arrival, need to get to Terminal B for Emirates." },
      { id: "ge-interview", time: "19:00", type: "activity", title: "Global Entry Interview", subtitle: "Terminal B", travelers: ["seth", "katrina"], status: "confirmed", where: "EWR Terminal B", details: "Enrollment center. Bring passport and confirmation.", badges: ["interview"] },
      { id: "lounge-ewr", time: "20:00", endTime: "23:00", type: "activity", title: "Terminal B Lounge", subtitle: "Virgin Atlantic Clubhouse or Art & Lounge", travelers: ["all"], status: "confirmed", where: "EWR Terminal B", details: "Relax before the overnight flight. Virgin Atlantic Clubhouse near Gates B51-B57.", badges: ["lounge"] },
      { id: "f2", time: "23:55", type: "flight", title: "EWR → ATH", subtitle: "Emirates EK210 • 9h 10m", travelers: ["all"], status: "confirmed", flightCode: "EK210", airline: "emirates", from: "EWR", to: "ATH", miles: 4927, details: "Overnight flight. Boeing 777-300ER. Arrives Athens Monday ~4 PM local." }
    ]
  },
  {
    date: "2026-02-02", dayNum: 2, label: "Mon, Feb 2", location: "ATH", theme: "Athens Arrival", destination: "athens",
    destinationInfo: "Welcome to Athens! 7 hours ahead of ET. Your body says it's morning, but it's late afternoon here. The Acropolis awaits!",
    events: [
      { id: "f2-arrive", time: "16:05", type: "flight", title: "Arrive Athens", subtitle: "Immigration & Baggage", travelers: ["all"], status: "confirmed", from: "EWR", to: "ATH", details: "Welcome to Greece! EU passport line should be quick." },
      { id: "taxi-hotel", time: "17:00", type: "activity", title: "Taxi to Hotel", subtitle: "~40 min to city center", travelers: ["all"], status: "confirmed", where: "Athens Airport", travelTime: 40, details: "Fixed fare to city center ~€40. Hotel is near Omonia Square." },
      { id: "hotel-checkin", time: "18:00", type: "hotel", title: "Fresh Hotel Check-in", subtitle: "Near Omonia Square", travelers: ["all"], status: "confirmed", where: "26 Sophocleous Street", mapsLink: "https://maps.google.com/?q=Fresh+Hotel+Athens", address: "26 Sophocleous & Klisthenous Street, Athens 10552", carousel: "fresh-hotel", details: "Boutique hotel with rooftop pool and Acropolis views. Design Hotels member." },
      { id: "dinner-day2", time: "20:00", type: "meal", title: "First Dinner in Athens", subtitle: "Explore Monastiraki", travelers: ["all"], status: "pending", where: "Near hotel", details: "Walk to Monastiraki area. Plenty of tavernas and rooftop restaurants with Acropolis views." }
    ]
  },
  {
    date: "2026-02-03", dayNum: 3, label: "Tue, Feb 3", location: "ATH", theme: "Acropolis Day", destination: "athens",
    estimatedSteps: 15000,
    events: [
      { id: "breakfast-day3", time: "09:00", type: "meal", title: "Hotel Breakfast", subtitle: "Air Lounge Restaurant", travelers: ["all"], status: "confirmed", where: "Fresh Hotel", details: "Included with room. Rooftop views!" },
      { id: "acropolis-tour", time: "10:30", endTime: "14:00", type: "activity", title: "Acropolis & Museum", subtitle: "Skip-the-line guided tour", travelers: ["all"], status: "confirmed", where: "Acropolis Hill", walkingSteps: 8000, carousel: "parthenon-tour", mapsLink: "https://maps.google.com/?q=Acropolis+Athens", details: "The iconic ancient citadel. Parthenon, Erechtheion, Temple of Athena Nike. Book skip-the-line tickets in advance!" },
      { id: "lunch-plaka", time: "14:30", type: "meal", title: "Lunch in Plaka", subtitle: "Traditional Greek taverna", travelers: ["all"], status: "pending", where: "Plaka District", details: "The oldest neighborhood in Athens. Narrow streets, cafes, souvenir shops." },
      { id: "free-afternoon", time: "16:00", endTime: "19:00", type: "activity", title: "Free Time", subtitle: "Explore or rest", travelers: ["all"], status: "confirmed", details: "Options: Ancient Agora, Monastiraki flea market, or back to hotel for rooftop pool." },
      { id: "dinner-day3", time: "20:00", type: "meal", title: "Dinner", subtitle: "Rooftop with views", travelers: ["all"], status: "pending", where: "TBD", details: "Rooftop dinner with Acropolis views. Suggestions: A for Athens, 360 Cocktail Bar." }
    ]
  },
  {
    date: "2026-02-04", dayNum: 4, label: "Wed, Feb 4", location: "ATH", theme: "Athens Exploration", destination: "athens",
    estimatedSteps: 12000,
    events: [
      { id: "breakfast-day4", time: "09:00", type: "meal", title: "Hotel Breakfast", travelers: ["all"], status: "confirmed", where: "Fresh Hotel" },
      { id: "tuktuk-tour", time: "10:00", endTime: "13:00", type: "activity", title: "TukTuk City Tour", subtitle: "3-hour guided tour", travelers: ["all"], status: "confirmed", where: "Hotel pickup", carousel: "tuktuk-athens", details: "Fun way to see Athens! Covers Plaka, Monastiraki, street art neighborhoods, hidden gems." },
      { id: "lunch-day4", time: "13:30", type: "meal", title: "Lunch", subtitle: "Local recommendation", travelers: ["all"], status: "pending", where: "Central Athens" },
      { id: "afternoon-day4", time: "15:00", endTime: "18:00", type: "activity", title: "National Archaeological Museum", subtitle: "Or shopping/exploring", travelers: ["all"], status: "pending", where: "Central Athens", details: "World's best collection of Greek antiquities. Or explore Ermou Street shopping." },
      { id: "dinner-day4", time: "20:00", type: "meal", title: "Dinner", travelers: ["all"], status: "pending", where: "TBD" }
    ]
  },
  {
    date: "2026-02-05", dayNum: 5, label: "Thu, Feb 5", location: "ATH", theme: "Day Trip or Leisure", destination: "athens",
    events: [
      { id: "breakfast-day5", time: "09:00", type: "meal", title: "Hotel Breakfast", travelers: ["all"], status: "confirmed", where: "Fresh Hotel" },
      { id: "day-trip", time: "10:00", endTime: "17:00", type: "activity", title: "Day Trip Options", subtitle: "Delphi, Cape Sounion, or Athens", travelers: ["all"], status: "pending", details: "Options: 1) Delphi day trip (full day), 2) Cape Sounion sunset (half day), 3) More Athens exploration" },
      { id: "dinner-day5", time: "20:00", type: "meal", title: "Group Dinner", subtitle: "Last night together", travelers: ["all"], status: "pending", where: "TBD", details: "Last dinner with everyone before K&F head home and S&P continue to India." }
    ]
  },
  {
    date: "2026-02-06", dayNum: 6, label: "Fri, Feb 6", location: "ATH", theme: "Split Day", destination: "travel",
    destinationInfo: "Today we split! Katrina & Sheri head home, Seth & Paul continue to Bangalore.",
    events: [
      { id: "breakfast-day6", time: "08:00", type: "meal", title: "Early Breakfast", travelers: ["all"], status: "confirmed", where: "Fresh Hotel" },
      { id: "hotel-checkout", time: "10:00", type: "hotel", title: "Hotel Checkout", travelers: ["all"], status: "confirmed", where: "Fresh Hotel", details: "Check out and head to airport together." },
      { id: "taxi-airport", time: "10:30", type: "activity", title: "Taxi to Airport", travelers: ["all"], status: "confirmed", travelTime: 45 },
      { id: "kf-flight1", time: "13:20", type: "flight", title: "ATH → ORD", subtitle: "United UA101 • 11h 40m", travelers: ["katrina", "sheri"], status: "confirmed", flightCode: "UA101", airline: "united", from: "ATH", to: "ORD", miles: 5471, details: "Direct to Chicago! Arrives ~4 PM local (10 PM Athens time)." },
      { id: "sp-flight1", time: "14:45", type: "flight", title: "ATH → DXB", subtitle: "Emirates EK210 • 4h 20m", travelers: ["seth", "paul"], status: "confirmed", flightCode: "EK210", airline: "emirates", from: "ATH", to: "DXB", miles: 2405, details: "Quick hop to Dubai for connection." },
      { id: "kf-flight2", time: "17:39", type: "flight", title: "ORD → CMH", subtitle: "United UA4529 • 1h 6m", travelers: ["katrina", "sheri"], status: "confirmed", flightCode: "UA4529", airline: "united", from: "ORD", to: "CMH", miles: 296, details: "Home by 7 PM! Welcome back." },
      { id: "sp-layover", time: "22:10", endTime: "02:15", type: "activity", title: "Dubai Layover", subtitle: "4h layover", travelers: ["seth", "paul"], status: "confirmed", where: "DXB Airport", details: "Emirates lounge access. Quick layover in Dubai." },
      { id: "sp-flight2", time: "02:15", type: "flight", title: "DXB → BLR", subtitle: "Emirates EK568 • 3h 45m", travelers: ["seth", "paul"], status: "confirmed", flightCode: "EK568", airline: "emirates", from: "DXB", to: "BLR", miles: 1676, details: "Red-eye to Bangalore. Arrives ~8 AM local." }
    ]
  },
  {
    date: "2026-02-07", dayNum: 7, label: "Sat, Feb 7", location: "BLR", theme: "Bangalore Arrival", destination: "bangalore",
    destinationInfo: "Welcome to India! Bangalore is 10.5 hours ahead of ET. Tech hub meets garden city.",
    events: [
      { id: "blr-arrive", time: "08:00", type: "flight", title: "Arrive Bangalore", subtitle: "Immigration & Baggage", travelers: ["seth", "paul"], status: "confirmed", from: "DXB", to: "BLR", details: "Welcome to India! E-visa should work at immigration." },
      { id: "taxi-leela", time: "09:00", type: "activity", title: "Taxi to Hotel", subtitle: "~75 min to Leela Palace", travelers: ["seth", "paul"], status: "confirmed", travelTime: 75, travelNote: "60-90 min depending on traffic", details: "Airport is far from city. Uber/Ola work great in Bangalore." },
      { id: "leela-checkin", time: "11:00", type: "hotel", title: "Leela Palace Check-in", subtitle: "Early check-in requested", travelers: ["seth", "paul"], status: "confirmed", where: "Old Airport Road", mapsLink: "https://maps.google.com/?q=Leela+Palace+Bangalore", carousel: "leela-palace", address: "23, HAL Old Airport Rd, Bangalore 560008", details: "Luxury 5-star. Beautiful grounds, multiple restaurants, spa." },
      { id: "rest-morning", time: "11:30", endTime: "14:00", type: "activity", title: "Rest & Recover", subtitle: "Jet lag recovery", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace", details: "Long journey! Take time to rest before exploring." },
      { id: "lunch-day7", time: "14:30", type: "meal", title: "Late Lunch", subtitle: "Hotel or nearby", travelers: ["seth", "paul"], status: "pending", where: "Leela Palace area" },
      { id: "evening-day7", time: "17:00", type: "activity", title: "Light Exploration", subtitle: "Nearby area", travelers: ["seth", "paul"], status: "pending", details: "Maybe just walk around hotel area or visit nearby Indiranagar." },
      { id: "dinner-day7", time: "20:00", type: "meal", title: "Dinner", subtitle: "Hotel restaurant", travelers: ["seth", "paul"], status: "pending", where: "Leela Palace", details: "Jamavar (Indian), Le Jardin (multi-cuisine), or Zen (Asian)." }
    ]
  },
  {
    date: "2026-02-08", dayNum: 8, label: "Sun, Feb 8", location: "BLR", theme: "Bangalore Day 1", destination: "bangalore",
    events: [
      { id: "breakfast-day8", time: "09:00", type: "meal", title: "Hotel Breakfast", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace" },
      { id: "day8-explore", time: "10:30", endTime: "17:00", type: "activity", title: "Bangalore Exploration", subtitle: "Temples, Gardens, Markets", travelers: ["seth", "paul"], status: "pending", details: "Options: Bull Temple, Lalbagh Gardens, Commercial Street shopping, Bangalore Palace." },
      { id: "dinner-day8", time: "20:00", type: "meal", title: "Dinner", subtitle: "Local cuisine", travelers: ["seth", "paul"], status: "pending", where: "TBD", details: "Try local Bangalore cuisine - MTR, Koshy's, or street food tour." }
    ]
  },
  {
    date: "2026-02-09", dayNum: 9, label: "Mon, Feb 9", location: "BLR", theme: "Work Day", destination: "bangalore",
    events: [
      { id: "breakfast-day9", time: "08:00", type: "meal", title: "Breakfast", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace" },
      { id: "work-day9", time: "09:00", endTime: "17:00", type: "activity", title: "Work Day", subtitle: "Remote work from hotel", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace", details: "Business center or room. Good wifi throughout hotel." },
      { id: "dinner-day9", time: "20:00", type: "meal", title: "Dinner", travelers: ["seth", "paul"], status: "pending" }
    ]
  },
  {
    date: "2026-02-10", dayNum: 10, label: "Tue, Feb 10", location: "BLR", theme: "Bangalore Day 2", destination: "bangalore",
    events: [
      { id: "breakfast-day10", time: "09:00", type: "meal", title: "Breakfast", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace" },
      { id: "day10-explore", time: "10:00", endTime: "17:00", type: "activity", title: "More Exploration", subtitle: "Art, Food, Tech", travelers: ["seth", "paul"], status: "pending", details: "Options: Art galleries, tech campus tours (if arranged), food walks, local markets." },
      { id: "dinner-day10", time: "20:00", type: "meal", title: "Last Dinner in India", subtitle: "Special dinner", travelers: ["seth", "paul"], status: "pending", details: "Final dinner in Bangalore. Maybe a nice rooftop or local specialty." }
    ]
  },
  {
    date: "2026-02-11", dayNum: 11, label: "Wed, Feb 11", location: "BLR", theme: "Departure Day", destination: "travel",
    events: [
      { id: "breakfast-day11", time: "07:00", type: "meal", title: "Early Breakfast", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace" },
      { id: "hotel-checkout-blr", time: "08:30", type: "hotel", title: "Hotel Checkout", travelers: ["seth", "paul"], status: "confirmed", where: "Leela Palace" },
      { id: "taxi-blr-airport", time: "09:00", type: "activity", title: "Taxi to Airport", travelers: ["seth", "paul"], status: "confirmed", travelTime: 75, details: "Allow extra time for Bangalore traffic." },
      { id: "sp-flight3", time: "12:35", type: "flight", title: "BLR → DXB", subtitle: "Emirates EK567 • 4h 5m", travelers: ["seth", "paul"], status: "confirmed", flightCode: "EK567", airline: "emirates", from: "BLR", to: "DXB", miles: 1676, details: "Back through Dubai." },
      { id: "dxb-layover2", time: "15:10", endTime: "22:30", type: "activity", title: "Dubai Layover", subtitle: "7h layover", travelers: ["seth", "paul"], status: "confirmed", where: "DXB Airport", details: "Longer layover this time. Emirates lounge, maybe quick city tour?" },
      { id: "sp-flight4", time: "22:30", type: "flight", title: "DXB → EWR", subtitle: "Emirates EK201 • 13h 55m", travelers: ["seth", "paul"], status: "confirmed", flightCode: "EK201", airline: "emirates", from: "DXB", to: "EWR", miles: 6846, details: "Long haul home. Arrives Newark ~5:25 AM next day." }
    ]
  },
  {
    date: "2026-02-12", dayNum: 12, label: "Thu, Feb 12", location: "CMH", theme: "Home", destination: "travel",
    events: [
      { id: "ewr-arrive", time: "05:25", type: "flight", title: "Arrive Newark", subtitle: "Immigration & Customs", travelers: ["seth", "paul"], status: "confirmed", from: "DXB", to: "EWR", details: "Welcome back to USA! Global Entry should speed things up." },
      { id: "sp-flight5", time: "08:35", type: "flight", title: "EWR → CMH", subtitle: "United UA4456 • 1h 40m", travelers: ["seth", "paul"], status: "confirmed", flightCode: "UA4456", airline: "united", from: "EWR", to: "CMH", miles: 462, details: "Final leg home!" },
      { id: "home-arrive", time: "10:15", type: "activity", title: "Home!", subtitle: "Welcome back", travelers: ["seth", "paul"], status: "confirmed", where: "Columbus", details: "Trip complete! Time to recover from jet lag." }
    ]
  }
];

const TEST_DAYS = [
  {
    date: "2025-01-01", dayNum: 1, label: "Wed, Jan 1", location: "CMH", theme: "Test Day 1", destination: "travel",
    events: [
      { id: "test-event-1", time: "09:00", endTime: "10:00", type: "activity", title: "Test Event 1", subtitle: "Sample event for testing", travelers: ["all"], status: "confirmed", where: "Test Location", details: "This is a test event to verify features work correctly." }
    ]
  },
  {
    date: "2025-01-02", dayNum: 2, label: "Thu, Jan 2", location: "CMH", theme: "Test Day 2", destination: "travel",
    events: [
      { id: "test-event-2", time: "14:00", endTime: "16:00", type: "meal", title: "Test Meal", subtitle: "Testing meal events", travelers: ["all"], status: "confirmed", where: "Test Restaurant" }
    ]
  },
  {
    date: "2025-01-03", dayNum: 3, label: "Fri, Jan 3", location: "CMH", theme: "Test Day 3", destination: "travel",
    events: [
      { id: "test-event-3", time: "12:00", type: "activity", title: "Test Complete", travelers: ["all"], status: "confirmed", details: "Testing complete - switch back to production trip." }
    ]
  }
];

// =============================================
// MIGRATION HANDLER
// =============================================

module.exports = async function (context, req) {
  const headers = getHeaders("POST, OPTIONS");

  if (req.method === "OPTIONS") {
    handleOptions(context, "POST, OPTIONS");
    return;
  }

  // Simple admin check - require a migrate key
  const migrateKey = req.body?.migrateKey || req.query?.migrateKey;
  const expectedKey = process.env.MIGRATE_KEY || "migrate-secret-2026";

  if (migrateKey !== expectedKey) {
    sendError(context, "Invalid migration key", 403, headers);
    return;
  }

  const dryRun = req.body?.dryRun === true;
  const tripFilter = req.body?.trip; // Optional: only migrate specific trip

  try {
    const results = {
      tables: [],
      trips: [],
      travelers: [],
      days: [],
      events: [],
      destinations: [],
      hotels: [],
      errors: []
    };

    // Ensure all tables exist
    if (!dryRun) {
      for (const tableName of Object.values(TABLES)) {
        try {
          await ensureTable(tableName);
          results.tables.push({ table: tableName, status: "ready" });
        } catch (err) {
          results.tables.push({ table: tableName, status: "error", error: err.message });
        }
      }
    }

    // Migrate destinations (global data)
    for (const [code, dest] of Object.entries(DESTINATIONS)) {
      const entity = {
        partitionKey: "destinations",
        rowKey: code,
        ...dest
      };
      if (!dryRun) {
        await upsertEntity(TABLES.DESTINATIONS, entity);
      }
      results.destinations.push({ code, name: dest.name });
    }

    // Migrate trips
    const tripsToMigrate = tripFilter
      ? { [tripFilter]: TRIPS[tripFilter] }
      : TRIPS;

    for (const [tripId, trip] of Object.entries(tripsToMigrate)) {
      if (!trip) continue;

      const isTest = tripId === "test-trip";
      const travelers = isTest ? TEST_TRAVELERS : PRODUCTION_TRAVELERS;
      const hotel = isTest ? TEST_HOTEL : PRODUCTION_HOTEL;
      const days = isTest ? TEST_DAYS : PRODUCTION_DAYS;
      const phases = isTest ? TEST_PHASES : PRODUCTION_PHASES;

      // Trip entity
      const tripEntity = {
        partitionKey: "trips",
        rowKey: tripId,
        ...trip,
        phases: JSON.stringify(phases),
        carousels: JSON.stringify(CAROUSELS)
      };
      if (!dryRun) {
        await upsertEntity(TABLES.TRIPS, tripEntity);
      }
      results.trips.push({ id: tripId, name: trip.name });

      // Travelers
      for (const traveler of travelers) {
        const travelerEntity = {
          partitionKey: tripId,
          rowKey: traveler.id,
          ...traveler,
          triviaScore: 0
        };
        if (!dryRun) {
          await upsertEntity(TABLES.TRAVELERS, travelerEntity);
        }
        results.travelers.push({ tripId, id: traveler.id, name: traveler.name });
      }

      // Hotel
      const hotelEntity = {
        partitionKey: tripId,
        rowKey: hotel.id || "hotel_1",
        ...hotel
      };
      if (!dryRun) {
        await upsertEntity(TABLES.HOTELS, hotelEntity);
      }
      results.hotels.push({ tripId, name: hotel.name });

      // Days and Events
      for (const day of days) {
        // Day entity
        const dayEntity = {
          partitionKey: tripId,
          rowKey: day.date,
          dayNum: day.dayNum,
          label: day.label,
          location: day.location,
          theme: day.theme,
          destination: day.destination,
          destinationInfo: day.destinationInfo || null,
          estimatedSteps: day.estimatedSteps || null
        };
        if (!dryRun) {
          await upsertEntity(TABLES.DAYS, dayEntity);
        }
        results.days.push({ tripId, date: day.date, theme: day.theme });

        // Events for this day
        for (const event of day.events || []) {
          const eventEntity = {
            partitionKey: `${tripId}_${day.date}`,
            rowKey: event.id,
            id: event.id,
            date: day.date,
            time: event.time,
            endTime: event.endTime || null,
            type: event.type,
            title: event.title,
            subtitle: event.subtitle || null,
            travelers: JSON.stringify(event.travelers || ["all"]),
            status: event.status || "confirmed",
            where: event.where || null,
            details: event.details || null,
            badges: event.badges ? JSON.stringify(event.badges) : null,
            flightCode: event.flightCode || null,
            airline: event.airline || null,
            from: event.from || null,
            to: event.to || null,
            miles: event.miles || null,
            mapsLink: event.mapsLink || null,
            venueLink: event.venueLink || null,
            address: event.address || null,
            carousel: event.carousel || null,
            walkingSteps: event.walkingSteps || null,
            travelTime: event.travelTime || null,
            travelNote: event.travelNote || null,
            hoverImage: event.hoverImage ? JSON.stringify(event.hoverImage) : null,
            isUserGenerated: false,
            createdAt: new Date().toISOString()
          };
          if (!dryRun) {
            await upsertEntity(TABLES.EVENTS, eventEntity);
          }
          results.events.push({ tripId, date: day.date, id: event.id, title: event.title });
        }
      }
    }

    sendSuccess(context, {
      success: true,
      dryRun,
      summary: {
        tables: results.tables.length,
        trips: results.trips.length,
        travelers: results.travelers.length,
        days: results.days.length,
        events: results.events.length,
        destinations: results.destinations.length,
        hotels: results.hotels.length
      },
      details: results
    }, 200, headers);

  } catch (err) {
    console.error("Migration error:", err);
    sendError(context, err.message, 500, headers);
  }
};
