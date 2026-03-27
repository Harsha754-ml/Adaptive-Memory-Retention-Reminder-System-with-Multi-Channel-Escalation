import json
import os
import time

DB_FILE = "database.json"

DEFAULT_DB = {
    "flashcards": [],
    "events": [],
    "pending_notifications": [],
    "learning_plans": [],
    "demo_mode": False,
    "settings": {
        "compression_ratio": 1440
    }
}

def init_db():
    if not os.path.exists(DB_FILE):
        write_db(DEFAULT_DB)

def read_db():
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return DEFAULT_DB

def write_db(data):
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

# --- LEARNING PLANS (CHRONOS) ---

def add_learning_plan(plan):
    data = read_db()
    if "learning_plans" not in data:
        data["learning_plans"] = []
    # Replace existing plan for same topic if exists
    data["learning_plans"] = [p for p in data["learning_plans"] if p.get("topic_id") != plan.get("topic_id")]
    data["learning_plans"].append(plan)
    write_db(data)
    return plan

def get_all_learning_plans():
    return read_db().get("learning_plans", [])

def update_learning_plan(topic_id, updates):
    data = read_db()
    plans = data.get("learning_plans", [])
    for i, p in enumerate(plans):
        if p.get("topic_id") == topic_id:
            data["learning_plans"][i].update(updates)
            write_db(data)
            return data["learning_plans"][i]
    return None

def get_learning_plan(topic_id):
    plans = get_all_learning_plans()
    for p in plans:
        if p.get("topic_id") == topic_id:
            return p
    return None

# --- FLASHCARDS ---

def add_flashcard(flashcard):
    data = read_db()
    data["flashcards"].append(flashcard)
    write_db(data)
    return flashcard

def get_all_flashcards():
    return read_db().get("flashcards", [])

def get_flashcard(flashcard_id):
    flashcards = read_db().get("flashcards", [])
    for fc in flashcards:
        if fc.get("id") == flashcard_id:
            return fc
    return None

def update_flashcard(flashcard_id, updates):
    data = read_db()
    for i, fc in enumerate(data["flashcards"]):
        if fc.get("id") == flashcard_id:
            data["flashcards"][i].update(updates)
            write_db(data)
            return data["flashcards"][i]
    return None

def delete_flashcard(flashcard_id):
    data = read_db()
    original_len = len(data["flashcards"])
    data["flashcards"] = [fc for fc in data["flashcards"] if fc.get("id") != flashcard_id]
    if len(data["flashcards"]) < original_len:
        write_db(data)
        return True
    return False

def add_event(text, event_type="info"):
    data = read_db()
    event = {
        "id": f"evt_{int(time.time()*1000)}",
        "text": text,
        "type": event_type,
        "timestamp": time.time()
    }
    data["events"].append(event)
    # Keep log small
    if len(data["events"]) > 200:
        data["events"] = data["events"][-200:]
    write_db(data)

def get_events(limit=50):
    events = read_db().get("events", [])
    # Return newest first
    return sorted(events, key=lambda x: x["timestamp"], reverse=True)[:limit]

def add_notification(notification):
    data = read_db()
    # Ensure no duplicates for same flashcard id
    data["pending_notifications"] = [n for n in data["pending_notifications"] if n.get("flashcard_id") != notification.get("flashcard_id")]
    data["pending_notifications"].append(notification)
    write_db(data)

def get_pending_notifications():
    return read_db().get("pending_notifications", [])

def clear_notification(notification_id):
    data = read_db()
    original = len(data["pending_notifications"])
    data["pending_notifications"] = [n for n in data["pending_notifications"] if n.get("notification_id") != notification_id]
    if len(data["pending_notifications"]) < original:
        write_db(data)
        return True
    return False

def get_demo_mode():
    return read_db().get("demo_mode", False)

def set_demo_mode(enabled: bool):
    data = read_db()
    data["demo_mode"] = enabled
    write_db(data)
