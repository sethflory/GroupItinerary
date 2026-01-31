/**
 * Clear all test data for a trip - prepare for beta launch
 *
 * Usage: node clear-test-data.js [tripId]
 *
 * This clears:
 * - All travelers (you'll add real ones via Trip Settings)
 * - All trip members
 * - All trivia data (questions, rounds, leaderboard, pokes)
 * - All location data
 * - All dinner polls
 * - All scavenger hunt data
 * - All saw-it game data
 * - All notifications
 *
 * It preserves:
 * - Trip configuration
 * - Days and Events (your itinerary)
 * - Destinations and Hotels
 */

require('dotenv').config();

const {
  TABLES,
  queryByPartition,
  deleteEntity,
  getTableClient
} = require('../shared/tableStorage');

const TRIP_ID = process.argv[2] || 'athens-bangalore-2026';

// Tables to clear completely for this trip
const TABLES_TO_CLEAR = [
  { name: TABLES.TRAVELERS, label: 'Travelers' },
  { name: TABLES.TRIP_MEMBERS, label: 'Trip Members' },
  { name: TABLES.TRAVELER_LOCATIONS, label: 'Locations' },
  { name: TABLES.TRIVIA_QUESTIONS, label: 'Trivia Questions' },
  { name: TABLES.TRIVIA_ROUNDS, label: 'Trivia Rounds' },
  { name: TABLES.TRIVIA_LEADERBOARD, label: 'Trivia Leaderboard' },
  { name: TABLES.TRIVIA_POKES, label: 'Trivia Pokes' },
  { name: TABLES.DINNER_POLLS, label: 'Dinner Polls' },
  { name: TABLES.SAW_IT_GAMES, label: 'Saw It Games' },
  { name: TABLES.SAW_IT_LISTS, label: 'Saw It Lists' },
  { name: TABLES.SCAVENGER_HUNTS, label: 'Scavenger Hunts' },
  { name: TABLES.SCAVENGER_HUNT_ITEMS, label: 'Scavenger Hunt Items' },
  { name: TABLES.NOTIFICATIONS, label: 'Notifications' },
];

async function clearTable(tableName, label) {
  try {
    const entities = await queryByPartition(tableName, TRIP_ID);
    if (entities.length === 0) {
      console.log(`  ${label}: (empty)`);
      return 0;
    }

    for (const entity of entities) {
      await deleteEntity(tableName, TRIP_ID, entity.rowKey);
    }
    console.log(`  ${label}: deleted ${entities.length} records`);
    return entities.length;
  } catch (err) {
    if (err.statusCode === 404) {
      console.log(`  ${label}: (table not found)`);
      return 0;
    }
    console.log(`  ${label}: ERROR - ${err.message}`);
    return 0;
  }
}

async function main() {
  console.log('╔════════════════════════════════════════════════════════════╗');
  console.log('║          CLEAR TEST DATA - BETA LAUNCH PREP                ║');
  console.log('╚════════════════════════════════════════════════════════════╝');
  console.log(`\nTrip ID: ${TRIP_ID}\n`);

  console.log('Clearing test data...\n');

  let totalDeleted = 0;

  for (const table of TABLES_TO_CLEAR) {
    const count = await clearTable(table.name, table.label);
    totalDeleted += count;
  }

  console.log('\n────────────────────────────────────────────────────────────');
  console.log(`Total records deleted: ${totalDeleted}`);
  console.log('────────────────────────────────────────────────────────────');

  // Show what's preserved
  console.log('\n✓ Preserved (not deleted):');
  console.log('  - Trip configuration');
  console.log('  - Days and Events (itinerary)');
  console.log('  - Destinations and Hotels');
  console.log('  - Photos');

  console.log('\n📋 Next steps:');
  console.log('  1. Open Trip Settings in the app');
  console.log('  2. Go to Travelers tab');
  console.log('  3. Add your real travelers');
  console.log('  4. Share access codes with each traveler');
  console.log('  5. Clear browser localStorage if needed');

  console.log('\n🚀 Ready for beta launch!\n');
}

main().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
