import os
import re
import json
import time
import urllib.parse
from typing import Optional
import requests
from fastapi import FastAPI, HTTPException, Header, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from pydantic import BaseModel
from bs4 import BeautifulSoup

app = FastAPI(title="Iran History Timeline API")

HISTORY_FILE = "data/history.json"
FEEDBACK_FILE = "data/feedback.json"

# Models
class SaveData(BaseModel):
    data: dict

class IngestData(BaseModel):
    geminiKey: str
    type: str  # "url" or "text"
    content: str  # URL or raw text

class FeedbackData(BaseModel):
    type: str
    text: str
    author: Optional[str] = "ناشناس"

# Helper functions
def to_farsi_num(n):
    farsi_digits = '۰۱۲۳۴۵۶۷۸۹'
    return "".join(farsi_digits[int(d)] if d.isdigit() else d for d in str(n))

def get_youtube_transcript(url: str) -> str:
    try:
        from youtube_transcript_api import YouTubeTranscriptApi
    except ImportError:
        raise ImportError("youtube-transcript-api is not installed. Please run pip install youtube-transcript-api")

    video_id = None
    patterns = [
        r"v=([a-zA-Z0-9_-]{11})",
        r"youtu\.be/([a-zA-Z0-9_-]{11})",
        r"embed/([a-zA-Z0-9_-]{11})",
        r"shorts/([a-zA-Z0-9_-]{11})"
    ]
    for pattern in patterns:
        match = re.search(pattern, url)
        if match:
            video_id = match.group(1)
            break
            
    if not video_id:
        # Fallback raw 11 chars
        match = re.search(r"([a-zA-Z0-9_-]{11})", url)
        if match:
            video_id = match.group(1)
            
    if not video_id:
        raise ValueError("Could not extract YouTube video ID from URL")
        
    try:
        # Support both class-based methods (newer versions) and instance-based methods (older versions)
        if hasattr(YouTubeTranscriptApi, 'get_transcript'):
            # Newer class-based API
            try:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=['fa', 'en'])
            except Exception:
                transcript_list = YouTubeTranscriptApi.get_transcript(video_id)
        else:
            # Older instance-based API
            api = YouTubeTranscriptApi()
            try:
                transcript_list = api.fetch(video_id, languages=['fa', 'en'])
            except Exception:
                transcript_list = api.fetch(video_id)
                
        # Convert each snippet to text, supporting both dict and custom object types
        text_parts = []
        for t in transcript_list:
            if isinstance(t, dict):
                text_parts.append(t['text'])
            else:
                text_parts.append(getattr(t, 'text', ''))
        text = " ".join(text_parts)
        return text
    except Exception as e:
        raise RuntimeError(f"Failed to fetch YouTube transcript: {str(ex) if 'ex' in locals() else str(e)}")

def get_webpage_content(url: str) -> str:
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
    }
    response = requests.get(url, headers=headers, timeout=15)
    response.raise_for_status()
    response.encoding = response.apparent_encoding
    
    soup = BeautifulSoup(response.text, 'html.parser')
    
    # Remove clutter elements
    for element in soup(["script", "style", "header", "footer", "nav", "aside"]):
        element.extract()
        
    text = soup.get_text(separator=' ')
    lines = (line.strip() for line in text.splitlines())
    chunks = (phrase.strip() for line in lines for phrase in line.split("  "))
    text = '\n'.join(chunk for chunk in chunks if chunk)
    return text

def merge_updates(current_data, gemini_response):
    updates = gemini_response.get("updates", [])
    new_events = gemini_response.get("newEvents", [])
    
    modified_events_count = 0
    added_events_count = 0
    added_refs_count = 0
    added_rulers_count = 0
    
    # 1. Apply updates to existing events
    for update in updates:
        event_id = update.get("eventId")
        event = next((e for e in current_data.get("events", []) if e.get("id") == event_id), None)
        if not event:
            continue
            
        modified = False
        
        # Update description if provided and is richer/longer
        new_desc = update.get("updatedDescription")
        if new_desc and len(new_desc.strip()) > len(event.get("description", "")):
            event["description"] = new_desc.strip()
            modified = True
            
        # Add rulers
        for ruler in update.get("addedRulers", []):
            if not event.get("rulers"):
                event["rulers"] = []
            ruler_names = [r.get("name", "").strip() for r in event["rulers"]]
            if ruler.get("name", "").strip() not in ruler_names:
                event["rulers"].append(ruler)
                added_rulers_count += 1
                modified = True
                
        # Add references
        for ref in update.get("addedReferences", []):
            if not event.get("references"):
                event["references"] = []
            ref_titles = [r.get("title", "").strip() for r in event["references"]]
            if ref.get("title", "").strip() not in ref_titles:
                event["references"].append(ref)
                added_refs_count += 1
                modified = True
                
        if modified:
            modified_events_count += 1
            
    # 2. Add new events
    for new_event in new_events:
        existing_ids = [e.get("id") for e in current_data.get("events", [])]
        if new_event.get("id") in existing_ids:
            new_event["id"] = f"{new_event.get('id')}_{int(time.time())}"
            
        # Ensure default color matches era
        if not new_event.get("color"):
            era_id = new_event.get("era")
            era = next((era for era in current_data.get("eras", []) if era.get("id") == era_id), None)
            new_event["color"] = era.get("color", "#C8893A") if era else "#C8893A"
            
        current_data["events"].append(new_event)
        added_events_count += 1
        
    # Sort events by dateSort
    current_data["events"].sort(key=lambda x: x.get("dateSort", 9999))
    
    return {
        "modified_events_count": modified_events_count,
        "added_events_count": added_events_count,
        "added_refs_count": added_refs_count,
        "added_rulers_count": added_rulers_count
    }

# APIs
class LoginData(BaseModel):
    password: str

@app.post("/api/login")
async def login_admin(payload: LoginData):
    correct_password = os.getenv("ADMIN_PASSWORD", "admin123")
    if payload.password == correct_password:
        return {"status": "success", "token": "admin-session-token"}
    raise HTTPException(status_code=401, detail="رمز عبور وارد شده نادرست است")

@app.post("/api/upload")
async def upload_history(payload: SaveData):
    data = payload.data
    if "eras" not in data or "events" not in data:
        raise HTTPException(status_code=400, detail="فرمت فایل بارگذاری شده صحیح نیست. فایل باید شامل دوره‌ها و رویدادها باشد.")
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "داده‌ها با موفقیت بارگذاری و بر روی دیسک ذخیره شدند"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در ذخیره‌سازی داده‌ها: {str(e)}")

@app.post("/api/save")
async def save_history(payload: SaveData):
    try:
        # Save payload data to history.json with pretty formatting
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(payload.data, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "داده‌ها با موفقیت در دیسک ذخیره شدند"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در ذخیره‌سازی داده‌ها: {str(e)}")

@app.post("/api/ingest")
async def ingest_content(payload: IngestData):
    start_time = time.time()
    
    # 1. Fetch content
    source_url_label = payload.content if payload.type == "url" else "متن وارد شده به صورت دستی"
    source_text = ""
    
    if payload.type == "url":
        is_youtube = "youtube.com" in payload.content or "youtu.be" in payload.content
        try:
            if is_youtube:
                source_text = get_youtube_transcript(payload.content)
            else:
                source_text = get_webpage_content(payload.content)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"خطا در دریافت محتوای آدرس: {str(e)}")
    else:
        source_text = payload.content
        
    if not source_text or len(source_text.strip()) < 10:
        raise HTTPException(status_code=400, detail="محتوای متنی یافت نشد یا بسیار کوتاه است")
        
    # Limit text to 60000 characters to avoid token limits
    source_text = source_text[:60000]
    
    # 2. Read history.json
    try:
        with open(HISTORY_FILE, "r", encoding="utf-8") as f:
            current_data = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در خواندن فایل تاریخچه: {str(e)}")
        
    # Generate a brief summary of existing events for Gemini context
    events_summary = []
    for ev in current_data.get("events", []):
        events_summary.append({
            "id": ev.get("id"),
            "title": ev.get("title"),
            "era": ev.get("era"),
            "date": ev.get("date"),
            "summary": ev.get("summary"),
            "tags": ev.get("tags", [])
        })
    events_summary_str = json.dumps(events_summary, ensure_ascii=False, indent=2)
    
    # 3. Call Gemini
    gemini_key = payload.geminiKey
    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={gemini_key}"
    headers = {"Content-Type": "application/json"}
    
    prompt = f"""
You are an expert Iranian historian assistant. Your task is to analyze the provided SOURCE TEXT and update/add to our existing Iranian History Timeline JSON data.

SOURCE URL/REF: {source_url_label}

EXISTING EVENTS (IDs, Titles, Summaries, Tags):
{events_summary_str}

VALID ERAS in the database:
- bastan (ایران باستان)
- eslami-avval (اسلامی اولیه)
- eslami-miani (قرون میانه)
- safaviyeh (صفوی و افشاری)
- qajar (قاجار و مشروطه)
- pahlavi (پهلوی)
- moaser (معاصر)

INSTRUCTIONS:
1. Carefully read the SOURCE TEXT. Look for historical details, rulers, dates, or events that match our existing events or present significant historical events in Iranian history that are currently missing.
2. Identify which existing events match. For each matching event:
   - If the source text provides a deeper, more detailed explanation of this event than our summary/description, write an updated, detailed, comprehensive `description` in Persian.
   - If the source text mentions rulers of this dynasty (with their names, reign years, and key roles/notes) that are not already present in the existing timeline, propose adding them to `addedRulers` (in Persian).
   - Propose adding a reference for this event in `addedReferences`. The reference MUST have:
     - `type`: one of "book", "video", "website", "image", "article"
     - `title`: The title of the source (e.g. video title or web page name or book name) in Persian or English.
     - `author`: The author/publisher/channel name if known.
     - `year`: Year of publication if known.
     - `url`: Use the SOURCE URL/REF provided above (if it is a URL, otherwise leave empty).
3. If the source text describes a highly significant historical event of Iranian history that is NOT present in the existing timeline:
   - Propose adding it under `newEvents` with a unique ID, matching `era`, Persian title, Persian summary, detailed description, tags, and a reference pointing to this source. Ensure you estimate its `date` (e.g. "۱۵۰۱ – ۱۷۲۲ م") and `dateSort` (numeric year, e.g. 1501).
4. Output your response ONLY as a valid JSON object matching the JSON schema below. DO NOT wrap it in markdown block quotes (do not include ```json ... ```) or any other text. It must be raw parsable JSON.

JSON RESPONSE SCHEMA:
{{
  "updates": [
    {{
      "eventId": "existing_event_id",
      "updatedDescription": "Updated detailed description of the event in Persian. Keep it rich and historical.",
      "addedRulers": [
        {{
          "name": "Ruler name in Persian",
          "reign": "Reign date string in Persian (e.g. ۵۵۰ – ۵۳۰ ق.م or ۱۹۲۵ – ۱۹۴۱ م)",
          "note": "A short note about their rule/achievements in Persian"
        }}
      ],
      "addedReferences": [
        {{
          "type": "video",
          "title": "Title of the video/article in Persian or English",
          "author": "Author or channel name",
          "year": "Year (optional)",
          "url": "{source_url_label if payload.type == 'url' else ''}"
        }}
      ]
    }}
  ],
  "newEvents": [
    {{
      "id": "unique-id-english",
      "era": "one of the valid eras listed above",
      "title": "Title of new event in Persian",
      "date": "Date label in Persian (e.g. ۱۵۰۰ م)",
      "dateSort": 1500,
      "summary": "Short 1-sentence summary in Persian",
      "description": "Full detailed description of the event in Persian",
      "rulers": [],
      "references": [
        {{
          "type": "website",
          "title": "Title of this source",
          "url": "{source_url_label if payload.type == 'url' else ''}"
        }}
      ],
      "tags": ["tag1", "tag2"]
    }}
  ]
}}

SOURCE TEXT:
{source_text}
"""
    
    payload_gemini = {
        "contents": [{"parts": [{"text": prompt}]}],
        "generationConfig": {
            "responseMimeType": "application/json"
        }
    }
    
    try:
        resp = requests.post(url, headers=headers, json=payload_gemini, timeout=180)
        resp.raise_for_status()
        gemini_data = resp.json()
        
        # Extract text response
        candidates = gemini_data.get("candidates", [])
        if not candidates:
            raise ValueError("No response candidates returned from Gemini API")
            
        response_text = candidates[0].get("content", {}).get("parts", [])[0].get("text", "")
        
        # Clean potential markdown wrappers
        clean_text = response_text.strip()
        if clean_text.startswith("```json"):
            clean_text = clean_text[7:]
        if clean_text.endswith("```"):
            clean_text = clean_text[:-3]
        clean_text = clean_text.strip()
        
        gemini_response = json.loads(clean_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در پردازش توسط هوش مصنوعی: {str(e)}")
        
    # 4. Merge updates
    stats = merge_updates(current_data, gemini_response)
    
    # 5. Write back to history.json
    try:
        with open(HISTORY_FILE, "w", encoding="utf-8") as f:
            json.dump(current_data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در ذخیره‌سازی داده‌های ادغام شده: {str(e)}")
        
    return {
        "status": "success",
        "message": "جذب داده با موفقیت انجام شد",
        "stats": stats,
        "processingTimeSec": round(time.time() - start_time, 2)
    }

@app.post("/api/feedback")
async def add_feedback(payload: FeedbackData):
    # Ensure feedback.json exists
    if not os.path.exists(FEEDBACK_FILE):
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump([], f, ensure_ascii=False)
            
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            feedbacks = json.load(f)
    except Exception:
        feedbacks = []
        
    import datetime
    new_id = max([f.get("id", 0) for f in feedbacks]) + 1 if feedbacks else 1
    
    # Generate timestamp
    now = datetime.datetime.now()
    date_str = to_farsi_num(now.strftime("%Y-%m-%d %H:%M:%S"))
    
    new_item = {
        "id": new_id,
        "type": payload.type,
        "text": payload.text,
        "author": payload.author or "ناشناس",
        "timestamp": time.time(),
        "date_str": date_str
    }
    
    feedbacks.append(new_item)
    
    try:
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump(feedbacks, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "پیشنهاد شما با موفقیت ثبت شد"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در ثبت پیشنهاد: {str(e)}")

@app.get("/api/feedback")
async def get_feedback(authorization: Optional[str] = Header(None)):
    if not authorization or authorization.replace("Bearer ", "").strip() != "admin-session-token":
        raise HTTPException(status_code=401, detail="عدم دسترسی: شما به عنوان ادمین احراز هویت نشده‌اید")
        
    if not os.path.exists(FEEDBACK_FILE):
        return []
        
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return []

@app.delete("/api/feedback/{feedback_id}")
async def delete_feedback(feedback_id: int, authorization: Optional[str] = Header(None)):
    if not authorization or authorization.replace("Bearer ", "").strip() != "admin-session-token":
        raise HTTPException(status_code=401, detail="عدم دسترسی: شما به عنوان ادمین احراز هویت نشده‌اید")
        
    if not os.path.exists(FEEDBACK_FILE):
        raise HTTPException(status_code=404, detail="فایل فیدبک یافت نشد")
        
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            feedbacks = json.load(f)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در خواندن فایل فیدبک: {str(e)}")
        
    filtered = [f for f in feedbacks if f.get("id") != feedback_id]
    if len(filtered) == len(feedbacks):
        raise HTTPException(status_code=404, detail="پیشنهاد مورد نظر یافت نشد")
        
    try:
        with open(FEEDBACK_FILE, "w", encoding="utf-8") as f:
            json.dump(filtered, f, ensure_ascii=False, indent=2)
        return {"status": "success", "message": "پیشنهاد با موفقیت حذف شد"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"خطا در حذف پیشنهاد: {str(e)}")

# Mount static files (serves index.html, style.css, main.js, and data/)
app.mount("/", StaticFiles(directory=".", html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Run on port 3031
    uvicorn.run("server:app", host="0.0.0.0", port=3031, reload=True)
