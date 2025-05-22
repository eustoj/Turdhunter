from fastapi import FastAPI, APIRouter, HTTPException, Depends
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field
from typing import List, Optional
import uuid
from datetime import datetime

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Create the main app without a prefix
app = FastAPI()

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Define Models
class GameScore(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_name: str
    difficulty: str
    time_seconds: int
    moves: int
    completed: bool
    timestamp: datetime = Field(default_factory=datetime.utcnow)

class GameScoreCreate(BaseModel):
    player_name: str
    difficulty: str
    time_seconds: int
    moves: int
    completed: bool

class SubscriptionStatus(BaseModel):
    id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    player_id: str
    is_subscribed: bool = False
    subscription_end_date: Optional[datetime] = None
    timestamp: datetime = Field(default_factory=datetime.utcnow)

# Add routes to the router
@api_router.get("/")
async def root():
    return {"message": "Welcome to Turd Hunter API!"}

@api_router.post("/scores", response_model=GameScore)
async def create_score(input: GameScoreCreate):
    score_dict = input.dict()
    score_obj = GameScore(**score_dict)
    await db.game_scores.insert_one(score_obj.dict())
    return score_obj

@api_router.get("/scores", response_model=List[GameScore])
async def get_scores(limit: int = 10, difficulty: Optional[str] = None):
    query = {}
    if difficulty:
        query["difficulty"] = difficulty
    
    scores = await db.game_scores.find(query).sort("time_seconds", 1).limit(limit).to_list(limit)
    return [GameScore(**score) for score in scores]

@api_router.get("/scores/{player_name}", response_model=List[GameScore])
async def get_player_scores(player_name: str):
    scores = await db.game_scores.find({"player_name": player_name}).sort("timestamp", -1).to_list(100)
    return [GameScore(**score) for score in scores]

@api_router.get("/subscription/{player_id}")
async def get_subscription_status(player_id: str):
    subscription = await db.subscriptions.find_one({"player_id": player_id})
    if not subscription:
        return {"is_subscribed": False}
    return SubscriptionStatus(**subscription)

@api_router.post("/subscription/{player_id}")
async def update_subscription_status(player_id: str, is_subscribed: bool):
    subscription = await db.subscriptions.find_one({"player_id": player_id})
    
    if subscription:
        await db.subscriptions.update_one(
            {"player_id": player_id},
            {"$set": {"is_subscribed": is_subscribed}}
        )
    else:
        subscription = SubscriptionStatus(player_id=player_id, is_subscribed=is_subscribed)
        await db.subscriptions.insert_one(subscription.dict())
    
    return {"status": "success", "is_subscribed": is_subscribed}

# Include the router in the main app
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
