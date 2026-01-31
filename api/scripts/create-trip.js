/**
 * Create a new trip - Bootstrap script for beta launch
 *
 * Usage: node create-trip.js
 */

require('dotenv').config();

const {
  TABLES,
  upsertEntity,
  ensureTable
} = require('../shared/tableStorage');

// Configure your trip here
const TRIP_CONFIG = {
  id: 'greece-india-2026',
  name: 'Greece & India 2026',
  subtitle: 'Our Adventure',
  dates: 'February 1 - 12, 2026',
  description: 'Athens together, then onward to India',
  icon: '🌍',
  badge: 'live',
  startDate: '2026-02-01T00:00:00Z',
  endDate: '2026-02-12T23:59:59Z',
  masterCode: 'tripmaster2026'  // Admin access code
};

// First traveler (you - the trip creator)
const FIRST_TRAVELER = {
  name: 'Seth',
  color: '#134e5e',
  group: 'family'
};

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║               CREATE NEW TRIP                              ║');
  console.log('╚════════════════════════════════════════════════════════════╝\n');

  // Ensure tables exist
  console.log('Ensuring tables exist...');
  await ensureTable(TABLES.TRIPS);
  await ensureTable(TABLES.TRAVELERS);
  await ensureTable(TABLES.DAYS);
  await ensureTable(TABLES.EVENTS);

  // Create trip
  console.log('\nCreating trip:', TRIP_CONFIG.name);
  const tripEntity = {
    partitionKey: 'trips',
    rowKey: TRIP_CONFIG.id,
    name: TRIP_CONFIG.name,
    subtitle: TRIP_CONFIG.subtitle,
    dates: TRIP_CONFIG.dates,
    description: TRIP_CONFIG.description,
    icon: TRIP_CONFIG.icon,
    badge: TRIP_CONFIG.badge,
    startDate: TRIP_CONFIG.startDate,
    endDate: TRIP_CONFIG.endDate,
    createdAt: new Date().toISOString()
  };
  await upsertEntity(TABLES.TRIPS, tripEntity);
  console.log('  ✓ Trip created');

  // Create first traveler
  console.log('\nCreating first traveler:', FIRST_TRAVELER.name);
  const nameParts = FIRST_TRAVELER.name.trim().split(/\s+/);
  const initials = nameParts.length >= 2
    ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
    : FIRST_TRAVELER.name.trim().substring(0, 2).toUpperCase();

  const travelerId = FIRST_TRAVELER.name.toLowerCase().replace(/[^a-z0-9]/g, '') + '_admin';
  const accessCode = FIRST_TRAVELER.name.toLowerCase() + '2026';

  const travelerEntity = {
    partitionKey: TRIP_CONFIG.id,
    rowKey: travelerId,
    name: FIRST_TRAVELER.name,
    group: FIRST_TRAVELER.group || 'family',
    color: FIRST_TRAVELER.color || '#134e5e',
    initials,
    accessCode,
    triviaScore: 0,
    isAdmin: true,
    createdAt: new Date().toISOString()
  };
  await upsertEntity(TABLES.TRAVELERS, travelerEntity);
  console.log('  ✓ Traveler created');

  // Summary
  console.log('\n════════════════════════════════════════════════════════════');
  console.log('TRIP CREATED SUCCESSFULLY!\n');
  console.log('Trip ID:', TRIP_CONFIG.id);
  console.log('Trip Name:', TRIP_CONFIG.name);
  console.log('\nAccess Codes:');
  console.log('  Master (admin):', TRIP_CONFIG.masterCode);
  console.log('  ' + FIRST_TRAVELER.name + ':', accessCode);
  console.log('\n⚠️  IMPORTANT: Add to your .env file:');
  console.log(`TRIP_ACCESS_CODES={"${TRIP_CONFIG.id}":"${TRIP_CONFIG.masterCode}"}`);
  console.log('\nThen restart the Azure Functions.\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
