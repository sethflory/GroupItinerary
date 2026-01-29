// ========================================
// PHOTO RIBBON, UPLOAD, LIGHTBOX
// ========================================

import { currentTripId, getCurrentPhotoPrefix } from '../state.js';
import { isFeatureEnabled, MAX_RIBBON_PHOTOS, PLACEHOLDER_COUNT } from '../config.js';
import { getStoredAccessCode } from '../auth.js';
import { loadPhotos, uploadPhoto as apiUploadPhoto } from '../api.js';

let tripPhotosCache = [];
let ribbonPaused = false;
let selectedFile = null;
let selectedFileData = null;

export async function loadTripPhotos() {
  try {
    const photos = await loadPhotos(currentTripId);
    tripPhotosCache = photos;
    renderPhotoRibbon(photos);
  } catch (error) {
    console.log('Photos API not available:', error.message);
    renderPhotoRibbon([]);
  }
}

export function renderPhotoRibbon(photos) {
  const ribbonEl = document.getElementById('ribbonScroll');
  const countEl = document.getElementById('ribbonCount');
  const controlsEl = document.getElementById('ribbonControls');

  if (!ribbonEl) return;

  const photoCount = photos.length;
  countEl.textContent = photoCount > 0
    ? `${photoCount} photo${photoCount !== 1 ? 's' : ''}`
    : 'No photos yet - be the first!';

  let ribbonHTML = '';
  const displayPhotos = photos.slice(0, MAX_RIBBON_PHOTOS);

  if (displayPhotos.length > 0) {
    // First set of photos
    displayPhotos.forEach(photo => {
      const caption = photo.metadata?.caption || '';
      const safeCaption = caption.replace(/'/g, "\\'");
      const uploader = (photo.metadata?.uploadedBy || '').replace(/'/g, "\\'");
      ribbonHTML += `
        <div class="ribbon-thumbnail" onclick="openLightbox('${photo.url}', '${safeCaption}', '${uploader}')">
          <img src="${photo.url}" alt="${caption}" loading="lazy">
        </div>
      `;
    });

    // Add placeholders if needed
    const placeholdersNeeded = Math.max(0, PLACEHOLDER_COUNT - displayPhotos.length);
    for (let i = 0; i < placeholdersNeeded; i++) {
      ribbonHTML += `
        <div class="ribbon-placeholder" onclick="openUploadModal()">
          <span class="material-symbols-outlined">add_a_photo</span>
          <span>Add yours</span>
        </div>
      `;
    }

    // Duplicate for seamless scrolling
    displayPhotos.forEach(photo => {
      const caption = photo.metadata?.caption || '';
      const safeCaption = caption.replace(/'/g, "\\'");
      const uploader = (photo.metadata?.uploadedBy || '').replace(/'/g, "\\'");
      ribbonHTML += `
        <div class="ribbon-thumbnail" onclick="openLightbox('${photo.url}', '${safeCaption}', '${uploader}')">
          <img src="${photo.url}" alt="${caption}" loading="lazy">
        </div>
      `;
    });

    controlsEl.style.display = 'flex';
  } else {
    // All placeholders when no photos
    const prompts = ['Your photo here!', 'Add a memory', 'Share a moment', 'Capture the trip', 'Add yours', 'Upload photo'];
    for (let i = 0; i < PLACEHOLDER_COUNT; i++) {
      ribbonHTML += `
        <div class="ribbon-placeholder" onclick="openUploadModal()">
          <span class="material-symbols-outlined">add_a_photo</span>
          <span>${prompts[i % prompts.length]}</span>
        </div>
      `;
    }
    controlsEl.style.display = 'none';
  }

  ribbonEl.innerHTML = ribbonHTML;
}

export function toggleRibbonPause() {
  setRibbonPaused(!ribbonPaused);
}

export function setRibbonPaused(paused) {
  ribbonPaused = paused;
  const ribbonEl = document.getElementById('ribbonScroll');
  const btnEl = document.getElementById('ribbonPauseBtn');

  if (ribbonEl) {
    ribbonEl.classList.toggle('paused', paused);
  }

  if (btnEl) {
    btnEl.innerHTML = paused
      ? '<span class="material-symbols-outlined">play_arrow</span> Play'
      : '<span class="material-symbols-outlined">pause</span> Pause';
  }
}

export function openUploadModal() {
  document.getElementById('uploadModal').classList.add('active');
  resetUploadForm();
}

export function closeUploadModal() {
  document.getElementById('uploadModal').classList.remove('active');
  resetUploadForm();
}

function resetUploadForm() {
  selectedFile = null;
  selectedFileData = null;
  document.getElementById('fileInput').value = '';
  document.getElementById('uploadPreview').classList.remove('visible');
  document.getElementById('previewImage').src = '';
  document.getElementById('photoCaption').value = '';
  document.getElementById('uploaderName').value = localStorage.getItem('uploaderName') || '';
  const submitBtn = document.getElementById('uploadSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">upload</span> Upload';
}

export function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    alert('Please select an image file');
    return;
  }

  if (file.size > 10 * 1024 * 1024) {
    alert('Image must be less than 10MB');
    return;
  }

  selectedFile = file;

  const reader = new FileReader();
  reader.onload = (e) => {
    selectedFileData = e.target.result;
    document.getElementById('previewImage').src = selectedFileData;
    document.getElementById('uploadPreview').classList.add('visible');
    document.getElementById('uploadSubmitBtn').disabled = false;
  };
  reader.readAsDataURL(file);
}

export async function uploadPhotoHandler() {
  if (!selectedFile || !selectedFileData) {
    alert('Please select a photo first');
    return;
  }

  const caption = document.getElementById('photoCaption').value.trim();
  const uploadedBy = document.getElementById('uploaderName').value.trim() || 'Anonymous';

  // Save uploader name for next time
  localStorage.setItem('uploaderName', uploadedBy);

  const submitBtn = document.getElementById('uploadSubmitBtn');
  submitBtn.disabled = true;
  submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle; animation: spin 1s linear infinite;">progress_activity</span> Uploading...';

  try {
    await apiUploadPhoto(currentTripId, {
      fileName: selectedFile.name,
      fileData: selectedFileData,
      caption,
      uploadedBy
    });

    closeUploadModal();
    loadTripPhotos(); // Refresh the ribbon
  } catch (error) {
    alert('Upload failed: ' + error.message);
    submitBtn.disabled = false;
    submitBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 18px; vertical-align: middle;">upload</span> Upload';
  }
}

export function openLightbox(url, caption, uploadedBy) {
  document.getElementById('lightboxImage').src = url;
  document.getElementById('lightboxCaption').innerHTML = `
    ${caption ? `<strong>${caption}</strong><br>` : ''}
    ${uploadedBy ? `<span style="opacity: 0.7">by ${uploadedBy}</span>` : ''}
  `;
  document.getElementById('photoLightbox').classList.add('visible');
  document.body.style.overflow = 'hidden';
}

export function closeLightbox() {
  document.getElementById('photoLightbox').classList.remove('visible');
  document.body.style.overflow = '';
}

// Export for global access
export function getPhotosCache() {
  return tripPhotosCache;
}
