/**
 * IRAN HISTORY TIMELINE — immersive.js
 * Persian Exhibition View — Scroll-safe two-panel layout
 */

'use strict';

// ── State ───────────────────────────────────────────────────
let allData        = null;
let filteredEvents = [];
let activeEventId  = null;
let activeEraFilter = 'all';
let searchQuery    = '';

const $ = id => document.getElementById(id);

// ── Init ────────────────────────────────────────────────────
(async function init() {
  loadTheme();
  updateHeaderHeight();
  window.addEventListener('resize', updateHeaderHeight);

  try {
    const res = await fetch('data/history.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    allData = await res.json();
    allData.events.sort((a, b) => (a.dateSort ?? 9999) - (b.dateSort ?? 9999));

    buildEraChips();
    applyFilter();
    setupListeners();
  } catch (err) {
    console.error('Error loading history:', err);
    $('detail-content').innerHTML =
      '<p style="color:var(--text-muted);padding:40px;text-align:center">⚠️ خطا در بارگذاری اطلاعات تاریخچه.</p>';
  }
})();

// ── Header Height ─────────────────────────────────────────────
function updateHeaderHeight() {
  const h = $('persian-header');
  if (h) {
    document.documentElement.style.setProperty('--header-height', h.offsetHeight + 'px');
  }
}

// ── Theme ────────────────────────────────────────────────────
function loadTheme() {
  const t = localStorage.getItem('iran_history_theme') || 'dark';
  applyTheme(t);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  const btn = $('btn-theme-imm');
  if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
  localStorage.setItem('iran_history_theme', theme);
}

// ── Era Chips ────────────────────────────────────────────────
function buildEraChips() {
  const bar = $('era-chips-bar');
  if (!bar || !allData) return;

  const allBtn = bar.querySelector('[data-era="all"]');
  bar.innerHTML = '';
  bar.appendChild(allBtn);

  allData.eras.forEach(era => {
    const chip = document.createElement('button');
    chip.className = 'era-chip';
    chip.dataset.era = era.id;
    chip.innerHTML = `<span class="era-chip-dot" style="background:${era.color}"></span>${era.title}`;
    chip.addEventListener('click', () => {
      bar.querySelectorAll('.era-chip').forEach(c => c.classList.remove('active'));
      chip.classList.add('active');
      activeEraFilter = era.id;
      applyFilter();
    });
    bar.appendChild(chip);
  });

  allBtn.addEventListener('click', () => {
    bar.querySelectorAll('.era-chip').forEach(c => c.classList.remove('active'));
    allBtn.classList.add('active');
    activeEraFilter = 'all';
    applyFilter();
  });
}

// ── Filter Logic ─────────────────────────────────────────────
function applyFilter() {
  const term = searchQuery.toLowerCase();

  filteredEvents = allData.events.filter(e => {
    const byEra = activeEraFilter === 'all' || e.era === activeEraFilter;
    const bySearch = !term ||
      e.title.toLowerCase().includes(term) ||
      (e.summary  && e.summary.toLowerCase().includes(term)) ||
      (e.description && e.description.toLowerCase().includes(term)) ||
      (e.tags && e.tags.some(t => t.toLowerCase().includes(term)));
    return byEra && bySearch;
  });

  renderEventList();

  if (filteredEvents.length === 0) {
    $('detail-content').style.display = 'none';
    $('empty-state').classList.remove('hidden');
    return;
  }

  $('empty-state').classList.add('hidden');
  $('detail-content').style.display = '';

  // Keep active event if still in list, otherwise select first
  const stillActive = filteredEvents.some(e => e.id === activeEventId);
  selectEvent(stillActive ? activeEventId : filteredEvents[0].id, false);
}

// ── Render Event List ─────────────────────────────────────────
function renderEventList() {
  const container = $('events-list');
  container.innerHTML = '';

  if (filteredEvents.length === 0) {
    container.innerHTML = '<p style="text-align:center;color:var(--text-muted);padding:30px;font-size:0.85rem">رویدادی یافت نشد</p>';
    return;
  }

  filteredEvents.forEach(e => {
    const era = allData.eras.find(r => r.id === e.era);
    const eraColor = era ? era.color : 'var(--firouzeh)';

    const item = document.createElement('div');
    item.className = `ev-list-item${e.id === activeEventId ? ' active' : ''}`;
    item.dataset.id = e.id;
    item.setAttribute('role', 'button');
    item.setAttribute('tabindex', '0');
    item.setAttribute('aria-selected', e.id === activeEventId ? 'true' : 'false');

    item.innerHTML = `
      <div class="ev-list-title">
        <span class="ev-list-era-dot" style="background:${eraColor}"></span>
        ${escHtml(e.title)}
      </div>
      <div class="ev-list-date">${escHtml(e.date)}</div>
      ${e.summary ? `<div class="ev-list-summary">${escHtml(e.summary)}</div>` : ''}
    `;

    item.addEventListener('click', () => selectEvent(e.id));
    item.addEventListener('keydown', ev => {
      if (ev.key === 'Enter' || ev.key === ' ') {
        ev.preventDefault();
        selectEvent(e.id);
      }
    });

    container.appendChild(item);
  });
}

// ── Select Event ──────────────────────────────────────────────
function selectEvent(eventId, animate = true) {
  activeEventId = eventId;

  // Update list active states
  document.querySelectorAll('.ev-list-item').forEach(item => {
    const isActive = item.dataset.id === eventId;
    item.classList.toggle('active', isActive);
    item.setAttribute('aria-selected', isActive ? 'true' : 'false');
    if (isActive) {
      // Scroll the list item into view within the panel
      item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }
  });

  const event = allData.events.find(e => e.id === eventId);
  if (!event) return;

  const content = $('detail-content');

  if (animate) {
    content.classList.add('fading');
    setTimeout(() => {
      populateDetail(event);
      content.classList.remove('fading');
      // Scroll detail panel back to top
      $('detail-panel').scrollTop = 0;
    }, 200);
  } else {
    populateDetail(event);
  }
}

// ── Populate Detail ───────────────────────────────────────────
function populateDetail(event) {
  const era = allData.eras.find(r => r.id === event.era);
  const eraColor = era ? era.color : 'var(--firouzeh)';

  // Meta
  const badge = $('detail-era-badge');
  badge.textContent = era ? era.title : '';
  badge.style.background = eraColor;
  badge.style.boxShadow = `0 2px 12px ${eraColor}55`;

  $('detail-date').textContent = event.date || '';
  $('detail-title').textContent = event.title || '';

  // Summary
  const summaryEl = $('detail-summary');
  summaryEl.textContent = event.summary || '';
  summaryEl.style.borderColor = eraColor;
  summaryEl.style.background = `${eraColor}18`;

  // Description
  $('detail-desc').textContent = event.description || 'توضیحات کاملی برای این رویداد ثبت نشده است.';

  // Tags
  const tagsEl = $('detail-tags');
  tagsEl.innerHTML = '';
  (event.tags || []).forEach(tag => {
    const span = document.createElement('span');
    span.className = 'd-tag';
    span.textContent = `# ${tag}`;
    tagsEl.appendChild(span);
  });

  // Rulers
  const rulersSection = $('rulers-section');
  const rulersGrid = $('rulers-grid');
  rulersGrid.innerHTML = '';

  if (event.rulers && event.rulers.length > 0) {
    event.rulers.forEach(r => {
      const div = document.createElement('div');
      div.className = 'ruler-item';
      div.innerHTML = `
        <div class="ruler-name">👑 ${escHtml(r.name)}</div>
        ${r.reign ? `<div class="ruler-reign">${escHtml(r.reign)}</div>` : ''}
        ${r.note  ? `<div class="ruler-note">${escHtml(r.note)}</div>` : ''}
      `;
      rulersGrid.appendChild(div);
    });
    rulersSection.classList.remove('hidden');
  } else {
    rulersSection.classList.add('hidden');
  }

  // References
  const refsSection = $('refs-section');
  const refsList = $('refs-list');
  refsList.innerHTML = '';

  if (event.references && event.references.length > 0) {
    const iconMap = { book: '📚', video: '🎬', website: '🌐', image: '🖼', article: '📄' };

    event.references.forEach(ref => {
      const a = document.createElement('a');
      a.className = 'ref-item';
      a.href = ref.url || '#';
      a.target = ref.url ? '_blank' : '_self';
      a.rel = 'noopener noreferrer';

      const icon = iconMap[ref.type] || '🌐';
      const label = [ref.title, ref.author ? `(${ref.author})` : ''].filter(Boolean).join(' ');

      a.innerHTML = `
        <span class="ref-icon">${icon}</span>
        <span class="ref-title">${escHtml(label)}</span>
      `;
      refsList.appendChild(a);
    });
    refsSection.classList.remove('hidden');
  } else {
    refsSection.classList.add('hidden');
  }

  // Nav arrows
  updateNavButtons();
}

// ── Nav Buttons ───────────────────────────────────────────────
function updateNavButtons() {
  const idx = filteredEvents.findIndex(e => e.id === activeEventId);
  const total = filteredEvents.length;

  const prevBtn = $('btn-prev-event'); // next chronologically (earlier)
  const nextBtn = $('btn-next-event'); // prev chronologically (later)
  const counter = $('nav-counter');

  prevBtn.disabled = (idx >= total - 1);
  nextBtn.disabled = (idx <= 0);
  counter.textContent = `${idx + 1} از ${total}`;
}

// ── Event Listeners ───────────────────────────────────────────
function setupListeners() {
  // Theme toggle
  $('btn-theme-imm').addEventListener('click', () => {
    const cur = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
    applyTheme(cur === 'dark' ? 'light' : 'dark');
  });

  // Search
  $('imm-search').addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    applyFilter();
  });

  // Nav buttons
  $('btn-prev-event').addEventListener('click', () => {
    const idx = filteredEvents.findIndex(e => e.id === activeEventId);
    if (idx < filteredEvents.length - 1) selectEvent(filteredEvents[idx + 1].id);
  });

  $('btn-next-event').addEventListener('click', () => {
    const idx = filteredEvents.findIndex(e => e.id === activeEventId);
    if (idx > 0) selectEvent(filteredEvents[idx - 1].id);
  });

  // Keyboard arrows
  document.addEventListener('keydown', e => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const idx = filteredEvents.findIndex(ev => ev.id === activeEventId);
    if (idx === -1) return;

    if (e.key === 'ArrowLeft') {  // next in RTL = left
      const next = Math.min(idx + 1, filteredEvents.length - 1);
      selectEvent(filteredEvents[next].id);
    } else if (e.key === 'ArrowRight') { // prev in RTL = right
      const prev = Math.max(idx - 1, 0);
      selectEvent(filteredEvents[prev].id);
    }
  });
}

// ── Toast ─────────────────────────────────────────────────────
function showToast(msg, type = 'info') {
  const container = $('imm-toast-container');
  const toast = document.createElement('div');
  toast.className = 'imm-toast';
  toast.textContent = msg;
  if (type === 'error') toast.style.borderColor = 'var(--crimson)';
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transition = 'opacity 300ms';
    setTimeout(() => toast.remove(), 320);
  }, 2800);
}

// ── Util ──────────────────────────────────────────────────────
function escHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
