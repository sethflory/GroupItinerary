const {
  TABLES,
  generateRowKey,
  toDateKey
} = require('./tableStorage');

describe('tableStorage', () => {
  describe('TABLES constants', () => {
    it('should have all required table names', () => {
      expect(TABLES.USERS).toBe('Users');
      expect(TABLES.TRIPS).toBe('Trips');
      expect(TABLES.TRAVELERS).toBe('Travelers');
      expect(TABLES.DAYS).toBe('Days');
      expect(TABLES.EVENTS).toBe('Events');
      expect(TABLES.DINNER_POLLS).toBe('DinnerPolls');
    });

    it('should have feature tables', () => {
      expect(TABLES.TRIVIA_QUESTIONS).toBe('TriviaQuestions');
      expect(TABLES.TRIVIA_ROUNDS).toBe('TriviaRounds');
      expect(TABLES.PHOTOS).toBe('Photos');
    });

    it('should have Saw It tables', () => {
      expect(TABLES.SAW_IT_GAMES).toBe('SawItGames');
      expect(TABLES.SAW_IT_LISTS).toBe('SawItLists');
    });
  });

  describe('generateRowKey', () => {
    it('should generate unique keys', () => {
      const key1 = generateRowKey();
      const key2 = generateRowKey();
      expect(key1).not.toBe(key2);
    });

    it('should include prefix when provided', () => {
      const key = generateRowKey('poll');
      expect(key).toMatch(/^poll_\d+_[a-z0-9]+$/);
    });

    it('should generate key without prefix', () => {
      const key = generateRowKey();
      expect(key).toMatch(/^\d+_[a-z0-9]+$/);
    });

    it('should have timestamp portion padded to 15 characters', () => {
      const key = generateRowKey();
      const parts = key.split('_');
      // Timestamp portion should be 15 characters (padded)
      expect(parts[0]).toMatch(/^\d{15}$/);
    });
  });

  describe('toDateKey', () => {
    it('should extract date from ISO timestamp', () => {
      expect(toDateKey('2025-06-15T10:30:00Z')).toBe('2025-06-15');
    });

    it('should handle date-only string', () => {
      expect(toDateKey('2025-06-15')).toBe('2025-06-15');
    });

    it('should handle timestamp with timezone offset', () => {
      expect(toDateKey('2025-06-15T10:30:00+03:00')).toBe('2025-06-15');
    });
  });
});
