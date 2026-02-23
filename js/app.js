/* ============================================
   Main Application Controller
   Navigation, state management, and initialization.
   ============================================ */

const App = (() => {
  let currentSection = 'project';

  function init() {
    // Initialize modules
    TerrainModule.init();
    PreviewModule.init();
    ExportModule.init();

    // Navigation
    document.querySelectorAll('.nav-item').forEach(item => {
      item.addEventListener('click', () => {
        const section = item.dataset.section;
        navigateTo(section);
      });
    });

    // Toggle handlers for nail params
    document.getElementById('variableLength').addEventListener('change', (e) => {
      document.getElementById('variableLengthConfig').classList.toggle('hidden', !e.target.checked);
    });

    document.getElementById('centralizers').addEventListener('change', (e) => {
      document.getElementById('centralizerSpacingRow').style.display = e.target.checked ? '' : 'none';
    });

    // Keyboard navigation
    document.addEventListener('keydown', (e) => {
      if (e.ctrlKey || e.metaKey) {
        const sections = ['project', 'terrain', 'nails', 'preview', 'export'];
        const num = parseInt(e.key);
        if (num >= 1 && num <= 5) {
          e.preventDefault();
          navigateTo(sections[num - 1]);
        }
      }
    });

    // Trigger resize for canvases after DOM is ready
    setTimeout(() => {
      TerrainModule.resizeCanvas();
      PreviewModule.resizeCanvas();
    }, 100);
  }

  function navigateTo(section) {
    currentSection = section;

    // Update nav
    document.querySelectorAll('.nav-item').forEach(item => {
      item.classList.toggle('active', item.dataset.section === section);
    });

    // Update content
    document.querySelectorAll('.content-section').forEach(sec => {
      sec.classList.toggle('active', sec.id === `section-${section}`);
    });

    // Resize canvases when switching to their sections
    if (section === 'terrain') {
      setTimeout(() => TerrainModule.resizeCanvas(), 50);
    } else if (section === 'preview') {
      setTimeout(() => PreviewModule.resizeCanvas(), 50);
    }
  }

  function showToast(message, type = 'info') {
    const container = document.getElementById('toastContainer');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 3000);
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  return { navigateTo, showToast };
})();
