from fastapi import FastAPI, APIRouter, HTTPException, Request, Response, Depends, Body
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import httpx
import socketio

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# ============ SOCKET.IO SETUP ============
sio = socketio.AsyncServer(
    async_mode='asgi',
    cors_allowed_origins='*',
    logger=False,
    engineio_logger=False
)

# Create the main FastAPI app
fastapi_app = FastAPI(title="Development OS API")

# Wrap FastAPI with Socket.IO
app = socketio.ASGIApp(sio, other_asgi_app=fastapi_app)

# Create a router with the /api prefix
api_router = APIRouter(prefix="/api")

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# ============ REALTIME SERVICE ============
class RealtimeService:
    """Service to emit real-time events to connected clients"""
    
    @staticmethod
    async def emit_to_user(user_id: str, event: str, payload: dict):
        """Emit event to specific user"""
        await sio.emit(event, payload, room=f"user:{user_id}")
        logger.info(f"REALTIME: {event} -> user:{user_id}")
    
    @staticmethod
    async def emit_to_role(role: str, event: str, payload: dict):
        """Emit event to all users with specific role"""
        await sio.emit(event, payload, room=f"role:{role}")
        logger.info(f"REALTIME: {event} -> role:{role}")
    
    @staticmethod
    async def emit_to_project(project_id: str, event: str, payload: dict):
        """Emit event to project room"""
        await sio.emit(event, payload, room=f"project:{project_id}")
        logger.info(f"REALTIME: {event} -> project:{project_id}")
    
    @staticmethod
    async def emit_to_all(event: str, payload: dict):
        """Emit event to all connected clients"""
        await sio.emit(event, payload)
        logger.info(f"REALTIME: {event} -> broadcast")

realtime = RealtimeService()

# ============ SOCKET.IO EVENT HANDLERS ============

# Store user info per socket connection
socket_users = {}

async def get_user_from_token(token: str):
    """Verify session token and return user"""
    if not token:
        return None
    session = await db.user_sessions.find_one({"session_token": token}, {"_id": 0})
    if not session:
        return None
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        return None
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    return user

@sio.event
async def connect(sid, environ):
    logger.info(f"Socket connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Socket disconnected: {sid}")
    socket_users.pop(sid, None)

@sio.event
async def authenticate(sid, data):
    """Authenticate socket connection with session token"""
    token = data.get('token')
    user = await get_user_from_token(token)
    if not user:
        return {'ok': False, 'error': 'Invalid token'}
    
    socket_users[sid] = user
    logger.info(f"Socket {sid} authenticated as {user['user_id']} ({user['role']})")
    return {'ok': True, 'user_id': user['user_id'], 'role': user['role']}

@sio.event
async def join(sid, data):
    """Join rooms based on user role and context - WITH AUTH CHECK"""
    # Check if authenticated
    user = socket_users.get(sid)
    if not user:
        return {'ok': False, 'error': 'Not authenticated. Call authenticate first.'}
    
    rooms = data.get('rooms', [])
    allowed_rooms = []
    denied_rooms = []
    
    for room in rooms:
        # Validate room access based on user
        if room.startswith('user:'):
            # Can only join own user room
            if room == f"user:{user['user_id']}":
                allowed_rooms.append(room)
            else:
                denied_rooms.append(room)
        elif room.startswith('role:'):
            # Can only join own role room
            if room == f"role:{user['role']}":
                allowed_rooms.append(room)
            else:
                denied_rooms.append(room)
        elif room.startswith('project:'):
            # For clients: verify ownership. For admin: allow all
            if user['role'] == 'admin':
                allowed_rooms.append(room)
            elif user['role'] == 'client':
                project_id = room.replace('project:', '')
                project = await db.projects.find_one({"project_id": project_id, "client_id": user['user_id']})
                if project:
                    allowed_rooms.append(room)
                else:
                    denied_rooms.append(room)
            else:
                # Developers/testers can join project rooms they have assignments in
                allowed_rooms.append(room)  # TODO: stricter check
        else:
            denied_rooms.append(room)
    
    for room in allowed_rooms:
        await sio.enter_room(sid, room)
        logger.info(f"Socket {sid} joined room: {room}")
    
    if denied_rooms:
        logger.warning(f"Socket {sid} denied rooms: {denied_rooms}")
    
    return {'ok': True, 'joined': allowed_rooms, 'denied': denied_rooms}

@sio.event
async def leave(sid, data):
    """Leave rooms"""
    rooms = data.get('rooms', [])
    for room in rooms:
        await sio.leave_room(sid, room)
    return {'ok': True}


# ============ MODELS ============

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str
    email: str
    name: str
    picture: Optional[str] = None
    role: str = "client"  # client, developer, tester, admin
    skills: List[str] = []
    level: str = "junior"  # junior, middle, senior
    rating: float = 5.0
    completed_tasks: int = 0
    active_load: int = 0
    created_at: datetime

class UserSession(BaseModel):
    model_config = ConfigDict(extra="ignore")
    session_id: str
    user_id: str
    session_token: str
    expires_at: datetime
    created_at: datetime

# Request Models
class RequestCreate(BaseModel):
    title: str
    description: str
    business_idea: str
    target_audience: Optional[str] = None
    budget_range: Optional[str] = None
    timeline: Optional[str] = None

class RequestModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    request_id: str
    user_id: str
    title: str
    description: str
    business_idea: str
    target_audience: Optional[str] = None
    budget_range: Optional[str] = None
    timeline: Optional[str] = None
    status: str = "pending"  # pending, in_review, approved, rejected
    created_at: datetime

# Product Definition
class ProductDefinition(BaseModel):
    model_config = ConfigDict(extra="ignore")
    product_id: str
    request_id: str
    product_type: str  # web_app, mobile_app, telegram_app, dashboard, marketplace, etc.
    goal: str
    target_audience: str
    key_features: List[str]
    constraints: List[str]
    estimated_timeline: str
    status: str = "draft"
    created_at: datetime

# Scope
class ScopeItem(BaseModel):
    model_config = ConfigDict(extra="ignore")
    item_id: str
    scope_id: str
    title: str
    description: str
    item_type: str  # feature, integration, design, logic, qa
    priority: str = "core"  # core, optional, future
    estimated_hours: int
    status: str = "pending"

class Scope(BaseModel):
    model_config = ConfigDict(extra="ignore")
    scope_id: str
    product_id: str
    total_hours: int
    items: List[ScopeItem] = []
    status: str = "draft"
    created_at: datetime

# Project
class Project(BaseModel):
    model_config = ConfigDict(extra="ignore")
    project_id: str
    scope_id: str
    client_id: str
    name: str
    current_stage: str = "discovery"  # discovery, scope, design, development, qa, delivery, support
    progress: int = 0
    status: str = "active"
    created_at: datetime

# Work Unit
class WorkUnit(BaseModel):
    model_config = ConfigDict(extra="ignore")
    unit_id: str
    project_id: str
    scope_item_id: str
    title: str
    description: str
    unit_type: str  # task, bug, integration, design
    estimated_hours: int
    actual_hours: int = 0
    assigned_to: Optional[str] = None
    status: str = "pending"  # pending, assigned, in_progress, submitted, review, validation, completed
    created_at: datetime

# Assignment
class Assignment(BaseModel):
    model_config = ConfigDict(extra="ignore")
    assignment_id: str
    unit_id: str
    developer_id: str
    assigned_by: str
    status: str = "active"
    created_at: datetime

# Work Log
class WorkLogCreate(BaseModel):
    hours: float
    description: str

class WorkLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str
    unit_id: str
    developer_id: str
    hours: float
    description: str
    created_at: datetime

# Submission
class SubmissionCreate(BaseModel):
    summary: str
    links: List[str] = []
    attachments: List[str] = []

class Submission(BaseModel):
    model_config = ConfigDict(extra="ignore")
    submission_id: str
    unit_id: str
    developer_id: str
    summary: str
    links: List[str] = []
    attachments: List[str] = []
    status: str = "pending"  # pending, approved, revision_needed
    created_at: datetime

# Review
class ReviewCreate(BaseModel):
    submission_id: str
    result: str  # approved, revision_needed
    feedback: str

class Review(BaseModel):
    model_config = ConfigDict(extra="ignore")
    review_id: str
    submission_id: str
    reviewer_id: str
    result: str
    feedback: str
    created_at: datetime

# Validation Task
class ValidationTask(BaseModel):
    model_config = ConfigDict(extra="ignore")
    validation_id: str
    unit_id: str
    tester_id: Optional[str] = None
    status: str = "pending"  # pending, in_progress, passed, failed
    issues: List[str] = []
    created_at: datetime

# Validation Issue
class ValidationIssue(BaseModel):
    model_config = ConfigDict(extra="ignore")
    issue_id: str
    validation_id: str
    title: str
    description: str
    severity: str  # low, medium, high, critical
    status: str = "open"
    created_at: datetime

# Deliverable 2.0 - Product Delivery Layer
class DeliverableBlock(BaseModel):
    """Individual feature/result block in deliverable"""
    block_id: str
    block_type: str  # feature, integration, design, api, documentation
    title: str
    description: str
    preview_url: Optional[str] = None
    api_url: Optional[str] = None
    work_unit_ids: List[str] = []  # linked completed work units
    status: str = "completed"

class DeliverableResource(BaseModel):
    """External resource linked to deliverable"""
    resource_id: str
    resource_type: str  # repo, api, documentation, demo, figma
    title: str
    url: str

class DeliverableCreate(BaseModel):
    title: str
    summary: str
    blocks: List[dict] = []
    resources: List[dict] = []
    version: str = "v1.0"

class Deliverable(BaseModel):
    model_config = ConfigDict(extra="ignore")
    deliverable_id: str
    project_id: str
    title: str
    summary: str
    blocks: List[dict] = []  # DeliverableBlock items
    resources: List[dict] = []  # DeliverableResource items
    version: str = "v1.0"
    status: str = "pending"  # pending, approved, rejected, revision_requested
    client_feedback: Optional[str] = None
    approved_at: Optional[datetime] = None
    created_at: datetime

# Support Ticket
class SupportTicketCreate(BaseModel):
    title: str
    description: str
    ticket_type: str  # bug, improvement, question

class SupportTicket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str
    project_id: str
    user_id: str
    title: str
    description: str
    ticket_type: str
    priority: str = "medium"
    status: str = "open"
    created_at: datetime

# Portfolio Case
class PortfolioCase(BaseModel):
    model_config = ConfigDict(extra="ignore")
    case_id: str
    title: str
    description: str
    client_name: str
    industry: str
    product_type: str
    technologies: List[str]
    results: str
    testimonial: Optional[str] = None
    image_url: Optional[str] = None
    featured: bool = False
    created_at: datetime


# ============ AUTH HELPERS ============

async def get_current_user(request: Request) -> User:
    """Get current user from session token in cookie or Authorization header"""
    session_token = request.cookies.get("session_token")
    if not session_token:
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            session_token = auth_header[7:]
    
    if not session_token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    
    session = await db.user_sessions.find_one({"session_token": session_token}, {"_id": 0})
    if not session:
        raise HTTPException(status_code=401, detail="Invalid session")
    
    expires_at = session["expires_at"]
    if isinstance(expires_at, str):
        expires_at = datetime.fromisoformat(expires_at)
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at < datetime.now(timezone.utc):
        raise HTTPException(status_code=401, detail="Session expired")
    
    user = await db.users.find_one({"user_id": session["user_id"]}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    if isinstance(user.get("created_at"), str):
        user["created_at"] = datetime.fromisoformat(user["created_at"])
    
    return User(**user)


def require_role(*roles):
    """Decorator to require specific roles"""
    async def role_checker(user: User = Depends(get_current_user)):
        if user.role not in roles:
            raise HTTPException(status_code=403, detail=f"Requires one of roles: {roles}")
        return user
    return role_checker


# ============ AUTH ENDPOINTS ============

@api_router.post("/auth/session")
async def create_session(request: Request, response: Response):
    """Exchange session_id for session_token"""
    body = await request.json()
    session_id = body.get("session_id")
    
    if not session_id:
        raise HTTPException(status_code=400, detail="session_id required")
    
    # Call Emergent Auth to get user data
    async with httpx.AsyncClient() as client_http:
        auth_response = await client_http.get(
            "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data",
            headers={"X-Session-ID": session_id}
        )
        
        if auth_response.status_code != 200:
            raise HTTPException(status_code=401, detail="Invalid session_id")
        
        auth_data = auth_response.json()
    
    email = auth_data["email"]
    name = auth_data.get("name", email.split("@")[0])
    picture = auth_data.get("picture")
    session_token = auth_data["session_token"]
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        user_id = existing_user["user_id"]
        # Update user info
        await db.users.update_one(
            {"user_id": user_id},
            {"$set": {"name": name, "picture": picture}}
        )
    else:
        # Create new user
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "picture": picture,
            "role": "client",
            "skills": [],
            "level": "junior",
            "rating": 5.0,
            "completed_tasks": 0,
            "active_load": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(user_doc)
    
    # Create session
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    # Set cookie
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return user


@api_router.get("/auth/me")
async def get_me(user: User = Depends(get_current_user)):
    """Get current user info"""
    return user


@api_router.post("/auth/logout")
async def logout(request: Request, response: Response):
    """Logout user"""
    session_token = request.cookies.get("session_token")
    if session_token:
        await db.user_sessions.delete_one({"session_token": session_token})
    
    response.delete_cookie(key="session_token", path="/")
    return {"message": "Logged out"}


# ============ FULL AUTH SYSTEM ============

class RegisterRequest(BaseModel):
    email: str
    password: str
    name: str
    role: str = "client"
    company: Optional[str] = None
    skills: List[str] = []
    specialization: Optional[str] = None


class LoginRequest(BaseModel):
    email: str
    password: str


class DemoRequest(BaseModel):
    role: str = "client"


import bcrypt

def hash_password(password: str) -> str:
    """Secure password hashing with bcrypt"""
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against bcrypt hash"""
    try:
        return bcrypt.checkpw(password.encode(), hashed.encode())
    except Exception:
        return False


@api_router.post("/auth/register")
async def register_user(req: RegisterRequest, response: Response):
    """Register new user with email/password"""
    email = req.email.strip().lower()
    
    # Check if user exists
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    # Validate role
    if req.role not in ["client", "developer", "tester"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    # Create user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "password_hash": hash_password(req.password),
        "name": req.name.strip(),
        "picture": None,
        "role": req.role,
        "company": req.company,
        "skills": req.skills,
        "specialization": req.specialization,
        "level": "junior",
        "rating": 5.0,
        "completed_tasks": 0,
        "active_load": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    # Return user without password
    user_doc.pop("_id", None)
    user_doc.pop("password_hash", None)
    return user_doc


@api_router.post("/auth/login")
async def login_user(req: LoginRequest, response: Response):
    """Login with email/password"""
    email = req.email.strip().lower()
    
    # Find user
    user = await db.users.find_one({"email": email}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Check password with bcrypt
    if user.get("password_hash"):
        if not verify_password(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    else:
        # Legacy user without password (OAuth only)
        raise HTTPException(status_code=401, detail="Invalid credentials")
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user["user_id"],
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user.pop("password_hash", None)
    return user


@api_router.post("/auth/demo")
async def demo_access(req: DemoRequest, response: Response):
    """Quick demo access - creates temporary demo user"""
    role = req.role if req.role in ["client", "developer", "tester", "admin"] else "client"
    
    # Create demo user
    demo_id = f"demo_{uuid.uuid4().hex[:8]}"
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    demo_names = {
        "client": "Demo Client",
        "developer": "Demo Developer",
        "tester": "Demo Tester",
        "admin": "Demo Admin"
    }
    
    user_doc = {
        "user_id": user_id,
        "email": f"{demo_id}@demo.devos.io",
        "name": demo_names.get(role, "Demo User"),
        "picture": None,
        "role": role,
        "is_demo": True,
        "skills": ["React", "Node.js", "TypeScript"] if role in ["developer", "tester"] else [],
        "level": "middle",
        "rating": 5.0,
        "completed_tasks": 0,
        "active_load": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=1)  # Demo sessions last 1 day
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=24 * 60 * 60
    )
    
    user_doc.pop("_id", None)
    return user_doc


@api_router.put("/auth/role")
async def update_user_role(
    user_id: str,
    role: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Update user role"""
    if role not in ["client", "developer", "tester", "admin", "provider"]:
        raise HTTPException(status_code=400, detail="Invalid role")
    
    result = await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"role": role}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {"message": "Role updated"}


@api_router.post("/auth/demo-provider")
async def demo_provider_login(response: Response):
    """Quick demo access for provider (marketplace)"""
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    user_doc = {
        "user_id": user_id,
        "email": f"demo_provider_{uuid.uuid4().hex[:8]}@demo.market.io",
        "name": "Demo Provider",
        "picture": None,
        "role": "provider",
        "is_demo": True,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create provider profile
    provider_doc = {
        "provider_id": f"prov_{uuid.uuid4().hex[:12]}",
        "user_id": user_id,
        "name": "Demo Provider",
        "phone": "+380501234567",
        "services": ["oil_change", "diagnostics", "tire_change"],
        "location": {"lat": 50.4501, "lng": 30.5234},  # Kyiv center
        "radius_km": 15.0,
        "status": "online",
        "quick_mode": False,
        "behavioral_score": 65,
        "tier": "Silver",
        "stats": {
            "today_requests": 5,
            "today_accepted": 3,
            "today_missed": 2,
            "lost_revenue": 1200,
            "avg_response_time": 25
        },
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.providers.insert_one(provider_doc)
    if "_id" in provider_doc:
        del provider_doc["_id"]
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=1)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=24 * 60 * 60
    )
    
    user_doc.pop("_id", None)
    
    # Create test service requests for inbox
    now = datetime.now(timezone.utc)
    test_requests = [
        {
            "request_id": f"sreq_{uuid.uuid4().hex[:12]}",
            "customer_id": "test_customer_1",
            "customer_name": "Іван Петренко",
            "customer_phone": "+380671234567",
            "service_type": "Заміна масла",
            "description": "Потрібна заміна масла та фільтрів",
            "location": {"lat": 50.4505, "lng": 30.5240, "address": "вул. Хрещатик, 22"},
            "urgency": "urgent",
            "estimated_price": 1500,
            "status": "distributed",
            "selected_provider_id": None,
            "distributed_to": [user_id],
            "expires_at": (now + timedelta(seconds=25)).isoformat(),
            "created_at": now.isoformat()
        },
        {
            "request_id": f"sreq_{uuid.uuid4().hex[:12]}",
            "customer_id": "test_customer_2",
            "customer_name": "Марія Коваленко",
            "customer_phone": "+380677654321",
            "service_type": "Діагностика двигуна",
            "description": "Горить check engine, потрібна перевірка",
            "location": {"lat": 50.4520, "lng": 30.5200, "address": "пр. Перемоги, 15"},
            "urgency": "normal",
            "estimated_price": 800,
            "status": "distributed",
            "selected_provider_id": None,
            "distributed_to": [user_id],
            "expires_at": (now + timedelta(seconds=20)).isoformat(),
            "created_at": now.isoformat()
        },
        {
            "request_id": f"sreq_{uuid.uuid4().hex[:12]}",
            "customer_id": "test_customer_3",
            "customer_name": "Олег Сидоренко",
            "customer_phone": "+380509876543",
            "service_type": "Заміна акумулятора",
            "description": "Машина не заводиться, потрібен виїзд",
            "location": {"lat": 50.4480, "lng": 30.5280, "address": "вул. Саксаганського, 100"},
            "urgency": "emergency",
            "estimated_price": 2500,
            "status": "distributed",
            "selected_provider_id": None,
            "distributed_to": [user_id],
            "expires_at": (now + timedelta(seconds=18)).isoformat(),
            "created_at": now.isoformat()
        }
    ]
    await db.service_requests.insert_many(test_requests)
    
    return {**user_doc, "provider": provider_doc}


# Quick Auth Models
class QuickAuthRequest(BaseModel):
    email: str
    role: str = "client"
    skill: Optional[str] = None

class OnboardingRequest(BaseModel):
    email: str
    name: str
    role: str = "client"
    company: Optional[str] = None
    skills: List[str] = []


@api_router.post("/auth/quick")
async def quick_auth(req: QuickAuthRequest, response: Response):
    """Quick auth - check if user exists or create pending user"""
    email = req.email.strip().lower()
    
    # Check if user exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    
    if existing_user:
        # User exists - create session and return
        user_id = existing_user["user_id"]
        session_token = f"sess_{uuid.uuid4().hex}"
        expires_at = datetime.now(timezone.utc) + timedelta(days=7)
        
        session_doc = {
            "session_id": str(uuid.uuid4()),
            "user_id": user_id,
            "session_token": session_token,
            "expires_at": expires_at.isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.user_sessions.insert_one(session_doc)
        
        response.set_cookie(
            key="session_token",
            value=session_token,
            httponly=True,
            secure=True,
            samesite="none",
            path="/",
            max_age=7 * 24 * 60 * 60
        )
        
        if isinstance(existing_user.get("created_at"), str):
            existing_user["created_at"] = datetime.fromisoformat(existing_user["created_at"])
        
        return {"isNew": False, "user": existing_user}
    
    # New user - store email temporarily, needs onboarding
    return {"isNew": True, "email": email}


@api_router.post("/auth/onboarding")
async def complete_onboarding(req: OnboardingRequest, response: Response):
    """Complete user onboarding"""
    email = req.email.strip().lower()
    
    # Check if user already exists
    existing_user = await db.users.find_one({"email": email}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")
    
    # Create new user
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": req.name.strip(),
        "picture": None,
        "role": req.role,
        "company": req.company,
        "skills": req.skills,
        "level": "junior",
        "rating": 5.0,
        "completed_tasks": 0,
        "active_load": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.users.insert_one(user_doc)
    
    # Create session
    session_token = f"sess_{uuid.uuid4().hex}"
    expires_at = datetime.now(timezone.utc) + timedelta(days=7)
    
    session_doc = {
        "session_id": str(uuid.uuid4()),
        "user_id": user_id,
        "session_token": session_token,
        "expires_at": expires_at.isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.user_sessions.insert_one(session_doc)
    
    response.set_cookie(
        key="session_token",
        value=session_token,
        httponly=True,
        secure=True,
        samesite="none",
        path="/",
        max_age=7 * 24 * 60 * 60
    )
    
    user_doc.pop("_id", None)
    user_doc["created_at"] = datetime.fromisoformat(user_doc["created_at"])
    return user_doc


# ============ PUBLIC ENDPOINTS ============

@api_router.get("/")
async def root():
    return {"message": "Development OS API", "version": "1.0.0"}


@api_router.get("/portfolio/cases", response_model=List[PortfolioCase])
async def get_portfolio_cases():
    """Public: Get all portfolio cases"""
    cases = await db.portfolio_cases.find({}, {"_id": 0}).to_list(100)
    for case in cases:
        if isinstance(case.get("created_at"), str):
            case["created_at"] = datetime.fromisoformat(case["created_at"])
    return cases


@api_router.get("/portfolio/featured", response_model=List[PortfolioCase])
async def get_featured_cases():
    """Public: Get featured portfolio cases"""
    cases = await db.portfolio_cases.find({"featured": True}, {"_id": 0}).to_list(10)
    for case in cases:
        if isinstance(case.get("created_at"), str):
            case["created_at"] = datetime.fromisoformat(case["created_at"])
    return cases


@api_router.get("/stats")
async def get_platform_stats():
    """Public: Get platform statistics"""
    projects_count = await db.projects.count_documents({})
    clients_count = await db.users.count_documents({"role": "client"})
    developers_count = await db.users.count_documents({"role": "developer"})
    completed_projects = await db.projects.count_documents({"status": "completed"})
    
    return {
        "total_projects": projects_count,
        "total_clients": clients_count,
        "total_developers": developers_count,
        "completed_projects": completed_projects,
        "satisfaction_rate": 98.5,
        "avg_delivery_time": "4 weeks"
    }


# ============ CLIENT ENDPOINTS ============

@api_router.post("/requests", response_model=RequestModel)
async def create_request(
    req: RequestCreate,
    user: User = Depends(get_current_user)
):
    """Client: Create a new project request"""
    request_doc = {
        "request_id": f"req_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "title": req.title,
        "description": req.description,
        "business_idea": req.business_idea,
        "target_audience": req.target_audience,
        "budget_range": req.budget_range,
        "timeline": req.timeline,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.requests.insert_one(request_doc)
    request_doc.pop("_id", None)
    request_doc["created_at"] = datetime.fromisoformat(request_doc["created_at"])
    return RequestModel(**request_doc)


@api_router.get("/requests", response_model=List[RequestModel])
async def get_my_requests(user: User = Depends(get_current_user)):
    """Client: Get my requests"""
    query = {"user_id": user.user_id} if user.role == "client" else {}
    requests = await db.requests.find(query, {"_id": 0}).to_list(100)
    for req in requests:
        if isinstance(req.get("created_at"), str):
            req["created_at"] = datetime.fromisoformat(req["created_at"])
    return requests


@api_router.get("/projects/mine", response_model=List[Project])
async def get_my_projects(user: User = Depends(get_current_user)):
    """Client: Get my projects"""
    projects = await db.projects.find({"client_id": user.user_id}, {"_id": 0}).to_list(100)
    for proj in projects:
        if isinstance(proj.get("created_at"), str):
            proj["created_at"] = datetime.fromisoformat(proj["created_at"])
    return projects


@api_router.get("/projects/{project_id}", response_model=Project)
async def get_project(project_id: str, user: User = Depends(get_current_user)):
    """Get project details"""
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    
    # Ownership check: client can only see own projects
    if user.role == "client" and project.get("client_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    if isinstance(project.get("created_at"), str):
        project["created_at"] = datetime.fromisoformat(project["created_at"])
    return Project(**project)


@api_router.get("/projects/{project_id}/deliverables", response_model=List[Deliverable])
async def get_project_deliverables(project_id: str, user: User = Depends(get_current_user)):
    """Client: Get project deliverables"""
    # Ownership check
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role == "client" and project.get("client_id") != user.user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    deliverables = await db.deliverables.find({"project_id": project_id}, {"_id": 0}).to_list(100)
    for d in deliverables:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return deliverables


async def verify_deliverable_ownership(deliverable_id: str, user: User) -> dict:
    """Helper to verify client owns the deliverable"""
    deliverable = await db.deliverables.find_one({"deliverable_id": deliverable_id}, {"_id": 0})
    if not deliverable:
        raise HTTPException(status_code=404, detail="Deliverable not found")
    
    # Admin can access all
    if user.role == "admin":
        return deliverable
    
    # Client must own the project
    project = await db.projects.find_one({"project_id": deliverable["project_id"]}, {"_id": 0})
    if not project or (user.role == "client" and project.get("client_id") != user.user_id):
        raise HTTPException(status_code=403, detail="Access denied")
    
    return deliverable


@api_router.post("/deliverables/{deliverable_id}/approve")
async def approve_deliverable(
    deliverable_id: str,
    feedback: Optional[str] = None,
    user: User = Depends(get_current_user)
):
    """Client: Approve deliverable"""
    # Ownership check
    deliverable = await verify_deliverable_ownership(deliverable_id, user)
    
    result = await db.deliverables.update_one(
        {"deliverable_id": deliverable_id},
        {"$set": {
            "status": "approved", 
            "client_feedback": feedback,
            "approved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Update project progress
    await db.projects.update_one(
        {"project_id": deliverable["project_id"]},
        {"$inc": {"progress": 25}}
    )
    
    logger.info(f"DELIVERABLE APPROVED: {deliverable_id} by {user.user_id}")
    return {"message": "Deliverable approved", "deliverable_id": deliverable_id}


@api_router.post("/deliverables/{deliverable_id}/reject")
async def reject_deliverable(
    deliverable_id: str,
    feedback: str,
    user: User = Depends(get_current_user)
):
    """Client: Reject deliverable and create support ticket"""
    # Ownership check
    deliverable = await verify_deliverable_ownership(deliverable_id, user)
    
    result = await db.deliverables.update_one(
        {"deliverable_id": deliverable_id},
        {"$set": {"status": "revision_requested", "client_feedback": feedback}}
    )
    
    # Create support ticket for revision
    ticket_doc = {
        "ticket_id": f"tkt_{uuid.uuid4().hex[:12]}",
        "project_id": deliverable["project_id"],
        "user_id": user.user_id,
        "title": f"Revision requested for {deliverable['title']}",
        "description": feedback,
        "ticket_type": "revision",
        "priority": "high",
        "status": "open",
        "deliverable_id": deliverable_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.insert_one(ticket_doc)
    
    logger.info(f"DELIVERABLE REJECTED: {deliverable_id} by {user.user_id}, ticket created")
    return {"message": "Revision requested", "ticket_id": ticket_doc["ticket_id"]}


@api_router.get("/deliverables/{deliverable_id}")
async def get_deliverable(
    deliverable_id: str,
    user: User = Depends(get_current_user)
):
    """Get single deliverable with full details"""
    # Ownership check
    deliverable = await verify_deliverable_ownership(deliverable_id, user)
    
    if isinstance(deliverable.get("created_at"), str):
        deliverable["created_at"] = datetime.fromisoformat(deliverable["created_at"])
    if isinstance(deliverable.get("approved_at"), str):
        deliverable["approved_at"] = datetime.fromisoformat(deliverable["approved_at"])
    
    return deliverable


@api_router.post("/projects/{project_id}/support", response_model=SupportTicket)
async def create_support_ticket(
    project_id: str,
    ticket: SupportTicketCreate,
    user: User = Depends(get_current_user)
):
    """Client: Create support ticket"""
    ticket_doc = {
        "ticket_id": f"tkt_{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "user_id": user.user_id,
        "title": ticket.title,
        "description": ticket.description,
        "ticket_type": ticket.ticket_type,
        "priority": "medium",
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.insert_one(ticket_doc)
    ticket_doc.pop("_id", None)
    ticket_doc["created_at"] = datetime.fromisoformat(ticket_doc["created_at"])
    return SupportTicket(**ticket_doc)


# ============ DEVELOPER ENDPOINTS ============

@api_router.get("/developer/assignments", response_model=List[Assignment])
async def get_my_assignments(user: User = Depends(require_role("developer", "admin"))):
    """Developer: Get my assignments"""
    assignments = await db.assignments.find(
        {"developer_id": user.user_id, "status": "active"},
        {"_id": 0}
    ).to_list(100)
    for a in assignments:
        if isinstance(a.get("created_at"), str):
            a["created_at"] = datetime.fromisoformat(a["created_at"])
    return assignments


@api_router.get("/developer/work-units", response_model=List[WorkUnit])
async def get_my_work_units(user: User = Depends(require_role("developer", "admin"))):
    """Developer: Get my work units"""
    units = await db.work_units.find(
        {"assigned_to": user.user_id},
        {"_id": 0}
    ).to_list(100)
    for u in units:
        if isinstance(u.get("created_at"), str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return units


@api_router.get("/developer/work-logs/{unit_id}")
async def get_work_logs_for_unit(
    unit_id: str,
    user: User = Depends(require_role("developer", "admin"))
):
    """Developer: Get work logs for a unit"""
    logs = await db.work_logs.find(
        {"unit_id": unit_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for log in logs:
        if isinstance(log.get("created_at"), str):
            log["created_at"] = datetime.fromisoformat(log["created_at"])
    return logs


@api_router.post("/developer/work-units/{unit_id}/start")
async def start_work(
    unit_id: str,
    user: User = Depends(require_role("developer", "admin"))
):
    """Developer: Start working on a unit"""
    result = await db.work_units.update_one(
        {"unit_id": unit_id, "assigned_to": user.user_id, "status": "assigned"},
        {"$set": {"status": "in_progress"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=400, detail="Cannot start work on this unit")
    return {"message": "Work started"}



class StatusUpdate(BaseModel):
    status: str


@api_router.patch("/work-units/{unit_id}/status")
async def update_work_unit_status(
    unit_id: str,
    update: StatusUpdate,
    user: User = Depends(require_role("developer", "admin"))
):
    """Developer: Update work unit status (with allowed transitions)"""
    work_unit = await db.work_units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not work_unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    # Guard: must be assigned to this developer
    if work_unit.get("assigned_to") != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Work unit not assigned to you")
    
    current_status = work_unit.get("status")
    new_status = update.status
    
    # Allowed transitions for executor
    allowed_transitions = {
        "assigned": ["in_progress"],
        "in_progress": ["submitted"],  # Note: submit should go through /submit endpoint
        "revision": ["in_progress"],
    }
    
    allowed = allowed_transitions.get(current_status, [])
    if new_status not in allowed:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot transition from '{current_status}' to '{new_status}'. Allowed: {allowed}"
        )
    
    await db.work_units.update_one(
        {"unit_id": unit_id},
        {"$set": {"status": new_status}}
    )
    
    logger.info(f"STATUS UPDATE: unit_id={unit_id}, {current_status} -> {new_status}, by {user.user_id}")
    return {"message": "Status updated", "new_status": new_status}



@api_router.post("/work-units/{unit_id}/log", response_model=WorkLog)
async def create_work_log(
    unit_id: str,
    log: WorkLogCreate,
    user: User = Depends(require_role("developer", "admin"))
):
    """Developer: Log work hours"""
    log_doc = {
        "log_id": f"log_{uuid.uuid4().hex[:12]}",
        "unit_id": unit_id,
        "developer_id": user.user_id,
        "hours": log.hours,
        "description": log.description,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.work_logs.insert_one(log_doc)
    
    # Update work unit hours
    await db.work_units.update_one(
        {"unit_id": unit_id},
        {"$inc": {"actual_hours": log.hours}}
    )
    
    log_doc.pop("_id", None)
    log_doc["created_at"] = datetime.fromisoformat(log_doc["created_at"])
    return WorkLog(**log_doc)


@api_router.get("/work-units/{unit_id}/logs")
async def get_work_logs(
    unit_id: str,
    user: User = Depends(get_current_user)
):
    """Get work logs for a unit"""
    logs = await db.work_logs.find(
        {"unit_id": unit_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    for log in logs:
        if isinstance(log.get("created_at"), str):
            log["created_at"] = datetime.fromisoformat(log["created_at"])
    return logs


@api_router.get("/work-units/{unit_id}/submissions")
async def get_unit_submissions(
    unit_id: str,
    user: User = Depends(get_current_user)
):
    """Get submissions for a unit"""
    submissions = await db.submissions.find(
        {"unit_id": unit_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    for sub in submissions:
        if isinstance(sub.get("created_at"), str):
            sub["created_at"] = datetime.fromisoformat(sub["created_at"])
        # Get review feedback if exists
        review = await db.reviews.find_one({"submission_id": sub["submission_id"]}, {"_id": 0})
        if review:
            sub["feedback"] = review.get("feedback")
    return submissions


@api_router.post("/work-units/{unit_id}/submit", response_model=Submission)
async def submit_work(
    unit_id: str,
    submission: SubmissionCreate,
    user: User = Depends(require_role("developer", "admin"))
):
    """Developer: Submit work for review"""
    # Get work unit and verify status
    work_unit = await db.work_units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not work_unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    # Guard: can only submit from in_progress or revision
    allowed_statuses = ["in_progress", "revision"]
    if work_unit.get("status") not in allowed_statuses:
        raise HTTPException(
            status_code=400, 
            detail=f"Cannot submit work in status '{work_unit.get('status')}'. Must be: {allowed_statuses}"
        )
    
    # Guard: must be assigned to this developer
    if work_unit.get("assigned_to") != user.user_id and user.role != "admin":
        raise HTTPException(status_code=403, detail="Work unit not assigned to you")
    
    logger.info(f"SUBMIT: unit_id={unit_id}, status_before={work_unit.get('status')}, dev={user.user_id}")
    
    submission_doc = {
        "submission_id": f"sub_{uuid.uuid4().hex[:12]}",
        "unit_id": unit_id,
        "developer_id": user.user_id,
        "summary": submission.summary,
        "links": submission.links,
        "attachments": submission.attachments,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.submissions.insert_one(submission_doc)
    
    # Update work unit status
    await db.work_units.update_one(
        {"unit_id": unit_id},
        {"$set": {"status": "submitted"}}
    )
    
    logger.info(f"SUBMIT COMPLETE: unit_id={unit_id}, status_after=submitted, submission_id={submission_doc['submission_id']}")
    
    # 🔴 REAL-TIME: Notify admin of new submission
    await realtime.emit_to_role('admin', 'submission.created', {
        'submission_id': submission_doc['submission_id'],
        'unit_id': unit_id,
        'title': work_unit.get('title'),
        'developer_id': user.user_id,
        'project_id': work_unit.get('project_id')
    })
    
    submission_doc.pop("_id", None)
    submission_doc["created_at"] = datetime.fromisoformat(submission_doc["created_at"])
    return Submission(**submission_doc)


# ============ TESTER ENDPOINTS ============

@api_router.get("/tester/validation-tasks", response_model=List[ValidationTask])
async def get_my_validation_tasks(user: User = Depends(require_role("tester", "admin"))):
    """Tester: Get validation tasks (assigned to me OR unassigned pending)"""
    # Show tasks assigned to this tester OR unassigned pending tasks
    tasks = await db.validation_tasks.find(
        {"$or": [
            {"tester_id": user.user_id},
            {"tester_id": None, "status": "pending"}
        ]},
        {"_id": 0}
    ).to_list(100)
    for t in tasks:
        if isinstance(t.get("created_at"), str):
            t["created_at"] = datetime.fromisoformat(t["created_at"])
    return tasks


@api_router.get("/tester/issues")
async def get_tester_issues(user: User = Depends(require_role("tester", "admin"))):
    """Tester: Get all issues created by this tester"""
    issues = await db.validation_issues.find(
        {"created_by": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    return issues


@api_router.get("/validation/{validation_id}/issues")
async def get_validation_issues(
    validation_id: str,
    user: User = Depends(get_current_user)
):
    """Get issues for a validation"""
    issues = await db.validation_issues.find(
        {"validation_id": validation_id},
        {"_id": 0}
    ).to_list(100)
    return issues


@api_router.post("/validation/{validation_id}/pass")
async def pass_validation(
    validation_id: str,
    user: User = Depends(require_role("tester", "admin"))
):
    """Tester: Pass validation"""
    # Get validation task
    validation = await db.validation_tasks.find_one({"validation_id": validation_id}, {"_id": 0})
    if not validation:
        raise HTTPException(status_code=404, detail="Validation task not found")
    
    # Guard: only pending or in_progress can be passed
    if validation.get("status") not in ["pending", "in_progress"]:
        raise HTTPException(status_code=400, detail=f"Cannot pass validation in status: {validation.get('status')}")
    
    # Update validation status and assign tester
    await db.validation_tasks.update_one(
        {"validation_id": validation_id},
        {"$set": {"status": "passed", "tester_id": user.user_id}}
    )
    
    # Update work unit to completed
    await db.work_units.update_one(
        {"unit_id": validation.get("unit_id")},
        {"$set": {"status": "completed"}}
    )
    
    logger.info(f"VALIDATION PASS: validation_id={validation_id}, unit_id={validation.get('unit_id')}, tester={user.user_id}")
    return {"message": "Validation passed"}


@api_router.post("/validation/{validation_id}/fail")
async def fail_validation(
    validation_id: str,
    user: User = Depends(require_role("tester", "admin"))
):
    """Tester: Fail validation"""
    # Get validation task
    validation = await db.validation_tasks.find_one({"validation_id": validation_id}, {"_id": 0})
    if not validation:
        raise HTTPException(status_code=404, detail="Validation task not found")
    
    # Guard: only pending or in_progress can be failed
    if validation.get("status") not in ["pending", "in_progress"]:
        raise HTTPException(status_code=400, detail=f"Cannot fail validation in status: {validation.get('status')}")
    
    # Update validation status and assign tester
    await db.validation_tasks.update_one(
        {"validation_id": validation_id},
        {"$set": {"status": "failed", "tester_id": user.user_id}}
    )
    
    # Update work unit back to revision (dev needs to resubmit)
    await db.work_units.update_one(
        {"unit_id": validation.get("unit_id")},
        {"$set": {"status": "revision"}}
    )
    
    logger.info(f"VALIDATION FAIL: validation_id={validation_id}, unit_id={validation.get('unit_id')}, tester={user.user_id}")
    return {"message": "Validation failed"}


class IssueCreate(BaseModel):
    title: str
    description: str = ""
    severity: str = "medium"


@api_router.post("/validation/{validation_id}/issue", response_model=ValidationIssue)
async def create_validation_issue(
    validation_id: str,
    issue: IssueCreate,
    user: User = Depends(require_role("tester", "admin"))
):
    """Tester: Create validation issue"""
    issue_doc = {
        "issue_id": f"iss_{uuid.uuid4().hex[:12]}",
        "validation_id": validation_id,
        "title": issue.title,
        "description": issue.description,
        "severity": issue.severity,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.validation_issues.insert_one(issue_doc)
    issue_doc.pop("_id", None)
    issue_doc["created_at"] = datetime.fromisoformat(issue_doc["created_at"])
    return ValidationIssue(**issue_doc)


@api_router.get("/tester/validation/{validation_id}/details")
async def get_validation_details(
    validation_id: str,
    user: User = Depends(require_role("tester", "admin"))
):
    """Tester: Get validation details including work unit and submission"""
    validation = await db.validation_tasks.find_one({"validation_id": validation_id}, {"_id": 0})
    if not validation:
        raise HTTPException(status_code=404, detail="Validation not found")
    
    work_unit = await db.work_units.find_one({"unit_id": validation.get("unit_id")}, {"_id": 0})
    submission = await db.submissions.find_one({"unit_id": validation.get("unit_id")}, {"_id": 0})
    
    return {
        "validation": validation,
        "work_unit": work_unit,
        "submission": submission
    }


@api_router.get("/tester/validation/{validation_id}/issues")
async def get_validation_issues(
    validation_id: str,
    user: User = Depends(require_role("tester", "admin"))
):
    """Tester: Get issues for a validation"""
    issues = await db.validation_issues.find(
        {"validation_id": validation_id},
        {"_id": 0}
    ).to_list(100)
    return issues


# ============ ADMIN ENDPOINTS ============

@api_router.get("/admin/users", response_model=List[User])
async def get_all_users(admin: User = Depends(require_role("admin"))):
    """Admin: Get all users"""
    users = await db.users.find({}, {"_id": 0}).to_list(1000)
    for u in users:
        if isinstance(u.get("created_at"), str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return users


@api_router.get("/admin/developers", response_model=List[User])
async def get_developers(admin: User = Depends(require_role("admin"))):
    """Admin: Get all developers"""
    developers = await db.users.find({"role": "developer"}, {"_id": 0}).to_list(100)
    for d in developers:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
    return developers


@api_router.get("/admin/testers", response_model=List[User])
async def get_testers(admin: User = Depends(require_role("admin"))):
    """Admin: Get all testers"""
    testers = await db.users.find({"role": "tester"}, {"_id": 0}).to_list(100)
    for t in testers:
        if isinstance(t.get("created_at"), str):
            t["created_at"] = datetime.fromisoformat(t["created_at"])
    return testers


@api_router.get("/admin/requests", response_model=List[RequestModel])
async def get_all_requests(admin: User = Depends(require_role("admin"))):
    """Admin: Get all requests"""
    requests = await db.requests.find({}, {"_id": 0}).to_list(1000)
    for req in requests:
        if isinstance(req.get("created_at"), str):
            req["created_at"] = datetime.fromisoformat(req["created_at"])
    return requests


@api_router.post("/admin/requests/{request_id}/approve")
async def approve_request(request_id: str, admin: User = Depends(require_role("admin"))):
    """Admin: Approve request"""
    result = await db.requests.update_one(
        {"request_id": request_id},
        {"$set": {"status": "approved"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Request not found")
    return {"message": "Request approved"}


@api_router.post("/admin/product-definition", response_model=ProductDefinition)
async def create_product_definition(
    request_id: str,
    product_type: str,
    goal: str,
    target_audience: str,
    key_features: List[str],
    constraints: List[str],
    estimated_timeline: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Create product definition from request"""
    product_doc = {
        "product_id": f"prod_{uuid.uuid4().hex[:12]}",
        "request_id": request_id,
        "product_type": product_type,
        "goal": goal,
        "target_audience": target_audience,
        "key_features": key_features,
        "constraints": constraints,
        "estimated_timeline": estimated_timeline,
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.product_definitions.insert_one(product_doc)
    product_doc.pop("_id", None)
    product_doc["created_at"] = datetime.fromisoformat(product_doc["created_at"])
    return ProductDefinition(**product_doc)


@api_router.post("/admin/scope", response_model=Scope)
async def create_scope(
    product_id: str,
    total_hours: int,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Create scope for product"""
    scope_doc = {
        "scope_id": f"scope_{uuid.uuid4().hex[:12]}",
        "product_id": product_id,
        "total_hours": total_hours,
        "items": [],
        "status": "draft",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.scopes.insert_one(scope_doc)
    scope_doc.pop("_id", None)
    scope_doc["created_at"] = datetime.fromisoformat(scope_doc["created_at"])
    return Scope(**scope_doc)


@api_router.post("/admin/scope/{scope_id}/item", response_model=ScopeItem)
async def add_scope_item(
    scope_id: str,
    title: str,
    description: str,
    item_type: str,
    priority: str,
    estimated_hours: int,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Add scope item"""
    item = {
        "item_id": f"item_{uuid.uuid4().hex[:12]}",
        "scope_id": scope_id,
        "title": title,
        "description": description,
        "item_type": item_type,
        "priority": priority,
        "estimated_hours": estimated_hours,
        "status": "pending"
    }
    await db.scope_items.insert_one(item)
    item.pop("_id", None)
    return ScopeItem(**item)


@api_router.post("/admin/project", response_model=Project)
async def create_project(
    scope_id: str,
    client_id: str,
    name: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Create project from scope"""
    project_doc = {
        "project_id": f"proj_{uuid.uuid4().hex[:12]}",
        "scope_id": scope_id,
        "client_id": client_id,
        "name": name,
        "current_stage": "discovery",
        "progress": 0,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.projects.insert_one(project_doc)
    project_doc.pop("_id", None)
    project_doc["created_at"] = datetime.fromisoformat(project_doc["created_at"])
    return Project(**project_doc)


@api_router.get("/admin/projects", response_model=List[Project])
async def get_all_projects(admin: User = Depends(require_role("admin"))):
    """Admin: Get all projects"""
    projects = await db.projects.find({}, {"_id": 0}).to_list(1000)
    for proj in projects:
        if isinstance(proj.get("created_at"), str):
            proj["created_at"] = datetime.fromisoformat(proj["created_at"])
    return projects


@api_router.post("/admin/work-unit", response_model=WorkUnit)
async def create_work_unit(
    project_id: str,
    scope_item_id: str,
    title: str,
    description: str,
    unit_type: str,
    estimated_hours: int,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Create work unit"""
    unit_doc = {
        "unit_id": f"unit_{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "scope_item_id": scope_item_id,
        "title": title,
        "description": description,
        "unit_type": unit_type,
        "estimated_hours": estimated_hours,
        "actual_hours": 0,
        "assigned_to": None,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.work_units.insert_one(unit_doc)
    unit_doc.pop("_id", None)
    unit_doc["created_at"] = datetime.fromisoformat(unit_doc["created_at"])
    return WorkUnit(**unit_doc)


@api_router.get("/admin/work-units", response_model=List[WorkUnit])
async def get_all_work_units(admin: User = Depends(require_role("admin"))):
    """Admin: Get all work units"""
    units = await db.work_units.find({}, {"_id": 0}).to_list(1000)
    for u in units:
        if isinstance(u.get("created_at"), str):
            u["created_at"] = datetime.fromisoformat(u["created_at"])
    return units


@api_router.post("/admin/assign", response_model=Assignment)
async def assign_work_unit(
    unit_id: str,
    developer_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Assign work unit to developer"""
    # Get work unit details for notification
    work_unit = await db.work_units.find_one({"unit_id": unit_id}, {"_id": 0})
    
    assignment_doc = {
        "assignment_id": f"asgn_{uuid.uuid4().hex[:12]}",
        "unit_id": unit_id,
        "developer_id": developer_id,
        "assigned_by": admin.user_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assignments.insert_one(assignment_doc)
    
    # Update work unit
    await db.work_units.update_one(
        {"unit_id": unit_id},
        {"$set": {"assigned_to": developer_id, "status": "assigned"}}
    )
    
    # Update developer load
    await db.users.update_one(
        {"user_id": developer_id},
        {"$inc": {"active_load": 1}}
    )
    
    # 🔴 REAL-TIME: Notify developer of new assignment
    await realtime.emit_to_user(developer_id, 'workunit.assigned', {
        'unit_id': unit_id,
        'title': work_unit.get('title') if work_unit else 'New Task',
        'assigned_by': admin.user_id
    })
    
    assignment_doc.pop("_id", None)
    assignment_doc["created_at"] = datetime.fromisoformat(assignment_doc["created_at"])
    return Assignment(**assignment_doc)


@api_router.get("/admin/submissions", response_model=List[Submission])
async def get_pending_submissions(admin: User = Depends(require_role("admin"))):
    """Admin: Get pending submissions for review"""
    submissions = await db.submissions.find({"status": "pending"}, {"_id": 0}).to_list(100)
    for s in submissions:
        if isinstance(s.get("created_at"), str):
            s["created_at"] = datetime.fromisoformat(s["created_at"])
    return submissions


@api_router.post("/admin/review", response_model=Review)
async def create_review(
    review: ReviewCreate,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Review submission"""
    review_doc = {
        "review_id": f"rev_{uuid.uuid4().hex[:12]}",
        "submission_id": review.submission_id,
        "reviewer_id": admin.user_id,
        "result": review.result,
        "feedback": review.feedback,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reviews.insert_one(review_doc)
    
    # Get submission
    submission = await db.submissions.find_one({"submission_id": review.submission_id}, {"_id": 0})
    
    # Update submission status
    await db.submissions.update_one(
        {"submission_id": review.submission_id},
        {"$set": {"status": review.result}}
    )
    
    if submission:
        # Get work unit for notification
        work_unit = await db.work_units.find_one({"unit_id": submission["unit_id"]}, {"_id": 0})
        developer_id = submission.get("developer_id")
        
        # If approved, create validation task
        if review.result == "approved":
            validation_doc = {
                "validation_id": f"val_{uuid.uuid4().hex[:12]}",
                "unit_id": submission["unit_id"],
                "tester_id": None,
                "status": "pending",
                "issues": [],
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.validation_tasks.insert_one(validation_doc)
            
            # Update work unit status to validation
            await db.work_units.update_one(
                {"unit_id": submission["unit_id"]},
                {"$set": {"status": "validation"}}
            )
            
            # 🔴 REAL-TIME: Notify tester of new validation task
            await realtime.emit_to_role('tester', 'validation.created', {
                'validation_id': validation_doc['validation_id'],
                'unit_id': submission["unit_id"],
                'title': work_unit.get('title') if work_unit else 'Task'
            })
            
            # 🔴 REAL-TIME: Notify developer submission approved
            if developer_id:
                await realtime.emit_to_user(developer_id, 'submission.reviewed', {
                    'unit_id': submission["unit_id"],
                    'result': 'approved',
                    'feedback': review.feedback
                })
        
        # If revision needed, update work unit back to revision
        elif review.result == "revision_needed":
            await db.work_units.update_one(
                {"unit_id": submission["unit_id"]},
                {"$set": {"status": "revision"}}
            )
            
            # 🔴 REAL-TIME: Notify developer revision required
            if developer_id:
                await realtime.emit_to_user(developer_id, 'workunit.revision_requested', {
                    'unit_id': submission["unit_id"],
                    'title': work_unit.get('title') if work_unit else 'Task',
                    'feedback': review.feedback
                })
    
    review_doc.pop("_id", None)
    review_doc["created_at"] = datetime.fromisoformat(review_doc["created_at"])
    return Review(**review_doc)


@api_router.post("/admin/validation/{validation_id}/assign")
async def assign_validation(
    validation_id: str,
    tester_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Assign validation task to tester"""
    result = await db.validation_tasks.update_one(
        {"validation_id": validation_id},
        {"$set": {"tester_id": tester_id, "status": "in_progress"}}
    )
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Validation task not found")
    return {"message": "Validation assigned"}


@api_router.post("/admin/deliverable", response_model=Deliverable)
async def create_deliverable(
    data: DeliverableCreate,
    project_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Create Deliverable 2.0 with blocks and resources"""
    # Get project to find client
    project = await db.projects.find_one({"project_id": project_id}, {"_id": 0})
    
    # Generate block IDs
    blocks_with_ids = []
    for block in data.blocks:
        blocks_with_ids.append({
            "block_id": f"blk_{uuid.uuid4().hex[:8]}",
            "block_type": block.get("block_type", "feature"),
            "title": block.get("title", ""),
            "description": block.get("description", ""),
            "preview_url": block.get("preview_url"),
            "api_url": block.get("api_url"),
            "work_unit_ids": block.get("work_unit_ids", []),
            "status": "completed"
        })
    
    # Generate resource IDs
    resources_with_ids = []
    for res in data.resources:
        resources_with_ids.append({
            "resource_id": f"res_{uuid.uuid4().hex[:8]}",
            "resource_type": res.get("resource_type", "repo"),
            "title": res.get("title", ""),
            "url": res.get("url", "")
        })
    
    deliverable_doc = {
        "deliverable_id": f"dlv_{uuid.uuid4().hex[:12]}",
        "project_id": project_id,
        "title": data.title,
        "summary": data.summary,
        "blocks": blocks_with_ids,
        "resources": resources_with_ids,
        "version": data.version,
        "status": "pending",
        "client_feedback": None,
        "approved_at": None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.deliverables.insert_one(deliverable_doc)
    
    # Update project progress
    await db.projects.update_one(
        {"project_id": project_id},
        {"$set": {"current_stage": "delivery"}}
    )
    
    logger.info(f"DELIVERABLE CREATED: {deliverable_doc['deliverable_id']} for project {project_id}, version {data.version}")
    
    # 🔴 REAL-TIME: Notify client of new deliverable
    if project and project.get('client_id'):
        await realtime.emit_to_user(project['client_id'], 'deliverable.created', {
            'deliverable_id': deliverable_doc['deliverable_id'],
            'project_id': project_id,
            'title': data.title,
            'version': data.version
        })
    
    deliverable_doc.pop("_id", None)
    deliverable_doc["created_at"] = datetime.fromisoformat(deliverable_doc["created_at"])
    return Deliverable(**deliverable_doc)


@api_router.get("/admin/projects/{project_id}/completed-units")
async def get_completed_work_units(
    project_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Get completed work units for deliverable builder"""
    units = await db.work_units.find(
        {"project_id": project_id, "status": "completed"},
        {"_id": 0}
    ).to_list(100)
    return units


@api_router.get("/projects/{project_id}/versions")
async def get_project_versions(
    project_id: str,
    user: User = Depends(get_current_user)
):
    """Get all deliverable versions for a project"""
    deliverables = await db.deliverables.find(
        {"project_id": project_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    versions = []
    for d in deliverables:
        if isinstance(d.get("created_at"), str):
            d["created_at"] = datetime.fromisoformat(d["created_at"])
        versions.append({
            "deliverable_id": d["deliverable_id"],
            "version": d.get("version", "v1.0"),
            "title": d["title"],
            "status": d["status"],
            "created_at": d["created_at"],
            "blocks_count": len(d.get("blocks", []))
        })
    return versions


@api_router.get("/admin/support-tickets", response_model=List[SupportTicket])
async def get_all_support_tickets(admin: User = Depends(require_role("admin"))):
    """Admin: Get all support tickets"""
    tickets = await db.support_tickets.find({}, {"_id": 0}).to_list(1000)
    for t in tickets:
        if isinstance(t.get("created_at"), str):
            t["created_at"] = datetime.fromisoformat(t["created_at"])
    return tickets


@api_router.post("/admin/portfolio", response_model=PortfolioCase)
async def create_portfolio_case(
    title: str,
    description: str,
    client_name: str,
    industry: str,
    product_type: str,
    technologies: List[str],
    results: str,
    testimonial: Optional[str] = None,
    image_url: Optional[str] = None,
    featured: bool = False,
    admin: User = Depends(require_role("admin"))
):
    """Admin: Create portfolio case"""
    case_doc = {
        "case_id": f"case_{uuid.uuid4().hex[:12]}",
        "title": title,
        "description": description,
        "client_name": client_name,
        "industry": industry,
        "product_type": product_type,
        "technologies": technologies,
        "results": results,
        "testimonial": testimonial,
        "image_url": image_url,
        "featured": featured,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.portfolio_cases.insert_one(case_doc)
    case_doc.pop("_id", None)
    case_doc["created_at"] = datetime.fromisoformat(case_doc["created_at"])
    return PortfolioCase(**case_doc)


# ============ ASSIGNMENT ENGINE ============

def score_developer_for_work_unit(work_unit: dict, developer: dict) -> tuple:
    """Calculate assignment score for a developer"""
    reasons = []
    
    # Skill match (30%)
    required_skill = work_unit.get("unit_type", "task")
    dev_skills = developer.get("skills", [])
    skill_match = 1.0 if required_skill in [s.lower() for s in dev_skills] else 0.5
    if skill_match == 1.0:
        reasons.append(f"Strong {required_skill} match")
    
    # Level match (20%)
    level_scores = {"junior": 0.5, "middle": 0.75, "senior": 1.0, "lead": 1.0}
    level_score = level_scores.get(developer.get("level", "junior"), 0.5)
    if level_score >= 0.75:
        reasons.append(f"{developer.get('level', 'junior').capitalize()} level developer")
    
    # Rating (20%)
    rating = developer.get("rating", 5.0)
    rating_score = min(rating / 5.0, 1.0)
    if rating >= 4.5:
        reasons.append("High rating")
    
    # Load availability (15%)
    active_load = developer.get("active_load", 0)
    max_load = 40  # hours per week
    load_availability = max(0, 1 - (active_load / max_load))
    if load_availability > 0.7:
        reasons.append("Low current load")
    
    # Completed tasks (10%)
    completed = developer.get("completed_tasks", 0)
    experience_score = min(completed / 50, 1.0)
    if completed > 20:
        reasons.append(f"{completed} tasks completed")
    
    # Speed (5%)
    speed_score = 0.7  # Default
    
    # Calculate total score
    total_score = (
        skill_match * 0.30 +
        level_score * 0.20 +
        rating_score * 0.20 +
        load_availability * 0.15 +
        experience_score * 0.10 +
        speed_score * 0.05
    )
    
    return total_score, reasons


@api_router.get("/admin/assignment-engine/{work_unit_id}/candidates")
async def get_assignment_candidates(
    work_unit_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Get recommended developers for a work unit"""
    # Get work unit
    work_unit = await db.work_units.find_one({"unit_id": work_unit_id}, {"_id": 0})
    if not work_unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    # Get available developers
    developers = await db.users.find(
        {"role": "developer"},
        {"_id": 0}
    ).to_list(100)
    
    # Score each developer
    candidates = []
    for dev in developers:
        score, reasons = score_developer_for_work_unit(work_unit, dev)
        if score > 0.4:  # Minimum threshold
            candidates.append({
                "developer": dev,
                "score": score,
                "reasons": reasons
            })
    
    # Sort by score descending
    candidates.sort(key=lambda x: x["score"], reverse=True)
    
    return candidates[:5]  # Top 5


@api_router.post("/admin/assignment-engine/{work_unit_id}/assign")
async def assign_work_unit(
    work_unit_id: str,
    developer_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Assign a work unit to a specific developer"""
    # Verify work unit exists
    work_unit = await db.work_units.find_one({"unit_id": work_unit_id}, {"_id": 0})
    if not work_unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    # Verify developer exists
    developer = await db.users.find_one({"user_id": developer_id, "role": "developer"}, {"_id": 0})
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    
    # Create assignment
    assignment_doc = {
        "assignment_id": f"asgn_{uuid.uuid4().hex[:12]}",
        "unit_id": work_unit_id,
        "developer_id": developer_id,
        "assigned_by": admin.user_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assignments.insert_one(assignment_doc)
    
    # Update work unit
    await db.work_units.update_one(
        {"unit_id": work_unit_id},
        {"$set": {"assigned_to": developer_id, "status": "assigned"}}
    )
    
    # Update developer load
    await db.users.update_one(
        {"user_id": developer_id},
        {"$inc": {"active_load": work_unit.get("estimated_hours", 0)}}
    )
    
    return {"message": "Assigned successfully", "assignment_id": assignment_doc["assignment_id"]}


@api_router.post("/admin/assignment-engine/{work_unit_id}/assign-best")
async def assign_best_match(
    work_unit_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Assign work unit to the best matching developer"""
    # Get candidates
    work_unit = await db.work_units.find_one({"unit_id": work_unit_id}, {"_id": 0})
    if not work_unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    developers = await db.users.find({"role": "developer"}, {"_id": 0}).to_list(100)
    
    if not developers:
        raise HTTPException(status_code=400, detail="No developers available")
    
    # Find best match
    best_dev = None
    best_score = 0
    for dev in developers:
        score, _ = score_developer_for_work_unit(work_unit, dev)
        if score > best_score:
            best_score = score
            best_dev = dev
    
    if not best_dev:
        raise HTTPException(status_code=400, detail="No suitable developer found")
    
    # Create assignment
    assignment_doc = {
        "assignment_id": f"asgn_{uuid.uuid4().hex[:12]}",
        "unit_id": work_unit_id,
        "developer_id": best_dev["user_id"],
        "assigned_by": admin.user_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assignments.insert_one(assignment_doc)
    
    # Update work unit
    await db.work_units.update_one(
        {"unit_id": work_unit_id},
        {"$set": {"assigned_to": best_dev["user_id"], "status": "assigned"}}
    )
    
    # Update developer load
    await db.users.update_one(
        {"user_id": best_dev["user_id"]},
        {"$inc": {"active_load": work_unit.get("estimated_hours", 0)}}
    )
    
    return {
        "message": "Assigned to best match",
        "assignment_id": assignment_doc["assignment_id"],
        "developer_id": best_dev["user_id"],
        "score": best_score
    }


# ============ CLIENT SUPPORT SYSTEM ============

@api_router.get("/client/support-tickets")
async def get_client_tickets(user: User = Depends(get_current_user)):
    """Get support tickets for the current client"""
    tickets = await db.support_tickets.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    # Add project names
    for ticket in tickets:
        if ticket.get("project_id"):
            project = await db.projects.find_one({"project_id": ticket["project_id"]}, {"_id": 0, "name": 1})
            ticket["project_name"] = project.get("name") if project else None
    
    return tickets


@api_router.post("/client/support-tickets")
async def create_client_ticket(
    title: str = Body(...),
    description: str = Body(...),
    ticket_type: str = Body("bug"),
    priority: str = Body("medium"),
    project_id: str = Body(None),
    user: User = Depends(get_current_user)
):
    """Create a new support ticket"""
    
    valid_types = ["bug", "improvement", "question"]
    valid_priorities = ["low", "medium", "high"]
    
    if ticket_type not in valid_types:
        raise HTTPException(status_code=400, detail=f"Invalid ticket_type. Must be one of: {valid_types}")
    if priority not in valid_priorities:
        raise HTTPException(status_code=400, detail=f"Invalid priority. Must be one of: {valid_priorities}")
    
    ticket_doc = {
        "ticket_id": f"tkt_{uuid.uuid4().hex[:12]}",
        "user_id": user.user_id,
        "project_id": project_id,
        "title": title,
        "description": description,
        "ticket_type": ticket_type,
        "priority": priority,
        "status": "open",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.insert_one(ticket_doc)
    
    logger.info(f"TICKET CREATED: {ticket_doc['ticket_id']} by {user.user_id}")
    
    if "_id" in ticket_doc:
        del ticket_doc["_id"]
    return ticket_doc


@api_router.get("/client/support-tickets/{ticket_id}")
async def get_client_ticket(ticket_id: str, user: User = Depends(get_current_user)):
    """Get a specific support ticket"""
    ticket = await db.support_tickets.find_one(
        {"ticket_id": ticket_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    # Get responses
    responses = await db.ticket_responses.find(
        {"ticket_id": ticket_id},
        {"_id": 0}
    ).sort("created_at", 1).to_list(100)
    ticket["responses"] = responses
    
    return ticket


@api_router.post("/client/support-tickets/{ticket_id}/respond")
async def respond_to_ticket(
    ticket_id: str,
    message: str = Body(...),
    user: User = Depends(get_current_user)
):
    """Client responds to a support ticket"""
    ticket = await db.support_tickets.find_one(
        {"ticket_id": ticket_id, "user_id": user.user_id},
        {"_id": 0}
    )
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    response_doc = {
        "response_id": f"resp_{uuid.uuid4().hex[:12]}",
        "ticket_id": ticket_id,
        "user_id": user.user_id,
        "user_role": user.role,
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ticket_responses.insert_one(response_doc)
    
    return {"message": "Response added"}


@api_router.get("/client/pending-deliverables")
async def get_pending_deliverables(user: User = Depends(get_current_user)):
    """Get pending deliverables for client approval"""
    # Get user's projects
    projects = await db.projects.find(
        {"client_id": user.user_id},
        {"_id": 0, "project_id": 1, "name": 1}
    ).to_list(100)
    
    project_ids = [p["project_id"] for p in projects]
    project_names = {p["project_id"]: p["name"] for p in projects}
    
    # Get pending deliverables
    deliverables = await db.deliverables.find(
        {"project_id": {"$in": project_ids}, "status": "pending"},
        {"_id": 0}
    ).to_list(100)
    
    for d in deliverables:
        d["project_name"] = project_names.get(d.get("project_id"))
    
    return deliverables


# Admin ticket management
@api_router.get("/admin/support-tickets")
async def get_all_tickets(
    status: Optional[str] = None,
    admin: User = Depends(require_role("admin"))
):
    """Get all support tickets"""
    query = {}
    if status:
        query["status"] = status
    
    tickets = await db.support_tickets.find(query, {"_id": 0}).sort("created_at", -1).to_list(200)
    
    # Add user and project info
    for ticket in tickets:
        user = await db.users.find_one({"user_id": ticket.get("user_id")}, {"_id": 0, "name": 1, "email": 1})
        ticket["user_name"] = user.get("name") if user else "Unknown"
        
        if ticket.get("project_id"):
            project = await db.projects.find_one({"project_id": ticket["project_id"]}, {"_id": 0, "name": 1})
            ticket["project_name"] = project.get("name") if project else None
    
    return tickets


@api_router.post("/admin/support-tickets/{ticket_id}/status")
async def update_ticket_status(
    ticket_id: str,
    status: str = Body(...),
    admin: User = Depends(require_role("admin"))
):
    """Update ticket status"""
    valid_statuses = ["open", "in_progress", "resolved", "closed"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.support_tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Ticket not found")
    
    return {"message": f"Status updated to {status}"}


@api_router.post("/admin/support-tickets/{ticket_id}/respond")
async def admin_respond_to_ticket(
    ticket_id: str,
    message: str = Body(...),
    admin: User = Depends(require_role("admin"))
):
    """Admin responds to a support ticket"""
    response_doc = {
        "response_id": f"resp_{uuid.uuid4().hex[:12]}",
        "ticket_id": ticket_id,
        "user_id": admin.user_id,
        "user_role": "admin",
        "message": message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.ticket_responses.insert_one(response_doc)
    
    # Update ticket to in_progress if open
    await db.support_tickets.update_one(
        {"ticket_id": ticket_id, "status": "open"},
        {"$set": {"status": "in_progress"}}
    )
    
    return {"message": "Response added"}


# ============ ADMIN CONTROL CENTER ENDPOINTS ============

@api_router.get("/admin/control-center/overview")
async def get_control_center_overview(admin: User = Depends(require_role("admin"))):
    """Get aggregated overview data for Control Center"""
    
    # Work Unit Stats
    all_units = await db.work_units.find({}, {"_id": 0}).to_list(1000)
    
    status_counts = {
        "pending": 0,
        "assigned": 0, 
        "in_progress": 0,
        "submitted": 0,
        "review": 0,
        "validation": 0,
        "completed": 0,
        "revision": 0
    }
    
    for unit in all_units:
        status = unit.get("status", "pending")
        if status in status_counts:
            status_counts[status] += 1
    
    active_units = status_counts["assigned"] + status_counts["in_progress"] + status_counts["submitted"]
    in_review = status_counts["review"] + status_counts["submitted"]
    in_validation = status_counts["validation"]
    blocked = status_counts["revision"]
    
    # Pending Deliverables
    pending_deliverables = await db.deliverables.count_documents({"status": "pending"})
    
    # Overdue (units in non-completed status for more than estimated time)
    overdue_count = 0
    for unit in all_units:
        if unit.get("status") not in ["completed", "pending"]:
            actual = unit.get("actual_hours", 0)
            estimated = unit.get("estimated_hours", 8)
            if actual > estimated * 1.5:
                overdue_count += 1
    
    # Team Stats
    developers = await db.users.find({"role": "developer"}, {"_id": 0}).to_list(100)
    testers = await db.users.find({"role": "tester"}, {"_id": 0}).to_list(100)
    
    # Developer health
    overloaded_devs = []
    top_devs = []
    idle_devs = []
    
    for dev in developers:
        load = dev.get("active_load", 0)
        rating = dev.get("rating", 5.0)
        completed = dev.get("completed_tasks", 0)
        
        dev_info = {
            "user_id": dev["user_id"],
            "name": dev.get("name", "Unknown"),
            "email": dev.get("email", ""),
            "score": int(rating * 20),
            "load": min(int(load / 40 * 100), 200),  # As percentage of 40h week
            "completed": completed,
            "skills": dev.get("skills", [])
        }
        
        if load > 40:
            overloaded_devs.append(dev_info)
        elif load == 0:
            idle_devs.append(dev_info)
        if rating >= 4.5 and completed > 5:
            top_devs.append(dev_info)
    
    # Tester health
    validation_tasks = await db.validation_tasks.find({}, {"_id": 0}).to_list(1000)
    tester_stats = {}
    
    for task in validation_tasks:
        tester_id = task.get("tester_id")
        if tester_id:
            if tester_id not in tester_stats:
                tester_stats[tester_id] = {"passed": 0, "failed": 0}
            if task.get("status") == "passed":
                tester_stats[tester_id]["passed"] += 1
            elif task.get("status") == "failed":
                tester_stats[tester_id]["failed"] += 1
    
    tester_health = []
    for tester in testers:
        stats = tester_stats.get(tester["user_id"], {"passed": 0, "failed": 0})
        total = stats["passed"] + stats["failed"]
        accuracy = int((stats["passed"] / total * 100)) if total > 0 else 100
        
        # Count issues
        issues = await db.validation_issues.count_documents({"created_by": tester["user_id"]})
        
        tester_health.append({
            "user_id": tester["user_id"],
            "name": tester.get("name", "Unknown"),
            "accuracy": accuracy,
            "validations": total,
            "issues_found": issues
        })
    
    # Project health
    projects = await db.projects.find({}, {"_id": 0}).to_list(100)
    project_health = []
    
    for proj in projects:
        # Count revisions for project
        proj_units = await db.work_units.find({"project_id": proj["project_id"]}, {"_id": 0}).to_list(100)
        total_revisions = sum(1 for u in proj_units if u.get("status") == "revision")
        stuck_count = sum(1 for u in proj_units if u.get("status") in ["review", "validation"] and u.get("actual_hours", 0) > u.get("estimated_hours", 8))
        
        progress = proj.get("progress", 0)
        status = "healthy"
        if total_revisions > 3 or stuck_count > 2:
            status = "at_risk"
        if progress < 30 and len(proj_units) > 5:
            status = "delayed"
        
        # Pending approvals
        pending = await db.deliverables.count_documents({"project_id": proj["project_id"], "status": "pending"})
        
        project_health.append({
            "project_id": proj["project_id"],
            "name": proj.get("name", "Unknown"),
            "progress": progress,
            "stage": proj.get("current_stage", "discovery"),
            "status": status,
            "revisions": total_revisions,
            "pending_approvals": pending
        })
    
    # Alerts
    alerts = []
    
    # Stuck in review alerts
    for unit in all_units:
        if unit.get("status") in ["submitted", "review"]:
            hours = unit.get("actual_hours", 0)
            if hours > 24:
                alerts.append({
                    "type": "stuck_review",
                    "severity": "warning",
                    "title": f"Work unit stuck in review",
                    "subtitle": f"{unit.get('title', 'Unknown')} - {hours}h in review",
                    "unit_id": unit.get("unit_id"),
                    "action": "Review"
                })
    
    # Overloaded developer alerts
    for dev in overloaded_devs:
        alerts.append({
            "type": "overloaded",
            "severity": "danger",
            "title": f"Developer overloaded",
            "subtitle": f"{dev['name']} - {dev['load']}% load",
            "user_id": dev["user_id"],
            "action": "Reassign"
        })
    
    # At risk project alerts
    for proj in project_health:
        if proj["status"] == "at_risk":
            alerts.append({
                "type": "project_risk",
                "severity": "warning",
                "title": f"Project at risk",
                "subtitle": f"{proj['name']} - {proj['revisions']} revisions",
                "project_id": proj["project_id"],
                "action": "View"
            })
    
    return {
        "stats": {
            "active_units": active_units,
            "in_review": in_review,
            "in_validation": in_validation,
            "blocked": blocked,
            "pending_deliverables": pending_deliverables,
            "overdue": overdue_count
        },
        "team": {
            "developers": {
                "total": len(developers),
                "overloaded": overloaded_devs[:5],
                "top": sorted(top_devs, key=lambda x: x["score"], reverse=True)[:5],
                "idle": idle_devs[:5]
            },
            "testers": {
                "total": len(testers),
                "list": sorted(tester_health, key=lambda x: x["accuracy"], reverse=True)[:5]
            }
        },
        "projects": project_health[:10],
        "alerts": alerts[:10]
    }


@api_router.get("/admin/control-center/pipeline")
async def get_control_center_pipeline(admin: User = Depends(require_role("admin"))):
    """Get pipeline data for Control Center"""
    
    all_units = await db.work_units.find({}, {"_id": 0}).to_list(1000)
    
    # Get developers for assignee names
    developers = {d["user_id"]: d["name"] for d in await db.users.find({"role": "developer"}, {"_id": 0, "user_id": 1, "name": 1}).to_list(100)}
    
    # Get projects for names
    projects = {p["project_id"]: p["name"] for p in await db.projects.find({}, {"_id": 0, "project_id": 1, "name": 1}).to_list(100)}
    
    # Organize by status
    pipeline = {
        "backlog": [],
        "assigned": [],
        "in_progress": [],
        "review": [],
        "validation": [],
        "done": []
    }
    
    status_mapping = {
        "pending": "backlog",
        "assigned": "assigned",
        "in_progress": "in_progress",
        "submitted": "review",
        "review": "review",
        "validation": "validation",
        "completed": "done",
        "revision": "in_progress"  # Show revision items in progress
    }
    
    for unit in all_units:
        status = unit.get("status", "pending")
        column = status_mapping.get(status, "backlog")
        
        item = {
            "unit_id": unit.get("unit_id"),
            "title": unit.get("title", "Untitled"),
            "project": projects.get(unit.get("project_id"), "Unknown"),
            "project_id": unit.get("project_id"),
            "assignee": developers.get(unit.get("assigned_to"), "Unassigned"),
            "assignee_id": unit.get("assigned_to"),
            "type": unit.get("unit_type", "task"),
            "estimated_hours": unit.get("estimated_hours", 0),
            "actual_hours": unit.get("actual_hours", 0),
            "status": status,
            "is_revision": status == "revision"
        }
        
        pipeline[column].append(item)
    
    # Count and limit
    result = {}
    for col, items in pipeline.items():
        result[col] = {
            "count": len(items),
            "items": items[:5]  # Show top 5 per column
        }
    
    return result


@api_router.get("/admin/control-center/actions")
async def get_control_center_actions(admin: User = Depends(require_role("admin"))):
    """Get pending admin actions for Control Center"""
    
    actions = []
    
    # Unassigned work units
    unassigned = await db.work_units.find({"assigned_to": None, "status": "pending"}, {"_id": 0}).to_list(10)
    for unit in unassigned:
        actions.append({
            "type": "assign",
            "title": f"Assign: {unit.get('title', 'Unknown')}",
            "subtitle": "Work unit needs assignment",
            "entity_id": unit.get("unit_id"),
            "cta": "Assign"
        })
    
    # Pending submissions for review
    pending_subs = await db.submissions.find({"status": "pending"}, {"_id": 0}).to_list(10)
    for sub in pending_subs:
        actions.append({
            "type": "review",
            "title": f"Review submission",
            "subtitle": f"Unit: {sub.get('unit_id', 'Unknown')[:12]}",
            "entity_id": sub.get("submission_id"),
            "cta": "Review"
        })
    
    # Pending validation assignments
    unassigned_validations = await db.validation_tasks.find({"tester_id": None, "status": "pending"}, {"_id": 0}).to_list(10)
    for val in unassigned_validations:
        actions.append({
            "type": "assign_tester",
            "title": f"Assign tester",
            "subtitle": f"Validation needs tester",
            "entity_id": val.get("validation_id"),
            "cta": "Assign"
        })
    
    # Pending deliverable approvals (from client)
    pending_deliverables = await db.deliverables.find({"status": "pending"}, {"_id": 0}).to_list(10)
    for dlv in pending_deliverables:
        actions.append({
            "type": "deliverable",
            "title": f"Deliverable pending",
            "subtitle": f"{dlv.get('title', 'Unknown')} awaiting client",
            "entity_id": dlv.get("deliverable_id"),
            "cta": "View"
        })
    
    # Open support tickets
    open_tickets = await db.support_tickets.find({"status": "open"}, {"_id": 0}).to_list(10)
    for ticket in open_tickets:
        actions.append({
            "type": "ticket",
            "title": f"Support: {ticket.get('title', 'Unknown')[:30]}",
            "subtitle": f"Priority: {ticket.get('priority', 'medium')}",
            "entity_id": ticket.get("ticket_id"),
            "cta": "Resolve"
        })
    
    return actions[:15]


@api_router.post("/admin/control-center/reassign")
async def reassign_work_unit(
    unit_id: str,
    new_developer_id: str,
    admin: User = Depends(require_role("admin"))
):
    """Reassign work unit to different developer"""
    
    # Get work unit
    unit = await db.work_units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    old_dev_id = unit.get("assigned_to")
    estimated_hours = unit.get("estimated_hours", 0)
    
    # Update old developer load
    if old_dev_id:
        await db.users.update_one(
            {"user_id": old_dev_id},
            {"$inc": {"active_load": -estimated_hours}}
        )
        # Deactivate old assignment
        await db.assignments.update_one(
            {"unit_id": unit_id, "developer_id": old_dev_id, "status": "active"},
            {"$set": {"status": "reassigned"}}
        )
    
    # Create new assignment
    assignment_doc = {
        "assignment_id": f"asgn_{uuid.uuid4().hex[:12]}",
        "unit_id": unit_id,
        "developer_id": new_developer_id,
        "assigned_by": admin.user_id,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.assignments.insert_one(assignment_doc)
    
    # Update work unit
    await db.work_units.update_one(
        {"unit_id": unit_id},
        {"$set": {"assigned_to": new_developer_id, "status": "assigned"}}
    )
    
    # Update new developer load
    await db.users.update_one(
        {"user_id": new_developer_id},
        {"$inc": {"active_load": estimated_hours}}
    )
    
    logger.info(f"REASSIGN: unit {unit_id} from {old_dev_id} to {new_developer_id}")
    return {"message": "Reassigned successfully"}


@api_router.post("/admin/control-center/force-status")
async def force_work_unit_status(
    unit_id: str,
    new_status: str,
    admin: User = Depends(require_role("admin"))
):
    """Force change work unit status"""
    
    valid_statuses = ["pending", "assigned", "in_progress", "submitted", "review", "validation", "completed", "revision"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")
    
    result = await db.work_units.update_one(
        {"unit_id": unit_id},
        {"$set": {"status": new_status}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    logger.info(f"FORCE STATUS: unit {unit_id} -> {new_status} by admin {admin.user_id}")
    return {"message": f"Status changed to {new_status}"}


@api_router.post("/admin/control-center/escalate")
async def escalate_work_unit(
    unit_id: str,
    reason: str,
    admin: User = Depends(require_role("admin"))
):
    """Escalate work unit - creates high priority ticket"""
    
    unit = await db.work_units.find_one({"unit_id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Work unit not found")
    
    ticket_doc = {
        "ticket_id": f"tkt_{uuid.uuid4().hex[:12]}",
        "project_id": unit.get("project_id"),
        "user_id": admin.user_id,
        "title": f"ESCALATED: {unit.get('title', 'Unknown')}",
        "description": reason,
        "ticket_type": "escalation",
        "priority": "high",
        "status": "open",
        "unit_id": unit_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.support_tickets.insert_one(ticket_doc)
    
    logger.info(f"ESCALATE: unit {unit_id}, ticket {ticket_doc['ticket_id']}")
    return {"message": "Escalated", "ticket_id": ticket_doc["ticket_id"]}


# ============ AUTO-SYSTEM ENGINE ============

# System Settings Model
class SystemSettings(BaseModel):
    assignment_mode: str = "manual"  # manual | assisted | auto
    alert_engine_enabled: bool = True
    priority_engine_enabled: bool = True
    auto_assign_low_priority: bool = True
    auto_assign_normal_priority: bool = False
    auto_assign_high_priority: bool = False
    auto_assign_critical_priority: bool = False  # Always manual for critical
    stuck_threshold_hours: int = 12
    overload_threshold_percent: int = 110
    max_revisions_alert: int = 3


@api_router.get("/admin/system-settings")
async def get_system_settings(admin: User = Depends(require_role("admin"))):
    """Get current system settings"""
    settings = await db.system_settings.find_one({"setting_id": "global"}, {"_id": 0})
    if not settings:
        # Create default settings
        settings = {
            "setting_id": "global",
            "assignment_mode": "manual",
            "alert_engine_enabled": True,
            "priority_engine_enabled": True,
            "auto_assign_low_priority": True,
            "auto_assign_normal_priority": False,
            "auto_assign_high_priority": False,
            "auto_assign_critical_priority": False,
            "stuck_threshold_hours": 12,
            "overload_threshold_percent": 110,
            "max_revisions_alert": 3,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.system_settings.insert_one(settings)
        if "_id" in settings:
            del settings["_id"]
    return settings


@api_router.post("/admin/system-settings")
async def update_system_settings(
    assignment_mode: Optional[str] = None,
    alert_engine_enabled: Optional[bool] = None,
    priority_engine_enabled: Optional[bool] = None,
    auto_assign_low_priority: Optional[bool] = None,
    auto_assign_normal_priority: Optional[bool] = None,
    auto_assign_high_priority: Optional[bool] = None,
    stuck_threshold_hours: Optional[int] = None,
    overload_threshold_percent: Optional[int] = None,
    max_revisions_alert: Optional[int] = None,
    admin: User = Depends(require_role("admin"))
):
    """Update system settings"""
    update_data = {"updated_at": datetime.now(timezone.utc).isoformat()}
    
    if assignment_mode is not None:
        if assignment_mode not in ["manual", "assisted", "auto"]:
            raise HTTPException(status_code=400, detail="Invalid assignment_mode")
        update_data["assignment_mode"] = assignment_mode
    
    if alert_engine_enabled is not None:
        update_data["alert_engine_enabled"] = alert_engine_enabled
    if priority_engine_enabled is not None:
        update_data["priority_engine_enabled"] = priority_engine_enabled
    if auto_assign_low_priority is not None:
        update_data["auto_assign_low_priority"] = auto_assign_low_priority
    if auto_assign_normal_priority is not None:
        update_data["auto_assign_normal_priority"] = auto_assign_normal_priority
    if auto_assign_high_priority is not None:
        update_data["auto_assign_high_priority"] = auto_assign_high_priority
    if stuck_threshold_hours is not None:
        update_data["stuck_threshold_hours"] = stuck_threshold_hours
    if overload_threshold_percent is not None:
        update_data["overload_threshold_percent"] = overload_threshold_percent
    if max_revisions_alert is not None:
        update_data["max_revisions_alert"] = max_revisions_alert
    
    await db.system_settings.update_one(
        {"setting_id": "global"},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"SYSTEM SETTINGS updated: {update_data}")
    return {"message": "Settings updated", "updates": update_data}


# ============ AUTO ASSIGNMENT ENGINE ============

async def calculate_developer_score(developer: dict, work_unit: dict) -> float:
    """Calculate assignment score for a developer"""
    score = 0.0
    
    # Skill match (0-40 points)
    required_skills = work_unit.get("required_skills", [])
    dev_skills = developer.get("skills", [])
    if required_skills:
        matched = len(set(required_skills) & set(dev_skills))
        score += (matched / len(required_skills)) * 40
    else:
        score += 20  # Default if no skills required
    
    # Level match (0-20 points)
    unit_complexity = work_unit.get("complexity", "medium")
    dev_level = developer.get("level", "middle")
    level_scores = {"junior": 1, "middle": 2, "senior": 3}
    complexity_reqs = {"low": 1, "medium": 2, "high": 3}
    
    if level_scores.get(dev_level, 2) >= complexity_reqs.get(unit_complexity, 2):
        score += 20
    else:
        score += 5
    
    # Rating (0-20 points)
    rating = developer.get("rating", 5.0)
    score += (rating / 5.0) * 20
    
    # Load availability (0-20 points) - less load = higher score
    active_load = developer.get("active_load", 0)
    max_load = 40  # 40 hours
    if active_load < max_load:
        score += ((max_load - active_load) / max_load) * 20
    
    return round(score, 2)


@api_router.post("/system/auto-assignment/run")
async def run_auto_assignment(admin: User = Depends(require_role("admin"))):
    """Manually trigger auto-assignment engine"""
    
    settings = await db.system_settings.find_one({"setting_id": "global"}, {"_id": 0})
    if not settings:
        settings = {"assignment_mode": "manual"}
    
    if settings.get("assignment_mode") == "manual":
        return {"message": "Auto-assignment disabled (manual mode)", "assigned": 0}
    
    # Find unassigned work units
    query = {"assigned_to": None, "status": "pending"}
    
    # Filter by priority based on settings
    allowed_priorities = []
    if settings.get("auto_assign_low_priority", True):
        allowed_priorities.append("low")
    if settings.get("auto_assign_normal_priority", False):
        allowed_priorities.append("normal")
    if settings.get("auto_assign_high_priority", False):
        allowed_priorities.append("high")
    # Critical always manual
    
    if allowed_priorities:
        query["priority"] = {"$in": allowed_priorities}
    
    unassigned_units = await db.work_units.find(query, {"_id": 0}).to_list(50)
    
    if not unassigned_units:
        return {"message": "No units to assign", "assigned": 0}
    
    # Get available developers
    developers = await db.users.find(
        {"role": "developer", "active_load": {"$lt": 40}},
        {"_id": 0}
    ).to_list(100)
    
    if not developers:
        return {"message": "No available developers", "assigned": 0}
    
    assigned_count = 0
    assignments = []
    
    for unit in unassigned_units:
        # Score all developers
        scored_devs = []
        for dev in developers:
            score = await calculate_developer_score(dev, unit)
            scored_devs.append((dev, score))
        
        # Sort by score descending
        scored_devs.sort(key=lambda x: x[1], reverse=True)
        
        if not scored_devs:
            continue
        
        best_dev, best_score = scored_devs[0]
        
        # In assisted mode, just store suggestion
        if settings.get("assignment_mode") == "assisted":
            await db.work_units.update_one(
                {"unit_id": unit["unit_id"]},
                {"$set": {
                    "suggested_developer": best_dev["user_id"],
                    "suggestion_score": best_score,
                    "suggested_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            assignments.append({
                "unit_id": unit["unit_id"],
                "suggested_to": best_dev["user_id"],
                "score": best_score,
                "mode": "assisted"
            })
        
        # In auto mode, actually assign
        elif settings.get("assignment_mode") == "auto":
            # Create assignment
            assignment_doc = {
                "assignment_id": f"asgn_{uuid.uuid4().hex[:12]}",
                "unit_id": unit["unit_id"],
                "developer_id": best_dev["user_id"],
                "assigned_by": "SYSTEM_AUTO",
                "assignment_score": best_score,
                "status": "active",
                "auto_assigned": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.assignments.insert_one(assignment_doc)
            
            # Update work unit
            await db.work_units.update_one(
                {"unit_id": unit["unit_id"]},
                {"$set": {
                    "assigned_to": best_dev["user_id"],
                    "status": "assigned",
                    "auto_assigned": True,
                    "assigned_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Update developer load
            estimated_hours = unit.get("estimated_hours", 0)
            await db.users.update_one(
                {"user_id": best_dev["user_id"]},
                {"$inc": {"active_load": estimated_hours}}
            )
            
            # Update local developer state for next iteration
            best_dev["active_load"] = best_dev.get("active_load", 0) + estimated_hours
            
            assigned_count += 1
            assignments.append({
                "unit_id": unit["unit_id"],
                "assigned_to": best_dev["user_id"],
                "score": best_score,
                "mode": "auto"
            })
            
            logger.info(f"AUTO-ASSIGN: {unit['unit_id']} -> {best_dev['user_id']} (score: {best_score})")
    
    return {
        "message": f"Auto-assignment complete",
        "mode": settings.get("assignment_mode"),
        "assigned": assigned_count,
        "assignments": assignments
    }


# ============ ALERT ENGINE ============

@api_router.post("/system/alert-engine/run")
async def run_alert_engine(admin: User = Depends(require_role("admin"))):
    """Run alert engine to generate system alerts"""
    
    settings = await db.system_settings.find_one({"setting_id": "global"}, {"_id": 0})
    if not settings or not settings.get("alert_engine_enabled", True):
        return {"message": "Alert engine disabled", "alerts_created": 0}
    
    stuck_threshold = settings.get("stuck_threshold_hours", 12)
    overload_threshold = settings.get("overload_threshold_percent", 110)
    max_revisions = settings.get("max_revisions_alert", 3)
    
    alerts_created = []
    now = datetime.now(timezone.utc)
    
    # 1. STUCK ALERTS - Units stuck in review/validation
    stuck_statuses = ["submitted", "review", "validation"]
    all_units = await db.work_units.find(
        {"status": {"$in": stuck_statuses}},
        {"_id": 0}
    ).to_list(1000)
    
    for unit in all_units:
        # Calculate time in current status
        status_changed = unit.get("status_changed_at") or unit.get("created_at")
        if status_changed:
            if isinstance(status_changed, str):
                status_changed = datetime.fromisoformat(status_changed.replace('Z', '+00:00'))
            hours_stuck = (now - status_changed).total_seconds() / 3600
            
            if hours_stuck > stuck_threshold:
                # Check if alert already exists
                existing = await db.system_alerts.find_one({
                    "entity_id": unit["unit_id"],
                    "type": "stuck",
                    "resolved": False
                }, {"_id": 0})
                
                if not existing:
                    alert_doc = {
                        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
                        "type": "stuck",
                        "entity_type": "work_unit",
                        "entity_id": unit["unit_id"],
                        "message": f"Work unit stuck in {unit['status']} for {int(hours_stuck)}h",
                        "severity": "warning" if hours_stuck < 24 else "critical",
                        "details": {
                            "unit_title": unit.get("title"),
                            "status": unit.get("status"),
                            "hours_stuck": round(hours_stuck, 1)
                        },
                        "resolved": False,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.system_alerts.insert_one(alert_doc)
                    alerts_created.append(alert_doc["alert_id"])
                    logger.info(f"ALERT: stuck {unit['unit_id']} ({hours_stuck}h)")
    
    # 2. OVERLOAD ALERTS - Developers with high load
    developers = await db.users.find({"role": "developer"}, {"_id": 0}).to_list(100)
    
    for dev in developers:
        load_percent = (dev.get("active_load", 0) / 40) * 100
        
        if load_percent > overload_threshold:
            existing = await db.system_alerts.find_one({
                "entity_id": dev["user_id"],
                "type": "overload",
                "resolved": False
            }, {"_id": 0})
            
            if not existing:
                alert_doc = {
                    "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
                    "type": "overload",
                    "entity_type": "developer",
                    "entity_id": dev["user_id"],
                    "message": f"Developer overloaded: {int(load_percent)}% capacity",
                    "severity": "warning" if load_percent < 150 else "critical",
                    "details": {
                        "developer_name": dev.get("name"),
                        "load_percent": round(load_percent, 1),
                        "active_hours": dev.get("active_load", 0)
                    },
                    "resolved": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.system_alerts.insert_one(alert_doc)
                alerts_created.append(alert_doc["alert_id"])
                logger.info(f"ALERT: overload {dev['user_id']} ({load_percent}%)")
    
    # 3. REVISION LOOP ALERTS - Too many revisions
    # Count revisions per unit
    revision_counts = {}
    all_units = await db.work_units.find({}, {"_id": 0, "unit_id": 1, "status": 1, "title": 1}).to_list(1000)
    
    for unit in all_units:
        # Count how many times unit went to revision
        revision_history = await db.work_unit_history.count_documents({
            "unit_id": unit["unit_id"],
            "new_status": "revision"
        })
        
        if revision_history > max_revisions:
            existing = await db.system_alerts.find_one({
                "entity_id": unit["unit_id"],
                "type": "revision_loop",
                "resolved": False
            }, {"_id": 0})
            
            if not existing:
                alert_doc = {
                    "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
                    "type": "revision_loop",
                    "entity_type": "work_unit",
                    "entity_id": unit["unit_id"],
                    "message": f"Revision loop detected: {revision_history} revisions",
                    "severity": "warning",
                    "details": {
                        "unit_title": unit.get("title"),
                        "revision_count": revision_history
                    },
                    "resolved": False,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.system_alerts.insert_one(alert_doc)
                alerts_created.append(alert_doc["alert_id"])
    
    # 4. TESTER ACCURACY ALERTS - High false positive rate
    testers = await db.users.find({"role": "tester"}, {"_id": 0}).to_list(100)
    
    for tester in testers:
        # Calculate accuracy
        validations = await db.validation_tasks.find(
            {"tester_id": tester["user_id"], "status": {"$in": ["passed", "failed"]}},
            {"_id": 0}
        ).to_list(100)
        
        if len(validations) >= 5:  # Only alert after enough data
            failed_count = sum(1 for v in validations if v.get("status") == "failed")
            fail_rate = (failed_count / len(validations)) * 100
            
            # If failing > 50%, might be too strict
            if fail_rate > 50:
                existing = await db.system_alerts.find_one({
                    "entity_id": tester["user_id"],
                    "type": "tester_accuracy",
                    "resolved": False
                }, {"_id": 0})
                
                if not existing:
                    alert_doc = {
                        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
                        "type": "tester_accuracy",
                        "entity_type": "tester",
                        "entity_id": tester["user_id"],
                        "message": f"High fail rate: {int(fail_rate)}%",
                        "severity": "warning",
                        "details": {
                            "tester_name": tester.get("name"),
                            "fail_rate": round(fail_rate, 1),
                            "total_validations": len(validations)
                        },
                        "resolved": False,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.system_alerts.insert_one(alert_doc)
                    alerts_created.append(alert_doc["alert_id"])
    
    # 5. PROJECT RISK ALERTS
    projects = await db.projects.find({}, {"_id": 0}).to_list(100)
    
    for proj in projects:
        # Check if project is delayed
        deadline = proj.get("deadline")
        progress = proj.get("progress", 0)
        
        if deadline:
            if isinstance(deadline, str):
                deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
            
            days_to_deadline = (deadline - now).days
            
            # If < 7 days and < 80% progress
            if days_to_deadline < 7 and progress < 80:
                existing = await db.system_alerts.find_one({
                    "entity_id": proj["project_id"],
                    "type": "project_risk",
                    "resolved": False
                }, {"_id": 0})
                
                if not existing:
                    alert_doc = {
                        "alert_id": f"alert_{uuid.uuid4().hex[:12]}",
                        "type": "project_risk",
                        "entity_type": "project",
                        "entity_id": proj["project_id"],
                        "message": f"Project at risk: {days_to_deadline} days left, {progress}% done",
                        "severity": "critical" if days_to_deadline < 3 else "warning",
                        "details": {
                            "project_name": proj.get("name"),
                            "progress": progress,
                            "days_remaining": days_to_deadline
                        },
                        "resolved": False,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    await db.system_alerts.insert_one(alert_doc)
                    alerts_created.append(alert_doc["alert_id"])
    
    return {
        "message": "Alert engine run complete",
        "alerts_created": len(alerts_created),
        "alert_ids": alerts_created
    }


@api_router.get("/admin/system-alerts")
async def get_system_alerts(
    resolved: bool = False,
    severity: Optional[str] = None,
    admin: User = Depends(require_role("admin"))
):
    """Get system alerts"""
    query = {"resolved": resolved}
    if severity:
        query["severity"] = severity
    
    alerts = await db.system_alerts.find(query, {"_id": 0}).sort("created_at", -1).to_list(100)
    return alerts


@api_router.post("/admin/system-alerts/{alert_id}/resolve")
async def resolve_alert(alert_id: str, admin: User = Depends(require_role("admin"))):
    """Resolve a system alert"""
    result = await db.system_alerts.update_one(
        {"alert_id": alert_id},
        {"$set": {
            "resolved": True,
            "resolved_by": admin.user_id,
            "resolved_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alert not found")
    
    return {"message": "Alert resolved"}


# ============ PRIORITY ENGINE ============

@api_router.post("/system/priority-engine/run")
async def run_priority_engine(admin: User = Depends(require_role("admin"))):
    """Run priority engine to auto-adjust priorities"""
    
    settings = await db.system_settings.find_one({"setting_id": "global"}, {"_id": 0})
    if not settings or not settings.get("priority_engine_enabled", True):
        return {"message": "Priority engine disabled", "updated": 0}
    
    now = datetime.now(timezone.utc)
    updated_count = 0
    updates = []
    
    all_units = await db.work_units.find(
        {"status": {"$nin": ["completed", "cancelled"]}},
        {"_id": 0}
    ).to_list(1000)
    
    for unit in all_units:
        current_priority = unit.get("priority", "normal")
        new_priority = current_priority
        reason = None
        
        # Rule 1: Stuck units get priority boost
        status_changed = unit.get("status_changed_at") or unit.get("created_at")
        if status_changed:
            if isinstance(status_changed, str):
                status_changed = datetime.fromisoformat(status_changed.replace('Z', '+00:00'))
            hours_in_status = (now - status_changed).total_seconds() / 3600
            
            if hours_in_status > 24 and current_priority == "low":
                new_priority = "normal"
                reason = "stuck_upgrade"
            elif hours_in_status > 48 and current_priority == "normal":
                new_priority = "high"
                reason = "stuck_upgrade"
        
        # Rule 2: Close to deadline
        # Check if unit's project has deadline
        project = await db.projects.find_one({"project_id": unit.get("project_id")}, {"_id": 0})
        if project and project.get("deadline"):
            deadline = project.get("deadline")
            if isinstance(deadline, str):
                deadline = datetime.fromisoformat(deadline.replace('Z', '+00:00'))
            
            days_to_deadline = (deadline - now).days
            
            if days_to_deadline < 3 and current_priority != "critical":
                new_priority = "high"
                reason = "deadline_approaching"
            elif days_to_deadline < 1 and current_priority in ["low", "normal"]:
                new_priority = "critical"
                reason = "deadline_critical"
        
        # Rule 3: Blocks deliverable
        # Check if this unit is part of a pending deliverable
        deliverable = await db.deliverables.find_one({
            "blocks.work_unit_ids": unit["unit_id"],
            "status": "pending"
        }, {"_id": 0})
        
        if deliverable and current_priority in ["low", "normal"]:
            new_priority = "high"
            reason = "blocks_deliverable"
        
        # Apply update if priority changed
        if new_priority != current_priority:
            await db.work_units.update_one(
                {"unit_id": unit["unit_id"]},
                {"$set": {
                    "priority": new_priority,
                    "priority_auto_updated": True,
                    "priority_reason": reason,
                    "priority_updated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
            
            # Log history
            await db.work_unit_history.insert_one({
                "history_id": f"hist_{uuid.uuid4().hex[:12]}",
                "unit_id": unit["unit_id"],
                "action": "priority_change",
                "old_priority": current_priority,
                "new_priority": new_priority,
                "reason": reason,
                "changed_by": "SYSTEM_AUTO",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
            
            updated_count += 1
            updates.append({
                "unit_id": unit["unit_id"],
                "old": current_priority,
                "new": new_priority,
                "reason": reason
            })
            
            logger.info(f"PRIORITY: {unit['unit_id']} {current_priority} -> {new_priority} ({reason})")
    
    return {
        "message": "Priority engine run complete",
        "updated": updated_count,
        "updates": updates
    }


# ============ COMBINED SYSTEM RUN ============

@api_router.post("/system/run-all")
async def run_all_system_engines(admin: User = Depends(require_role("admin"))):
    """Run all system engines in sequence"""
    
    results = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "engines": {}
    }
    
    # 1. Run priority engine first
    try:
        priority_result = await run_priority_engine(admin)
        results["engines"]["priority"] = priority_result
    except Exception as e:
        results["engines"]["priority"] = {"error": str(e)}
    
    # 2. Run alert engine
    try:
        alert_result = await run_alert_engine(admin)
        results["engines"]["alert"] = alert_result
    except Exception as e:
        results["engines"]["alert"] = {"error": str(e)}
    
    # 3. Run auto-assignment
    try:
        assignment_result = await run_auto_assignment(admin)
        results["engines"]["assignment"] = assignment_result
    except Exception as e:
        results["engines"]["assignment"] = {"error": str(e)}
    
    return results


fastapi_app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)


# ============ PROVIDER INBOX + PRESSURE ENGINE ============
# Uber-like marketplace for auto services

# Provider Model
class ProviderProfile(BaseModel):
    provider_id: str
    user_id: str
    name: str
    phone: Optional[str] = None
    services: List[str] = []  # oil_change, diagnostics, tire_change, etc.
    location: Optional[dict] = None  # {lat, lng}
    radius_km: float = 10.0
    status: str = "offline"  # offline, online, busy, on_route
    quick_mode: bool = False
    behavioral_score: int = 50
    tier: str = "Bronze"  # Bronze, Silver, Gold, Platinum
    stats: dict = {}
    created_at: str


# Service Request Model (customer request)
class ServiceRequest(BaseModel):
    request_id: str
    customer_id: str
    customer_name: str
    customer_phone: Optional[str] = None
    service_type: str
    description: str
    location: dict  # {lat, lng, address}
    urgency: str = "normal"  # normal, urgent, emergency
    estimated_price: float = 0
    status: str = "pending"  # pending, distributed, accepted, in_progress, completed, cancelled
    selected_provider_id: Optional[str] = None
    distributed_to: List[str] = []  # provider_ids
    expires_at: Optional[str] = None
    created_at: str


@api_router.get("/provider/profile")
async def get_provider_profile(user: User = Depends(get_current_user)):
    """Get provider profile"""
    profile = await db.providers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not profile:
        # Create default profile
        profile = {
            "provider_id": f"prov_{uuid.uuid4().hex[:12]}",
            "user_id": user.user_id,
            "name": user.name,
            "phone": None,
            "services": [],
            "location": None,
            "radius_km": 10.0,
            "status": "offline",
            "quick_mode": False,
            "behavioral_score": 50,
            "tier": "Bronze",
            "stats": {
                "today_requests": 0,
                "today_accepted": 0,
                "today_missed": 0,
                "lost_revenue": 0,
                "avg_response_time": 0,
                "total_completed": 0
            },
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.providers.insert_one(profile)
        if "_id" in profile:
            del profile["_id"]
    return profile


@api_router.post("/provider/status")
async def update_provider_status(
    status: str = Body(...),
    location: Optional[dict] = Body(None),
    user: User = Depends(get_current_user)
):
    """Update provider online status"""
    valid_statuses = ["offline", "online", "busy", "on_route"]
    if status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status: {valid_statuses}")
    
    update_data = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if location:
        update_data["location"] = location
    
    await db.providers.update_one(
        {"user_id": user.user_id},
        {"$set": update_data},
        upsert=True
    )
    
    logger.info(f"PROVIDER STATUS: {user.user_id} -> {status}")
    return {"message": f"Status updated to {status}"}


@api_router.post("/provider/quick-mode")
async def toggle_quick_mode(
    enabled: bool = Body(...),
    user: User = Depends(get_current_user)
):
    """Toggle quick mode (auto-accept)"""
    # Check if provider is eligible (score > 70)
    provider = await db.providers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    if enabled and provider.get("behavioral_score", 0) < 70:
        raise HTTPException(status_code=400, detail="Quick mode requires behavioral score > 70")
    
    await db.providers.update_one(
        {"user_id": user.user_id},
        {"$set": {"quick_mode": enabled}}
    )
    
    return {"message": f"Quick mode {'enabled' if enabled else 'disabled'}"}


@api_router.get("/provider/inbox")
async def get_provider_inbox(user: User = Depends(get_current_user)):
    """Get live requests for provider"""
    provider = await db.providers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not provider:
        return {"requests": [], "message": "Provider profile not found"}
    
    if provider.get("status") == "offline":
        return {"requests": [], "message": "You are offline"}
    
    now = datetime.now(timezone.utc)
    provider_location = provider.get("location", {})
    radius = provider.get("radius_km", 10.0)
    
    # Get distributed requests for this provider
    requests = await db.service_requests.find({
        "distributed_to": user.user_id,
        "status": {"$in": ["distributed", "pending"]},
        "selected_provider_id": None
    }, {"_id": 0}).to_list(50)
    
    result = []
    for req in requests:
        # Calculate distance
        req_location = req.get("location", {})
        distance_km = calculate_distance(
            provider_location.get("lat", 0), provider_location.get("lng", 0),
            req_location.get("lat", 0), req_location.get("lng", 0)
        )
        
        # Check expiration
        expires_at = req.get("expires_at")
        if expires_at:
            exp_time = datetime.fromisoformat(expires_at.replace('Z', '+00:00'))
            expires_in = int((exp_time - now).total_seconds())
            if expires_in <= 0:
                continue  # Skip expired
        else:
            expires_in = 30  # Default 30 sec
        
        # Calculate priority score
        urgency_score = {"emergency": 1.0, "urgent": 0.7, "normal": 0.3}.get(req.get("urgency", "normal"), 0.3)
        distance_score = max(0, 1 - (distance_km / radius))
        price_score = min(1, req.get("estimated_price", 0) / 5000)
        
        priority_score = round(
            urgency_score * 0.4 +
            distance_score * 0.3 +
            price_score * 0.2 +
            0.1,  # base
            2
        )
        
        # Generate matching reasons
        reasons = []
        if distance_km < 2:
            reasons.append("рядом")
        if provider.get("status") == "online":
            reasons.append("свободен сейчас")
        if provider.get("behavioral_score", 0) >= 70:
            reasons.append("высокий рейтинг")
        
        result.append({
            "request_id": req["request_id"],
            "service_type": req.get("service_type", "Услуга"),
            "description": req.get("description", ""),
            "customer_name": req.get("customer_name", "Клиент"),
            "location": req_location,
            "address": req_location.get("address", ""),
            "distance_km": round(distance_km, 1),
            "eta_minutes": int(distance_km * 3),  # ~3 min per km
            "urgency": req.get("urgency", "normal"),
            "estimated_price": req.get("estimated_price", 0),
            "priority_score": priority_score,
            "expires_in": expires_in,
            "reasons": reasons,
            "status": req.get("status"),
            "created_at": req.get("created_at")
        })
    
    # Sort by priority (highest first)
    result.sort(key=lambda x: (-x["priority_score"], x["expires_in"]))
    
    return {"requests": result}


@api_router.post("/provider/requests/{request_id}/accept")
async def accept_request(request_id: str, user: User = Depends(get_current_user)):
    """Accept a service request"""
    
    # Get request
    req = await db.service_requests.find_one({"request_id": request_id}, {"_id": 0})
    if not req:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Check if already taken
    if req.get("selected_provider_id"):
        return {"success": False, "message": "already_taken", "taken_by": req["selected_provider_id"]}
    
    # Check if provider is in distributed list
    if user.user_id not in req.get("distributed_to", []):
        raise HTTPException(status_code=403, detail="Request not distributed to you")
    
    now = datetime.now(timezone.utc)
    
    # Update request
    await db.service_requests.update_one(
        {"request_id": request_id, "selected_provider_id": None},
        {"$set": {
            "selected_provider_id": user.user_id,
            "status": "accepted",
            "accepted_at": now.isoformat()
        }}
    )
    
    # Create booking
    booking_doc = {
        "booking_id": f"bkg_{uuid.uuid4().hex[:12]}",
        "request_id": request_id,
        "customer_id": req.get("customer_id"),
        "provider_id": user.user_id,
        "service_type": req.get("service_type"),
        "estimated_price": req.get("estimated_price"),
        "status": "confirmed",
        "created_at": now.isoformat()
    }
    await db.bookings.insert_one(booking_doc)
    
    # Update provider stats
    await db.providers.update_one(
        {"user_id": user.user_id},
        {
            "$set": {"status": "busy"},
            "$inc": {
                "stats.today_accepted": 1,
                "behavioral_score": 10  # +10 for fast accept
            }
        }
    )
    
    # Update tier
    await update_provider_tier(user.user_id)
    
    logger.info(f"REQUEST ACCEPTED: {request_id} by {user.user_id}")
    
    return {
        "success": True,
        "message": "accepted",
        "booking_id": booking_doc["booking_id"],
        "customer": {
            "name": req.get("customer_name"),
            "phone": req.get("customer_phone"),
            "location": req.get("location")
        }
    }


@api_router.post("/provider/requests/{request_id}/reject")
async def reject_request(request_id: str, user: User = Depends(get_current_user)):
    """Reject/skip a service request"""
    
    # Remove from distributed list
    await db.service_requests.update_one(
        {"request_id": request_id},
        {"$pull": {"distributed_to": user.user_id}}
    )
    
    # Get request price for lost revenue
    req = await db.service_requests.find_one({"request_id": request_id}, {"_id": 0})
    lost = req.get("estimated_price", 0) if req else 0
    
    # Update provider stats
    await db.providers.update_one(
        {"user_id": user.user_id},
        {
            "$inc": {
                "stats.today_missed": 1,
                "stats.lost_revenue": lost,
                "behavioral_score": -5  # -5 for reject
            }
        }
    )
    
    # Add to missed history
    await db.provider_missed.insert_one({
        "provider_id": user.user_id,
        "request_id": request_id,
        "lost_revenue": lost,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Update tier
    await update_provider_tier(user.user_id)
    
    return {"success": True, "message": "rejected"}


@api_router.get("/provider/pressure")
async def get_provider_pressure(user: User = Depends(get_current_user)):
    """Get pressure/behavioral data for provider"""
    provider = await db.providers.find_one({"user_id": user.user_id}, {"_id": 0})
    if not provider:
        return {"error": "Provider not found"}
    
    stats = provider.get("stats", {})
    score = provider.get("behavioral_score", 50)
    
    # Calculate tier
    tier = calculate_tier(score)
    
    # Generate tips
    tips = []
    if stats.get("today_missed", 0) > 3:
        tips.append("Ты пропускаешь много заявок. Это снижает твой рейтинг.")
    if score < 70:
        tips.append("Отвечай быстрее, чтобы повысить свой tier.")
    if stats.get("avg_response_time", 0) > 30:
        tips.append("Твоё среднее время ответа слишком большое.")
    if provider.get("status") == "offline":
        tips.append("Ты оффлайн, а рядом есть заявки!")
    
    # Check nearby requests count
    nearby_count = await db.service_requests.count_documents({
        "status": {"$in": ["pending", "distributed"]},
        "selected_provider_id": None
    })
    
    return {
        "score": score,
        "tier": tier,
        "stats": {
            "today_requests": stats.get("today_requests", 0),
            "today_accepted": stats.get("today_accepted", 0),
            "today_missed": stats.get("today_missed", 0),
            "lost_revenue": stats.get("lost_revenue", 0),
            "avg_response_time": stats.get("avg_response_time", 0),
            "nearby_requests": nearby_count
        },
        "tips": tips,
        "quick_mode_available": score >= 70,
        "quick_mode_enabled": provider.get("quick_mode", False)
    }


@api_router.get("/provider/missed")
async def get_provider_missed(user: User = Depends(get_current_user)):
    """Get missed requests history"""
    missed = await db.provider_missed.find(
        {"provider_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(20).to_list(20)
    
    # Enrich with request data
    for m in missed:
        req = await db.service_requests.find_one({"request_id": m.get("request_id")}, {"_id": 0})
        if req:
            m["service_type"] = req.get("service_type")
            m["location"] = req.get("location", {})
            m["estimated_price"] = req.get("estimated_price", 0)
    
    total_lost = sum(m.get("lost_revenue", 0) for m in missed)
    
    return {
        "missed": missed,
        "total_lost_revenue": total_lost,
        "count": len(missed)
    }


# Helper functions
def calculate_distance(lat1, lng1, lat2, lng2):
    """Calculate distance in km (simplified)"""
    import math
    if not all([lat1, lng1, lat2, lng2]):
        return 999
    
    R = 6371  # Earth's radius in km
    dlat = math.radians(lat2 - lat1)
    dlng = math.radians(lng2 - lng1)
    a = math.sin(dlat/2)**2 + math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) * math.sin(dlng/2)**2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
    return R * c


def calculate_tier(score):
    """Calculate tier based on behavioral score"""
    if score >= 85:
        return "Platinum"
    elif score >= 70:
        return "Gold"
    elif score >= 50:
        return "Silver"
    else:
        return "Bronze"


async def update_provider_tier(user_id):
    """Update provider tier based on score"""
    provider = await db.providers.find_one({"user_id": user_id}, {"_id": 0})
    if provider:
        score = provider.get("behavioral_score", 50)
        # Clamp score 0-100
        score = max(0, min(100, score))
        tier = calculate_tier(score)
        await db.providers.update_one(
            {"user_id": user_id},
            {"$set": {"behavioral_score": score, "tier": tier}}
        )


# ============ SERVICE REQUEST DISTRIBUTION ============

@api_router.post("/requests/service")
async def create_service_request(
    service_type: str = Body(...),
    description: str = Body(""),
    location: dict = Body(...),
    urgency: str = Body("normal"),
    estimated_price: float = Body(0),
    user: User = Depends(get_current_user)
):
    """Create a new service request (customer)"""
    
    request_id = f"sreq_{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc)
    expires_at = (now + timedelta(seconds=30)).isoformat()
    
    request_doc = {
        "request_id": request_id,
        "customer_id": user.user_id,
        "customer_name": user.name,
        "customer_phone": None,
        "service_type": service_type,
        "description": description,
        "location": location,
        "urgency": urgency,
        "estimated_price": estimated_price,
        "status": "pending",
        "selected_provider_id": None,
        "distributed_to": [],
        "expires_at": expires_at,
        "created_at": now.isoformat()
    }
    await db.service_requests.insert_one(request_doc)
    
    # Auto-distribute to nearby providers
    distributed_count = await distribute_request_to_providers(request_id, location)
    
    logger.info(f"SERVICE REQUEST: {request_id} created, distributed to {distributed_count} providers")
    
    return {
        "request_id": request_id,
        "status": "distributed" if distributed_count > 0 else "pending",
        "distributed_to_count": distributed_count,
        "expires_in": 30
    }


async def distribute_request_to_providers(request_id: str, location: dict):
    """Distribute request to nearby online providers"""
    
    # Get online providers
    providers = await db.providers.find({
        "status": {"$in": ["online"]},
        "location": {"$ne": None}
    }, {"_id": 0}).to_list(100)
    
    request_lat = location.get("lat", 0)
    request_lng = location.get("lng", 0)
    
    distributed_to = []
    
    for provider in providers:
        prov_location = provider.get("location", {})
        distance = calculate_distance(
            request_lat, request_lng,
            prov_location.get("lat", 0), prov_location.get("lng", 0)
        )
        
        # Check if within radius
        if distance <= provider.get("radius_km", 10):
            distributed_to.append(provider["user_id"])
            
            # Check quick mode
            if provider.get("quick_mode"):
                # Auto-accept for quick mode providers
                await db.service_requests.update_one(
                    {"request_id": request_id, "selected_provider_id": None},
                    {"$set": {
                        "selected_provider_id": provider["user_id"],
                        "status": "accepted"
                    }}
                )
                # Create booking
                req = await db.service_requests.find_one({"request_id": request_id}, {"_id": 0})
                booking_doc = {
                    "booking_id": f"bkg_{uuid.uuid4().hex[:12]}",
                    "request_id": request_id,
                    "customer_id": req.get("customer_id"),
                    "provider_id": provider["user_id"],
                    "service_type": req.get("service_type"),
                    "estimated_price": req.get("estimated_price"),
                    "status": "confirmed",
                    "auto_accepted": True,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }
                await db.bookings.insert_one(booking_doc)
                await db.providers.update_one(
                    {"user_id": provider["user_id"]},
                    {"$set": {"status": "busy"}, "$inc": {"stats.today_accepted": 1}}
                )
                logger.info(f"QUICK MODE: {request_id} auto-accepted by {provider['user_id']}")
                return 1  # Only one provider gets it
    
    # Update request with distributed providers
    if distributed_to:
        await db.service_requests.update_one(
            {"request_id": request_id},
            {"$set": {"distributed_to": distributed_to, "status": "distributed"}}
        )
    
    return len(distributed_to)


@api_router.get("/customer/requests")
async def get_customer_requests(user: User = Depends(get_current_user)):
    """Get customer's service requests"""
    requests = await db.service_requests.find(
        {"customer_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with provider info
    for req in requests:
        if req.get("selected_provider_id"):
            provider = await db.providers.find_one(
                {"user_id": req["selected_provider_id"]},
                {"_id": 0, "name": 1, "phone": 1, "location": 1}
            )
            req["provider"] = provider
    
    return requests


@api_router.get("/customer/bookings")
async def get_customer_bookings(user: User = Depends(get_current_user)):
    """Get customer's bookings"""
    bookings = await db.bookings.find(
        {"customer_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    # Enrich with provider info
    for booking in bookings:
        if booking.get("provider_id"):
            provider = await db.providers.find_one(
                {"user_id": booking["provider_id"]},
                {"_id": 0, "name": 1, "phone": 1, "behavioral_score": 1, "tier": 1}
            )
            booking["provider"] = provider
    
    return bookings


# Seed mock providers for testing
@fastapi_app.on_event("startup")
async def seed_mock_providers():
    """Seed mock providers for testing"""
    count = await db.providers.count_documents({})
    if count == 0:
        mock_providers = [
            {
                "provider_id": f"prov_{uuid.uuid4().hex[:12]}",
                "user_id": f"user_provider_1",
                "name": "Олександр (СТО)",
                "phone": "+380501234567",
                "services": ["oil_change", "diagnostics", "tire_change"],
                "location": {"lat": 50.4501, "lng": 30.5234},  # Kyiv center
                "radius_km": 15.0,
                "status": "online",
                "quick_mode": False,
                "behavioral_score": 78,
                "tier": "Gold",
                "stats": {"today_requests": 12, "today_accepted": 8, "today_missed": 4, "lost_revenue": 2400},
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "provider_id": f"prov_{uuid.uuid4().hex[:12]}",
                "user_id": f"user_provider_2",
                "name": "Максим (Виїзний майстер)",
                "phone": "+380507654321",
                "services": ["battery", "tow", "emergency"],
                "location": {"lat": 50.4547, "lng": 30.5138},
                "radius_km": 20.0,
                "status": "online",
                "quick_mode": True,
                "behavioral_score": 92,
                "tier": "Platinum",
                "stats": {"today_requests": 18, "today_accepted": 16, "today_missed": 2, "lost_revenue": 800},
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.providers.insert_many(mock_providers)
        logger.info("Seeded mock providers")


@fastapi_app.on_event("startup")
async def startup_event():
    """Seed initial data on startup"""
    # Seed portfolio cases if empty
    cases_count = await db.portfolio_cases.count_documents({})
    if cases_count == 0:
        mock_cases = [
            {
                "case_id": f"case_{uuid.uuid4().hex[:12]}",
                "title": "E-Commerce Marketplace Platform",
                "description": "Full-stack marketplace with real-time inventory, payment processing, and analytics dashboard",
                "client_name": "TechRetail Inc.",
                "industry": "E-Commerce",
                "product_type": "web_app",
                "technologies": ["React", "Node.js", "PostgreSQL", "Stripe", "AWS"],
                "results": "300% increase in conversion rate, 50% reduction in cart abandonment",
                "testimonial": "Development OS transformed our digital presence. The platform exceeded expectations.",
                "image_url": "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=800",
                "featured": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "case_id": f"case_{uuid.uuid4().hex[:12]}",
                "title": "Healthcare Management System",
                "description": "HIPAA-compliant patient management system with telemedicine integration",
                "client_name": "MedCare Solutions",
                "industry": "Healthcare",
                "product_type": "web_app",
                "technologies": ["Vue.js", "Python", "MongoDB", "WebRTC", "GCP"],
                "results": "40% improvement in patient scheduling efficiency, 99.9% uptime",
                "testimonial": "The team delivered a complex healthcare solution with impeccable security standards.",
                "image_url": "https://images.unsplash.com/photo-1576091160399-112ba8d25d1f?w=800",
                "featured": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "case_id": f"case_{uuid.uuid4().hex[:12]}",
                "title": "Fintech Trading Dashboard",
                "description": "Real-time trading platform with advanced charting and portfolio analytics",
                "client_name": "Alpha Investments",
                "industry": "Finance",
                "product_type": "dashboard",
                "technologies": ["React", "Go", "TimescaleDB", "WebSocket", "Kubernetes"],
                "results": "Sub-100ms latency, handling 10K+ concurrent users",
                "testimonial": "Exceptional performance and reliability. Our traders love the interface.",
                "image_url": "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=800",
                "featured": True,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "case_id": f"case_{uuid.uuid4().hex[:12]}",
                "title": "AI-Powered Content Platform",
                "description": "Content management system with AI-driven recommendations and analytics",
                "client_name": "MediaFlow",
                "industry": "Media",
                "product_type": "web_app",
                "technologies": ["Next.js", "Python", "OpenAI", "Redis", "Vercel"],
                "results": "200% increase in user engagement, 45% longer session duration",
                "testimonial": "The AI integration has revolutionized how we deliver content to our audience.",
                "image_url": "https://images.unsplash.com/photo-1677442136019-21780ecad995?w=800",
                "featured": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            },
            {
                "case_id": f"case_{uuid.uuid4().hex[:12]}",
                "title": "Logistics Tracking System",
                "description": "End-to-end supply chain visibility platform with IoT integration",
                "client_name": "GlobalShip",
                "industry": "Logistics",
                "product_type": "web_app",
                "technologies": ["React", "Node.js", "PostgreSQL", "IoT Hub", "Azure"],
                "results": "60% reduction in delivery delays, real-time tracking for 100K+ shipments",
                "testimonial": "Complete visibility across our supply chain. Game-changing platform.",
                "image_url": "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=800",
                "featured": False,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
        ]
        await db.portfolio_cases.insert_many(mock_cases)
        logger.info("Seeded portfolio cases")
    
    # Create admin user if not exists
    admin_exists = await db.users.find_one({"email": "admin@devos.io"}, {"_id": 0})
    if not admin_exists:
        admin_doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": "admin@devos.io",
            "name": "Platform Admin",
            "picture": None,
            "role": "admin",
            "skills": ["management", "architecture", "review"],
            "level": "senior",
            "rating": 5.0,
            "completed_tasks": 0,
            "active_load": 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(admin_doc)
        logger.info("Created admin user")


@fastapi_app.on_event("shutdown")
async def shutdown_db_client():
    client.close()


# ============ AI PROJECT ANALYSIS ============
class AIAnalysisRequest(BaseModel):
    idea: str
    request_id: Optional[str] = None

class AIFeature(BaseModel):
    name: str
    description: str
    hours: int

class AIAnalysisResponse(BaseModel):
    features: List[AIFeature]
    timeline: Dict[str, str]
    cost: Dict[str, Any]

@api_router.post("/ai/analyze-project")
async def analyze_project_with_ai(request: AIAnalysisRequest):
    """Use AI to analyze a project idea and generate features, timeline, and cost"""
    from emergentintegrations.llm.chat import LlmChat, UserMessage
    import json
    
    api_key = os.environ.get('EMERGENT_LLM_KEY')
    if not api_key:
        raise HTTPException(status_code=500, detail="AI service not configured")
    
    try:
        chat = LlmChat(
            api_key=api_key,
            session_id=f"project-analysis-{request.request_id or uuid.uuid4().hex[:8]}",
            system_message="""You are a senior software architect and project estimator with 15+ years of experience.
Your task is to provide DETAILED and REALISTIC project estimates.

IMPORTANT ESTIMATION RULES:
1. Be thorough - break down into ALL necessary features, not just main ones
2. Include: authentication, admin panels, testing, deployment setup, documentation
3. Include backend AND frontend hours separately for each feature
4. Consider: database design, API development, UI/UX, integrations, security
5. Typical feature hours: Simple (8-16h), Medium (20-40h), Complex (50-100h)
6. Include buffer time (15-20%) for bug fixes and iterations
7. A typical MVP takes 300-800 hours depending on complexity

Always respond with valid JSON only, no markdown, no explanations.
The JSON must have this exact structure:
{
  "features": [
    {"name": "Feature Name", "description": "Detailed description", "hours": 40}
  ],
  "timeline": {
    "design": "X week(s)",
    "development": "X-Y weeks", 
    "testing": "X week(s)",
    "total": "X-Y weeks"
  },
  "cost": {
    "total_hours": 500,
    "hourly_rate": 50,
    "min": 22500,
    "max": 27500,
    "currency": "USD"
  },
  "complexity": "low|medium|high",
  "team_size": "1-2 developers"
}

Cost calculation: 
- min = total_hours * hourly_rate * 0.9
- max = total_hours * hourly_rate * 1.1
Use $50/hour as default rate."""
        ).with_model("openai", "gpt-4o")
        
        user_message = UserMessage(
            text=f"""Analyze this project idea and provide a DETAILED JSON breakdown.
Be thorough - include ALL features needed for a production-ready product.
Consider: frontend, backend, database, auth, admin, integrations, testing, deployment.

PROJECT IDEA:
{request.idea}

Respond with JSON only. Be realistic with hours - don't underestimate."""
        )
        
        response = await chat.send_message(user_message)
        
        # Parse JSON from response
        clean_response = response.strip()
        if clean_response.startswith("```"):
            clean_response = clean_response.split("```")[1]
            if clean_response.startswith("json"):
                clean_response = clean_response[4:]
        clean_response = clean_response.strip()
        
        try:
            result = json.loads(clean_response)
        except json.JSONDecodeError:
            import re
            json_match = re.search(r'\{[\s\S]*\}', response)
            if json_match:
                result = json.loads(json_match.group())
            else:
                raise HTTPException(status_code=500, detail="Failed to parse AI response")
        
        # Ensure cost calculation with 3 tiers
        if 'features' in result:
            total_hours = sum(f.get('hours', 0) for f in result['features'])
            
            # 3 pricing tiers (rates hidden from user)
            market_rate = 44  # Average market rate
            premium_rate = 25  # Our premium quality rate
            optimized_rate = 15  # Optimized with trade-offs
            
            result['cost'] = {
                'total_hours': total_hours,
                'market_average': {
                    'min': int(total_hours * market_rate * 0.9),
                    'max': int(total_hours * market_rate * 1.1),
                    'label': 'Market Average'
                },
                'premium_quality': {
                    'min': int(total_hours * premium_rate * 0.9),
                    'max': int(total_hours * premium_rate * 1.1),
                    'label': 'Premium Quality'
                },
                'optimized': {
                    'min': int(total_hours * optimized_rate * 0.9),
                    'max': int(total_hours * optimized_rate * 1.1),
                    'label': 'Optimized'
                },
                'currency': 'USD'
            }
        
        return result
        
    except Exception as e:
        logger.error(f"AI analysis error: {str(e)}")
        raise HTTPException(status_code=500, detail=f"AI analysis failed: {str(e)}")


# Include the router in the main app (MUST be at the end after all routes defined)
fastapi_app.include_router(api_router)
