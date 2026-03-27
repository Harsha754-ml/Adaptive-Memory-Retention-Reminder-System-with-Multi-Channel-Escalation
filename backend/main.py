import os
import time
import asyncio
from uuid import uuid4
from typing import Annotated, List
from fastapi import FastAPI, BackgroundTasks, UploadFile, File, Form, HTTPException, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

import database
import curve_engine
import ingest
from scheduler import start_scheduler

app = FastAPI(title="MemoryForge API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def startup_event():
    database.init_db()
    start_scheduler()

# -----------------
# MODELS
# -----------------
class AddFlashcardReq(BaseModel):
    topic_name: str
    question: str
    answer: str
    source_type: str = "manual"

class ReviewReq(BaseModel):
    flashcard_id: str
    result: str

class TextIngestReq(BaseModel):
    text: str
    topic_name: str

class YoutubeIngestReq(BaseModel):
    url: str
    topic_name: str

class ClearNotifReq(BaseModel):
    notification_id: str

class DemoToggleReq(BaseModel):
    enabled: bool

# -----------------
# FLASHCARD ENDPOINTS
# -----------------
@app.post("/flashcard/add")
def add_flashcard(req: AddFlashcardReq, background_tasks: BackgroundTasks):
    fc = {
        "id": "fc_" + str(uuid4())[:8],
        "topic_name": req.topic_name,
        "question": req.question,
        "answer": req.answer,
        "source_type": req.source_type,
        "created_at": time.time(),
        "last_reviewed": time.time(),
        "stability": 24.0,
        "review_count": 0,
        "ignore_count": 0,
        "status": "active",
        "summary": "",
        "audio_ready": False
    }
    database.add_flashcard(fc)
    database.add_event(f"Added Manual: {req.topic_name}")
    
    background_tasks.add_task(ingest.generate_audio, fc["id"], req.question, req.answer)
    return fc

@app.get("/flashcards")
def get_flashcards():
    flashcards = database.get_all_flashcards()
    demo_mode = database.get_demo_mode()
    
    enriched = []
    for fc in flashcards:
        retention = curve_engine.calculate_retention(fc["last_reviewed"], fc["stability"], demo_mode)
        score = curve_engine.calculate_score(retention)
        urgency = curve_engine.get_urgency(score)
        
        fc_enriched = dict(fc)
        fc_enriched["retention_score"] = score
        fc_enriched["urgency_level"] = urgency
        fc_enriched["next_reminder_minutes"] = curve_engine.get_next_reminder_minutes(fc["stability"], demo_mode)
        fc_enriched["curve_points"] = curve_engine.get_curve_points(fc["last_reviewed"], fc["stability"], demo_mode)
        enriched.append(fc_enriched)
        
    return enriched

@app.get("/flashcard/{id}")
def get_flashcard(id: str):
    cards = get_flashcards()
    for c in cards:
        if c["id"] == id:
            return c
    raise HTTPException(status_code=404, detail="Flashcard not found")

@app.post("/flashcard/review")
def review_flashcard(req: ReviewReq):
    fc = database.get_flashcard(req.flashcard_id)
    if not fc:
        raise HTTPException(status_code=404, detail="Flashcard not found")
        
    new_stability = curve_engine.update_stability(fc["stability"], req.result)
    updates = {
        "stability": new_stability,
        "last_reviewed": time.time(),
        "review_count": fc.get("review_count", 0) + 1,
        "ignore_count": 0
    }
    database.update_flashcard(req.flashcard_id, updates)
    database.add_event(f"Reviewed: {fc['topic_name']} ({req.result})")
    
    # Clear any pending notification for it
    pending = database.get_pending_notifications()
    for p in pending:
        if p["flashcard_id"] == req.flashcard_id:
            database.clear_notification(p["notification_id"])
            
    return get_flashcard(req.flashcard_id)

@app.delete("/flashcard/{id}")
def delete_flashcard(id: str):
    success = database.delete_flashcard(id)
    if success:
        return {"success": True}
    raise HTTPException(status_code=404)

# -----------------
# INGEST ENDPOINTS
# -----------------
@app.post("/ingest/text")
def ingest_text_api(req: TextIngestReq):
    try:
        # ingest_text now handles Chronos Plan creation internally
        fcs = ingest.ingest_text(req.text, req.topic_name)
        if not fcs:
            raise HTTPException(status_code=500, detail="Gemini failed or returned empty")
        return fcs
    except Exception as e:
        print(f"Ingest Text Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/youtube")
def ingest_youtube_api(req: YoutubeIngestReq):
    try:
        fcs = ingest.ingest_youtube(req.url, req.topic_name)
        if not fcs:
            raise HTTPException(status_code=500, detail="Gemini/YouTube extraction failed")
        return fcs
    except Exception as e:
        print(f"Ingest URL Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/ingest/file")
async def ingest_file_api(
    file: Annotated[UploadFile, File(...)], 
    topic_name: Annotated[str, Form(...)]
):
    try:
        contents = await file.read()
        filename_lower = file.filename.lower()
        
        if filename_lower.endswith(".pdf"):
            fcs = ingest.ingest_pdf(contents, topic_name)
        elif filename_lower.endswith(".txt"):
            fcs = ingest.ingest_text(contents.decode('utf-8', errors='ignore'), topic_name)
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format (pdf/txt only)")
            
        if not fcs:
            raise HTTPException(status_code=500, detail="Failed to parse file or AI failed")
            
        return fcs
    except Exception as e:
        print(f"Ingest File Error: {e}")
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Server error: {str(e)}")

# -----------------
# LEARNING PLAN ENDPOINTS
# -----------------
@app.get("/learning-plans")
def get_learning_plans():
    return database.get_all_learning_plans()

@app.get("/learning-plan/{topic_id}")
def get_learning_plan(topic_id: str):
    plan = database.get_learning_plan(topic_id)
    if not plan:
        raise HTTPException(status_code=404, detail="Plan not found")
    return plan

# -----------------
# NOTIFICATION ENDPOINTS
# -----------------
@app.get("/notifications/pending")
def pending_notifications():
    return database.get_pending_notifications()

@app.post("/notifications/clear")
def clear_notification(req: ClearNotifReq):
    database.clear_notification(req.notification_id)
    return {"success": True}

@app.post("/notifications/clear-all")
def clear_all_notifications():
    for p in database.get_pending_notifications():
        database.clear_notification(p["notification_id"])
    return {"success": True}

# -----------------
# AUDIO ENDPOINTS
# -----------------
@app.get("/audio/{id}")
def get_audio(id: str):
    path = f"audio/{id}.mp3"
    if not os.path.exists(path):
        raise HTTPException(status_code=404, detail="Audio file not found")
    return FileResponse(path, media_type="audio/mpeg")

# -----------------
# SETTINGS
# -----------------
@app.get("/dashboard")
def dashboard_stats():
    cards = get_flashcards()
    total = len(cards)
    critical = sum(1 for c in cards if c["urgency_level"] == "critical")
    warning = sum(1 for c in cards if c["urgency_level"] == "warning")
    return {
        "total_cards": total,
        "critical_cards": critical,
        "warning_cards": warning,
        "demo_mode": database.get_demo_mode(),
        "recent_events": database.get_events(limit=5),
        "active_plans": len([p for p in database.get_all_learning_plans() if p.get("status") == "active"])
    }

@app.get("/events")
def events_endpoint():
    return database.get_events(limit=50)

@app.post("/settings/demo-mode")
def toggle_demo(req: DemoToggleReq):
    database.set_demo_mode(req.enabled)
    database.add_event(f"Demo mode changed: {req.enabled}")
    return {"success": True}

# -----------------
# WEBSOCKET
# -----------------
active_connections = []

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    active_connections.append(websocket)
    try:
        while True:
            # Broadcast the unified state every 3 seconds
            data = {
                "flashcards": get_flashcards(),
                "learning_plans": database.get_all_learning_plans(),
                "events": database.get_events(limit=10),
                "dashboard": dashboard_stats()
            }
            await websocket.send_json(data)
            await asyncio.sleep(3)
    except WebSocketDisconnect:
        if websocket in active_connections:
            active_connections.remove(websocket)
    except Exception as e:
        print(f"WS Error: {e}")
        if websocket in active_connections:
            active_connections.remove(websocket)
