from datetime import datetime
from pathlib import Path
import json
import re
import sqlite3
import uuid
import hashlib
import hmac
import base64
import subprocess
import threading

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "animai.db"
MEDIA_DIR = BASE_DIR / "media"
MEDIA_DIR.mkdir(exist_ok=True)

app = FastAPI(title="AnimAI Story Director API", version="1.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = db()
    conn.execute("""CREATE TABLE IF NOT EXISTS users(
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""")
    conn.execute("""CREATE TABLE IF NOT EXISTS projects(
        id TEXT PRIMARY KEY,
        user_id INTEGER NOT NULL,
        project_name TEXT NOT NULL,
        story TEXT NOT NULL,
        duration INTEGER NOT NULL,
        status TEXT NOT NULL,
        plan_json TEXT NOT NULL,
        created_at TEXT NOT NULL
    )""")
    conn.commit()
    conn.close()

init_db()

class RegisterRequest(BaseModel):
    name: str
    email: str
    password: str

class LoginRequest(BaseModel):
    email: str
    password: str

class AnalyzeRequest(BaseModel):
    user_id: int = 1
    story: str = Field(min_length=10)
    duration: int = Field(default=60, ge=5, le=3600)

def hash_password(password):
    return hashlib.sha256(password.encode("utf-8")).hexdigest()

def extract_characters(story):
    rules = [
        ("Sandy", "Hero", "Main character"),
        ("Sai", "Heroine", "Main character"),
        ("Viru", "Sai’s father", "Opposes the relationship"),
        ("Kar", "Sai’s brother", "Has doubts about Sandy"),
        ("Saleem", "Sai’s friend", "Supports Sai"),
        ("Anita", "Sai’s friend", "Supports Sai"),
        ("Mahi", "Sandy’s friend", "Supports Sandy"),
        ("Suchi", "Sandy’s friend", "Supports Sandy"),
        ("Naveen", "Sandy’s father", "Supports Sandy"),
        ("Kavit", "Sandy’s mother", "Supports Sandy"),
        ("Praj", "Sandy’s cousin", "Supports Sandy"),
    ]
    found=[]
    for name, role, description in rules:
        if re.search(r"\b"+re.escape(name)+r"\b", story, re.I):
            found.append({"name":name,"role":role,"description":description})
    if re.search(r"\bchild\b|\bkid\b|\bdaughter\b|\bson\b", story, re.I):
        found.append({"name":"Sai’s Child","role":"Child","description":"Sai’s child and an important emotional responsibility"})
    return found

def has_any(text, words):
    t=text.lower()
    return any(w in t for w in words)

def make_scene(index, start, end, description, characters, emotion, action, camera,
               time, weather, music, sfx, dialogue=False, dialogue_text="", lip_sync=False):
    return {
        "id": index, "start": start, "end": end, "description": description,
        "characters": characters, "emotion": emotion, "action": action,
        "motion": action, "camera": camera, "time": time, "weather": weather,
        "music": music, "sfx": sfx, "dialogue": dialogue,
        "dialogue_text": dialogue_text, "lip_sync": lip_sync
    }

def build_story_plan(story, duration):
    chars=extract_characters(story)
    names=[c["name"] for c in chars]
    hero="Sandy" if "Sandy" in names else (names[0] if names else "Hero")
    heroine="Sai" if "Sai" in names else (names[1] if len(names)>1 else "Heroine")
    father="Viru" if "Viru" in names else "Sai’s father"
    brother="Kar" if "Kar" in names else "Sai’s brother"
    child="Sai’s Child" if "Sai’s Child" in names else "Sai’s child"
    beats=[
      ("Opening",f"Introduce {hero} and {heroine} and establish their separate lives.","curiosity / warmth","walk, observe, natural blinking and eye movement","Wide establishing shot","Morning","Natural daylight","Soft piano","Natural ambience",[hero,heroine]),
      ("First Connection",f"{hero} and {heroine} notice each other and begin a meaningful connection.","shy happiness","eye contact, smile, subtle head movement, gentle walking","Medium tracking two-shot","Morning","Bright natural light","Gentle romantic guitar","Environment ambience",[hero,heroine]),
      ("Growing Love",f"{hero} and {heroine} spend time together and their love becomes stronger.","joy / affection","talk, smile, gesture, walk together","Close two-shot with slow push-in","Afternoon","Warm sunlight","Warm romantic strings","Light ambience",[hero,heroine]),
      ("Love Confession",f"{hero} realizes the depth of his feelings and expresses genuine love to {heroine}.","nervous romance","emotional eye contact, smile, expressive face","Close-up with slow push-in","Golden hour","Soft sunset glow","Emotional piano and strings","Soft wind",[hero,heroine]),
      ("Family Discovery",f"{father} discovers the relationship and strongly questions it.","shock / tension","turn, confront, worried expressions, restrained gestures","Shot-reverse-shot close-ups","Evening","Dramatic indoor light","Low tension strings","Room ambience",[hero,heroine,father]),
      ("Family Pressure",f"{brother} has doubts about {hero}; family pressure increases while {heroine} protects the relationship.","conflict / fear","argument, tears, lowered gaze, restrained gestures","Medium group shot","Evening","Dim / overcast","Dramatic strings","Indoor ambience",[hero,heroine,brother,father]),
      ("Responsibility",f"{heroine} faces additional responsibility because of {child}; the decision becomes more serious and emotional.","sadness / responsibility","protective gesture, pause, emotional facial expression","Intimate close-ups","Night","Soft practical light","Quiet piano","Room / night ambience",[heroine,child,hero]),
      ("Separation",f"Family pressure forces {hero} and {heroine} to separate even though they still love each other.","heartbreak","walk away, tearful look back, lowered gaze","Wide static shot then slow pull-back","Rainy evening","Rain / cool light","Sad piano","Rain and wind",[hero,heroine]),
      ("Struggle",f"{hero} refuses to give up and works hard to prove that his love is genuine and responsible.","determination","walk, work, think, persistent body language","Slow tracking montage","Night to morning","Changing light","Hopeful orchestral build","City / work ambience",[hero]),
      ("Understanding",f"Both families begin listening, reflecting and understanding the sincerity of the relationship.","reflection / hope","listen, pause, softened expressions, respectful gestures","Balanced group composition","Morning","Warm daylight","Hopeful piano","Quiet ambience",[hero,heroine,father,brother]),
      ("Reunion",f"{hero} and {heroine} reconnect after separation and share an emotional moment.","relief / love","approach, smile, eye contact, supportive gesture","Slow cinematic push-in","Golden hour","Warm sunset","Warm strings","Soft wind",[hero,heroine]),
      ("Acceptance",f"Both families accept the relationship after seeing genuine love, responsibility and commitment.","joy / peace","smile, respectful family interaction, emotional closure","Wide cinematic finale","Sunset","Golden warm light","Full emotional theme","Natural ambience",[hero,heroine,father,brother])]
    lines=[
      f'{hero}: I love you, Sai, and I want to prove that my love is genuine.',
      f'{heroine}: I love you too, but my family and my responsibilities make this difficult.',
      f'{father}: I am worried about Sai and her future. I cannot accept this easily.',
      f'{brother}: Sandy, you must prove that you are serious about my sister.',
      f'{hero}: I will not run away from responsibility. I will face every problem with her.',
      f'{heroine}: Even when we are separated, my feelings have not changed.',
      f'{hero}: I will show your family that our love is built on respect and responsibility.',
      f'{father}: I understand now that your love is sincere.',
      f'{heroine}: We finally have a chance to be together without fear.'
    ]
    n=max(6,min(20,round(duration/25))); step=duration/n; scenes=[]
    for i in range(n):
        title,desc,emotion,action,camera,time,weather,music,sfx,active=beats[min(i,len(beats)-1)]
        active=[x for x in active if x in names]
        if not active: active=[x for x in [hero,heroine] if x in names]
        line=lines[min(max(i-3,0),len(lines)-1)] if i>=3 else ""
        scenes.append(make_scene(i+1,round(i*step),round((i+1)*step),desc,active,emotion,action,camera,time,weather,music,sfx,bool(line),line,bool(line)))
    return {"characters":names,"character_details":chars,"weather":"AI-selected per scene","time":"AI-selected per scene","emotion":"AI-selected per scene","actions":sorted(set(x["action"] for x in scenes)),"dialogue":True,"subtitles":True,"lip_sync":True,"music":"Adaptive cinematic score","scenes":scenes,"director_notes":["Maintain exact character identity, face, hair, clothing and age across scenes.","Reuse the same character reference/memory across every scene.","Use natural blinking, eye direction, facial expressions and subtle head/body micro-movements.","Keep location, time, weather and lighting continuous unless the story changes them.","Generate dialogue automatically from the user’s story and assign consistent voices.","Use dedicated lip-sync for every speaking scene.","Duck music during dialogue and raise the emotional score between dialogue beats.","Use cinematic camera movement that supports the emotional purpose of each scene."]}


def _safe_project_paths(project_id: str):
    image_path = MEDIA_DIR / f"{project_id}.jpg"
    video_path = MEDIA_DIR / f"{project_id}.mp4"
    return image_path, video_path

def _set_project_status(project_id: str, status: str):
    conn = db()
    conn.execute("UPDATE projects SET status=? WHERE id=?", (status, project_id))
    conn.commit()
    conn.close()

def _run_video_generation(project_id: str, duration: int):
    image_path, video_path = _safe_project_paths(project_id)
    try:
        _set_project_status(project_id, "Generating")
        # This MVP creates a real MP4 from the uploaded image with subtle cinematic
        # camera motion. It is the local render pipeline; AI image-to-video comes next.
        vf = (
            "scale=1280:720:force_original_aspect_ratio=increase,"
            "crop=1280:720,"
            "zoompan=z='min(zoom+0.00035,1.12)':"
            "x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':"
            "d=1:s=1280x720:fps=24,setsar=1"
        )
        cmd = [
            "ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
            "-loop", "1", "-i", str(image_path),
            "-t", str(duration), "-vf", vf,
            "-c:v", "libx264", "-preset", "veryfast", "-pix_fmt", "yuv420p",
            "-movflags", "+faststart", str(video_path)
        ]
        subprocess.run(cmd, check=True, timeout=max(180, duration * 4))
        _set_project_status(project_id, "Completed")
    except Exception as exc:
        if video_path.exists():
            video_path.unlink(missing_ok=True)
        _set_project_status(project_id, "Failed")
        print(f"Video generation failed for {project_id}: {exc}")

@app.post("/projects/{project_id}/generate")
def generate_video(project_id: str, payload: dict):
    conn = db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    image_b64 = payload.get("image_base64", "")
    if not image_b64:
        raise HTTPException(status_code=400, detail="Please upload a character or scene image")
    try:
        if "," in image_b64:
            image_b64 = image_b64.split(",", 1)[1]
        raw = base64.b64decode(image_b64, validate=True)
        if len(raw) > 15 * 1024 * 1024:
            raise HTTPException(status_code=413, detail="Image must be 15 MB or smaller")
        image_path, video_path = _safe_project_paths(project_id)
        image_path.write_bytes(raw)
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid image data")
    _set_project_status(project_id, "Queued")
    threading.Thread(target=_run_video_generation, args=(project_id, int(row["duration"])), daemon=True).start()
    return {"project_id": project_id, "status": "Queued", "message": "Video rendering started"}

@app.get("/projects/item/{project_id}/video")
def get_video(project_id: str):
    _, video_path = _safe_project_paths(project_id)
    if not video_path.exists():
        raise HTTPException(status_code=404, detail="Video is not ready yet")
    return FileResponse(video_path, media_type="video/mp4", filename=f"AnimAI_{project_id}.mp4")

@app.get("/health")
def health():
    return {"status": "ok", "service": "AnimAI Story Director"}

@app.post("/auth/register")
def register(req: RegisterRequest):
    conn = db()
    try:
        cur = conn.execute(
            "INSERT INTO users(name,email,password,created_at) VALUES(?,?,?,?)",
            (req.name.strip(), req.email.strip().lower(), hash_password(req.password), datetime.utcnow().isoformat())
        )
        conn.commit()
        return {"id": cur.lastrowid, "name": req.name.strip(), "email": req.email.strip().lower()}
    except sqlite3.IntegrityError:
        raise HTTPException(status_code=409, detail="Email already registered")
    finally:
        conn.close()

@app.post("/auth/login")
def login(req: LoginRequest):
    conn = db()
    row = conn.execute("SELECT * FROM users WHERE email=?", (req.email.strip().lower(),)).fetchone()
    conn.close()
    if not row or not hmac.compare_digest(row["password"], hash_password(req.password)):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {
        "access_token": f"local-{row['id']}",
        "user": {"id": row["id"], "name": row["name"], "email": row["email"]}
    }

@app.post("/projects/analyze")
def analyze(req: AnalyzeRequest):
    plan = build_story_plan(req.story, req.duration)
    project_id = str(uuid.uuid4())
    title = re.sub(r"\s+", " ", req.story.strip())[:60]
    now = datetime.utcnow().isoformat()
    conn = db()
    conn.execute(
        "INSERT INTO projects(id,user_id,project_name,story,duration,status,plan_json,created_at) VALUES(?,?,?,?,?,?,?,?)",
        (project_id, req.user_id, title or "Untitled Story", req.story, req.duration,
         "Planned", json.dumps(plan), now)
    )
    conn.commit()
    conn.close()
    return {
        "id": project_id,
        "title": title or "Untitled Story",
        "status": "Planned",
        "duration": req.duration,
        "plan": plan
    }

@app.get("/projects/{user_id}")
def list_projects(user_id: int):
    conn = db()
    rows = conn.execute(
        "SELECT id,project_name,status,duration,created_at FROM projects WHERE user_id=? ORDER BY created_at DESC",
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(r) for r in rows]

@app.get("/projects/item/{project_id}")
def get_project(project_id: str):
    conn = db()
    row = conn.execute("SELECT * FROM projects WHERE id=?", (project_id,)).fetchone()
    conn.close()
    if not row:
        raise HTTPException(status_code=404, detail="Project not found")
    data = dict(row)
    data["plan"] = json.loads(data.pop("plan_json"))
    _, video_path = _safe_project_paths(project_id)
    data["video_ready"] = video_path.exists()
    data["video_url"] = f"/projects/item/{project_id}/video" if video_path.exists() else None
    return data
