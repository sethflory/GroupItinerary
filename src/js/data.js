// ========================================
// HARDCODED DATA
// Will be replaced by API data when USE_TABLE_STORAGE is enabled
// ========================================

export const PRODUCTION_TRAVELERS = [];

export const PRODUCTION_HOTEL = null;

export const DESTINATIONS = {};

export const CAROUSELS = {};

export const PRODUCTION_PHASES = {};

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

export const PRODUCTION_DAYS = [];
