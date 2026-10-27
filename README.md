# AnimAI Full Stack v1

## What is included
- FastAPI backend
- SQLite database
- Register/Login
- Project persistence
- AI Director story analysis endpoint
- Automatic characters/scenes/weather/time/emotion/camera/motion
- Dialogue + lip-sync planning
- Music planning
- React-free lightweight frontend
- Dashboard
- Create Story
- Projects
- Profile

## Run on Windows

### 1. Open PowerShell in backend folder
```powershell
cd backend
python -m venv venv
.\venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload
```

Backend:
http://127.0.0.1:8000

### 2. Open another PowerShell
```powershell
cd frontend
python -m http.server 5500
```

Open:
http://127.0.0.1:5500

## Next production step
The current backend is the real application foundation. The remaining external AI layer is intentionally separated:
- LLM for deeper story analysis
- image-to-video model
- TTS
- lip-sync
- FFmpeg composition
- object storage
- background job queue

This separation lets the UI and project database work before adding paid model APIs.
