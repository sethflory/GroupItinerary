// ========================================
// HOW IT WORKS MODAL
// ========================================

export function openHowItWorks() {
  document.getElementById('hiwModal').classList.add('active');
}

export function closeHiwModal() {
  document.getElementById('hiwModal').classList.remove('active');
}

export function copyHiwPrompt() {
  const promptText = document.getElementById('hiwPromptCode').textContent;
  navigator.clipboard.writeText(promptText).then(() => {
    const btn = event.target.closest('.hiw-copy-btn');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<span class="material-symbols-outlined">check</span> Copied!';
    setTimeout(() => {
      btn.innerHTML = originalHtml;
    }, 2000);
  });
}

export function initModalListeners() {
  // Close modal on overlay click
  const hiwModal = document.getElementById('hiwModal');
  if (hiwModal) {
    hiwModal.addEventListener('click', (e) => {
      if (e.target.id === 'hiwModal') {
        closeHiwModal();
      }
    });
  }
}
