from apscheduler.schedulers.background import BackgroundScheduler
import database
import curve_engine
import time
import requests
import os

from dotenv import load_dotenv
load_dotenv()

N8N_WEBHOOK_URL = os.getenv("N8N_WEBHOOK_URL", "")

def trigger_n8n_webhook(payload):
    """
    Dispatches a proactive notification request to n8n.
    Payload: { topic_name, type, content, title, stage }
    """
    if not N8N_WEBHOOK_URL:
        print("⚠️ n8n Webhook URL not configured. Skipping notification.")
        return False
        
    try:
        response = requests.post(N8N_WEBHOOK_URL, json=payload, timeout=5)
        if response.ok:
            print(f"✅ n8n notification triggered for {payload['topic_name']}")
            return True
        else:
            print(f"❌ n8n failure: {response.status_code}")
            return False
    except Exception as e:
        print(f"❌ n8n connection error: {e}")
        return False

def process_learning_plans():
    """
    Checks all active Learning Plans for due steps.
    If a step is due, it triggers n8n and marks it as completed.
    """
    plans = database.get_all_learning_plans()
    now = time.time()
    
    for plan in plans:
        if plan.get("status") != "active":
            continue
            
        # Find next pending step
        pending_steps = [s for s in plan.get("steps", []) if s.get("status") == "pending"]
        if not pending_steps:
            database.update_learning_plan(plan["topic_id"], {"status": "completed"})
            continue
            
        # Sort by stage to ensure sequential processing
        pending_steps.sort(key=lambda s: s["stage"])
        next_step = pending_steps[0]
        
        if now >= next_step["due_at"]:
            # Trigger n8n
            payload = {
                "topic_id": plan["topic_id"],
                "topic_name": plan["topic_name"],
                "title": next_step["title"],
                "type": next_step["type"],
                "content": next_step["content"],
                "stage": next_step["stage"],
                "laptop_ip": LAPTOP_IP
            }
            
            if trigger_n8n_webhook(payload):
                # Update step status
                for step in plan["steps"]:
                    if step["stage"] == next_step["stage"]:
                        step["status"] = "completed"
                
                database.update_learning_plan(plan["topic_id"], {
                    "steps": plan["steps"],
                    "current_stage": next_step["stage"] + 1
                })
                
                database.add_event(f"Chronos Plan: {plan['topic_name']} - Stage {next_step['stage']} active.")

def memory_check_job():
    # Process the Proactive Learning Plans first
    process_learning_plans()
    
    # Existing Flashcard retention logic
    flashcards = database.get_all_flashcards()
    demo_mode = database.get_demo_mode()
    
    for fc in flashcards:
        if fc.get("status") != "active":
            continue
            
        retention = curve_engine.calculate_retention(fc["last_reviewed"], fc["stability"], demo_mode)
        score = curve_engine.calculate_score(retention)
        urgency = curve_engine.get_urgency(score)
        
        if score < 70:
            pending = database.get_pending_notifications()
            already_pending = any(n["flashcard_id"] == fc.get("id") for n in pending)
            
            if not already_pending:
                notification_id = f"notif_{int(time.time()*1000)}"
                notification = {
                    "notification_id": notification_id,
                    "flashcard_id": fc.get("id"),
                    "topic_name": fc.get("topic_name"),
                    "question": fc.get("question"),
                    "retention_score": score,
                    "urgency_level": urgency,
                    "action": "open_quiz" if score < 50 else "open_summary",
                    "audio_url": f"http://{LAPTOP_IP}:8000/audio/{fc.get('id')}",
                    "summary_text": fc.get("summary", ""),
                    "next_reminder_minutes": curve_engine.get_next_reminder_minutes(fc["stability"], demo_mode),
                    "created_at": time.time()
                }
                
                if urgency == "critical":
                    notification["action"] = "force_quiz"
                    
                database.add_notification(notification)
                database.add_event(f"Legacy Recall: {fc['topic_name']} {score}%")
                
            if score < 30:
                try:
                    # Critical local trigger for system speaker
                    requests.post("http://127.0.0.1:8000/speak", json={
                        "text": f"Warning! Memory decay detected: {fc.get('topic_name')}.",
                        "urgency": "critical"
                    }, timeout=1)
                except Exception:
                    pass

def start_scheduler():
    scheduler = BackgroundScheduler()
    # Checking every 5 seconds for responsive learning plans
    scheduler.add_job(memory_check_job, 'interval', seconds=5)
    scheduler.start()
