#!/usr/bin/env python3
"""
Iran History Timeline — Batch Translation Script
Translates all events in history.json to English using Gemini API.
Key is read from .env file (never stored in code).
Usage: python3 translate_history.py <GEMINI_API_KEY>
"""

import sys
import json
import time
import os
import warnings
warnings.filterwarnings("ignore")

sys.path.insert(0, '/Users/farjad/Library/Python/3.9/lib/python/site-packages')


def translate_batch(client, events_batch):
    events_json = json.dumps(
        [{"id": e["id"],
          "title": e.get("title",""),
          "summary": e.get("summary",""),
          "description": e.get("description","")}
         for e in events_batch],
        ensure_ascii=False, indent=2
    )

    prompt = f"""You are a scholar of Iranian history. Translate the following Persian historical event data to fluent, accurate English.
- Keep proper nouns (rulers, places, empires) in their standard English historical form (e.g. "Cyrus the Great", "Achaemenid Empire").
- Preserve all factual content. Do not summarize or shorten descriptions.
- Return ONLY a valid JSON array, no markdown fences, no explanation.
- Each object must have: id, title_en, summary_en, description_en

Persian events:
{events_json}"""

    from google import genai
    r = client.models.generate_content(model='gemini-2.5-flash', contents=prompt)
    text = r.text.strip()
    # Strip markdown if present
    if text.startswith("```"):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
    return json.loads(text.strip())


def translate_eras(client, eras):
    eras_json = json.dumps(
        [{"id": e["id"], "title": e.get("title","")} for e in eras],
        ensure_ascii=False, indent=2
    )
    prompt = f"""Translate these Persian Iranian historical era names to standard English historical names.
Return ONLY a JSON array with: id, title_en
No markdown, no explanation.

{eras_json}"""
    from google import genai
    r = client.models.generate_content(model='gemini-2.5-flash', contents=prompt)
    text = r.text.strip()
    if text.startswith("```"):
        lines = text.split('\n')
        text = '\n'.join(lines[1:-1] if lines[-1].strip() == '```' else lines[1:])
    return json.loads(text.strip())


def main():
    api_key = None

    # Try command line first
    if len(sys.argv) >= 2:
        api_key = sys.argv[1].strip()
    else:
        # Try .env
        env_path = os.path.join(os.path.dirname(__file__), ".env")
        if os.path.exists(env_path):
            for line in open(env_path).readlines():
                if line.startswith("GEMINI_API_KEY="):
                    api_key = line.split("=", 1)[1].strip()
                    break

    if not api_key:
        print("❌ No API key found. Usage: python3 translate_history.py <API_KEY>")
        sys.exit(1)

    history_file = os.path.join(os.path.dirname(__file__), "data", "history.json")
    print(f"📂 Reading {history_file}...")
    with open(history_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    events = data["events"]
    eras   = data["eras"]
    print(f"📊 Found {len(events)} events and {len(eras)} eras\n")

    from google import genai
    client = genai.Client(api_key=api_key)

    # ── Translate eras ──────────────────────────────────────────
    print("🌍 Translating eras...")
    try:
        era_results = translate_eras(client, eras)
        era_map = {e["id"]: e.get("title_en","") for e in era_results}
        for era in data["eras"]:
            if era["id"] in era_map:
                era["title_en"] = era_map[era["id"]]
                print(f"  ✓ {era['title'][:30]} → {era['title_en']}")
        time.sleep(2)
    except Exception as e:
        print(f"  ⚠️ Era translation error: {e}")

    # ── Translate events in batches ────────────────────────────
    BATCH = 4
    total  = len(events)
    done   = 0
    failed = []

    print(f"\n📜 Translating {total} events (batches of {BATCH})...\n")

    for i in range(0, total, BATCH):
        batch      = events[i : i+BATCH]
        batch_num  = i // BATCH + 1
        total_b    = (total + BATCH - 1) // BATCH

        # Skip already-translated
        if all(e.get("title_en") for e in batch):
            print(f"[{batch_num}/{total_b}] ⏭  Already done")
            done += len(batch)
            continue

        print(f"[{batch_num}/{total_b}] Translating events {i}–{min(i+BATCH-1, total-1)}...")

        try:
            translated = translate_batch(client, batch)
            t_map = {t["id"]: t for t in translated}

            for ev in batch:
                t = t_map.get(ev["id"])
                if t:
                    ev["title_en"]       = t.get("title_en", ev.get("title",""))
                    ev["summary_en"]     = t.get("summary_en", ev.get("summary",""))
                    ev["description_en"] = t.get("description_en", ev.get("description",""))
                    print(f"  ✓ {ev['title'][:38]:38s} → {ev.get('title_en','')[:38]}")
                    done += 1

            # Save after every batch
            with open(history_file, "w", encoding="utf-8") as f:
                json.dump(data, f, ensure_ascii=False, indent=2)

            if i + BATCH < total:
                time.sleep(2)

        except Exception as e:
            print(f"  ❌ Batch {batch_num} failed: {e}")
            failed.extend([ev["id"] for ev in batch])
            time.sleep(4)
            continue

    # Final save
    with open(history_file, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)

    print(f"\n{'='*55}")
    print(f"✅  Done! {done}/{total} events translated")
    if failed:
        print(f"⚠️  Failed IDs: {failed}")
    print(f"💾  Saved: {history_file}")
    print(f"{'='*55}")


if __name__ == "__main__":
    main()
