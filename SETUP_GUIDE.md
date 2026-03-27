# MemoryForge V2: Complete Local Setup Guide

Welcome to the production-ready build of MemoryForge. Everything has been placed directly in `MemoryForge/`.

## Architecture Overview
1. **Python Backend**: Fast, AI-driven backend managing Ebbinghaus curves via APScheduler, creating Audio MP3s via gTTS, and pushing WebSockets.
2. **React Dashboard**: Live metrics, visualizations, and logs via a Vite dev server.
3. **Flutter App**: Cleaned, bottom-nav application with Smart Modal ingestion tabs, local-network 5-second polling (replacing legacy remote FCM setups, but FCM is included down below if you need it via n8n).

---

## 1. Starting the FastAPI Backend
Open a terminal and run:
```bash
cd MemoryForge/backend
# (Optional but recommended) Enable a virtual env here
pip install -r requirements.txt
```
**CRITICAL**: Edit `.env` and put your `GEMINI_API_KEY` inside.
```bash
# Start server attached to all interfaces (so phone can hit it)
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

---

## 2. Starting the React Dashboard
Open a SECOND terminal on your laptop:
```bash
cd MemoryForge/dashboard
npm install
npm run dev
```
Open `http://localhost:5173`. You will instantly see the dashboard try to connect to the backend WebSocket (`ws://localhost:8000/ws`). 

---

## 3. Connecting the Flutter Phone App
1. Find your **Laptop's WiFi IP Address**. Open CMD, type `ipconfig`, look for "IPv4 Address" (e.g. `192.168.1.5`).
2. Open `MemoryForge/flutter_app/lib/constants.dart`.
3. Change `192.168.1.10` to your actual IP Address.

Open a THIRD terminal (or use VS Code):
```bash
cd MemoryForge/flutter_app
flutter pub get
flutter run
```
Because the phone is on the same WiFi, the app's `Timer.periodic(5s)` will silently hit `http://192.168.1.5:8000/notifications/pending` every 5 seconds. If a card organically decays past the warning threshold, the MaterialBanner will immediately appear *natively* on your device.

---

## 4. (Optional) n8n Push Webhook Fallback
If you wish to do it strictly via push notification instead of local 5s polling:
1. Open n8n, click **Import from File**.
2. Select `MemoryForge/n8n_fcm_workflow.json` generated for you.
3. It handles the `Switch` routing correctly, stopping `safe` and `warning` paths, and firing an outbound `POST` request to FCM for `danger` and `critical` retention levels.
