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

export const PRODUCTION_DAYS = [
      {
        date: "2026-02-01",
        dayNum: 1,
        label: "Sun, Feb 1",
        location: "CMH",
        theme: "Departure Day",
        destination: "travel",
        events: [
          {
            id: "lounge-cmh",
            time: "15:00",
            endTime: "16:00",
            type: "activity",
            title: "Escape Lounge",
            subtitle: "Concourse B, Gate 32B",
            travelers: ["all"],
            status: "confirmed",
            where: "CMH Airport",
            details: "Priority Pass accepted. Fresh food, wifi, quiet space before the journey begins.",
            badges: ["lounge"]
          },
          {
            id: "f1",
            time: "16:27",
            type: "flight",
            title: "CMH → EWR",
            subtitle: "United UA3675 • 1h 53m",
            travelers: ["all"],
            status: "confirmed",
            flightCode: "UA3675",
            airline: "united",
            from: "CMH",
            to: "EWR",
            miles: 462,
            details: "Arrives Newark ~6:20 PM. Terminal C arrival, need to get to Terminal B for Emirates."
          },
          {
            id: "ge-interview",
            time: "19:00",
            type: "activity",
            title: "Global Entry Interview",
            subtitle: "Terminal B",
            travelers: ["seth", "katrina"],
            status: "confirmed",
            where: "EWR Terminal B",
            details: "Enrollment center. Bring passport and confirmation.",
            badges: ["interview"]
          },
          {
            id: "lounge-ewr",
            time: "20:00",
            endTime: "23:00",
            type: "activity",
            title: "Terminal B Lounge",
            subtitle: "Virgin Atlantic Clubhouse or Art & Lounge",
            travelers: ["all"],
            status: "confirmed",
            where: "EWR Terminal B",
            details: "Relax before the overnight flight. Virgin Atlantic Clubhouse near Gates B51-B57.",
            badges: ["lounge"]
          },
          {
            id: "f2",
            time: "23:55",
            type: "flight",
            title: "EWR → ATH",
            subtitle: "Emirates EK210 • 9h 10m",
            travelers: ["all"],
            status: "confirmed",
            flightCode: "EK210",
            airline: "emirates",
            from: "EWR",
            to: "ATH",
            miles: 4927,
            details: "Overnight flight. Boeing 777-300ER. Arrives Athens Monday ~4 PM local."
          }
        ]
      },
      {
        date: "2026-02-02",
        dayNum: 2,
        label: "Mon, Feb 2",
        location: "ATH",
        theme: "Athens Arrival",
        destination: "athens",
        destinationInfo: "Welcome to Athens! 7 hours ahead of ET. Your body says it's morning, but it's late afternoon here. The Acropolis awaits!",
        events: [
          {
            id: "f2-arrive",
            time: "16:05",
            type: "flight",
            title: "Arrive Athens",
            subtitle: "Welcome to Greece!",
            travelers: ["all"],
            status: "confirmed",
            from: "EWR",
            to: "ATH",
            feelsLike: "9:05 AM ET"
          },
          {
            id: "h1",
            time: "18:00",
            type: "hotel",
            title: "Check into The Fresh Hotel",
            subtitle: "Design Hotels member",
            travelers: ["all"],
            status: "confirmed",
            where: "Near Omonia Square",
            address: "26 Sophocleous & Klisthenous Street, Athens 10552",
            mapsLink: "https://maps.google.com/?q=Fresh+Hotel+Athens",
            venueLink: "https://freshhotel.gr/",
            details: "Rooftop pool with Acropolis views! 8-min walk to Monastiraki. 5 nights (checkout Sat 2/7).",
            feelsLike: "11:00 AM ET",
            carousel: "fresh-hotel"
          },
          {
            id: "m1",
            time: "20:00",
            type: "meal",
            title: "Welcome Dinner",
            subtitle: "First taste of Athens",
            travelers: ["all"],
            status: "pending",
            where: "Near hotel - Plaka or Psirri area",
            walkingSteps: 1500,
            feelsLike: "1:00 PM ET",
            details: "Keep it light - jet lag will be real. Maybe mezze and local wine?"
          }
        ]
      },
      {
        date: "2026-02-03",
        dayNum: 3,
        label: "Tue, Feb 3",
        location: "ATH",
        theme: "Ancient Wonders",
        destination: "athens",
        estimatedSteps: 15000,
        events: [
          {
            id: "a1",
            time: "09:00",
            endTime: "13:00",
            type: "activity",
            title: "Acropolis & Museum",
            subtitle: "The crown jewel of Athens",
            travelers: ["all"],
            status: "pending",
            where: "Acropolis Hill",
            mapsLink: "https://maps.google.com/?q=Acropolis+Athens",
            walkingSteps: 8000,
            details: "Book skip-the-line tickets. Wear comfortable shoes - marble stairs!",
            feelsLike: "2:00 AM ET (your body thinks it's the middle of the night)"
          },
          {
            id: "m2",
            time: "13:30",
            type: "meal",
            title: "Lunch in Plaka",
            subtitle: "Rooftop dining with Acropolis views",
            travelers: ["all"],
            status: "pending",
            where: "Plaka neighborhood",
            walkingSteps: 1500
          },
          {
            id: "a2-tuktuk",
            time: "15:30",
            endTime: "18:30",
            type: "activity",
            title: "TukTuk Athens Private Tour",
            subtitle: "City Center & Old Town",
            travelers: ["all"],
            status: "confirmed",
            where: "Athens City Center",
            mapsLink: "https://maps.google.com/?q=Athens+City+Center",
            walkingSteps: 2000,
            details: "Private evening/afternoon complete tour covering City Center and Old Town. A fun way to see Athens!",
            carousel: "tuktuk-athens"
          },
          {
            id: "m3",
            time: "20:00",
            type: "meal",
            title: "Dinner",
            subtitle: "Greek taverna",
            travelers: ["all"],
            status: "pending"
          }
        ]
      },
      {
        date: "2026-02-04",
        dayNum: 4,
        label: "Wed, Feb 4",
        location: "ATH",
        theme: "Work Day",
        destination: "athens",
        estimatedSteps: 8000,
        events: [
          {
            id: "w1",
            time: "09:00",
            endTime: "17:00",
            type: "activity",
            title: "Work Day",
            subtitle: "S & P on the clock",
            travelers: ["guys"],
            status: "confirmed",
            details: "Working remotely from Athens. Full day of meetings."
          },
          {
            id: "a3-kf",
            time: "10:00",
            endTime: "12:00",
            type: "activity",
            title: "Acropolis Museum",
            subtitle: "World-class collection",
            travelers: ["girls"],
            status: "pending",
            where: "Acropolis Museum",
            mapsLink: "https://maps.google.com/?q=Acropolis+Museum+Athens",
            venueLink: "https://theacropolismuseum.gr",
            walkingSteps: 3000,
            details: "Indoor option - great if weather is rough. K & F explore while the guys work."
          },
          {
            id: "m4-kf",
            time: "12:30",
            type: "meal",
            title: "Lunch in Koukaki",
            subtitle: "Neighborhood gem",
            travelers: ["girls"],
            status: "pending",
            where: "Koukaki neighborhood",
            walkingSteps: 1500
          },
          {
            id: "a4-kf",
            time: "15:00",
            endTime: "17:00",
            type: "activity",
            title: "Ancient Agora & Temple of Hephaestus",
            subtitle: "Best-preserved ancient Greek temple",
            travelers: ["girls"],
            status: "pending",
            where: "Ancient Agora",
            mapsLink: "https://maps.google.com/?q=Ancient+Agora+Athens",
            walkingSteps: 4000
          },
          {
            id: "m5-work",
            time: "19:30",
            type: "meal",
            title: "Work Dinner",
            subtitle: "Business dinner",
            travelers: ["guys"],
            status: "confirmed",
            details: "Work dinner for S & P."
          },
          {
            id: "m5-kf",
            time: "19:30",
            type: "meal",
            title: "Girls' Night Dinner",
            subtitle: "K & F dinner",
            travelers: ["girls"],
            status: "pending",
            details: "K & F enjoy dinner on their own while the guys are at work dinner."
          },
          {
            id: "drinks-wed",
            time: "21:30",
            type: "meal",
            title: "Nightcap at A for Athens",
            subtitle: "Rooftop cocktails with Acropolis views",
            travelers: ["all"],
            status: "confirmed",
            where: "A for Athens, Miaouli 2",
            mapsLink: "https://maps.google.com/?q=A+for+Athens+Monastiraki",
            venueLink: "https://aforathens.com/bar-restaurant/",
            details: "Everyone reunites after separate dinners. Award-winning cocktails on a stunning rooftop terrace overlooking the Acropolis. 1 min walk from Monastiraki Square.",
            hoverImage: { url: "https://aforathens.com/wp-content/uploads/2018/10/restaurant-bar-1728x1080.jpg", caption: "A for Athens - Rooftop Bar" }
          }
        ]
      },
      {
        date: "2026-02-05",
        dayNum: 5,
        label: "Thu, Feb 5",
        location: "ATH",
        theme: "Last Full Day",
        destination: "athens",
        estimatedSteps: 8000,
        events: [
          {
            id: "w2",
            time: "09:00",
            endTime: "12:00",
            type: "activity",
            title: "Work Morning",
            subtitle: "S & P wrap up work",
            travelers: ["guys"],
            status: "confirmed",
            details: "Morning meetings, then free for the rest of the day."
          },
          {
            id: "a5-kf",
            time: "10:00",
            endTime: "12:00",
            type: "activity",
            title: "Morning Exploration",
            subtitle: "K & F free time",
            travelers: ["girls"],
            status: "pending",
            details: "Shopping, cafe hopping, or revisit favorite spots."
          },
          {
            id: "m6",
            time: "12:00",
            type: "meal",
            title: "Group Lunch",
            subtitle: "Quick bite before tour",
            travelers: ["all"],
            status: "pending",
            details: "Everyone reunites for a leisurely lunch."
          },
          {
            id: "a5-parthenon",
            time: "13:00",
            endTime: "16:00",
            type: "activity",
            title: "Parthenon Guided Walking Tour",
            subtitle: "Expert-led exploration",
            travelers: ["all"],
            status: "confirmed",
            where: "Acropolis / Parthenon",
            mapsLink: "https://maps.google.com/?q=Parthenon+Athens",
            walkingSteps: 6000,
            details: "Guided walking tour of the Parthenon and Acropolis. Everyone together for this iconic experience.",
            carousel: "parthenon-tour"
          },
          {
            id: "m7",
            time: "20:00",
            type: "meal",
            title: "Farewell Dinner",
            subtitle: "Last night all together",
            travelers: ["all"],
            status: "pending",
            details: "Celebrate the trip before K & F head home tomorrow."
          }
        ]
      },
      {
        date: "2026-02-06",
        dayNum: 6,
        label: "Fri, Feb 6",
        location: "ATH",
        theme: "Trip Splits",
        destination: "athens",
        destinationInfo: "Bittersweet day - K & F head home while S & P prepare for India. Last moments together in Athens!",
        events: [
          {
            id: "h1-out-kf",
            time: "10:00",
            type: "hotel",
            title: "K & F Check Out",
            subtitle: "Fresh Hotel farewell",
            travelers: ["girls"],
            status: "confirmed",
            details: "4 wonderful nights. Head to airport for afternoon flight."
          },
          {
            id: "m7",
            time: "12:00",
            type: "meal",
            title: "Farewell Lunch",
            subtitle: "Last meal as a group",
            travelers: ["all"],
            status: "pending",
            details: "Make it special - this is the last meal together!"
          },
          {
            id: "f-kf-return",
            time: "17:35",
            type: "flight",
            title: "ATH → EWR",
            subtitle: "Emirates EK209 • 10h 45m",
            travelers: ["girls"],
            status: "confirmed",
            flightCode: "EK209",
            airline: "emirates",
            from: "ATH",
            to: "EWR",
            miles: 4940,
            details: "Arrives Newark 9:20 PM ET same day. Flying west gains time!"
          },
          {
            id: "h-newark",
            time: "22:00",
            type: "hotel",
            title: "Newark Airport Marriott",
            subtitle: "One night layover",
            travelers: ["girls"],
            status: "confirmed",
            where: "Newark Liberty International Airport",
            details: "Rest up for morning flight home to CMH.",
            feelsLike: "4:00 AM Athens time"
          },
          {
            id: "a-sp-evening",
            time: "19:00",
            type: "activity",
            title: "Last Evening in Athens",
            subtitle: "S & P final night",
            travelers: ["guys"],
            status: "confirmed",
            details: "Enjoy Athens one more night before the India adventure."
          }
        ]
      },
      {
        date: "2026-02-07",
        dayNum: 7,
        label: "Sat, Feb 7",
        location: "ATH",
        theme: "K&F Home / S&P to India",
        destination: "travel",
        events: [
          {
            id: "f-kf-home",
            time: "09:16",
            type: "flight",
            title: "EWR → CMH",
            subtitle: "United • 1h 53m",
            travelers: ["girls"],
            status: "confirmed",
            airline: "united",
            from: "EWR",
            to: "CMH",
            miles: 462,
            details: "K & F arrive home ~11:09 AM. Welcome back!"
          },
          {
            id: "h1-out-sp",
            time: "11:00",
            type: "hotel",
            title: "S & P Check Out",
            subtitle: "Fresh Hotel farewell",
            travelers: ["guys"],
            status: "confirmed",
            details: "5 nights complete. Store luggage, explore Athens, then evening flight."
          },
          {
            id: "a-sp-day",
            time: "12:00",
            type: "activity",
            title: "Final Athens Day",
            subtitle: "Free time before flight",
            travelers: ["guys"],
            status: "confirmed",
            details: "Last chance for sights, shopping, or a long Greek lunch."
          },
          {
            id: "f-sp-dxb",
            time: "18:05",
            type: "flight",
            title: "ATH → DXB",
            subtitle: "Emirates EK210 • 4h 30m",
            travelers: ["guys"],
            status: "confirmed",
            flightCode: "EK210",
            airline: "emirates",
            from: "ATH",
            to: "DXB",
            miles: 2031,
            details: "Arrives Dubai 11:35 PM. Short layover then on to Bangalore."
          },
          {
            id: "lounge-dxb-out",
            time: "23:45",
            endTime: "03:00",
            type: "activity",
            title: "Emirates Business Lounge",
            subtitle: "Overnight layover luxury",
            travelers: ["guys"],
            status: "confirmed",
            where: "DXB Terminal 3, Concourse A",
            details: "World's largest business class lounge (172,000 sq ft). Champagne bar, spa, showers, fine dining. Direct gate boarding to EK564.",
            hoverImage: { url: "https://cdn.onemileatatime.com/wp-content/uploads/2022/07/Emirates-Business-Lounge-Dubai-40.jpeg", caption: "Emirates Business Lounge - Champagne Bar" },
            badges: ["lounge"]
          }
        ]
      },
      {
        date: "2026-02-08",
        dayNum: 8,
        label: "Sun, Feb 8",
        location: "BLR",
        theme: "Bangalore Arrival",
        destination: "bangalore",
        destinationInfo: "Welcome to India! 10.5 hours ahead of ET. Garden city, tech hub, incredible food. The Leela Palace awaits!",
        events: [
          {
            id: "f-sp-blr",
            time: "03:40",
            type: "flight",
            title: "DXB → BLR",
            subtitle: "Emirates EK564 • 4h 35m",
            travelers: ["guys"],
            status: "confirmed",
            flightCode: "EK564",
            airline: "emirates",
            from: "DXB",
            to: "BLR",
            miles: 1675,
            details: "Red-eye connection. Arrives Bangalore 8:15 AM local.",
            feelsLike: "9:45 PM ET (Sat night)"
          },
          {
            id: "limo-blr",
            time: "08:30",
            type: "activity",
            title: "Emirates Chauffeur-Drive",
            subtitle: "Complimentary limo to hotel",
            travelers: ["guys"],
            status: "confirmed",
            where: "BLR Airport Arrivals",
            details: "BMW 5 Series with leather seating. Paul has the reservation confirmation. Driver will meet at arrivals with name sign.",
            hoverImage: { url: "https://c.ekstatic.net/ecl/airport/chauffeur/emirates-chauffeur-drive-service-business-class-768x480.jpg", caption: "Emirates Chauffeur-Drive Service" },
            travelTime: 75,
            travelNote: "🚘 60-90 min to Leela Palace (35 km, Bangalore traffic)"
          },
          {
            id: "h-leela",
            time: "09:45",
            type: "hotel",
            title: "Check into The Leela Palace",
            subtitle: "Early check-in confirmed",
            travelers: ["guys"],
            status: "confirmed",
            where: "HAL Airport Road, Bangalore",
            mapsLink: "https://maps.google.com/?q=Leela+Palace+Bangalore",
            venueLink: "https://www.theleela.com/the-leela-palace-bengaluru",
            details: "Ranked #1 City Hotel in India. 357 rooms, modeled after Royal Palace of Mysore. Pool, spa, 6 restaurants. 4 nights.",
            feelsLike: "11:15 PM ET (Sat night)",
            carousel: "leela-palace"
          },
          {
            id: "a-sp-rest",
            time: "12:00",
            type: "activity",
            title: "Rest & Recover",
            subtitle: "Catch up on sleep",
            travelers: ["guys"],
            status: "confirmed",
            details: "Long travel day. Pool, spa, room service - ease into India."
          },
          {
            id: "m-sp-dinner",
            time: "19:30",
            type: "meal",
            title: "First Bangalore Dinner",
            subtitle: "Hotel restaurant or local spot",
            travelers: ["guys"],
            status: "pending",
            details: "Try Jamavar (Indian) or Zen (Pan-Asian) at the hotel, or venture out."
          }
        ]
      },
      {
        date: "2026-02-09",
        dayNum: 9,
        label: "Mon, Feb 9",
        location: "BLR",
        theme: "Work Day",
        destination: "bangalore",
        estimatedSteps: 4000,
        events: [
          {
            id: "w-mon",
            time: "09:00",
            endTime: "17:00",
            type: "activity",
            title: "Work Day",
            subtitle: "S & P at the office",
            travelers: ["guys"],
            status: "confirmed",
            where: "EY Office, Old Madras Road",
            mapsLink: "https://maps.google.com/?q=EY+Old+Madras+Road+Bangalore",
            details: "Full work day in Bangalore.",
            travelTime: 60,
            travelNote: "🚗 45-75 min from Leela Palace (rush hour: 2 hrs for 10 km!)",
            hoverImage: { url: "https://rmz-static.s3.dualstack.ap-south-1.amazonaws.com/01_264d8a9716.webp", caption: "RMZ Infinity - EY Bangalore" }
          },
          {
            id: "m-blr-dinner-mon",
            time: "19:30",
            type: "meal",
            title: "Dinner",
            subtitle: "Post-work meal",
            travelers: ["guys"],
            status: "pending",
            details: "Explore Bangalore's dining scene."
          },
          {
            id: "w-steerco",
            time: "22:30",
            endTime: "23:30",
            type: "activity",
            title: "SteerCo Meeting",
            subtitle: "Seth late call",
            travelers: ["seth"],
            status: "confirmed",
            where: "Hotel or Office",
            details: "Late night SteerCo - 12 PM ET back home."
          }
        ]
      },
      {
        date: "2026-02-10",
        dayNum: 10,
        label: "Tue, Feb 10",
        location: "BLR",
        theme: "Work Day",
        destination: "bangalore",
        estimatedSteps: 4000,
        events: [
          {
            id: "w-tue",
            time: "09:00",
            endTime: "17:00",
            type: "activity",
            title: "Work Day",
            subtitle: "S & P at the office",
            travelers: ["guys"],
            status: "confirmed",
            where: "EY Office, Old Madras Road",
            mapsLink: "https://maps.google.com/?q=EY+Old+Madras+Road+Bangalore",
            details: "Full work day in Bangalore.",
            travelTime: 60,
            travelNote: "🚗 45-75 min from Leela Palace (leave early!)",
            hoverImage: { url: "https://rmz-static.s3.dualstack.ap-south-1.amazonaws.com/01_264d8a9716.webp", caption: "RMZ Infinity - EY Bangalore" }
          },
          {
            id: "m-happy-hour",
            time: "17:30",
            type: "meal",
            title: "Happy Hour",
            subtitle: "Near EY Office",
            travelers: ["guys"],
            status: "confirmed",
            where: "Old Madras Road, Bangalore",
            mapsLink: "https://maps.google.com/?q=Old+Madras+Road+Bangalore",
            details: "Post-work drinks near the EY Bangalore office. Great way to unwind!",
            travelTime: 10,
            travelNote: "🚶 10 min walk from office"
          },
          {
            id: "m-blr-dinner-tue",
            time: "20:00",
            type: "meal",
            title: "Dinner",
            subtitle: "After happy hour",
            travelers: ["guys"],
            status: "pending",
            details: "Dinner nearby or head back toward the hotel."
          }
        ]
      },
      {
        date: "2026-02-11",
        dayNum: 11,
        label: "Wed, Feb 11",
        location: "BLR",
        theme: "Last Work Day",
        destination: "bangalore",
        estimatedSteps: 4000,
        events: [
          {
            id: "w-wed",
            time: "09:00",
            endTime: "17:00",
            type: "activity",
            title: "Work Day",
            subtitle: "S & P final day at office",
            travelers: ["guys"],
            status: "confirmed",
            where: "EY Office, Old Madras Road",
            mapsLink: "https://maps.google.com/?q=EY+Old+Madras+Road+Bangalore",
            details: "Last work day in Bangalore. Wrap up and say goodbyes to colleagues.",
            travelTime: 60,
            travelNote: "🚗 45-75 min from Leela Palace (leave early!)",
            hoverImage: { url: "https://rmz-static.s3.dualstack.ap-south-1.amazonaws.com/01_264d8a9716.webp", caption: "RMZ Infinity - EY Bangalore" }
          },
          {
            id: "w-program-leads",
            time: "19:30",
            endTime: "20:30",
            type: "activity",
            title: "Monthly Program Leads Call",
            subtitle: "Seth from office",
            travelers: ["seth"],
            status: "confirmed",
            where: "Office",
            details: "Seth's Monthly Program Leads call. Paul heads back to hotel."
          },
          {
            id: "m-closing-dinner",
            time: "21:00",
            type: "meal",
            title: "Closing Dinner",
            subtitle: "Leela Palace farewell",
            travelers: ["guys"],
            status: "confirmed",
            where: "The Leela Palace Bengaluru",
            mapsLink: "https://maps.google.com/?q=Leela+Palace+Bangalore",
            venueLink: "https://www.theleela.com/the-leela-palace-bengaluru",
            details: "Final celebration at the hotel. Early night after - 4 AM departure!",
            hoverImage: { url: "https://cdn0.weddingwire.in/vendor/9648/3_2/1280/jpg/jamvar-outdoor_15_39648-161701164798216.jpeg", caption: "Jamvar at The Leela Palace" }
          },
          {
            id: "sleep-note",
            time: "23:00",
            type: "activity",
            title: "Early Night",
            subtitle: "4 AM departure tomorrow",
            travelers: ["guys"],
            status: "confirmed",
            details: "Set multiple alarms. Leave for airport ~2 AM."
          }
        ]
      },
      {
        date: "2026-02-12",
        dayNum: 12,
        label: "Thu, Feb 12",
        location: "BLR",
        theme: "S & P Return Home",
        destination: "travel",
        events: [
          {
            id: "h-leela-out",
            time: "02:00",
            type: "hotel",
            title: "Check out Leela Palace",
            subtitle: "4 wonderful nights",
            travelers: ["guys"],
            status: "confirmed",
            details: "Middle of the night checkout. Long journey home begins.",
            feelsLike: "3:30 PM ET (Wed)",
            travelTime: 45,
            travelNote: "🚗 45 min to airport (light traffic at 2 AM)"
          },
          {
            id: "f-blr-dxb",
            time: "04:00",
            type: "flight",
            title: "BLR → DXB",
            subtitle: "Emirates EK569 • 3h 30m",
            travelers: ["guys"],
            status: "confirmed",
            flightCode: "EK569",
            airline: "emirates",
            from: "BLR",
            to: "DXB",
            miles: 1675,
            details: "Arrives Dubai 7:10 AM. Quick connection to Chicago.",
            feelsLike: "5:30 PM ET (Wed)"
          },
          {
            id: "lounge-dxb-return",
            time: "07:30",
            endTime: "09:15",
            type: "activity",
            title: "Emirates Business Lounge",
            subtitle: "Morning refresh before long haul",
            travelers: ["guys"],
            status: "confirmed",
            where: "DXB Terminal 3, Concourse A",
            details: "Grab breakfast, freshen up with a shower, enjoy the Timeless Spa before the 15-hour flight to Chicago.",
            hoverImage: { url: "https://cdn.onemileatatime.com/wp-content/uploads/2022/07/Emirates-Business-Lounge-Dubai-55.jpeg", caption: "Emirates Business Lounge - Dining" },
            badges: ["lounge"]
          },
          {
            id: "f-dxb-ord",
            time: "09:45",
            type: "flight",
            title: "DXB → ORD",
            subtitle: "Emirates EK235 • 14h 50m",
            travelers: ["guys"],
            status: "confirmed",
            flightCode: "EK235",
            airline: "emirates",
            from: "DXB",
            to: "ORD",
            miles: 7228,
            details: "Long haul to Chicago. Arrives 3:45 PM CT.",
            feelsLike: "12:45 AM ET (Thu)"
          },
          {
            id: "lounge-ord",
            time: "16:30",
            endTime: "19:00",
            type: "activity",
            title: "Air France-KLM Lounge",
            subtitle: "Priority Pass via Chase Sapphire Reserve",
            travelers: ["guys"],
            status: "confirmed",
            where: "ORD Terminal 5, near Gate M17",
            details: "Relax before the final leg home. Complimentary food, drinks, and Wi-Fi. Open 5 PM-8 PM for Priority Pass. French-style hospitality.",
            hoverImage: { url: "https://thertwguys.com/wp-content/uploads/2019/06/chicago-air-france-klm-lounge-seating-1-1600x900.jpg", caption: "Air France-KLM Lounge ORD" },
            badges: ["lounge"]
          },
          {
            id: "f-ord-cmh",
            time: "19:35",
            type: "flight",
            title: "ORD → CMH",
            subtitle: "United (EK6236 codeshare) • 1h 27m",
            travelers: ["guys"],
            status: "confirmed",
            flightCode: "EK6236",
            airline: "united",
            from: "ORD",
            to: "CMH",
            miles: 297,
            details: "Final leg! Arrives Columbus 10:07 PM. Welcome home!"
          }
        ]
      }
    ];;
