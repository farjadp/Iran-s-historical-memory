// ═══════════════════════════════════════════════════
// en-main.js — English version of Iran History Timeline
// Uses title_en / summary_en / description_en from history.json
// Falls back to Persian if English not available
// ═══════════════════════════════════════════════════
const LANG = 'en';


// ── Language helpers ──────────────────────────────────
function getLangTitle(ev)   { return (LANG === 'en' && ev.title_en)       ? ev.title_en       : ev.title; }
function getLangSummary(ev) { return (LANG === 'en' && ev.summary_en)     ? ev.summary_en     : ev.summary; }
function getLangDesc(ev)    { return (LANG === 'en' && ev.description_en) ? ev.description_en : ev.description; }
function getLangEraTitle(era) { return (LANG === 'en' && era.title_en) ? era.title_en : era.title; }

/**
 * IRAN HISTORY TIMELINE — main.js
 * Loads data/history.json, renders timeline, manages side panel,
 * admin panel (add/edit/export), localStorage for extra refs.
 */

'use strict';

// ── Constants ──────────────────────────────────────────────
const DATA_URL        = '/data/history.json';
const STORAGE_KEY     = 'iran_history_extra';   // user-added refs
const STORAGE_EVENTS  = 'iran_history_events';  // user-added events
const STORAGE_THEME   = 'iran_history_theme';

// ── State ──────────────────────────────────────────────────
let allData          = null;  // parsed JSON
let extraRefs        = {};    // { eventId: [ ref, ... ] }
let extraEvents      = [];    // user-added events
let activeEventId    = null;
let activeEraFilter  = 'all';
let searchQuery      = '';
let isAdminLoggedIn  = sessionStorage.getItem('isAdminLoggedIn') === 'true';

function updateAdminUiState() {
  const editBtn = $('btn-panel-edit-event');
  if (editBtn) {
    if (isAdminLoggedIn) {
      editBtn.classList.remove('hidden');
    } else {
      editBtn.classList.add('hidden');
    }
  }
}

// ── DOM refs ───────────────────────────────────────────────
const $ = id => document.getElementById(id);

const timelineContainer = $('timeline-container');
const sidePanelEl       = $('side-panel');
const noResultsEl       = $('no-results');
const searchInput       = $('search-input');
const eraFilterBar      = $('era-filter-bar');
const adminDialog       = $('admin-dialog');
const toastContainer    = $('toast-container');

// Panel elements
const panelEraBadge   = $('panel-era-badge');
const panelTitle      = $('panel-title');
const panelSummary    = $('panel-summary');
const panelDesc       = $('panel-description');
const panelTagsEl     = $('panel-tags');
const refList         = $('ref-list');
const addRefForm      = $('add-ref-form');
const refTypeSelect   = $('ref-type-select');
const refTitleInput   = $('ref-title-input');
const refAuthorInput  = $('ref-author-input');
const refYearInput    = $('ref-year-input');
const refUrlInput     = $('ref-url-input');

// Admin elements
const eventForm       = $('event-form');
const formFeedback    = $('form-feedback');

// ── Init ───────────────────────────────────────────────────
(async function init() {
  loadTheme();
  loadLocalData();

  try {
    const res  = await fetch(DATA_URL);
    allData    = await res.json();
    extraEvents.forEach(ev => allData.events.push(ev));
    render();
    setupEventListeners();
  } catch (err) {
    console.error('Error loading data:', err);
    if (!allData) {
      timelineContainer.innerHTML =
        '<p style="text-align:center;padding:40px;color:var(--text-muted)">⚠️ Error loading data. Please use a local server.</p>';
    }
  }
})();

// ── Load / Save localStorage ───────────────────────────────
function loadLocalData() {
  try {
    extraRefs   = JSON.parse(localStorage.getItem(STORAGE_KEY)  || '{}');
    extraEvents = JSON.parse(localStorage.getItem(STORAGE_EVENTS) || '[]');
  } catch { extraRefs = {}; extraEvents = []; }
}

function saveLocalData() {
  localStorage.setItem(STORAGE_KEY,    JSON.stringify(extraRefs));
  localStorage.setItem(STORAGE_EVENTS, JSON.stringify(extraEvents));
  saveDatabaseToDisk();
}

function saveDatabaseToDisk() {
  const payload = {
    data: JSON.parse(buildExportData())
  };
  
  fetch('/api/save', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  .then(res => {
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return res.json();
  })
  .then(res => {
    if (res.status === 'success') {
      showToast('💾 تغییرات روی دیسک ذخیره شدند');
      // Clear local storage and reload from disk to ensure sync
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(STORAGE_EVENTS);
      loadLocalData();
      
      fetch(DATA_URL + '?cb=' + Date.now())
        .then(r => r.json())
        .then(json => {
          allData = json;
          render();
        });
    } else {
      showToast('❌ Error در ذخیره روی دیسک: ' + res.message, 'error');
    }
  })
  .catch(err => {
    console.error('Save to disk failed:', err);
    showToast('⚠️ ذخیره موقت در مرورگر انجام شد', 'warning');
  });
}

// ── Theme ──────────────────────────────────────────────────
function loadTheme() {
  const saved = localStorage.getItem(STORAGE_THEME) || 'dark';
  applyTheme(saved);
}

function applyTheme(theme) {
  document.documentElement.dataset.theme = theme === 'light' ? 'light' : '';
  $('btn-theme').textContent = theme === 'light' ? '🌙' : '☀️';
  localStorage.setItem(STORAGE_THEME, theme);
}

function toggleTheme() {
  const current = document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
}

// ── Render ─────────────────────────────────────────────────
function render() {
  buildEraFilterButtons();
  renderTimeline();
  updateStats();
  if ($('edit-list'))          populateAdminEraSelect(), renderEditList();
  setupScrollReveal();
}

function buildEraFilterButtons() {
  eraFilterBar.innerHTML = '<button class="era-btn active" data-era="all">All Eras</button>';
  allData.eras.forEach(era => {
    const btn = document.createElement('button');
    btn.className    = 'era-btn';
    btn.dataset.era  = era.id;
    btn.textContent  = getLangEraTitle(era);
    btn.style.cssText = `--era-color:${era.color}`;
    eraFilterBar.appendChild(btn);
  });
  eraFilterBar.querySelectorAll('.era-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      activeEraFilter = btn.dataset.era;
      eraFilterBar.querySelectorAll('.era-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      // Color active era button
      if (activeEraFilter !== 'all') {
        const era = allData.eras.find(e => e.id === activeEraFilter);
        if (era) btn.style.background = era.color;
      } else {
        btn.style.background = 'var(--gold)';
      }

      renderTimeline();
    });
  });
}

function getFilteredEvents() {
  let events = allData.events;

  if (activeEraFilter !== 'all') {
    events = events.filter(e => e.era === activeEraFilter);
  }

  if (searchQuery) {
    const q = searchQuery.toLowerCase();
    events = events.filter(e =>
      getLangTitle(e).toLowerCase().includes(q) ||
      getLangSummary(e).toLowerCase().includes(q) ||
      (e.tags || []).some(t => t.toLowerCase().includes(q))
    );
  }

  // Sort a copy so allData.events original order is never mutated
  return [...events].sort((a, b) => {
    const da = (a.dateSort != null) ? a.dateSort : 99999;
    const db = (b.dateSort != null) ? b.dateSort : 99999;
    return da - db;
  });
}

function renderTimeline() {
  timelineContainer.innerHTML = '';
  const events = getFilteredEvents();

  if (events.length === 0) {
    noResultsEl.classList.remove('hidden');
    return;
  }
  noResultsEl.classList.add('hidden');

  // Group by era
  const grouped = {};
  events.forEach(ev => {
    if (!grouped[ev.era]) grouped[ev.era] = [];
    grouped[ev.era].push(ev);
  });

  let cardIndex = 0;

  Object.entries(grouped).forEach(([eraId, eraEvents]) => {
    const era = allData.eras.find(e => e.id === eraId) || { title: eraId, color: '#C8893A' };

    // Era label
    const labelEl = document.createElement('div');
    labelEl.className = 'era-group-label';
    labelEl.innerHTML = `
      <div class="era-group-label-inner">
        <span class="era-group-label-dot" style="background:${era.color}"></span>
        ${getLangEraTitle(era)}
      </div>`;
    timelineContainer.appendChild(labelEl);

    eraEvents.forEach(event => {
      const el = createEventEl(event, cardIndex++);
      timelineContainer.appendChild(el);
    });
  });

  // Re-setup scroll reveal for new elements
  setupScrollReveal();
}

function createEventEl(event, index) {
  const era    = allData.eras.find(e => e.id === event.era) || { color: '#C8893A', title: '' };
  const color  = event.color || era.color;
  const tags   = (event.tags || []).slice(0, 3);
  const isEven = index % 2 === 0;

  const wrapper = document.createElement('div');
  wrapper.className  = 'timeline-event';
  wrapper.dataset.id = event.id;
  wrapper.setAttribute('role', 'listitem');

  const nodeHtml = `
    <div class="event-node">
      <button class="node-dot" style="--era-color:${color}" tabindex="0"
              aria-label="مشاهده ${event.title}" data-id="${event.id}">
        ${getEraEmoji(event.era)}
      </button>
    </div>`;

  const cardHtml = `
    <div class="event-card" tabindex="0" data-id="${event.id}"
         aria-label="${getLangTitle(event)}" role="button">
      <div class="card-meta">
        <span class="card-era-dot" style="background:${color}"></span>
        <span class="card-date">${event.date}</span>
        ${event.flagUrl ? `<img class="card-flag" src="${event.flagUrl}" alt="${escHtml(event.flagAlt || '')}" loading="lazy" onerror="this.style.display='none'" />` : ''}
      </div>
      <h3 class="card-title">${getLangTitle(event)}</h3>
      <p class="card-summary">${getLangSummary(event)}</p>
      ${tags.length ? `<div class="card-tags">${tags.map(t => `<span class="card-tag">${t}</span>`).join('')}</div>` : ''}
    </div>`;

  const emptyHtml = `<div class="event-empty"></div>`;

  if (isEven) {
    wrapper.innerHTML = cardHtml + nodeHtml + emptyHtml;
    wrapper.querySelector('.event-card').style.setProperty('--era-color', color);
  } else {
    wrapper.innerHTML = emptyHtml + nodeHtml + cardHtml;
    wrapper.querySelector('.event-card').style.setProperty('--era-color', color);
  }

  return wrapper;
}

function getEraEmoji(eraId) {
  const map = {
    'bastan':       '🏛',
    'eslami-avval': '📜',
    'eslami-miani': '⚔️',
    'safaviyeh':    '🕌',
    'qajar':        '👑',
    'pahlavi':      '🏗',
    'moaser':       '✊',
  };
  return map[eraId] || '📌';
}

// ── Scroll Reveal Fallback (for browsers without scroll-driven) ──
function setupScrollReveal() {
  const supportsScrollTimeline = CSS.supports('animation-timeline', 'view()');

  document.querySelectorAll('.timeline-event').forEach(el => {
    if (supportsScrollTimeline) {
      el.classList.remove('reveal', 'visible');
    } else {
      el.classList.add('reveal');
    }
  });

  if (supportsScrollTimeline) return; // handled by CSS

  const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1, rootMargin: '0px 0px -50px 0px' });

  document.querySelectorAll('.timeline-event.reveal').forEach(el => {
    observer.observe(el);
  });
}

// ── Stats ──────────────────────────────────────────────────
function updateStats() {
  const totalRefs = allData.events.reduce((sum, ev) => {
    const extra = extraRefs[ev.id] ? extraRefs[ev.id].length : 0;
    return sum + (ev.references || []).length + extra;
  }, 0);

  $('stat-events').textContent = toFarsiNum(allData.events.length);
  $('stat-refs').textContent   = toFarsiNum(totalRefs);
}

function toFarsiNum(n) {
  return String(n); // EN version: use regular digits
}

// ── Calendar Conversions ────────────────────────────────────
function toEngNum(str) {
  if (!str) return '';
  const farsiDigits = [/۰/g, /۱/g, /۲/g, /۳/g, /۴/g, /۵/g, /۶/g, /۷/g, /۸/g, /۹/g];
  for (let i = 0; i < 10; i++) {
    str = str.replace(farsiDigits[i], i);
  }
  return str;
}

function parseDateStringToYears(dateStr) {
  if (!dateStr) return [];
  const normalized = toEngNum(dateStr).trim();
  
  // Split by dash/en-dash
  const parts = normalized.split(/[-–]/).map(p => p.trim());
  
  if (parts.length === 1) {
    const part = parts[0];
    const isBC = part.includes('ق.م');
    const num = parseInt(part.replace(/[^\d]/g, ''), 10);
    if (isNaN(num)) return [];
    return [isBC ? -num : num];
  } else if (parts.length === 2) {
    const p1 = parts[0];
    const p2 = parts[1];
    
    const isBC2 = p2.includes('ق.م');
    const isAD2 = p2.includes('م');
    
    const isBC1 = p1.includes('ق.م') || (isBC2 && !p1.includes('م'));
    
    const num1 = parseInt(p1.replace(/[^\d]/g, ''), 10);
    const num2 = parseInt(p2.replace(/[^\d]/g, ''), 10);
    
    if (isNaN(num1) || isNaN(num2)) return [];
    
    const val1 = isBC1 ? -num1 : num1;
    const val2 = isBC2 ? -num2 : num2;
    return [val1, val2];
  }
  return [];
}

function formatShamsiYear(year) {
  if (year === null || year === undefined) return '';
  if (year <= 0) {
    return `${toFarsiNum(Math.abs(year))} ق.م`;
  }
  if (year < 622) {
    return `${toFarsiNum(year)} م (ق.ه)`;
  }
  const sh = year - 621;
  return `${toFarsiNum(sh)} ه.ش`;
}

function formatShahanshahiYear(year) {
  if (year === null || year === undefined) return '';
  const sh = year + 559;
  if (sh <= 0) {
    return `${toFarsiNum(Math.abs(sh))} پ.ش`;
  }
  return `${toFarsiNum(sh)} شاهنشاهی`;
}

function toShamsi(dateLabel) {
  if (!dateLabel) return '—';
  const years = parseDateStringToYears(dateLabel);
  if (years.length === 0) return '—';
  if (years.length === 1) {
    return formatShamsiYear(years[0]);
  }
  const [y1, y2] = years;
  
  if (y1 <= 0 && y2 <= 0) {
    return `${toFarsiNum(Math.abs(y1))} – ${toFarsiNum(Math.abs(y2))} ق.م`;
  }
  if (y1 > 0 && y1 < 622 && y2 > 0 && y2 < 622) {
    return `${toFarsiNum(y1)} – ${toFarsiNum(y2)} م (ق.ه)`;
  }
  if (y1 >= 622 && y2 >= 622) {
    return `${toFarsiNum(y1 - 621)} – ${toFarsiNum(y2 - 621)} ه.ش`;
  }
  
  return `${formatShamsiYear(y1)} – ${formatShamsiYear(y2)}`;
}

function toShahanshahi(dateLabel) {
  if (!dateLabel) return '—';
  const years = parseDateStringToYears(dateLabel);
  if (years.length === 0) return '—';
  if (years.length === 1) {
    return formatShahanshahiYear(years[0]);
  }
  const [y1, y2] = years;
  const sh1 = y1 + 559;
  const sh2 = y2 + 559;
  
  if (sh1 <= 0 && sh2 <= 0) {
    return `${toFarsiNum(Math.abs(sh1))} – ${toFarsiNum(Math.abs(sh2))} پ.ش`;
  }
  if (sh1 > 0 && sh2 > 0) {
    return `${toFarsiNum(sh1)} – ${toFarsiNum(sh2)} شاهنشاهی`;
  }
  
  return `${formatShahanshahiYear(y1)} – ${formatShahanshahiYear(y2)}`;
}

function formatMiladi(date) {
  return date || '—';
}

// ── Side Panel ─────────────────────────────────────────────
function openPanel(eventId) {
  const event = allData.events.find(e => e.id === eventId);
  if (!event) return;

  activeEventId = eventId;
  const era = allData.eras.find(e => e.id === event.era) || { title: '', color: '#C8893A' };

  // Badge
  panelEraBadge.textContent = getLangEraTitle(era);
  panelEraBadge.style.background = era.color;

  // Three-calendar dates
  $('cal-miladi').textContent       = formatMiladi(event.date);
  $('cal-shamsi').textContent       = toShamsi(event.date);
  $('cal-shahanshahi').textContent  = toShahanshahi(event.date);

  // Flag
  const flagEl = $('panel-flag');
  if (event.flagUrl) {
    flagEl.src = event.flagUrl;
    flagEl.alt = event.flagAlt || '';
    flagEl.style.display = '';
    flagEl.onerror = () => { flagEl.style.display = 'none'; };
  } else {
    flagEl.style.display = 'none';
  }

  panelTitle.textContent   = getLangTitle(event);
  panelSummary.textContent = getLangSummary(event);
  panelDesc.textContent    = getLangDesc(event) || '';

  // Tags
  panelTagsEl.innerHTML = (event.tags || [])
    .map(t => `<span class="panel-tag">#${t}</span>`).join('');

  // Dynasty rulers tree
  renderRulersTree(event);

  // Refs
  renderRefs(event);

  // Update edit button visibility
  updateAdminUiState();

  // Active state on card/node
  document.querySelectorAll('.event-card.active, .node-dot.active').forEach(el => el.classList.remove('active'));
  document.querySelectorAll(`[data-id="${eventId}"]`).forEach(el => el.classList.add('active'));

  // Bloody Dey 1404 Theme Check
  if (eventId === 'user_1782328116866') {
    sidePanelEl.classList.add('bloody-dey-theme');
  } else {
    sidePanelEl.classList.remove('bloody-dey-theme');
  }

  // Open
  sidePanelEl.classList.add('open');
  sidePanelEl.setAttribute('aria-hidden', 'false');
  $('panel-close').focus();
  document.body.style.overflow = 'hidden';
}

function closePanel() {
  sidePanelEl.classList.remove('open');
  sidePanelEl.setAttribute('aria-hidden', 'true');
  document.querySelectorAll('.event-card.active, .node-dot.active').forEach(el => el.classList.remove('active'));
  activeEventId = null;
  document.body.style.overflow = '';

  // Hide add-ref form
  addRefForm?.classList.add('hidden');
}

// ── Dynasty Rulers Tree ──────────────────────────────────────
function renderRulersTree(event) {
  const section = $('dynasty-section');
  const treeEl  = $('dynasty-tree');

  if (!event.rulers || event.rulers.length === 0) {
    section.classList.add('hidden');
    return;
  }

  section.classList.remove('hidden');
  treeEl.innerHTML = event.rulers.map((ruler, i) => `
    <li class="ruler-node">
      <div class="ruler-index">${toFarsiNum(i + 1)}</div>
      <div class="ruler-info">
        <div class="ruler-name">${escHtml(ruler.name)}</div>
        ${ruler.reign ? `<div class="ruler-reign">${escHtml(ruler.reign)}</div>` : ''}
        ${ruler.note  ? `<div class="ruler-note">${escHtml(ruler.note)}</div>`  : ''}
      </div>
    </li>
  `).join('');
}

function renderRefs(event) {

  const baseRefs  = event.references || [];
  const localRefs = (extraRefs[event.id] || []).map(r => ({ ...r, _local: true }));
  const allRefs   = [...baseRefs, ...localRefs];

  if (allRefs.length === 0) {
    refList.innerHTML = '<li style="color:var(--text-muted);font-size:0.85rem;padding:8px 0">No sources yet.</li>';
    return;
  }

  refList.innerHTML = allRefs.map((ref, i) => {
    const icon = getRefIcon(ref.type);
    const meta = [ref.author, ref.year].filter(Boolean).join(' · ');
    return `
      <li class="ref-item">
        <span class="ref-icon">${icon}</span>
        <div class="ref-content">
          <div class="ref-title">${escHtml(ref.title)}</div>
          ${meta ? `<div class="ref-meta">${escHtml(meta)}</div>` : ''}
          ${ref.url ? `<a class="ref-link" href="${escHtml(ref.url)}" target="_blank" rel="noopener noreferrer">🔗 Open Link</a>` : ''}
        </div>
        ${ref._local ? '<span class="ref-local-badge">جدید</span>' : ''}
      </li>`;
  }).join('');
}

function getRefIcon(type) {
  return { book: '📚', video: '🎬', website: '🌐', image: '🖼', article: '📄' }[type] || '📌';
}

function escHtml(str) {
  return String(str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Add Reference ──────────────────────────────────────────
function saveNewRef() {
  const title = refTitleInput.value.trim();
  if (!title || !activeEventId) { showToast('Source title is required', 'error'); return; }

  const ref = {
    type:   refTypeSelect.value,
    title,
    author: refAuthorInput.value.trim() || undefined,
    year:   refYearInput.value.trim()   || undefined,
    url:    refUrlInput.value.trim()    || undefined,
    _local: true,
  };

  if (!extraRefs[activeEventId]) extraRefs[activeEventId] = [];
  extraRefs[activeEventId].push(ref);
  saveLocalData();

  const event = allData.events.find(e => e.id === activeEventId);
  renderRefs(event);
  updateStats();

  // Reset form
  refTitleInput.value = '';
  refAuthorInput.value = '';
  refYearInput.value = '';
  refUrlInput.value = '';
  addRefForm?.classList.add('hidden');

  showToast('✅ منبع با موفقیت اضافه شد');
}

// ── Admin Panel ────────────────────────────────────────────
function populateAdminEraSelect() {
  const eraOptions = allData.eras.map(e => `<option value="${e.id}">${e.title}</option>`).join('');
  const sel = $('ev-era');
  if (sel) sel.innerHTML = eraOptions;
  const proSel = $('pro-ev-era');
  if (proSel) proSel.innerHTML = eraOptions;
}

// ── Pro Editor State ───────────────────────────────────────
let proEditorEventId = null;

function renderEditList(filter = '') {
  const editList = $('edit-list');
  const events = allData.events.filter(ev =>
    !filter || getLangTitle(ev).toLowerCase().includes(filter.toLowerCase())
  );

  if (events.length === 0) {
    editList.innerHTML = '<p style="color:var(--text-muted);font-size:0.85rem;padding:12px 0">No events found.</p>';
    return;
  }

  editList.innerHTML = events.map(ev => {
    const era = allData.eras.find(e => e.id === ev.era);
    const isSelected = ev.id === proEditorEventId;
    return `
      <div class="edit-list-item${isSelected ? ' selected' : ''}" data-id="${ev.id}">
        <div class="edit-item-info">
          <div class="edit-item-title">${escHtml(getLangTitle(ev))}</div>
          <div class="edit-item-date">${escHtml(ev.date)}${era ? ' — ' + getLangEraTitle(era) : ''}</div>
        </div>
        <button class="btn-edit-item" data-id="${ev.id}" style="display:none">v</button>
        <button class="btn-delete-item" data-id="${ev.id}" style="display:none">x</button>
      </div>`;
  }).join('');
}

function loadEventIntoProEditor(eventId) {
  const ev = allData.events.find(e => e.id === eventId);
  if (!ev) return;

  proEditorEventId = eventId;
  renderEditList($('admin-search')?.value || '');

  $('pro-editor-empty').classList.add('hidden');
  $('pro-editor-fields').classList.remove('hidden');
  $('pro-editor-event-name').textContent = ev.title;

  $('pro-ev-title').value       = ev.title;
  $('pro-ev-date').value        = ev.date;
  $('pro-ev-datesort').value    = ev.dateSort || '';
  $('pro-ev-era').value         = ev.era;
  $('pro-ev-summary').value     = ev.summary;
  $('pro-ev-description').value = getLangDesc(ev) || '';
  $('pro-ev-tags').value        = (ev.tags || []).join(', ');

  const statusEl = $('pro-save-status');
  statusEl.textContent = '';
  statusEl.className = 'pro-save-status';

  renderProRulers(ev);
  renderProRefs(ev);
  switchEditorSubtab('basic');
}

function renderProRulers(ev) {
  const list = $('rulers-editor-list');
  const rulers = ev.rulers || [];
  if (rulers.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem">No rulers recorded.</p>';
    return;
  }
  list.innerHTML = rulers.map((r, i) => `
    <div class="ruler-editor-item">
      <div class="ruler-editor-item-info">
        <div class="ruler-editor-item-name">${escHtml(r.name)}</div>
        ${r.reign ? `<div class="ruler-editor-item-reign">${escHtml(r.reign)}</div>` : ''}
        ${r.note  ? `<div class="ruler-editor-item-note">${escHtml(r.note)}</div>` : ''}
      </div>
      <button class="btn-ruler-delete" data-ruler-index="${i}" title="حذف حاکم">✕</button>
    </div>`).join('');
}

function renderProRefs(ev) {
  const list = $('refs-editor-list');
  const refs = [...(ev.references || []), ...(extraRefs[ev.id] || [])];
  if (refs.length === 0) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:0.82rem">No sources recorded.</p>';
    return;
  }
  list.innerHTML = refs.map((r, i) => {
    const icon = getRefIcon(r.type);
    const meta = [r.author, r.year].filter(Boolean).join(' · ');
    return `
      <div class="ref-editor-item">
        <span style="font-size:1.2rem;flex-shrink:0">${icon}</span>
        <div class="ref-editor-item-info">
          <div class="ref-editor-item-title">${escHtml(r.title)}</div>
          ${meta ? `<div class="ref-editor-item-meta">${escHtml(meta)}</div>` : ''}
          ${r.url ? `<a class="ref-editor-item-link" href="${escHtml(r.url)}" target="_blank" rel="noopener">🔗 ${escHtml(r.url)}</a>` : ''}
        </div>
        <button class="btn-ref-delete" data-ref-index="${i}" title="حذف منبع">✕</button>
      </div>`;
  }).join('');
}

function switchEditorSubtab(subtabId) {
  document.querySelectorAll('.editor-subtab').forEach(t => {
    t.classList.toggle('active', t.dataset.subtab === subtabId);
  });
  document.querySelectorAll('.editor-subpanel').forEach(p => {
    p.classList.toggle('active', p.id === 'subpanel-' + subtabId);
  });
}

async function proSaveEvent() {
  if (!proEditorEventId) return;
  const ev = allData.events.find(e => e.id === proEditorEventId);
  if (!ev) return;

  const statusEl = $('pro-save-status');
  statusEl.textContent = 'Saving...';
  statusEl.className = 'pro-save-status saving';

  const updated = {
    ...ev,
    title:       $('pro-ev-title').value.trim(),
    date:        $('pro-ev-date').value.trim(),
    dateSort:    parseFloat($('pro-ev-datesort').value) || ev.dateSort || 9999,
    era:         $('pro-ev-era').value,
    summary:     $('pro-ev-summary').value.trim(),
    description: $('pro-ev-description').value.trim(),
    tags:        $('pro-ev-tags').value.split(',').map(t => t.trim()).filter(Boolean),
  };

  try {
    const res = await fetch(`/api/events/${proEditorEventId}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-session-token'
      },
      body: JSON.stringify({ event: updated })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'خطا در ذخیره');

    const idx = allData.events.findIndex(e => e.id === proEditorEventId);
    if (idx !== -1) allData.events[idx] = data.event || updated;

    renderTimeline();
    renderEditList($('admin-search')?.value || '');
    updateStats();
    $('pro-editor-event-name').textContent = updated.title;

    statusEl.textContent = '✅ Saved';
    statusEl.className = 'pro-save-status saved';
    setTimeout(() => { statusEl.textContent = ''; statusEl.className = 'pro-save-status'; }, 3000);
    showToast('✅ Event updated successfully');
  } catch (err) {
    statusEl.textContent = '❌ Error';
    statusEl.className = 'pro-save-status error';
    showToast('❌ ' + err.message, 'error');
  }
}

function showDeleteConfirm(eventId) {
  const ev = allData.events.find(e => e.id === eventId);
  if (!ev) return;
  $('confirm-delete-event-name').textContent = ev.title;
  const dialog = $('confirm-delete-dialog');
  dialog.dataset.targetId = eventId;
  dialog.showModal();
}

async function executeDeleteEvent(eventId) {
  const btn = $('btn-confirm-delete');
  btn.disabled = true;
  btn.textContent = 'Deleting...';

  try {
    const res = await fetch(`/api/events/${eventId}`, {
      method: 'DELETE',
      headers: { 'Authorization': 'Bearer admin-session-token' }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'خطا در حذف');

    const idx = allData.events.findIndex(e => e.id === eventId);
    if (idx !== -1) allData.events.splice(idx, 1);
    extraEvents = extraEvents.filter(e => e.id !== eventId);

    $('confirm-delete-dialog')?.close();
    showToast('🗑 Event deleted successfully');

    if (proEditorEventId === eventId) {
      proEditorEventId = null;
      $('pro-editor-empty').classList.remove('hidden');
      $('pro-editor-fields').classList.add('hidden');
    }
    if (sidePanelEl.classList.contains('open') && activeEventId === eventId) closePanel();
    renderTimeline();
    renderEditList();
    updateStats();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  } finally {
    btn.disabled = false;
    btn.textContent = 'Yes, Delete';
  }
}

function deleteEvent(eventId) {
  showDeleteConfirm(eventId);
}

function loadEventForEdit(eventId) {
  // Route to pro editor
  switchAdminTab('edit');
  loadEventIntoProEditor(eventId);
}

function deleteEvent(eventId) {
  if (!confirm('آیا مطمئن هستید؟')) return;

  const idx = allData.events.findIndex(e => e.id === eventId);
  if (idx === -1) return;

  allData.events.splice(idx, 1);
  extraEvents = extraEvents.filter(e => e.id !== eventId);
  saveLocalData();
  renderTimeline();
  renderEditList();
  updateStats();
  showToast('رویداد حذف شد');
}

function handleEventFormSubmit(e) {
  e.preventDefault();

  const title = $('ev-title').value.trim();
  const date  = $('ev-date').value.trim();
  const era   = $('ev-era').value;
  const summary = $('ev-summary').value.trim();

  if (!title || !date || !era || !summary) {
    formFeedback.textContent = 'لطفاً تمام فیلدهای الزامی را پر کنید.';
    formFeedback.className = 'form-feedback error';
    formFeedback?.classList.remove('hidden');
    return;
  }

  const editingId = eventForm.dataset.editingId;

  const eventObj = {
    id:          editingId || 'user_' + Date.now(),
    era,
    title,
    date,
    dateSort:    parseFloat($('ev-datesort').value) || 9999,
    summary,
    description: $('ev-description').value.trim(),
    tags:        $('ev-tags').value.split(',').map(t => t.trim()).filter(Boolean),
    references:  [],
    _userAdded:  true,
  };

  if (editingId) {
    const idx = allData.events.findIndex(e => e.id === editingId);
    if (idx !== -1) allData.events[idx] = eventObj;
    const idx2 = extraEvents.findIndex(e => e.id === editingId);
    if (idx2 !== -1) extraEvents[idx2] = eventObj; else extraEvents.push(eventObj);
  } else {
    allData.events.push(eventObj);
    extraEvents.push(eventObj);
  }

  saveLocalData();
  renderTimeline();
  renderEditList();
  updateStats();

  // Reset
  eventForm.reset();
  delete eventForm.dataset.editingId;
  formFeedback.textContent = editingId ? '✅ رویداد ویرایش شد' : '✅ رویداد با موفقیت اضافه شد';
  formFeedback.className = 'form-feedback success';
  formFeedback?.classList.remove('hidden');
  showToast(editingId ? '✅ ویرایش انجام شد' : '✅ رویداد اضافه شد');

  setTimeout(() => formFeedback?.classList.add('hidden'), 3000);
}

// ── Export / Copy JSON ─────────────────────────────────────
function buildExportData() {
  const data = {
    eras:   allData.eras,
    events: allData.events.map(ev => {
      const extras = extraRefs[ev.id] || [];
      return {
        ...ev,
        references: [...(ev.references || []), ...extras.map(r => {
          const { _local, ...clean } = r; return clean;
        })],
      };
    }),
  };
  return JSON.stringify(data, null, 2);
}

function refreshExportPreview() {
  $('json-preview').textContent = buildExportData();
}

function copyJson() {
  const json = buildExportData();
  navigator.clipboard.writeText(json)
    .then(() => showToast('✅ JSON کپی شد'))
    .catch(() => showToast('خطا در کپی', 'error'));
}

function downloadJson() {
  const json = buildExportData();
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = 'history.json';
  a.click();
  URL.revokeObjectURL(url);
  showToast('💾 دانلود شروع شد');
}

// ── Toast ──────────────────────────────────────────────────
function showToast(message, type = 'success') {
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  toastContainer.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 300ms forwards';
    setTimeout(() => toast.remove(), 320);
  }, 2800);
}

// ── Admin Tabs ─────────────────────────────────────────────
function switchAdminTab(tabId) {
  document.querySelectorAll('.admin-tab').forEach(t => {
    t.classList.toggle('active', t.dataset.tab === tabId);
    t.setAttribute('aria-selected', t.dataset.tab === tabId ? 'true' : 'false');
  });
  document.querySelectorAll('.admin-tab-panel').forEach(p => {
    p.classList.toggle('active', p.id === 'panel-' + tabId);
  });

  if (tabId === 'export') refreshExportPreview();
  if (tabId === 'edit')   renderEditList($('admin-search')?.value || '');
  if (tabId === 'feedback') loadFeedbackList();
}

// ── Event Listeners ────────────────────────────────────────
function setupEventListeners() {

  // Timeline click delegation
  timelineContainer.addEventListener('click', e => {
    const trigger = e.target.closest('[data-id]');
    if (trigger) openPanel(trigger.dataset.id);
  });

  timelineContainer.addEventListener('keydown', e => {
    if (e.key === 'Enter' || e.key === ' ') {
      const trigger = e.target.closest('[data-id]');
      if (trigger) { e.preventDefault(); openPanel(trigger.dataset.id); }
    }
  });

  // Panel close
  $('panel-close')?.addEventListener('click', closePanel);
  $('panel-backdrop')?.addEventListener('click', closePanel);

  // Escape closes panel or admin
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (sidePanelEl.classList.contains('open')) closePanel();
    }
  });

  // Search
  searchInput?.addEventListener('input', e => {
    searchQuery = e.target.value.trim();
    renderTimeline();
  });

  // Theme toggle
  $('btn-theme')?.addEventListener('click', toggleTheme);

  // Admin open/close
  $('btn-open-admin')?.addEventListener('click', () => {
    if (isAdminLoggedIn) {
      adminDialog?.showModal();
      refreshExportPreview();
    } else {
      $('login-dialog')?.showModal();
    }
  });
  $('admin-close')?.addEventListener('click', () => adminDialog?.close());
  adminDialog?.addEventListener('click', e => {
    if (e.target === adminDialog) adminDialog?.close();
  });

  // Login dialog handlers
  $('login-close')?.addEventListener('click', () => $('login-dialog')?.close());
  $('login-dialog')?.addEventListener('click', e => {
    if (e.target === $('login-dialog')) $('login-dialog')?.close();
  });

  $('login-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const password = $('login-password').value;
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'خطا در ورود');
      
      isAdminLoggedIn = true;
      sessionStorage.setItem('isAdminLoggedIn', 'true');
      showToast('🔓 ورود با موفقیت انجام شد');
      $('login-password').value = '';
      $('login-dialog')?.close();
      adminDialog?.showModal();
      refreshExportPreview();
      updateAdminUiState();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    }
  });

  // Admin Logout
  $('btn-admin-logout')?.addEventListener('click', () => {
    isAdminLoggedIn = false;
    sessionStorage.removeItem('isAdminLoggedIn');
    adminDialog?.close();
    updateAdminUiState();
    showToast('🔒 خروج با موفقیت انجام شد');
  });

  // Detail panel Edit button click
  $('btn-panel-edit-event')?.addEventListener('click', () => {
    if (activeEventId) {
      const eventId = activeEventId;
      closePanel();
      adminDialog?.showModal();
      switchAdminTab('edit');
      loadEventForEdit(eventId);
    }
  });

  // Upload data form handler
  $('admin-upload-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const fileInput = $('upload-file-input');
    if (!fileInput.files.length) {
      showToast('لطفاً یک فایل انتخاب کنید', 'error');
      return;
    }
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = async event => {
      try {
         const data = JSON.parse(event.target.result);
         if (!data.eras || !data.events) {
           throw new Error('فرمت فایل JSON نامعتبر است. باید شامل کلیدهای eras و events باشد.');
         }
         const uploadBtn = $('btn-start-upload');
         uploadBtn.disabled = true;
         uploadBtn.textContent = 'در حال آپلود...';
         
         const res = await fetch('/api/upload', {
           method: 'POST',
           headers: { 'Content-Type': 'application/json' },
           body: JSON.stringify({ data })
         });
         const resData = await res.json();
         if (!res.ok) throw new Error(resData.detail || 'خطا در آپلود');
         
         showToast('✅ داده‌ها با موفقیت بارگذاری و ذخیره شدند');
         adminDialog?.close();
         
         // Reload timeline
         const reloadRes = await fetch(DATA_URL + '?cb=' + Date.now());
         allData = await reloadRes.json();
         render();
       } catch (err) {
         showToast('❌ Error: ' + err.message, 'error');
       } finally {
         const uploadBtn = $('btn-start-upload');
         uploadBtn.disabled = false;
         uploadBtn.textContent = '📤 بارگذاری داده‌ها';
         fileInput.value = '';
       }
    };
    reader.readAsText(file);
  });

  // Admin tabs
  document.querySelectorAll('.admin-tab').forEach(tab => {
    tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
  });

  // Event form
  eventForm?.addEventListener('submit', handleEventFormSubmit);
  $('btn-clear-form')?.addEventListener('click', () => {
    eventForm.reset();
    delete eventForm.dataset.editingId;
    formFeedback?.classList.add('hidden');
  });

  // Admin search (edit tab)
  $('admin-search')?.addEventListener('input', e => renderEditList(e.target.value));

  // Edit list delegation — pro editor
  $('edit-list')?.addEventListener('click', e => {
    const item = e.target.closest('.edit-list-item');
    if (item && item.dataset.id) {
      loadEventIntoProEditor(item.dataset.id);
    }
  });

  // Pro editor save button
  $('btn-pro-save')?.addEventListener('click', proSaveEvent);

  // Pro editor delete button
  $('btn-pro-delete')?.addEventListener('click', () => {
    if (proEditorEventId) showDeleteConfirm(proEditorEventId);
  });

  // Delete confirmation dialog buttons
  $('btn-confirm-cancel')?.addEventListener('click', () => $('confirm-delete-dialog')?.close());
  $('btn-confirm-delete')?.addEventListener('click', () => {
    const targetId = $('confirm-delete-dialog').dataset.targetId;
    if (targetId) executeDeleteEvent(targetId);
  });
  $('confirm-delete-dialog')?.addEventListener('click', e => {
    if (e.target === $('confirm-delete-dialog')) $('confirm-delete-dialog')?.close();
  });

  // Editor sub-tabs
  document.querySelectorAll('.editor-subtab').forEach(tab => {
    tab.addEventListener('click', () => switchEditorSubtab(tab.dataset.subtab));
  });

  // Rulers editor
  $('rulers-editor-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-ruler-delete');
    if (!btn || !proEditorEventId) return;
    const idx = parseInt(btn.dataset.rulerIndex);
    const ev = allData.events.find(e => e.id === proEditorEventId);
    if (!ev || !ev.rulers) return;
    ev.rulers.splice(idx, 1);
    renderProRulers(ev);
    showToast('Ruler removed — save to apply');
  });

  $('btn-add-ruler')?.addEventListener('click', () => {
    if (!proEditorEventId) return;
    const name  = $('ruler-name-input').value.trim();
    const reign = $('ruler-reign-input').value.trim();
    const note  = $('ruler-note-input').value.trim();
    if (!name) { showToast('Ruler name is required', 'error'); return; }
    const ev = allData.events.find(e => e.id === proEditorEventId);
    if (!ev) return;
    if (!ev.rulers) ev.rulers = [];
    ev.rulers.push({ name, reign, note });
    renderProRulers(ev);
    $('ruler-name-input').value = '';
    $('ruler-reign-input').value = '';
    $('ruler-note-input').value = '';
    showToast('Ruler added — save to apply');
  });

  // Refs editor
  $('refs-editor-list')?.addEventListener('click', e => {
    const btn = e.target.closest('.btn-ref-delete');
    if (!btn || !proEditorEventId) return;
    const idx = parseInt(btn.dataset.refIndex);
    const ev = allData.events.find(e => e.id === proEditorEventId);
    if (!ev) return;
    const totalBase = (ev.references || []).length;
    if (idx < totalBase) {
      ev.references.splice(idx, 1);
    } else {
      const localIdx = idx - totalBase;
      if (!extraRefs[proEditorEventId]) extraRefs[proEditorEventId] = [];
      extraRefs[proEditorEventId].splice(localIdx, 1);
    }
    renderProRefs(ev);
    showToast('Source removed — save to apply');
  });

  $('btn-add-pro-ref')?.addEventListener('click', () => {
    if (!proEditorEventId) return;
    const title = $('pro-ref-title').value.trim();
    if (!title) { showToast('Source title is required', 'error'); return; }
    const ref = {
      type:   $('pro-ref-type').value,
      title,
      author: $('pro-ref-author').value.trim() || undefined,
      year:   $('pro-ref-year').value.trim() || undefined,
      url:    $('pro-ref-url').value.trim() || undefined,
    };
    const ev = allData.events.find(e => e.id === proEditorEventId);
    if (!ev) return;
    if (!ev.references) ev.references = [];
    ev.references.push(ref);
    renderProRefs(ev);
    $('pro-ref-title').value = '';
    $('pro-ref-author').value = '';
    $('pro-ref-year').value = '';
    $('pro-ref-url').value = '';
    showToast('Source added — save to apply');
  });

  // Add ref toggle
  $('btn-add-ref')?.addEventListener('click', () => {
    addRefForm?.classList.toggle('hidden');
    if (!addRefForm?.classList.contains('hidden')) refTitleInput.focus();
  });

  $('btn-cancel-ref')?.addEventListener('click', () => addRefForm?.classList.add('hidden'));
  $('btn-save-ref')?.addEventListener('click', saveNewRef);

  // Ref type change — show/hide author/year
  refTypeSelect?.addEventListener('change', () => {
    const showMeta = ['book','article'].includes(refTypeSelect.value);
    $('ref-author-group').style.display = showMeta ? '' : 'none';
    $('ref-year-group').style.display   = showMeta ? '' : 'none';
  });
  // Trigger once to set initial state
  refTypeSelect?.dispatchEvent(new Event('change'));

  // Export buttons
  $('btn-copy-json')?.addEventListener('click', copyJson);
  $('btn-download-json')?.addEventListener('click', downloadJson);

  // Gemini API key toggle visibility
  const apiKeyInput = $('ai-gemini-key');
  if (apiKeyInput) {
    apiKeyInput.value = localStorage.getItem('GEMINI_API_KEY') || '';
    $('btn-toggle-api-key')?.addEventListener('click', () => {
      const isPass = apiKeyInput.type === 'password';
      apiKeyInput.type = isPass ? 'text' : 'password';
      $('btn-toggle-api-key').textContent = isPass ? '🔒' : '👁';
    });
    apiKeyInput.addEventListener('input', () => {
      localStorage.setItem('GEMINI_API_KEY', apiKeyInput.value.trim());
    });
  }

  // AI Ingest radio change
  document.querySelectorAll('input[name="ai-source-type"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      const isUrl = e.target.value === 'url';
      $('ai-url-group').classList.toggle('hidden', !isUrl);
      $('ai-text-group').classList.toggle('hidden', isUrl);
    });
  });

  // AI Ingest form submit
  $('ai-ingest-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const apiKey = apiKeyInput.value.trim();
    if (!apiKey) {
      showToast('لطفاً کلید API جمینای را وارد کنید', 'error');
      return;
    }

    const type = document.querySelector('input[name="ai-source-type"]:checked').value;
    const content = type === 'url' ? $('ai-url').value.trim() : $('ai-text').value.trim();

    if (!content) {
      showToast('لطفاً منبع ورودی (آدرس یا متن) را پر کنید', 'error');
      return;
    }

    if (type === 'url') {
      const normalizeUrl = (urlStr) => {
        if (!urlStr) return '';
        try {
          let decoded = decodeURIComponent(urlStr.trim());
          return decoded.toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        } catch (e) {
          return urlStr.trim().toLowerCase().replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
        }
      };

      const normalizedInput = normalizeUrl(content);
      const duplicate = allData.events.find(e => 
        (e.references || []).some(ref => ref.url && normalizeUrl(ref.url) === normalizedInput)
      );

      if (duplicate) {
        const proceed = confirm(`This link has already been used for the event "${duplicate.title_en || duplicate.title}".\nAre you sure you want to process it again?`);
        if (!proceed) return;
      }
    }

    const startBtn = $('btn-start-ingest');
    const statusContainer = $('ai-status-container');
    const logsEl = $('ai-logs');
    const spinner = $('ai-status-spinner');

    startBtn.disabled = true;
    statusContainer.classList.remove('hidden');
    logsEl.innerHTML = '';
    spinner.style.display = 'inline-block';

    const log = (msg, isError = false) => {
      const time = new Date().toLocaleTimeString('fa-IR');
      const color = isError ? '#ff8a80' : '#a5d6a7';
      logsEl.innerHTML += `<div style="color: ${color}">[${time}] ${msg}</div>`;
      logsEl.scrollTop = logsEl.scrollHeight;
    };

    log('در حال ارسال درخواست به سرور محلی...');

    try {
      const res = await fetch('/api/ingest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          geminiKey: apiKey,
          type,
          content
        })
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || 'خطای نامشخص در سرور');
      }

      log('به‌روزرسانی موفقیت‌آمیز بود!');
      log(`رویدادهای اصلاح شده: ${toFarsiNum(data.stats.modified_events_count)}`);
      log(`رویدادهای اضافه شده: ${toFarsiNum(data.stats.added_events_count)}`);
      log(`منابع اضافه شده: ${toFarsiNum(data.stats.added_refs_count)}`);
      log(`حاکمان اضافه شده: ${toFarsiNum(data.stats.added_rulers_count)}`);
      log(`زمان پردازش: ${toFarsiNum(data.processingTimeSec)} ثانیه`);
      
      showToast('✅ جذب داده با موفقیت انجام شد');
      spinner.style.display = 'none';
      
      // Clear forms
      $('ai-url').value = '';
      $('ai-text').value = '';
      
      // Reload timeline from server
      const reloadRes = await fetch(DATA_URL + '?cb=' + Date.now());
      allData = await reloadRes.json();
      render();
    } catch (err) {
      console.error(err);
      log(`خطا: ${err.message}`, true);
      showToast('❌ Error در جذب داده: ' + err.message, 'error');
      spinner.style.display = 'none';
    } finally {
      startBtn.disabled = false;
    }
  });

  // Feedback Dialog Open/Close
  $('btn-open-feedback')?.addEventListener('click', () => {
    $('feedback-dialog')?.showModal();
  });
  
  $('feedback-close')?.addEventListener('click', () => $('feedback-dialog')?.close());
  $('btn-cancel-feedback')?.addEventListener('click', () => $('feedback-dialog')?.close());
  
  $('feedback-dialog')?.addEventListener('click', e => {
    if (e.target === $('feedback-dialog')) $('feedback-dialog')?.close();
  });
  
  // Feedback Submission
  $('feedback-form')?.addEventListener('submit', async e => {
    e.preventDefault();
    const type = $('feedback-type').value;
    const text = $('feedback-text').value.trim();
    const author = $('feedback-author').value.trim();
    
    if (!text) {
      showToast('لطفاً متن پیشنهاد خود را وارد کنید', 'error');
      return;
    }
    
    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'در حال ارسال...';
    
    try {
      const res = await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, text, author })
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || 'خطا در ثبت پیشنهاد');
      
      showToast('✅ ' + data.message);
      $('feedback-form').reset();
      $('feedback-dialog')?.close();
    } catch (err) {
      showToast('❌ ' + err.message, 'error');
    } finally {
      submitBtn.disabled = false;
      submitBtn.textContent = 'ارسال فیدبک';
    }
  });
}

// ── Feedback Administrative Management ────────────────────────
async function loadFeedbackList() {
  const container = $('feedback-list');
  if (!container) return;
  container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">در حال دریافت پیشنهادات کاربران...</p>';
  
  try {
    const res = await fetch('/api/feedback', {
      method: 'GET',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': 'Bearer admin-session-token'
      }
    });
    
    if (!res.ok) throw new Error('خطا در بارگذاری لیست پیشنهادات');
    
    const items = await res.json();
    if (!items || items.length === 0) {
      container.innerHTML = '<p style="text-align: center; color: var(--text-muted); padding: 20px;">هیچ پیشنهادی ثبت نشده است.</p>';
      return;
    }
    
    // Sort descending by timestamp
    items.sort((a, b) => b.timestamp - a.timestamp);
    
    container.innerHTML = items.map(item => {
      let typeText = '💡 سایر انتقادات و پیشنهادات';
      let badgeClass = 'badge-other';
      if (item.type === 'add') {
        typeText = '➕ پیشنهاد افزودن رویداد جدید';
        badgeClass = 'badge-add';
      } else if (item.type === 'remove') {
        typeText = '➖ پیشنهاد حذف یا اصلاح رویداد موجود';
        badgeClass = 'badge-remove';
      }
      
      return `
        <div class="feedback-card" data-feedback-id="${item.id}">
          <div class="feedback-card-header">
            <span class="feedback-badge ${badgeClass}">${typeText}</span>
            <span class="feedback-meta">${item.date_str || ''}</span>
          </div>
          <div class="feedback-text-content">${escapeHtml(item.text)}</div>
          <div class="feedback-card-actions">
            <span class="feedback-author">🗣 فرستنده: ${escapeHtml(item.author || 'ناشناس')}</span>
            <button class="btn-delete-feedback" onclick="deleteFeedbackItem(${item.id})">🗑 حذف پیشنهاد</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (err) {
    container.innerHTML = `<p style="text-align: center; color: #e57373; padding: 20px;">⚠️ خطا: ${err.message}</p>`;
  }
}

async function deleteFeedbackItem(id) {
  if (!confirm('آیا از حذف این پیشنهاد اطمینان دارید؟')) return;
  try {
    const res = await fetch(`/api/feedback/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': 'Bearer admin-session-token'
      }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.detail || 'خطا در حذف پیشنهاد');
    showToast('🗑 پیشنهاد با موفقیت حذف شد');
    loadFeedbackList();
  } catch (err) {
    showToast('❌ ' + err.message, 'error');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
