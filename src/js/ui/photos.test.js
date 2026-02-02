// Mock dependencies
jest.mock('../state.js', () => ({
  currentTripId: 'test-trip',
  getCurrentPhotoPrefix: jest.fn(() => 'photos/')
}));

jest.mock('../config.js', () => ({
  isFeatureEnabled: jest.fn(),
  MAX_RIBBON_PHOTOS: 10,
  PLACEHOLDER_COUNT: 5
}));

jest.mock('../auth.js', () => ({
  getStoredAccessCode: jest.fn(() => 'test-access-code')
}));

jest.mock('../api.js', () => ({
  loadPhotos: jest.fn(),
  uploadPhoto: jest.fn(),
  deleteAllPhotos: jest.fn()
}));

import { renderPhotoRibbon, deleteAllPhotosHandler, loadTripPhotos } from './photos.js';
import { deleteAllPhotos, loadPhotos } from '../api.js';

describe('renderPhotoRibbon', () => {
  let ribbonEl, countEl, controlsEl;

  beforeEach(() => {
    // Create DOM elements
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonCount"></div>
      <div id="ribbonControls"></div>
    `;
    ribbonEl = document.getElementById('ribbonScroll');
    countEl = document.getElementById('ribbonCount');
    controlsEl = document.getElementById('ribbonControls');
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should handle missing ribbonScroll element gracefully', () => {
    document.body.innerHTML = '';
    expect(() => renderPhotoRibbon([])).not.toThrow();
  });

  it('should handle missing ribbonCount element gracefully', () => {
    document.body.innerHTML = '<div id="ribbonScroll"></div>';
    expect(() => renderPhotoRibbon([])).not.toThrow();
  });

  it('should handle missing ribbonControls element gracefully', () => {
    document.body.innerHTML = '<div id="ribbonScroll"></div>';
    expect(() => renderPhotoRibbon([])).not.toThrow();
  });

  it('should render with no photos', () => {
    renderPhotoRibbon([]);
    expect(countEl.textContent).toBe('No photos yet - be the first!');
    expect(controlsEl.style.display).toBe('none');
    expect(ribbonEl.innerHTML).toContain('ribbon-placeholder');
  });

  it('should render with single photo', () => {
    const photos = [
      {
        url: 'https://example.com/photo1.jpg',
        metadata: { caption: 'Test Photo' }
      }
    ];
    renderPhotoRibbon(photos);
    expect(countEl.textContent).toBe('1 photo');
    expect(controlsEl.style.display).toBe('flex');
    expect(ribbonEl.innerHTML).toContain('ribbon-thumbnail');
  });

  it('should render with multiple photos', () => {
    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: { caption: 'Photo 1' } },
      { url: 'https://example.com/photo2.jpg', metadata: { caption: 'Photo 2' } },
      { url: 'https://example.com/photo3.jpg', metadata: { caption: 'Photo 3' } }
    ];
    renderPhotoRibbon(photos);
    expect(countEl.textContent).toBe('3 photos');
    expect(controlsEl.style.display).toBe('flex');
    expect(ribbonEl.innerHTML).toContain('ribbon-thumbnail');
  });

  it('should handle photos without metadata', () => {
    const photos = [
      { url: 'https://example.com/photo1.jpg' }
    ];
    renderPhotoRibbon(photos);
    expect(countEl.textContent).toBe('1 photo');
    expect(ribbonEl.innerHTML).toContain('ribbon-thumbnail');
  });

  it('should work when all optional DOM elements are missing', () => {
    document.body.innerHTML = '<div id="ribbonScroll"></div>';
    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: { caption: 'Test' } }
    ];
    
    // Should not throw error even when countEl and controlsEl are missing
    expect(() => renderPhotoRibbon(photos)).not.toThrow();
    
    const ribbonEl = document.getElementById('ribbonScroll');
    expect(ribbonEl.innerHTML).toContain('ribbon-thumbnail');
  });
});

describe('deleteAllPhotosHandler', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Mock window.confirm and window.alert
    global.confirm = jest.fn();
    global.alert = jest.fn();
    
    // Create DOM elements
    document.body.innerHTML = `
      <div id="ribbonScroll"></div>
      <div id="ribbonCount"></div>
      <div id="ribbonControls"></div>
    `;
  });

  afterEach(() => {
    document.body.innerHTML = '';
  });

  it('should show alert when there are no photos to delete', async () => {
    // Mock loadPhotos to return empty array
    loadPhotos.mockResolvedValue([]);
    await loadTripPhotos();
    
    // Call deleteAllPhotosHandler when there are no photos
    await deleteAllPhotosHandler();
    
    expect(global.alert).toHaveBeenCalledWith('No photos to delete');
    expect(deleteAllPhotos).not.toHaveBeenCalled();
  });

  it('should not delete if user cancels confirmation', async () => {
    // Mock loadPhotos to return photos
    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: { caption: 'Photo 1' } },
      { url: 'https://example.com/photo2.jpg', metadata: { caption: 'Photo 2' } }
    ];
    loadPhotos.mockResolvedValue(photos);
    await loadTripPhotos();
    
    // Mock user cancelling
    global.confirm.mockReturnValue(false);
    
    // Should not proceed with deletion
    deleteAllPhotos.mockResolvedValue({ deletedCount: 0 });
    await deleteAllPhotosHandler();
    
    expect(global.confirm).toHaveBeenCalled();
    expect(deleteAllPhotos).not.toHaveBeenCalled();
  });

  it('should delete all photos when user confirms', async () => {
    // Mock loadPhotos to return photos
    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: { caption: 'Photo 1' } },
      { url: 'https://example.com/photo2.jpg', metadata: { caption: 'Photo 2' } }
    ];
    loadPhotos.mockResolvedValue(photos);
    await loadTripPhotos();
    
    // Mock user confirming
    global.confirm.mockReturnValue(true);
    
    // Mock successful deletion
    deleteAllPhotos.mockResolvedValue({ deletedCount: 2 });
    
    await deleteAllPhotosHandler();
    
    expect(global.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete ALL 2 photos? This action cannot be undone.'
    );
    expect(deleteAllPhotos).toHaveBeenCalledWith('test-trip');
    expect(global.alert).toHaveBeenCalledWith('Successfully deleted 2 photos');
  });

  it('should handle deletion errors gracefully', async () => {
    // Mock loadPhotos to return photos
    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: { caption: 'Photo 1' } }
    ];
    loadPhotos.mockResolvedValue(photos);
    await loadTripPhotos();
    
    // Mock user confirming
    global.confirm.mockReturnValue(true);
    
    // Mock deletion error
    const errorMessage = 'Network error';
    deleteAllPhotos.mockRejectedValue(new Error(errorMessage));
    
    await deleteAllPhotosHandler();
    
    expect(global.alert).toHaveBeenCalledWith('Failed to delete photos: ' + errorMessage);
  });

  it('should show correct singular form for 1 photo', async () => {
    // Mock loadPhotos to return 1 photo
    const photos = [
      { url: 'https://example.com/photo1.jpg', metadata: { caption: 'Photo 1' } }
    ];
    loadPhotos.mockResolvedValue(photos);
    await loadTripPhotos();
    
    // Mock user confirming
    global.confirm.mockReturnValue(true);
    
    // Mock successful deletion
    deleteAllPhotos.mockResolvedValue({ deletedCount: 1 });
    
    await deleteAllPhotosHandler();
    
    expect(global.confirm).toHaveBeenCalledWith(
      'Are you sure you want to delete ALL 1 photo? This action cannot be undone.'
    );
    expect(global.alert).toHaveBeenCalledWith('Successfully deleted 1 photo');
  });
});
