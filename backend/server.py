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
CURATED_DESTINATIONS = [
    {"name": "Manali",        "image": "https://images.unsplash.com/photo-1626621341517-bbf3d9990a23?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Spiti Valley",  "image": "https://images.unsplash.com/photo-1626714555274-8e0d4f0e2d9d?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Ladakh",        "image": "https://images.unsplash.com/photo-1591516954303-1a2adc5d5fa5?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Goa",           "image": "https://images.unsplash.com/photo-1512343879784-a960bf40e7f2?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Jaipur",        "image": "https://images.unsplash.com/photo-1477587458883-47145ed94245?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Udaipur",       "image": "https://images.unsplash.com/photo-1599661046289-e31897846e41?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Kerala",        "image": "https://images.unsplash.com/photo-1602216056096-3b40cc0c9944?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Munnar",        "image": "https://images.unsplash.com/photo-1582510003544-4d00b7f74220?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Alleppey",      "image": "https://images.unsplash.com/photo-1611516491426-03025e6043c8?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Rishikesh",     "image": "https://images.unsplash.com/photo-1591018653308-fed4ad520fa1?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Varanasi",      "image": "https://images.unsplash.com/photo-1561361398-a8b0d3c1d8cf?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Hampi",         "image": "https://images.unsplash.com/photo-1606298855672-3efb63017be8?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Coorg",         "image": "https://images.unsplash.com/photo-1599629954294-14df9ec8bc03?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Gokarna",       "image": "https://images.unsplash.com/photo-1580836623504-2cf75bcf0a6e?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Pondicherry",   "image": "https://images.unsplash.com/photo-1517400508447-f8dd518b86db?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Andaman",       "image": "https://images.unsplash.com/photo-1583212292454-1fe6229603b7?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Darjeeling",    "image": "https://images.unsplash.com/photo-1605649461784-4cb5cdee0d65?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Auli",          "image": "https://images.unsplash.com/photo-1605649461858-87c0a1086f8b?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Mahabaleshwar", "image": "https://images.unsplash.com/photo-1591018653308-fed4ad520fa1?q=80&w=1200&auto=format&fit=crop"},
    {"name": "Mussoorie",     "image": "https://images.unsplash.com/photo-1605649461858-87c0a1086f8b?q=80&w=1200&auto=format&fit=crop"},
]

@api_router.get("/popular-destinations")
async def popular_destinations(limit: int = 20):
    out = []
    for dest in CURATED_DESTINATIONS:
        regex = {"$regex": dest["name"], "$options": "i"}
        # count quests that have at least one node matching this destination,
        # OR whose title/description mentions it
        count = await db.quests.count_documents({
            "$or": [
                {"nodes.location_name": regex},
                {"title": regex},
                {"description": regex},
            ]
        })
        if count == 0:
            continue
        out.append({
            "location_name": dest["name"],
            "quest_count": count,
            "sample_photo": dest["image"],
            "sample_cover": dest["image"],
            "lat": None,
            "lng": None,
        })
    out.sort(key=lambda d: -d["quest_count"])
    return out[:limit]

@api_router.get("/leaderboard")
async def leaderboard(limit: int = 20):
    # QP = 5 per quest + 2 per stop + 1 per like received
    pipeline = [
        {"$group": {
            "_id": "$user_id",
            "quest_count": {"$sum": 1},
            "stops": {"$sum": {"$size": {"$ifNull": ["$nodes", []]}}},
            "likes": {"$sum": {"$size": {"$ifNull": ["$likes", []]}}},
        }},
        {"$addFields": {"qp": {"$add": [
            {"$multiply": ["$quest_count", 5]},
            {"$multiply": ["$stops", 2]},
            "$likes",
        ]}}},
        {"$sort": {"qp": -1}},
        {"$limit": limit},
    ]
    rows = await db.quests.aggregate(pipeline).to_list(length=limit)
    out = []
    for i, r in enumerate(rows):
        u = await db.users.find_one({"id": r["_id"]}, {"_id": 0, "password_hash": 0})
        if not u:
            continue
        rank = i + 1
        rank_label = "Master" if r["qp"] >= 100 else ("Pro" if r["qp"] >= 50 else "Novice")
        out.append({
            "rank": rank,
            "user": _public_user(u),
            "qp": r["qp"],
            "quest_count": r["quest_count"],
            "stops": r["stops"],
            "likes": r["likes"],
            "rank_label": rank_label,
        })
    return out

@api_router.get("/search")
async def search(q: str = "", limit: int = 30):
    if not q.strip():
        return []
    regex = {"$regex": q.strip(), "$options": "i"}
    cursor = db.quests.find({
        "$or": [
            {"title": regex},
            {"description": regex},
            {"nodes.location_name": regex},
            {"nodes.title": regex},
        ]
    }, {"_id": 0}).limit(limit)
    quests = await cursor.to_list(length=limit)
    return [await _enrich_quest(qd) for qd in quests]

@api_router.get("/recommendations")
async def recommendations(limit: int = 10):
    # Simple: return latest quests sorted by recency. Could be personalized later.
    cursor = db.quests.find({}, {"_id": 0}).sort("created_at", -1).limit(limit)
    quests = await cursor.to_list(length=limit)
    return [await _enrich_quest(qd) for qd in quests]

# Static info for popular Indian destinations.
DESTINATION_INFO = {
    "manali": {"region": "Himachal Pradesh", "best_time": "October to June", "vibe": "Mountains · Adventure · Cafes",
        "about": "Tucked in the Beas valley, Manali is the gateway to high-altitude rides, snow-filled passes and apple-orchard cafes. Riders cross Atal Tunnel into Lahaul, trekkers head to Bhrigu and Hampta, and slow travellers settle into Old Manali for chai and bonfires.",
        "tips": ["Carry layered woolens even in summer", "Atal Tunnel toll is FREE", "Negotiate cab rates before boarding"]},
    "spiti": {"region": "Himachal Pradesh", "best_time": "May to October", "vibe": "Cold desert · Monasteries",
        "about": "A Buddhist desert above 10,000ft. Whitewashed monasteries, fossil villages, the moon-lake of Chandratal, and dirt-track ride to Kibber make Spiti India's most surreal frontier.",
        "tips": ["Acclimatise in Kaza for a day", "Carry cash — UPI is patchy", "Refuel at Kaza, Tabo and Reckong Peo"]},
    "ladakh": {"region": "Ladakh", "best_time": "May to September", "vibe": "Highland · Bike trips · Lakes",
        "about": "Ladakh is altitude in its purest form — Pangong's blue, Khardung La's snow, and Nubra's dunes. Whether you ride Manali-Leh or fly in, expect prayer flags, monasteries and AMS in equal measure.",
        "tips": ["Take Diamox a day before flying in", "Inner Line Permits required for Pangong/Nubra", "Drink 4L water daily"]},
    "rishikesh": {"region": "Uttarakhand", "best_time": "September to April", "vibe": "Yoga · Rafting · Spiritual",
        "about": "Yoga capital of the world. Rafting on the Ganges, sunset Beatles Ashram graffiti, evening Triveni aarti, and German bakery breakfasts make it a perfect long weekend.",
        "tips": ["Vegetarian-only food in town", "Rafting season: Sep-Jun", "Tapovan & Laxman Jhula are the best stays"]},
    "varanasi": {"region": "Uttar Pradesh", "best_time": "October to March", "vibe": "Spiritual · Heritage · Photography",
        "about": "The world's oldest living city. Sunrise boat rides past 88 ghats, evening Ganga aarti at Dashashwamedh, and the famous Blue Lassi — Kashi is sensory overload, in the best way.",
        "tips": ["Always remove shoes before entering ghats", "Beware of touts at Manikarnika", "Try kachori-sabzi at Ram Bhandar"]},
    "jaipur": {"region": "Rajasthan", "best_time": "October to March", "vibe": "Heritage · Food · Bazaars",
        "about": "The Pink City — Amer Fort sunrises, Hawa Mahal at golden hour, Bapu Bazaar block-prints and night-time view from Nahargarh. The royal capital still wears its identity proudly.",
        "tips": ["Take a guided heritage walk", "Lassi at Lassiwala (since 1944)", "Combo tickets save 50% on monuments"]},
    "udaipur": {"region": "Rajasthan", "best_time": "October to March", "vibe": "Lakes · Romance · Heritage",
        "about": "City of lakes — Pichola sunsets, City Palace terraces, vintage car museum, and rooftop dinners overlooking Lake Palace. Quietest of the Rajasthan triangle.",
        "tips": ["Boat ride is best at sunset", "Stay in haveli hotels in Old City", "Visit Bagore ki Haveli for folk dance"]},
    "goa": {"region": "Goa", "best_time": "November to February", "vibe": "Beaches · Music · Susegado",
        "about": "Two distinct Goas — North for nightlife, hippie markets and shacks; South for slow Portuguese villages and empty beaches. Either way, you'll come back with sand in your shoes.",
        "tips": ["Rent a scooter (INR 400/day)", "Avoid Calangute — try Vagator/Palolem", "Cashew feni is an acquired taste"]},
    "kerala": {"region": "Kerala", "best_time": "September to March", "vibe": "Backwaters · Hills · Spices",
        "about": "God's own country. Houseboats on Alleppey backwaters, tea estates in Munnar, Chinese fishing nets at Fort Kochi, and ayurvedic retreats — Kerala does slow travel like nobody else.",
        "tips": ["Monsoon is a separate season here", "Try parotta with beef fry in Kochi", "Houseboat for one night is enough"]},
    "munnar": {"region": "Kerala", "best_time": "September to May", "vibe": "Tea estates · Hills · Calm",
        "about": "Endless rolling tea gardens at 6,000ft. Visit Kolukkumalai (highest tea estate in the world), spot Nilgiri tahr at Eravikulam, and stay at a homestay tucked into a plantation.",
        "tips": ["Mornings are mistier than evenings", "Tea factory tours are worth it", "Carry warm clothes year-round"]},
    "alleppey": {"region": "Kerala", "best_time": "August to March", "vibe": "Backwaters · Houseboats",
        "about": "The Venice of the East. Float on a kettuvallam through coconut-fringed canals, see paddy fields below sea-level, eat karimeen pollichathu cooked onboard.",
        "tips": ["Book the houseboat in advance", "Avoid weekends if possible", "Kuttanad has the best birding"]},
    "hampi": {"region": "Karnataka", "best_time": "November to February", "vibe": "Boulders · UNESCO ruins · Hippie",
        "about": "A 14th-century empire sprawled across boulder fields. Climb Matanga at sunrise, coracle to Hippie Island, and wander Vittala Temple's stone chariot — Hampi is timeless and otherworldly.",
        "tips": ["Rent a moped or bicycle", "Cross-river by coracle (INR 20)", "Mango Tree cafe is iconic"]},
    "coorg": {"region": "Karnataka", "best_time": "October to March", "vibe": "Coffee · Hills · Pork",
        "about": "Scotland of India. Coffee plantations, Madikeri waterfalls, river rafting at Dubare, and authentic Kodava cuisine (pandi curry, akki roti). Long-weekend favourite from Bangalore.",
        "tips": ["Stay at a plantation homestay", "Try filter coffee at the source", "Ayyappa idli for breakfast at any roadside"]},
    "gokarna": {"region": "Karnataka", "best_time": "October to March", "vibe": "Beaches · Hippie · Treks",
        "about": "Goa's quieter cousin. Trek between Om, Half-Moon and Paradise beaches, sleep in shacks, and visit the Mahabaleshwar temple — sacred and salty all at once.",
        "tips": ["Stay near Kudle, not Gokarna town", "Beach trek takes 2-3 hours", "Carry water for the trek"]},
    "pondicherry": {"region": "Tamil Nadu / Puducherry", "best_time": "October to March", "vibe": "French quarter · Beach · Cafes",
        "about": "A French slice on the Coromandel coast. Cycle through pastel White Town, breakfast at Cafe des Arts, sunset at Promenade, and meditate at Auroville's Matrimandir.",
        "tips": ["Stay in heritage homes in White Town", "Auroville requires advance booking for Matrimandir", "Try French pastries at Baker Street"]},
    "andaman": {"region": "Andaman & Nicobar Islands", "best_time": "October to May", "vibe": "Islands · Diving · Beaches",
        "about": "India's tropical paradise. Radhanagar (Asia's #1 beach), scuba over coral at Havelock, glass-bottom boats and bioluminescent kayaking — pristine, remote, unforgettable.",
        "tips": ["Internet is patchy — disconnect", "Pre-book ferries for Havelock/Neil", "Try sea-food at Anju Coco"]},
    "darjeeling": {"region": "West Bengal", "best_time": "October to May", "vibe": "Tea · Toy train · Mountains",
        "about": "Tea, toy train and Tiger Hill sunrise over Kanchenjunga. Walk the Mall, breakfast at Glenary's, take the UNESCO Darjeeling Himalayan Railway to Ghum.",
        "tips": ["Tiger Hill needs a 4am start", "Toy train tickets sell out fast", "Carry warm clothes Apr-May too"]},
    "auli": {"region": "Uttarakhand", "best_time": "December to March (skiing); April to June", "vibe": "Skiing · Snow · Cable car",
        "about": "India's premier ski destination. Asia's longest gondola, beginner slopes, and panoramic Himalayan views — pair it with Joshimath for a perfect winter weekend.",
        "tips": ["Pre-book skiing & equipment", "Joshimath is the base town", "Combine with Valley of Flowers in Aug"]},
    "mahabaleshwar": {"region": "Maharashtra", "best_time": "October to June", "vibe": "Strawberries · Hills · Forts",
        "about": "Bombay's strawberry country. Mapro Garden, Pratapgad fort (Shivaji's), Arthur's Seat cliff and Venna Lake boating — a perfect monsoon and winter weekend escape.",
        "tips": ["Strawberry season: Dec-Apr", "Carry an umbrella in monsoon", "Pratapgad fort is best at sunrise"]},
    "mussoorie": {"region": "Uttarakhand", "best_time": "March to June; Sep to Nov", "vibe": "Hills · Cafes · Bookshops",
        "about": "Queen of hills. Mall Road in the evening, Char Dukan in Landour, Cambridge Book Depot for a chance encounter with Ruskin Bond, and Kempty Falls for a refreshing dip.",
        "tips": ["Visit Landour for the quiet vibe", "Char Dukan since 1947", "Avoid weekends — Delhi crowds"]},
}

def _dest_info_for(name: str) -> dict:
    key = name.lower().split(",")[0].strip()
    for k, v in DESTINATION_INFO.items():
        if k in key or key in k:
            return v
    return {
        "region": "India",
        "best_time": "Year-round",
        "vibe": "Travel · Discover",
        "about": f"Discover the unique places, food and stories of {name} through the OnQuest community's journeys.",
        "tips": ["Travel light", "Respect local customs", "Carry small change"],
    }

@api_router.get("/destinations/{name}")
async def destination_detail(name: str):
    # Find quests where any node has matching location_name (case-insensitive contains)
    regex = {"$regex": name, "$options": "i"}
    cursor = db.quests.find({"nodes.location_name": regex}, {"_id": 0}).sort("created_at", -1)
    raw = await cursor.to_list(length=50)
    quests = [await _enrich_quest(q) for q in raw]
    # Hero photo: first matching node photo, fallback to first quest cover
    hero = ""
    lat = lng = None
    matching_nodes = []
    for q in raw:
        for n in q.get("nodes", []):
            if n.get("location_name") and name.lower() in n["location_name"].lower():
                if not hero and n.get("photo_base64"):
                    hero = n["photo_base64"]
                if lat is None and n.get("lat") is not None:
                    lat = n["lat"]
                    lng = n["lng"]
                matching_nodes.append({
                    "title": n.get("title"),
                    "description": n.get("description", ""),
                    "type": n.get("type", "place"),
                    "photo_base64": n.get("photo_base64", ""),
                    "lat": n.get("lat"),
                    "lng": n.get("lng"),
                    "from_quest": q.get("title"),
                })
    if not hero and raw:
        hero = raw[0].get("cover_photo_base64", "")
    info = _dest_info_for(name)
    return {
        "location_name": name,
        "hero": hero,
        "lat": lat,
        "lng": lng,
        "quest_count": len(quests),
        "stop_count": len(matching_nodes),
        "info": info,
        "quests": quests,
        "stops": matching_nodes[:12],
    }

class TripPlanIn(BaseModel):
    destination: str
    duration_days: int = 3
    budget: str = "Mid"  # Low | Mid | Premium | Luxury
    transport: str = "Mixed"  # Flight | Train | Road Trip | Mixed
    group_type: str = "Solo"  # Solo | Couple | Family | Friends | Workation
    vibes: List[str] = []  # Adventure, Food, Calm, Beach, Mountains, Heritage, Nightlife, Workation
    notes: str = ""

@api_router.post("/ai/plan-trip")
async def plan_trip(payload: TripPlanIn):
    dest = payload.destination.strip()
    if not dest:
        raise HTTPException(status_code=400, detail="Destination is required")
    # 1. Find matching quests in our DB
    regex = {"$regex": dest, "$options": "i"}
    matches_cursor = db.quests.find({
        "$or": [
            {"title": regex},
            {"description": regex},
            {"nodes.location_name": regex},
            {"nodes.title": regex},
        ]
    }, {"_id": 0}).limit(6)
    matched_raw = await matches_cursor.to_list(length=6)
    matched_quests = [await _enrich_quest(q) for q in matched_raw]

    # 2. Build context for AI
    community_context = ""
    if matched_quests:
        lines = []
        for mq in matched_quests[:4]:
            stops = "; ".join([n.get("title", "") for n in mq.get("nodes", [])[:6]])
            lines.append(f"- '{mq.get('title','')}' by {mq['author']['name']}: {stops}")
        community_context = "\n".join(lines)

    vibes_str = ", ".join(payload.vibes) if payload.vibes else "balanced"
    prompt = f"""You are an expert travel planner for the OnQuest app.
Create a concise, exciting day-by-day itinerary in JSON.

Trip:
- Destination: {dest}
- Duration: {payload.duration_days} days
- Budget: {payload.budget}
- Transport preference: {payload.transport}
- Travelling as: {payload.group_type}
- Vibes: {vibes_str}
- Extra notes: {payload.notes or 'none'}

Community quests already covering this destination (use these for inspiration and reference):
{community_context or '- (none yet)'}

Respond with ONLY valid JSON in this exact shape (no markdown, no extra text):
{{
  "headline": "string, 6-10 words",
  "best_time": "string, e.g. 'October to February'",
  "estimated_cost": "string, e.g. 'INR 12,000-18,000 per person'",
  "days": [
    {{"day": 1, "title": "string", "stops": [{{"name":"string","kind":"place|activity|food|stay","note":"1 sentence"}}]}}
  ],
  "tips": ["3-5 short helpful tips"]
}}
Keep the response under 250 words total. Only return JSON."""

    try:
        from emergentintegrations.llm.chat import LlmChat, UserMessage
        chat = LlmChat(
            api_key=os.environ["EMERGENT_LLM_KEY"],
            session_id=f"trip-plan-{uuid.uuid4()}",
            system_message="You are a travel planning AI. Respond with valid JSON only.",
        ).with_model("gemini", "gemini-2.5-flash")
        resp = await chat.send_message(UserMessage(text=prompt))
        text = str(resp).strip()
        # strip code fences if present
        if text.startswith("```"):
            text = text.strip("`")
            if text.lower().startswith("json"):
                text = text[4:]
            text = text.strip()
        import json as _json
        try:
            ai_plan = _json.loads(text)
        except Exception:
            ai_plan = {"headline": f"Your {dest} adventure", "best_time": "Year-round", "estimated_cost": "Varies", "days": [], "tips": [text[:240]]}
    except Exception as e:
        logger.exception("AI plan failed")
        ai_plan = {"headline": f"Your {dest} adventure", "best_time": "Year-round", "estimated_cost": "Varies", "days": [], "tips": [f"AI service unavailable: {e}"]}

    # 3. Sponsored / monetization placeholders
    sponsors = [
        {
            "id": "flights",
            "category": "Flights",
            "title": f"Cheap flights to {dest}",
            "subtitle": "From INR 3,499 onwards",
            "cta": "Compare fares",
            "icon": "airplane",
            "image": "https://images.unsplash.com/photo-1436491865332-7a61a109cc05?q=80&w=1200&auto=format&fit=crop",
            "url": "#",
        },
        {
            "id": "hotels",
            "category": "Stays",
            "title": f"Top-rated stays in {dest}",
            "subtitle": "Book hotels & homestays",
            "cta": "View options",
            "icon": "bed",
            "image": "https://images.unsplash.com/photo-1566073771259-6a8506099945?q=80&w=1200&auto=format&fit=crop",
            "url": "#",
        },
        {
            "id": "local",
            "category": "Local Businesses",
            "title": f"Featured cafes & guides in {dest}",
            "subtitle": "Verified local partners",
            "cta": "Discover",
            "icon": "storefront",
            "image": "https://images.unsplash.com/photo-1414235077428-338989a2e8c0?q=80&w=1200&auto=format&fit=crop",
            "url": "#",
        },
    ]

    return {
        "input": payload.dict(),
        "matched_quests": matched_quests,
        "ai_plan": ai_plan,
        "sponsors": sponsors,
    }

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

    # Seed admin user only. Sample data is in /app/backend/seed_data.py
    explorer_email = "explorer@onquest.in"
    await db.users.delete_one({"email": explorer_email})

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
