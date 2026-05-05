from dotenv import load_dotenv
from pathlib import Path

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

import os
import logging
import uuid
import bcrypt
import jwt
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends
from fastapi.responses import JSONResponse
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# -----------------------------
# Setup
# -----------------------------
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = "HS256"

app = FastAPI(title="OnQuest API")
api_router = APIRouter(prefix="/api")

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# -----------------------------
# Auth helpers
# -----------------------------
def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")

def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode("utf-8"), hashed.encode("utf-8"))

def create_access_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "exp": datetime.now(timezone.utc) + timedelta(days=30),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

async def get_current_user(request: Request) -> dict:
    token = None
    auth_header = request.headers.get("Authorization", "")
    if auth_header.startswith("Bearer "):
        token = auth_header[7:]
    if not token:
        token = request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")

# -----------------------------
# Models
# -----------------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str
    bio: Optional[str] = ""

class LoginIn(BaseModel):
    email: EmailStr
    password: str

class UserOut(BaseModel):
    id: str
    email: str
    name: str
    bio: str = ""
    avatar: str = ""
    created_at: str

class QuestNode(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    title: str
    description: str = ""
    type: str = "place"  # place | activity
    photo_base64: str = ""
    lat: Optional[float] = None
    lng: Optional[float] = None
    location_name: str = ""
    order: int = 0

class QuestCreate(BaseModel):
    title: str
    description: str = ""
    cover_photo_base64: str = ""
    nodes: List[QuestNode] = []

class CommentCreate(BaseModel):
    text: str

# -----------------------------
# Auth Routes
# -----------------------------
@api_router.post("/auth/register")
async def register(payload: RegisterIn):
    email = payload.email.lower()
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    user_id = str(uuid.uuid4())
    user_doc = {
        "id": user_id,
        "email": email,
        "name": payload.name,
        "bio": payload.bio or "",
        "avatar": "",
        "password_hash": hash_password(payload.password),
        "created_at": datetime.now(timezone.utc).isoformat(),
        "role": "user",
    }
    await db.users.insert_one(user_doc)
    token = create_access_token(user_id, email)
    user_doc.pop("password_hash", None)
    user_doc.pop("_id", None)
    return {"user": user_doc, "token": token}

@api_router.post("/auth/login")
async def login(payload: LoginIn):
    email = payload.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    token = create_access_token(user["id"], user["email"])
    user.pop("password_hash", None)
    user.pop("_id", None)
    return {"user": user, "token": token}

@api_router.get("/auth/me")
async def me(user=Depends(get_current_user)):
    return user

@api_router.post("/auth/logout")
async def logout():
    return {"ok": True}

# -----------------------------
# Quests
# -----------------------------
def _public_user(u: dict) -> dict:
    return {
        "id": u.get("id", ""),
        "name": u.get("name", ""),
        "avatar": u.get("avatar", ""),
        "bio": u.get("bio", ""),
    }

async def _enrich_quest(q: dict) -> dict:
    q.pop("_id", None)
    user = await db.users.find_one({"id": q.get("user_id")}, {"_id": 0, "password_hash": 0})
    q["author"] = _public_user(user) if user else {"id": "", "name": "Unknown", "avatar": ""}
    q["likes_count"] = len(q.get("likes", []))
    q["comments_count"] = len(q.get("comments", []))
    return q

@api_router.post("/quests")
async def create_quest(payload: QuestCreate, user=Depends(get_current_user)):
    quest_id = str(uuid.uuid4())
    nodes = []
    for i, n in enumerate(payload.nodes):
        nd = n.dict()
        nd["order"] = i
        if not nd.get("id"):
            nd["id"] = str(uuid.uuid4())
        nodes.append(nd)
    doc = {
        "id": quest_id,
        "user_id": user["id"],
        "title": payload.title,
        "description": payload.description,
        "cover_photo_base64": payload.cover_photo_base64,
        "nodes": nodes,
        "ai_summary": "",
        "likes": [],
        "comments": [],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quests.insert_one(doc)
    doc.pop("_id", None)
    enriched = await _enrich_quest(doc)
    return enriched

@api_router.get("/quests/feed")
async def feed(limit: int = 30):
    cursor = db.quests.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    quests = await cursor.to_list(length=limit)
    return [await _enrich_quest(q) for q in quests]

@api_router.get("/quests/explore")
async def explore(limit: int = 30):
    # Trending = sorted by likes count
    pipeline = [
        {"$addFields": {"likes_count": {"$size": {"$ifNull": ["$likes", []]}}}},
        {"$sort": {"likes_count": -1, "created_at": -1}},
        {"$limit": limit},
        {"$project": {"_id": 0}},
    ]
    quests = await db.quests.aggregate(pipeline).to_list(length=limit)
    return [await _enrich_quest(q) for q in quests]

@api_router.get("/quests/{quest_id}")
async def get_quest(quest_id: str):
    q = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    return await _enrich_quest(q)

@api_router.post("/quests/{quest_id}/like")
async def like_quest(quest_id: str, user=Depends(get_current_user)):
    q = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    likes = q.get("likes", [])
    if user["id"] in likes:
        likes.remove(user["id"])
        liked = False
    else:
        likes.append(user["id"])
        liked = True
    await db.quests.update_one({"id": quest_id}, {"$set": {"likes": likes}})
    return {"liked": liked, "likes_count": len(likes)}

@api_router.post("/quests/{quest_id}/comment")
async def comment_quest(quest_id: str, payload: CommentCreate, user=Depends(get_current_user)):
    q = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    comment = {
        "id": str(uuid.uuid4()),
        "user": _public_user(user),
        "text": payload.text,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.quests.update_one({"id": quest_id}, {"$push": {"comments": comment}})
    return comment

@api_router.get("/quests/{quest_id}/comments")
async def get_comments(quest_id: str):
    q = await db.quests.find_one({"id": quest_id}, {"_id": 0, "comments": 1})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    return q.get("comments", [])

@api_router.post("/quests/{quest_id}/ai-summary")
async def ai_summary(quest_id: str, user=Depends(get_current_user)):
    q = await db.quests.find_one({"id": quest_id}, {"_id": 0})
    if not q:
        raise HTTPException(status_code=404, detail="Quest not found")
    if q.get("user_id") != user["id"]:
        raise HTTPException(status_code=403, detail="Only the author can regenerate summary")
    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        nodes = q.get("nodes", [])
        node_lines = []
        for i, n in enumerate(nodes, 1):
            line = f"{i}. {n.get('title', '')}"
            if n.get("location_name"):
                line += f" ({n['location_name']})"
            if n.get("description"):
                line += f" - {n['description']}"
            node_lines.append(line)
        prompt = (
            f"Travel quest titled '{q.get('title','')}'.\n"
            f"Description: {q.get('description','')}\n"
            f"Stops:\n" + "\n".join(node_lines) +
            "\n\nWrite a short, vivid 3-4 sentence travel summary in first person, capturing the spirit of this adventure. No headings, just the paragraph."
        )
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"quest-{quest_id}",
            system_message="You are a poetic travel writer crafting concise journey summaries.",
        ).with_model("gemini", "gemini-2.5-flash")
        msg = UserMessage(text=prompt)
        text = await chat.send_message(msg)
        summary = str(text).strip()
        await db.quests.update_one({"id": quest_id}, {"$set": {"ai_summary": summary}})
        return {"ai_summary": summary}
    except Exception as e:
        logger.exception("AI summary failed")
        raise HTTPException(status_code=500, detail=f"AI summary failed: {e}")

# -----------------------------
# Users
# -----------------------------
@api_router.get("/popular-destinations")
async def popular_destinations(limit: int = 12):
    pipeline = [
        {"$unwind": "$nodes"},
        {"$match": {"nodes.location_name": {"$nin": [None, ""]}}},
        {"$group": {
            "_id": "$nodes.location_name",
            "quest_count": {"$addToSet": "$id"},
            "sample_photo": {"$first": "$nodes.photo_base64"},
            "sample_cover": {"$first": "$cover_photo_base64"},
            "lat": {"$first": "$nodes.lat"},
            "lng": {"$first": "$nodes.lng"},
        }},
        {"$project": {
            "_id": 0,
            "location_name": "$_id",
            "quest_count": {"$size": "$quest_count"},
            "sample_photo": 1,
            "sample_cover": 1,
            "lat": 1,
            "lng": 1,
        }},
        {"$sort": {"quest_count": -1}},
        {"$limit": limit},
    ]
    return await db.quests.aggregate(pipeline).to_list(length=limit)

@api_router.get("/users/{user_id}")
async def get_user(user_id: str):
    u = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0})
    if not u:
        raise HTTPException(status_code=404, detail="User not found")
    quests = await db.quests.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(length=100)
    enriched = [await _enrich_quest(q) for q in quests]
    return {"user": u, "quests": enriched}

@api_router.get("/users/me/quests")
async def my_quests(user=Depends(get_current_user)):
    quests = await db.quests.find({"user_id": user["id"]}, {"_id": 0}).sort("created_at", -1).to_list(length=200)
    return [await _enrich_quest(q) for q in quests]

# -----------------------------
# Health
# -----------------------------
@api_router.get("/")
async def root():
    return {"message": "OnQuest API", "ok": True}

# -----------------------------
# Seed
# -----------------------------
async def seed():
    await db.users.create_index("email", unique=True)
    await db.quests.create_index("created_at")
    admin_email = os.environ.get("ADMIN_EMAIL", "admin@onquest.in").lower()
    admin_password = os.environ.get("ADMIN_PASSWORD", "admin123")
    existing = await db.users.find_one({"email": admin_email})
    if existing is None:
        admin_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": admin_id,
            "email": admin_email,
            "name": "OnQuest Admin",
            "bio": "Building the OnQuest community.",
            "avatar": "",
            "password_hash": hash_password(admin_password),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "role": "admin",
        })
        logger.info("Seeded admin user")
    elif not verify_password(admin_password, existing["password_hash"]):
        await db.users.update_one(
            {"email": admin_email},
            {"$set": {"password_hash": hash_password(admin_password)}},
        )

    # Seed a sample explorer if none
    explorer_email = "explorer@onquest.in"
    explorer = await db.users.find_one({"email": explorer_email})
    if explorer is None:
        explorer_id = str(uuid.uuid4())
        await db.users.insert_one({
            "id": explorer_id,
            "email": explorer_email,
            "name": "Aria Walker",
            "bio": "Mountains, maps, and momentum.",
            "avatar": "",
            "password_hash": hash_password("explorer123"),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "role": "user",
        })
        # Seed a sample quest
        quest_id = str(uuid.uuid4())
        await db.quests.insert_one({
            "id": quest_id,
            "user_id": explorer_id,
            "title": "Himalayan Sunrise Trail",
            "description": "A 3-day quest from the foothills to the first ridge of the Himalayas.",
            "cover_photo_base64": "",
            "nodes": [
                {"id": str(uuid.uuid4()), "title": "Manali Base Camp", "description": "Start the journey at dawn.", "type": "place", "photo_base64": "", "lat": 32.2396, "lng": 77.1887, "location_name": "Manali, India", "order": 0},
                {"id": str(uuid.uuid4()), "title": "Solang Valley Ride", "description": "Paragliding above pine forests.", "type": "activity", "photo_base64": "", "lat": 32.3193, "lng": 77.1573, "location_name": "Solang Valley", "order": 1},
                {"id": str(uuid.uuid4()), "title": "Rohtang Pass", "description": "Snow at 13,000 ft.", "type": "place", "photo_base64": "", "lat": 32.3667, "lng": 77.2467, "location_name": "Rohtang Pass", "order": 2},
            ],
            "ai_summary": "",
            "likes": [],
            "comments": [],
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Seeded sample quest")

@app.on_event("startup")
async def on_startup():
    await seed()

@app.on_event("shutdown")
async def on_shutdown():
    client.close()

# Routes + middleware
app.include_router(api_router)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)
