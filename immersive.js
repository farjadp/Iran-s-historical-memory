/**
 * IRAN HISTORY TIMELINE — immersive.js
 * Immersive Horizontal Exhibition View logic.
 */

'use strict';

// ── State ──────────────────────────────────────────────────
let allData = null;
let activeEventId = null;
let activeEraFilter = 'all';
let searchQuery = '';
let filteredEvents = [];

const $ = id => document.getElementById(id);

// ── Init ───────────────────────────────────────────────────
(async function init() {
  loadTheme();
  
  try {
    const res = await fetch('data/history.json');
    allData = await res.json();
    
    // Sort events initially by dateSort
    allData.events.sort((a, b) => (a.dateSort ?? 9999) - (b.dateSort ?? 9999));
    
    setupEraFilters();
    applyFilterAndSearch();
    setupEventListeners();
    
    // Select first event by default
    if (filteredEvents.length > 0) {
      selectEvent(filteredEvents[0].id);
    }
  } catch (err) {
    console.error('Error loading history data:', err);
    $('imm-showcase-view').innerHTML = 
      '<p style="text-align:center;padding:40px;color:var(--text-muted)">⚠️ خطا در بارگذاری داده‌های تاریخچه.</p>';
  }
})();

// ── Theme Management ───────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem('iran_history_theme') || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  $('btn-theme-page').textContent = theme === 'light' ? '🌙' : '☀️';
  localStorage.setItem('iran_history_theme', theme);
}

// ── Setup Era Filters ──────────────────────────────────────
function setupEraFilters() {
  const sidebar = $('imm-era-filters');
  if (!sidebar || !allData) return;
  
  // Clear any existing except "All"
  const allBtn = sidebar.querySelector('[data-era="all"]');
  sidebar.innerHTML = '';
  sidebar.appendChild(allBtn);
  
  allData.eras.forEach(era => {
    const btn = document.createElement('button');
    btn.className = 'imm-filter-btn';
    btn.dataset.era = era.id;
    btn.innerHTML = `
      <span>${era.title}</span>
      <span class="era-dot" style="background: ${era.color};"></span>
    `;
    btn.addEventListener('click', () => {
      document.querySelectorAll('.imm-filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      activeEraFilter = era.id;
      applyFilterAndSearch();
    });
    sidebar.appendChild(btn);
  });
  
  // Re-hook All button
  allBtn.addEventListener('click', () => {
    document.querySelectorAll('.imm-filter-btn').forEach(b => b.classList.remove('active'));
    allBtn.classList.add('active');
    activeEraFilter = 'all';
    applyFilterAndSearch();
  });
}

// ── Filter and Search Logic ───────────────────────────────
function applyFilterAndSearch() {
  if (!allData) return;
  
  filteredEvents = allData.events.filter(e => {
    const matchesEra = activeEraFilter === 'all' || e.era === activeEraFilter;
    
    const term = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || 
      e.title.toLowerCase().includes(term) ||
      (e.summary && e.summary.toLowerCase().includes(term)) ||
      (e.description && e.description.toLowerCase().includes(term)) ||
      (e.tags && e.tags.some(t => t.toLowerCase().includes(term)));
      
    return matchesEra && matchesSearch;
  });
  
  renderTimelineTrack();
  
  // Select first matched event or show empty state
  if (filteredEvents.length > 0) {
    $('imm-event-card').style.display = 'grid';
    // If current active is no longer in filtered, select first
    if (!filteredEvents.some(e => e.id === activeEventId)) {
      selectEvent(filteredEvents[0].id);
    } else {
      selectEvent(activeEventId);
    }
  } else {
    // Show empty state
    $('imm-event-card').style.display = 'none';
    showToast('هیچ رویدادی با این مشخصات یافت نشد', 'warning');
  }
}

// ── Render Timeline Bottom Track ──────────────────────────
function renderTimelineTrack() {
  const track = $('imm-timeline-track');
  if (!track) return;
  track.innerHTML = '';
  
  filteredEvents.forEach(e => {
    const card = document.createElement('div');
    card.className = `imm-nav-card ${e.id === activeEventId ? 'active' : ''}`;
    card.dataset.id = e.id;
    
    // Find era color
    const era = allData.eras.find(eraObj => eraObj.id === e.era);
    const eraColor = era ? era.color : 'var(--gold)';
    
    card.innerHTML = `
      <div class="imm-nav-card-title">${escapeHtml(e.title)}</div>
      <div class="imm-nav-card-date">${escapeHtml(e.date)}</div>
      <div class="imm-nav-card-era" style="background: ${eraColor};"></div>
    `;
    
    card.addEventListener('click', () => {
      selectEvent(e.id);
    });
    
    track.appendChild(card);
  });
}

// ── Select and Display Event (Immersive Transition) ───────
function selectEvent(eventId) {
  if (!allData) return;
  activeEventId = eventId;
  
  // Update active state in bottom cards
  document.querySelectorAll('.imm-nav-card').forEach(card => {
    const isActive = card.dataset.id === eventId;
    card.classList.toggle('active', isActive);
    
    if (isActive) {
      card.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  });
  
  const event = allData.events.find(e => e.id === eventId);
  if (!event) return;
  
  const card = $('imm-event-card');
  // Trigger fade out
  card.classList.add('imm-fade-hidden');
  
  setTimeout(() => {
    // Populate card details
    $('imm-event-title').textContent = event.title;
    $('imm-event-summary').textContent = event.summary || '';
    $('imm-event-desc').textContent = event.description || 'توضیحات بیشتری برای این رویداد ثبت نشده است.';
    
    // Calendar dates
    $('imm-date-label').textContent = event.date;
    
    // Era badge
    const era = allData.eras.find(eraObj => eraObj.id === event.era);
    const eraBadge = $('imm-era-badge');
    if (eraBadge) {
      eraBadge.textContent = era ? era.title : '';
      eraBadge.style.background = era ? era.color : 'var(--gold)';
    }
    
    // Card Glow color
    const glow = $('imm-card-glow');
    if (glow && era) {
      glow.style.backgroundColor = era.color;
    }
    
    // Tags
    const tagsBox = $('imm-event-tags');
    tagsBox.innerHTML = '';
    if (event.tags && event.tags.length > 0) {
      event.tags.forEach(t => {
        const tagSpan = document.createElement('span');
        tagSpan.className = 'imm-tag';
        tagSpan.textContent = `# ${t}`;
        tagsBox.appendChild(tagSpan);
      });
    }
    
    // Flag
    const flagBox = $('imm-flag-box');
    const flagImg = $('imm-flag-img');
    if (event.flagUrl) {
      flagImg.src = event.flagUrl;
      flagImg.alt = event.flagAlt || event.title;
      flagBox.style.display = 'block';
    } else {
      flagBox.style.display = 'none';
    }
    
    // Rulers list
    const rulersBox = $('imm-rulers-box');
    const rulersList = $('imm-rulers-list');
    rulersList.innerHTML = '';
    
    if (event.rulers && event.rulers.length > 0) {
      event.rulers.forEach(r => {
        const rulerCard = document.createElement('div');
        rulerCard.className = 'imm-ruler-card';
        rulerCard.innerHTML = `
          <div class="imm-ruler-name">👑 ${escapeHtml(r.name)}</div>
          <div class="imm-ruler-reign">${escapeHtml(r.reign)}</div>
          ${r.note ? `<div class="imm-ruler-note">${escapeHtml(r.note)}</div>` : ''}
        `;
        rulersList.appendChild(rulerCard);
      });
      rulersBox.style.display = 'block';
    } else {
      rulersBox.style.display = 'none';
    }
    
    // References
    const refsSection = $('imm-event-refs-section');
    const refsGrid = $('imm-event-refs');
    refsGrid.innerHTML = '';
    
    if (event.references && event.references.length > 0) {
      event.references.forEach(ref => {
        const refLink = document.createElement('a');
        refLink.className = 'imm-ref-link';
        refLink.href = ref.url || '#';
        refLink.target = ref.url ? '_blank' : '_self';
        
        let icon = '🌐';
        if (ref.type === 'book') icon = '📚';
        else if (ref.type === 'video') icon = '🎬';
        else if (ref.type === 'image') icon = '🖼';
        else if (ref.type === 'article') icon = '📄';
        
        refLink.innerHTML = `
          <span>${icon}</span>
          <span style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(ref.title)} ${ref.author ? `(${escapeHtml(ref.author)})` : ''}
          </span>
        `;
        
        refsGrid.appendChild(refLink);
      });
      refsSection.style.display = 'block';
    } else {
      refsSection.style.display = 'none';
    }
    
    // Trigger fade in
    card.classList.remove('imm-fade-hidden');
  }, 180);
}

// ── Event Listeners ────────────────────────────────────────
function setupEventListeners() {
  
  // Theme Toggle
  $('btn-theme-page').addEventListener('click', () => {
    const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });
  
  // Search
  $('imm-search').addEventListener('input', (e) => {
    searchQuery = e.target.value.trim();
    applyFilterAndSearch();
  });
  
  // Bottom track arrow navigation
  $('btn-scroll-right').addEventListener('click', () => {
    $('imm-timeline-track').scrollBy({ left: 240, behavior: 'smooth' });
  });
  
  $('btn-scroll-left').addEventListener('click', () => {
    $('imm-timeline-track').scrollBy({ left: -240, behavior: 'smooth' });
  });
  
  // Keyboard Arrow navigation (ArrowLeft & ArrowRight)
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    
    if (filteredEvents.length === 0) return;
    
    const currentIndex = filteredEvents.findIndex(ev => ev.id === activeEventId);
    if (currentIndex === -1) return;
    
    if (e.key === 'ArrowLeft') {
      // Next event chronologically
      const nextIndex = Math.min(currentIndex + 1, filteredEvents.length - 1);
      selectEvent(filteredEvents[nextIndex].id);
    } else if (e.key === 'ArrowRight') {
      // Previous event chronologically
      const prevIndex = Math.max(currentIndex - 1, 0);
      selectEvent(filteredEvents[prevIndex].id);
    }
  });
}

// ── Toast Utility ──────────────────────────────────────────
function showToast(msg, type = 'success') {
  const container = document.body;
  const toast = document.createElement('div');
  toast.style.position = 'fixed';
  toast.style.bottom = '20px';
  toast.style.right = '20px';
  toast.style.padding = '12px 24px';
  toast.style.borderRadius = '8px';
  toast.style.zIndex = '999';
  toast.style.direction = 'rtl';
  toast.style.fontFamily = 'inherit';
  toast.style.fontSize = '0.9rem';
  toast.style.fontWeight = '600';
  toast.style.boxShadow = '0 5px 20px rgba(0,0,0,0.5)';
  toast.style.transition = 'all 300ms ease';
  
  if (type === 'error') {
    toast.style.background = '#e57373';
    toast.style.color = '#fff';
  } else if (type === 'warning') {
    toast.style.background = '#ffb74d';
    toast.style.color = '#000';
  } else {
    toast.style.background = '#81c784';
    toast.style.color = '#fff';
  }
  
  toast.textContent = msg;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    setTimeout(() => toast.remove(), 320);
  }, 2500);
}

// Helper to escape HTML tags
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
