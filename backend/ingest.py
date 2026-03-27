import os
import json
import re
from uuid import uuid4
from dotenv import load_dotenv
from google import genai
from youtube_transcript_api import YouTubeTranscriptApi
import PyPDF2
import io
from gtts import gTTS
import database

load_dotenv()

API_KEY = os.getenv("GEMINI_API_KEY")
# Initialize the new Google GenAI client
client = None
if API_KEY:
    client = genai.Client(api_key=API_KEY)

# Use the latest verified models from the list
MODEL_NAME = 'gemini-2.5-flash' 
# Secondary fallback
FALLBACK_MODEL = 'gemini-1.5-flash'

def create_chronos_plan(topic_name: str, flashcards: list):
    """
    Creates a multi-stage 'Chronos Plan' for a newly ingested topic.
    Stages: 
    0: Immediate (Audio Summary)
    1: T + 1 Hour (Textual Recap)
    2: T + 24 Hours (Knowledge Quiz)
    """
    now = time.time()
    topic_id = "topic_" + str(uuid4())[:8]
    
    plan = {
        "topic_id": topic_id,
        "topic_name": topic_name,
        "created_at": now,
        "status": "active",
        "current_stage": 0,
        "steps": [
            {
                "stage": 0,
                "type": "audio_summary",
                "title": "Immediate Synthesis",
                "content": f"Audio summary for {topic_name} is ready for review.",
                "due_at": now, # Immediate
                "status": "pending"
            },
            {
                "stage": 1,
                "type": "text_recap",
                "title": "Synaptic Calibration",
                "content": f"Recapping {topic_name}: {flashcards[0]['question'] if flashcards else ''}",
                "due_at": now + 3600, # 1 Hour
                "status": "pending"
            },
            {
                "stage": 2,
                "type": "quiz",
                "title": "The Knowledge Litmus",
                "content": f"Final challenge for {topic_name}.",
                "due_at": now + 86400, # 24 Hours
                "status": "pending"
            }
        ]
    }
    
    database.add_learning_plan(plan)
    
    # Generate audio for the first card immediately if possible
    if flashcards:
        generate_audio(flashcards[0]["id"], flashcards[0]["question"], flashcards[0]["answer"])

def ingest_text(text: str, topic_name: str) -> list:
    if not client:
        print("Error: Gemini Client not initialized. Check GEMINI_API_KEY.")
        return []
        
    prompt = f"""You are a flashcard generator for the MemoryForge system. 
Analyze the input text and generate 5-8 high-quality flashcards.
Return ONLY a raw JSON array. No markdown, no triple backticks, no explanations.
Each object must have "question" and "answer" keys.

Input Text:
{text}"""

    try:
        import time
        time.sleep(1) # Simple throttle to help with quota
        # New SDK syntax
        response = client.models.generate_content(
            model=MODEL_NAME,
            contents=prompt
        )
        
        text_resp = response.text
        # Robust JSON cleaning
        clean_json = text_resp.strip()
        if "```" in clean_json:
            clean_json = re.sub(r'```json\s*|\s*```', '', clean_json)
            
        flashcards_data = json.loads(clean_json)
        
        created = []
        for item in flashcards_data:
            fc = {
                "id": "fc_" + str(uuid4())[:8],
                "topic_name": topic_name,
                "question": item["question"],
                "answer": item["answer"],
                "source_type": "ai_ingest",
                "created_at": time.time(),
                "last_reviewed": 0,
                "stability": 24.0,
                "review_count": 0,
                "ignore_count": 0,
                "status": "active",
                "summary": "",
                "audio_ready": False
            }
            database.add_flashcard(fc)
            created.append(fc)
        
        database.add_event(f"AI Ingested: {topic_name} ({len(created)} cards)")
        
        # INITIATE CHRONOS PLAN
        create_chronos_plan(topic_name, created)
        
        return created
        
    except Exception as e:
        print(f"Gemini Migration Error: {e}")
        import traceback
        traceback.print_exc()
        return []

def ingest_youtube(url: str, topic_name: str) -> list:
    try:
        video_id = url.split("v=")[1].split("&")[0]
        transcript = YouTubeTranscriptApi.get_transcript(video_id)
        text = " ".join([t["text"] for t in transcript])
        return ingest_text(text[:4000], topic_name)
    except Exception as e:
        print(f"YouTube Ingest Error: {e}")
        return []

def ingest_pdf(file_bytes: bytes, topic_name: str) -> list:
    try:
        pdf_reader = PyPDF2.PdfReader(io.BytesIO(file_bytes))
        text = ""
        for page in pdf_reader.pages[:5]: # Cap at 5 pages
            text += page.extract_text()
        return ingest_text(text[:4000], topic_name)
    except Exception as e:
        print(f"PDF Ingest Error: {e}")
        return []

def generate_summary(question: str, answer: str) -> str:
    if not client: return f"Memory card for {question}"
    try:
        prompt = f"Summarize this into one short, memorable sentence for audio playback: Q:{question} A:{answer}"
        response = client.models.generate_content(model=MODEL_NAME, contents=prompt)
        return response.text.replace("\n", " ").strip()
    except Exception:
        return f"Key takeaway: {answer[:50]}"

def generate_audio(flashcard_id: str, question: str, answer: str) -> str:
    try:
        summary = generate_summary(question, answer)
        # Update flashcard with summary
        database.update_flashcard(flashcard_id, {"summary": summary})
        
        os.makedirs("audio", exist_ok=True)
        path = f"audio/{flashcard_id}.mp3"
        tts = gTTS(text=summary, lang='en')
        tts.save(path)
        
        database.update_flashcard(flashcard_id, {"audio_ready": True})
        return path
    except Exception as e:
        print(f"Audio Generation Error: {e}")
        return ""
