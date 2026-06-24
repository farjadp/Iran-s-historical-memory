# 🦁 Iran's Historical Memory — Interactive Timeline

An interactive, modern, and visually stunning web timeline of Iranian history from prehistoric ages, mythological eras (Pishdadians), imperial dynasties (Achaemenid, Parthian, Sasanian, Safavid, Qajar, Pahlavi), down to modern times and contemporary events.

This project offers a seamless blend of historical visualization, administrative data management, AI-assisted content aggregation, and public feedback collection.

---

## ✨ Features

- **Interactive Timeline**: Clean, responsive layout with glassmorphic aesthetic cards, smooth micro-interactions, dark/light theme, and dynamic era filters.
- **Dynamic Detail Panel**: Sidebar showing comprehensive descriptions, dynasty flags, references, tag lists, and the dynastic rulers tree.
- **Triple Calendar Mapping**: Renders dates matching Gregorian, Solar Hijri, and Imperial Iranian calendar formats.
- **Admin Dashboard (Protected)**: Secure password-protected panel allowing full CRUD (Create, Read, Update, Delete) capability on historical events.
- **AI-Powered Ingest (Gemini 2.5 Flash)**: Paste any URL, raw text, or a YouTube video link. The backend extracts transcripts or webpage content, prompts Gemini, and merges/sorts new historical data or ruler tables automatically into the JSON database.
- **Feedback & Suggestion Loop**: Visitors can submit event corrections or new ideas from the homepage. Admins can view, moderate, and delete submissions directly in the dashboard.
- **Data Portability**: Instantly download, copy, or upload database backups (`data/history.json`) through the dashboard UI.

---

## 🛠️ Tech Stack

- **Backend**: Python 3.x, FastAPI, Uvicorn, BeautifulSoup4 (web scraping), requests, youtube-transcript-api.
- **Frontend**: Vanilla HTML5, Vanilla CSS3 (custom CSS variables, theme control, flex/grid layouts), ES6 Javascript.
- **AI Integration**: Google Gemini API (`gemini-2.5-flash`).
- **Database**: Flat JSON files (`data/history.json` and `data/feedback.json`) for maximum speed, portability, and zero-config deployment.

---

## 🚀 Getting Started

### 1. Clone & Set Up Directory
Ensure you are in the project root directory.

### 2. Install Dependencies
Install the required Python packages:
```bash
pip install fastapi uvicorn requests beautifulsoup4 youtube-transcript-api
```

### 3. Run the Server
Launch the FastAPI backend server:
```bash
python server.py
```
The server runs on **port 3031** by default.

### 4. Open in Browser
Open your browser and navigate to:
[http://localhost:3031](http://localhost:3031)

---

## 🔑 Administrative Access

- Click the **ادمین (Admin)** button in the top right header.
- Enter the admin password to access writing and ingestion features.
  - **Default Password**: `admin123`
  - To customize, set the environment variable: `ADMIN_PASSWORD`

---

## 📁 Folder Structure

```
├── data/
│   ├── history.json         # Core historical timeline database
│   └── feedback.json        # User suggestions and feedback database (auto-generated)
├── index.html               # Main homepage layout
├── main.js                  # Frontend core application logic
├── style.css                # Styling systems (themes, layouts, glassmorphic cards)
├── about-developer.html     # Information page about the developer
├── about-project.html       # Overview page of the technical project details
├── server.py                # FastAPI backend & Gemini integration server
└── .gitignore               # Ignored system and cache files
```

---

## 👨‍💻 Developer & Team

Developed by **Farjad Pourmohammad** — Startup Advisor, Systems Architect & Tech Sparring Partner based in Toronto, Canada.  
For more essays, articles, and advisory resources, visit [farjadp.com](https://farjadp.com).
