// Mock dependencies
jest.mock('../state.js', () => ({
  currentTripId: 'test-trip-123',
  getCurrentPhotoPrefix: jest.fn(() => 'test-prefix/')
}));

jest.mock('../config.js', () => ({
  isFeatureEnabled: jest.fn(() => true),
  MAX_RIBBON_PHOTOS: 20,
  PLACEHOLDER_COUNT: 6
}));

jest.mock('../auth.js', () => ({
  getStoredAccessCode: jest.fn(() => 'test-access-code')
}));

jest.mock('../api.js', () => ({
  loadPhotos: jest.fn(),
  uploadPhoto: jest.fn()
}));

import { renderPhotoRibbon } from './photos.js';

describe('renderPhotoRibbon', () => {
  beforeEach(() => {
    // Setup DOM
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should handle missing ribbonCount element without error', () => {
    const photos = [
      {
        url: 'https://example.com/photo1.jpg',
        metadata: { caption: 'Test photo' }
      }
    ];

    // Should not throw an error even though ribbonCount doesn't exist
    expect(() => renderPhotoRibbon(photos)).not.toThrow();
  });

  it('should handle missing ribbonControls element without error', () => {
    const photos = [
      {
        url: 'https://example.com/photo1.jpg',
        metadata: { caption: 'Test photo' }
      }
    ];

    // Should not throw an error even though ribbonControls doesn't exist
    expect(() => renderPhotoRibbon(photos)).not.toThrow();
  });

  it('should update ribbonCount when element exists', () => {
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonCount"></div>
    `;

    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: {} },
      { url: 'https://example.com/photo2.jpg', metadata: {} }
    ];

    renderPhotoRibbon(photos);

    const countEl = document.getElementById('ribbonCount');
    expect(countEl.textContent).toBe('2 photos');
  });

  it('should update ribbonCount with singular form for 1 photo', () => {
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonCount"></div>
    `;

    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: {} }
    ];

    renderPhotoRibbon(photos);

    const countEl = document.getElementById('ribbonCount');
    expect(countEl.textContent).toBe('1 photo');
  });

  it('should show "No photos yet" message when no photos', () => {
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonCount"></div>
    `;

    renderPhotoRibbon([]);

    const countEl = document.getElementById('ribbonCount');
    expect(countEl.textContent).toBe('No photos yet - be the first!');
  });

  it('should handle ribbonControls visibility when element exists with photos', () => {
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonControls" style="display: none;"></div>
    `;

    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: {} }
    ];

    renderPhotoRibbon(photos);

    const controlsEl = document.getElementById('ribbonControls');
    expect(controlsEl.style.display).toBe('flex');
  });

  it('should handle ribbonControls visibility when element exists without photos', () => {
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonControls" style="display: flex;"></div>
    `;

    renderPhotoRibbon([]);

    const controlsEl = document.getElementById('ribbonControls');
    expect(controlsEl.style.display).toBe('none');
  });

  it('should render photo thumbnails correctly', () => {
    const photos = [
      {
        url: 'https://example.com/photo1.jpg',
        metadata: {
          caption: 'Test caption',
          uploadedBy: 'John Doe',
          photoDate: '2024-01-01'
        }
      }
    ];

    renderPhotoRibbon(photos);

    const ribbonEl = document.getElementById('ribbonScroll');
    expect(ribbonEl.innerHTML).toContain('ribbon-thumbnail');
    expect(ribbonEl.innerHTML).toContain('https://example.com/photo1.jpg');
  });

  it('should render placeholders when no photos', () => {
    renderPhotoRibbon([]);

    const ribbonEl = document.getElementById('ribbonScroll');
    expect(ribbonEl.innerHTML).toContain('ribbon-placeholder');
    expect(ribbonEl.innerHTML).toContain('add_a_photo');
  });

  it('should not crash when ribbonScroll is missing', () => {
    document.body.innerHTML = '';

    expect(() => renderPhotoRibbon([])).not.toThrow();
  });
});
