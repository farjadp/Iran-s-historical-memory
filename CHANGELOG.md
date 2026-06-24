# Changelog — تایم‌لاین تاریخ ایران
# Iran History Timeline — Changelog

All notable changes to this project are documented here.  
Format: `[version] — YYYY-MM-DD`

---

## [v0.6.0] — 2026-06-24

### 🕊️ Memorial Theme & AI Safeguards
- Created a custom elegant, dark memorial theme for the "Bloody Dey 1404" event card (`bloody-dey-theme`).
- Replaced bright red harsh colors with a mournful dark aesthetic (`#0a0a0a` background, muted crimson text).
- Added fade-in animation for memorial quotes ("فرزند ایران و جان فدای میهن").
- Added duplicate URL detection and warning modal to the AI Ingest panel to prevent redundant content processing.
- Fixed the scroll bug inside the Admin Pro Editor panel by refactoring the flexbox layout of `.admin-dialog` and `.admin-inner`.

### 🌍 Bilingual Support (FA / EN)
- Added full **English version** at `/en/` with separate routing
- Translated all **62 historical events** + **7 eras** to English via Gemini AI
- Language switcher in navbar: 🇬🇧 English button (FA page) / 🦁 Lion & Sun flag (EN page)
- EN page uses LTR layout, Outfit/Inter fonts, absolute API paths
- Fallback to Persian for any untranslated content

### ✏️ Pro Editor
- New two-column editor UI in Admin → ویرایش tab
- Sub-tabs: Basic Info / Rulers / References
- `PUT /api/events/{id}` endpoint for updating events
- `DELETE /api/events/{id}` endpoint with confirmation dialog
- Search/filter events within the editor list

### 🏳️ Flags & Images
- Restored era-based flags for all 62 events (was missing/broken)
- Fixed 404 Wikipedia image URLs → replaced with working Wikimedia Commons URLs
- Lion & Sun flag (`/data/images/iranflag.png`) used for modern/contemporary era events
- Added historical flags: Achaemenid, Parthian, Sassanid, Safavid, Afsharid, Qajar

### 🖥️ Editor UI Improvements
- Admin dialog expanded from `680px` → `1180px` (full-width)
- Event list column widened: `270px` → `320px`
- Form padding increased: `24px / 32px` (was `20px / 22px`)
- Description textarea minimum height: `150px`
- Subtabs larger with hover effect and active gold highlight
- Visual separator between editor header and form

### 🔧 Bug Fixes
- Fixed timeline sort mutation bug: `[...events].sort()` prevents mutating original array
- Fixed `dateSort` values for 1404 SH events (Persian year → correct Gregorian mapping)
- Fixed `en-main.js` DATA_URL: was relative `data/history.json` → absolute `/data/history.json`
- Made all admin-panel DOM queries in EN version null-safe (`?.`)

---

## [v0.5.0] — 2026-06-24

### 🦁 Iran Page
- Added comprehensive `/iran.html` page
- Includes Lion & Sun flag, Iran map background, historical overview
- Sections: Geography, Culture, Poetry, UNESCO World Heritage sites
- 3 curated photos of Iran's landscape and architecture
- Link added to main footer navigation

### 👨‍💻 Developer Page Updates
- Updated bio text for Farjad Pourmohammad
- Added "عاشق وطن ❤️" tagline below name
- Added Lion & Sun flag and Iran map background to page layout
- Removed location (Toronto) and availability badge per user request

---

## [v0.4.0] — 2026-06-24

### 🎨 Immersive View Redesign
- New `/immersive.html` exhibition-style view
- Persian turquoise identity (`#5B9E8F`) as primary color
- Scroll-driven parallax animations
- Railway deployment configuration added

### 🔒 Security
- Removed hardcoded admin password from source code
- `ADMIN_PASSWORD` now loaded from environment variable (`.env`)
- Added `python-dotenv` dependency for local development

---

## [v0.3.0] — 2026-06-23

### 💬 Public Feedback System
- Floating feedback button on main page
- Feedback form: add event / remove event / other suggestions
- `POST /api/feedback` endpoint stores to `data/feedback.json`
- Admin panel → 💬 پیشنهادات tab to review submissions

### 🤖 AI Ingest (Gemini)
- Admin panel → 🤖 هوش مصنوعی tab
- Accepts URL (website / YouTube) or raw text
- Extracts historical events using Gemini API
- Auto-creates or updates events in `history.json`

### 📤 Data Management
- Export JSON tab: copy or download current `history.json`
- Upload tab: replace `history.json` via file upload
- `POST /api/upload` endpoint with admin auth

---

## [v0.2.0] — 2026-06-23

### ✨ Core Timeline
- Interactive timeline with era grouping and color coding
- Side panel with full event details
- Three-calendar date display: Gregorian / Solar Hijri / Imperial
- Dynasty/Rulers tree in side panel
- References list per event (book, video, website, article, image)
- Add reference inline from side panel

### 🗂️ Admin Panel
- Password-protected admin panel
- Add new historical event form
- Era select, date range, tags, summary, description
- Toast notifications for all actions

### 🔍 Search & Filter
- Full-text search across titles, summaries, and tags
- Era filter buttons with color coding
- Scroll-driven reveal animations

### 🌓 Theme
- Dark mode (default) and light mode toggle
- Turquoise / gold Iranian color palette
- Vazirmatn font for Persian text

---

## [v0.1.0] — 2026-06-23

### 🚀 Initial Release
- FastAPI backend serving `data/history.json`
- Static file serving for HTML/CSS/JS
- Basic timeline rendering from JSON data
- About Developer page (`/about-developer.html`)
- About Project page (`/about-project.html`)
- README with project vision
- Railway deployment config (`railway.json`, `Procfile`)

---

## Tech Stack
- **Backend**: Python / FastAPI
- **Frontend**: Vanilla HTML + CSS + JavaScript (no framework)
- **Data**: JSON flat-file (`data/history.json`)
- **AI**: Google Gemini API (translation + content ingestion)
- **Deployment**: Railway
- **Fonts**: Vazirmatn (FA), Outfit / Inter (EN)
