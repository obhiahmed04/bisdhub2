from fastapi import FastAPI, APIRouter, HTTPException, WebSocket, WebSocketDisconnect, Query, Depends, UploadFile, File
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
from pathlib import Path
import re
from pydantic import BaseModel, EmailStr, Field, ConfigDict
from typing import List, Optional, Dict, Any
import uuid
from datetime import datetime, timezone, timedelta
import bcrypt
import jwt
import asyncio
import resend
import random
import shutil
import aiofiles

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# Resend API setup
resend.api_key = os.getenv('RESEND_API_KEY', '')
SENDER_EMAIL = os.getenv('SENDER_EMAIL', 'onboarding@resend.dev')

# JWT settings
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key-change-in-production')
JWT_ALGORITHM = 'HS256'

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer()

# File upload directory
UPLOAD_DIR = Path(__file__).parent / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)

# Logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# Dev/test user helpers
def _make_full_user_doc(
    id_number: str,
    password: str,
    full_name: str,
    role: str = "user",
    *,
    is_admin: bool = False,
    is_moderator: bool = False,
    badges: Optional[List[str]] = None,
    current_status: Optional[str] = None,
    current_class: str = "12",
    section: str = "A",
    is_ex_student: bool = False,
) -> Dict[str, Any]:
    password_hash = bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    safe_name = (full_name or id_number).strip()
    parts = safe_name.split()
    display_name = f"{parts[0]} {parts[-1]}" if len(parts) > 1 else safe_name
    email_local = re.sub(r"[^a-zA-Z0-9]+", "", id_number.lower()) or "user"

    role_badges = badges[:] if badges else []
    lower_badges = [b.lower() for b in role_badges]

    if role and role.lower() not in lower_badges:
        role_badges.append(role)
        lower_badges.append(role.lower())

    if is_admin and "admin" not in lower_badges:
        role_badges.append("admin")

    now = datetime.now(timezone.utc)

    return {
        "user_id": str(uuid.uuid4()),
        "id_number": id_number,
        "full_name": safe_name,
        "display_name": display_name,
        "date_of_birth": "2000-01-01",
        "current_class": current_class,
        "section": section,
        "email": f"{email_local}@example.com",
        "phone_number": None,
        "is_ex_student": is_ex_student,
        "date_of_leaving": "2024-01-01" if is_ex_student else None,
        "last_class": "12" if is_ex_student else None,
        "current_status": current_status or ("alumni" if is_ex_student else "student"),
        "password_hash": password_hash,
        "profile_picture": "",
        "banner_image": "",
        "bio": f"{role} account for testing",
        "badges": role_badges,
        "role": role,
        "is_profile_public": True,
        "is_followers_public": True,
        "is_following_public": True,
        "is_friends_public": True,
        "is_admin": is_admin,
        "is_moderator": is_moderator,
        "is_banned": False,
        "is_muted": False,
        "ban_reason": None,
        "mute_until": None,
        "registration_status": "approved",
        "push_notifications_enabled": True,
        "created_at": now.isoformat(),
        "followers": [],
        "following": [],
        "friends": [],
        "friend_requests_sent": [],
        "friend_requests_received": []
    }


def _normalize_user_doc(user: Optional[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    if not user:
        return user

    normalized = dict(user)

    normalized.setdefault("user_id", str(uuid.uuid4()))
    normalized.setdefault("id_number", "UNKNOWN001")
    normalized.setdefault("full_name", normalized.get("display_name") or normalized.get("id_number", "User"))
    normalized.setdefault("display_name", normalized.get("full_name") or normalized.get("id_number", "User"))
    normalized.setdefault("date_of_birth", "2000-01-01")
    normalized.setdefault("current_class", "12")
    normalized.setdefault("section", "A")

    id_local = re.sub(
        r"[^a-zA-Z0-9]+",
        "",
        str(normalized.get("id_number", "user")).lower()
    ) or "user"

    email_value = normalized.get("email")
    if not isinstance(email_value, str) or "@" not in email_value or email_value.endswith(".test"):
        normalized["email"] = f"{id_local}@example.com"

    normalized.setdefault("phone_number", None)
    normalized.setdefault("is_ex_student", False)
    normalized.setdefault("date_of_leaving", None)
    normalized.setdefault("last_class", None)
    normalized.setdefault("current_status", "student")
    normalized.setdefault("profile_picture", "")
    normalized.setdefault("banner_image", "")
    normalized.setdefault("bio", "")
    normalized.setdefault("badges", [])
    normalized.setdefault("role", "user")
    normalized.setdefault("is_profile_public", True)
    normalized.setdefault("is_followers_public", True)
    normalized.setdefault("is_following_public", True)
    normalized.setdefault("is_friends_public", True)
    normalized.setdefault("show_age", True)
    normalized.setdefault("follow_requests_received", [])
    normalized.setdefault("is_admin", False)
    normalized.setdefault("is_moderator", False)
    normalized.setdefault("is_banned", False)
    normalized.setdefault("is_muted", False)
    normalized.setdefault("ban_reason", None)
    normalized.setdefault("mute_until", None)
    normalized.setdefault("registration_status", "approved")
    normalized.setdefault("push_notifications_enabled", True)
    normalized.setdefault("followers", [])
    normalized.setdefault("following", [])
    normalized.setdefault("friends", [])
    normalized.setdefault("friend_requests_sent", [])
    normalized.setdefault("friend_requests_received", [])
    normalized.setdefault("username_history", [])
    normalized.setdefault("username_last_changed", None)
    normalized.setdefault("is_friends_public", True)
    normalized.setdefault("show_age", True)
    normalized.setdefault("follow_requests_received", [])

    created_at = normalized.get("created_at")
    if isinstance(created_at, str):
        try:
            normalized["created_at"] = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except Exception:
            normalized["created_at"] = datetime.now(timezone.utc)
    elif created_at is None:
        normalized["created_at"] = datetime.now(timezone.utc)

    return normalized


TEST_USERS = [
    {"id_number": "ADMIN001", "password": "admin123", "role": "Administrator", "full_name": "Administrator", "is_admin": True},
    {"id_number": "OWNER001", "password": "owner123", "role": "Project Owner", "full_name": "Project Owner", "is_admin": True, "is_moderator": True, "is_ex_student": True},
    {"id_number": "MGMT001", "password": "management123", "role": "Management", "full_name": "Management", "is_admin": True},
    {"id_number": "CM001", "password": "cm123", "role": "Community Manager", "full_name": "Community Manager", "is_admin": True},
    {"id_number": "COS001", "password": "cos123", "role": "Chief of Staff", "full_name": "Chief of Staff", "is_admin": True},
    {"id_number": "CA001", "password": "ca123", "role": "Chief Administrator", "full_name": "Chief Administrator", "is_admin": True},
    {"id_number": "HA001", "password": "ha123", "role": "Head Administrator", "full_name": "Head Administrator", "is_admin": True},
    {"id_number": "ADMIN002", "password": "admin2123", "role": "Administrator", "full_name": "Administrator Two", "is_admin": True},
    {"id_number": "CMOD001", "password": "cmod123", "role": "Chief Moderator", "full_name": "Chief Moderator", "is_moderator": True},
    {"id_number": "HMOD001", "password": "hmod123", "role": "Head Moderator", "full_name": "Head Moderator", "is_moderator": True},
    {"id_number": "MOD001", "password": "mod123", "role": "Moderator", "full_name": "Moderator", "is_moderator": True},
    {"id_number": "USER001", "password": "user123", "role": "user", "full_name": "Test User"},
]

@app.get("/dev/create-owner")
async def create_owner_dev():
    owner = next(u for u in TEST_USERS if u["id_number"] == "OWNER001")
    doc = await asyncio.to_thread(_make_full_user_doc, **owner)
    await db.users.update_one({"id_number": owner["id_number"]}, {"$set": doc}, upsert=True)
    return {"status": "owner created", "login": "OWNER001 / owner123"}

@app.get("/dev/create-admin")
async def create_admin_dev():
    admin = next(u for u in TEST_USERS if u["id_number"] == "ADMIN001")
    doc = await asyncio.to_thread(_make_full_user_doc, **admin)
    await db.users.update_one({"id_number": admin["id_number"]}, {"$set": doc}, upsert=True)
    return {"status": "admin created", "login": "ADMIN001 / admin123"}

@app.get("/dev/create-test-users")
async def create_test_users_dev():
    try:
        results = []
        for spec in TEST_USERS:
            doc = await asyncio.to_thread(_make_full_user_doc, **spec)
            await db.users.update_one({"id_number": spec["id_number"]}, {"$set": doc}, upsert=True)
            results.append({"id_number": spec["id_number"], "password": spec["password"], "role": spec["role"], "status": "upserted"})
        return {"status": "test users ready", "accounts": results}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# WebSocket connection manager
# WebSocket connection manager
class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.user_rooms: Dict[str, set] = {}  # user_id -> set of rooms

    async def connect(self, user_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_connections[user_id] = websocket
        self.user_rooms[user_id] = set()

    def disconnect(self, user_id: str):
        if user_id in self.active_connections:
            del self.active_connections[user_id]
        if user_id in self.user_rooms:
            del self.user_rooms[user_id]

    def join_room(self, user_id: str, room: str):
        if user_id not in self.user_rooms:
            self.user_rooms[user_id] = set()
        self.user_rooms[user_id].add(room)

    async def send_personal_message(self, message: dict, user_id: str):
        if user_id in self.active_connections:
            try:
                await self.active_connections[user_id].send_json(message)
            except Exception:
                pass

    async def broadcast_to_room(self, message: dict, chat_room: str):
        for user_id, rooms in self.user_rooms.items():
            if chat_room in rooms and user_id in self.active_connections:
                try:
                    await self.active_connections[user_id].send_json(message)
                except Exception:
                    pass

manager = ConnectionManager()

# ============= MODELS =============

class RegistrationRequest(BaseModel):
    id_number: str
    full_name: str
    username: Optional[str] = None       # User-chosen username
    password: Optional[str] = None       # User-set password (stored as hash)
    date_of_birth: str
    current_class: str
    section: str
    email: EmailStr
    phone_number: Optional[str] = None
    is_ex_student: bool
    date_of_leaving: Optional[str] = None
    last_class: Optional[str] = None
    current_status: Optional[str] = None

class Registration(BaseModel):
    model_config = ConfigDict(extra="ignore")
    reg_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    id_number: str
    full_name: str
    date_of_birth: str
    current_class: str
    section: str
    email: EmailStr
    phone_number: Optional[str] = None
    is_ex_student: bool
    date_of_leaving: Optional[str] = None
    last_class: Optional[str] = None
    current_status: Optional[str] = None
    status: str = "pending"  # pending, approved, rejected
    rejection_reason: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    editable_until: Optional[str] = None  # ISO datetime - 10 min edit window
    email_verified: bool = False
    phone_verified: bool = False
    preset_username: Optional[str] = None
    preset_password_hash: Optional[str] = None
    requested_password_hash: Optional[str] = None  # User-set password hash
    requested_username: Optional[str] = None        # User-chosen username

class OTPVerification(BaseModel):
    email: EmailStr
    otp: str

class UserLogin(BaseModel):
    id_number: str
    password: str

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    user_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    id_number: str
    username: Optional[str] = None
    full_name: str
    display_name: str
    date_of_birth: str
    current_class: str
    section: str
    email: EmailStr
    phone_number: Optional[str] = None
    is_ex_student: bool
    date_of_leaving: Optional[str] = None
    last_class: Optional[str] = None
    current_status: Optional[str] = None
    password_hash: str
    profile_picture: Optional[str] = None
    banner_image: Optional[str] = None
    bio: Optional[str] = ""
    badges: List[str] = Field(default_factory=list)
    role: Optional[str] = "user"
    is_profile_public: bool = True
    is_followers_public: bool = True
    is_following_public: bool = True
    is_friends_public: bool = True
    is_admin: bool = False
    is_moderator: bool = False
    is_banned: bool = False
    is_muted: bool = False
    ban_reason: Optional[str] = None
    mute_until: Optional[str] = None
    registration_status: str = "approved"
    push_notifications_enabled: bool = True
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    followers: List[str] = Field(default_factory=list)
    following: List[str] = Field(default_factory=list)
    friends: List[str] = Field(default_factory=list)
    friend_requests_sent: List[str] = Field(default_factory=list)
    friend_requests_received: List[str] = Field(default_factory=list)
    username_history: List[str] = Field(default_factory=list)
    username_last_changed: Optional[str] = None

class Post(BaseModel):
    model_config = ConfigDict(extra="ignore")
    post_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    user_id: str
    content: str
    images: List[str] = Field(default_factory=list)
    visibility: str = "public"  # public, profile_only, official, friends_only
    likes: List[str] = Field(default_factory=list)
    comments: List[Dict[str, Any]] = Field(default_factory=list)
    is_official: bool = False
    repost_of: Optional[str] = None  # post_id of original post
    repost_user_id: Optional[str] = None  # original poster
    share_count: int = 0
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    chat_room: str
    user_id: str
    content: str
    reply_to: Optional[str] = None  # message_id being replied to
    reactions: Dict[str, List[str]] = Field(default_factory=dict)  # emoji -> [user_ids]
    is_gif: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class DirectMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    dm_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    sender_id: str
    receiver_id: str
    content: str
    images: List[str] = Field(default_factory=list)
    is_gif: bool = False
    voice_url: Optional[str] = None
    reply_to: Optional[str] = None
    message_type: str = "text"   # text | call_log | system
    read: bool = False
    delivered: bool = False
    reactions: Dict[str, List[str]] = Field(default_factory=dict)
    edited: bool = False
    edit_history: List[Dict[str, Any]] = Field(default_factory=list)
    deleted: bool = False
    deleted_at: Optional[str] = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class AdminAction(BaseModel):
    reg_id: str
    action: str  # approve or reject
    rejection_reason: Optional[str] = None
    password: Optional[str] = None  # Required only for approve

class ProfileUpdate(BaseModel):
    username: Optional[str] = None
    bio: Optional[str] = None
    profile_picture: Optional[str] = None
    banner_image: Optional[str] = None
    is_profile_public: Optional[bool] = None
    is_followers_public: Optional[bool] = None
    is_following_public: Optional[bool] = None
    is_friends_public: Optional[bool] = None
    push_notifications_enabled: Optional[bool] = None

class PostCreate(BaseModel):
    content: str
    images: List[str] = Field(default_factory=list)
    voice_url: Optional[str] = None
    visibility: str = "public"  # public, profile_only, official, friends_only

class CommentCreate(BaseModel):
    content: str

class Notification(BaseModel):
    model_config = ConfigDict(extra="ignore")
    notification_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    user_id: str
    type: str  # like, comment, follow, dm, mention, friend_request, friend_accept, repost, punishment
    from_user_id: str
    content: str
    post_id: Optional[str] = None
    target_url: Optional[str] = None  # URL to navigate to when clicked
    read: bool = False
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class ActionLog(BaseModel):
    model_config = ConfigDict(extra="ignore")
    log_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    admin_id: str
    admin_name: str
    action_type: str
    target_user_id: Optional[str] = None
    target_user_name: Optional[str] = None
    details: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PostReport(BaseModel):
    model_config = ConfigDict(extra="ignore")
    report_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    post_id: str
    reporter_id: str
    reason: str
    category: str = "other"  # spam, harassment, inappropriate, misinformation, other
    status: str = "pending"  # pending, reviewed, resolved
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class HelpChatMessage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    message_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    registration_id: str
    sender_type: str  # user or admin
    sender_id: str
    content: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))

class PasswordResetRequest(BaseModel):
    id_number: str
    email: Optional[EmailStr] = None

class PasswordResetVerify(BaseModel):
    id_number: str
    otp: str
    new_password: str

class AdminEditUser(BaseModel):
    user_id: str
    display_name: Optional[str] = None
    full_name: Optional[str] = None
    email: Optional[EmailStr] = None
    current_class: Optional[str] = None
    section: Optional[str] = None
    bio: Optional[str] = None
    badges: Optional[List[str]] = None

class ChatMessageReport(BaseModel):
    message_id: str
    chat_room: str
    reason: str
    category: str = "other"

class RoleAssignment(BaseModel):
    user_id: str
    role: str
    badges: List[str]

class ModerationAction(BaseModel):
    target_user_id: str
    action: str  # ban, unban, mute, unmute
    reason: Optional[str] = None
    mute_duration_hours: Optional[int] = None


# ============= TICKET SYSTEM =============

class TicketCreate(BaseModel):
    subject: str
    category: str = "general"  # general, registration, account, bug, other
    message: str
    registration_id: Optional[str] = None  # Link to registration if relevant

class TicketReply(BaseModel):
    message: str

class Ticket(BaseModel):
    model_config = ConfigDict(extra="ignore")
    ticket_id: str = Field(default_factory=lambda: str(uuid.uuid4()))
    serial_number: Optional[int] = None
    subject: str
    category: str = "general"
    status: str = "open"  # open, in_progress, resolved, closed
    priority: str = "normal"  # low, normal, high, urgent
    created_by: str  # user_id or "anonymous"
    created_by_name: str
    created_by_id_number: Optional[str] = None
    registration_id: Optional[str] = None
    messages: List[Dict[str, Any]] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(timezone.utc))
    resolved_at: Optional[str] = None
    assigned_to: Optional[str] = None

# ============= HELPER FUNCTIONS =============

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        token = credentials.credentials
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user_id = payload.get("user_id")

        user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
        if not user:
            raise HTTPException(status_code=401, detail="User not found")

        normalized_user = _normalize_user_doc(user)

        missing_updates = {}
        for key, value in normalized_user.items():
            original = user.get(key)
            comparable = value.isoformat() if isinstance(value, datetime) else value
            if original is None or key not in user:
                missing_updates[key] = comparable

        if missing_updates:
            await db.users.update_one({"user_id": user_id}, {"$set": missing_updates})

        return User(**normalized_user)

    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception(f"Invalid token/session state: {e}")
        raise HTTPException(status_code=401, detail="Invalid token")

async def verify_admin(user: User = Depends(get_current_user)):
    if not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return user

async def verify_moderator(user: User = Depends(get_current_user)):
    if not user.is_moderator and not user.is_admin:
        raise HTTPException(status_code=403, detail="Moderator access required")
    return user

async def verify_management(user: User = Depends(get_current_user)):
    management_roles = ["Project Owner", "Management"]
    if user.role not in management_roles:
        raise HTTPException(status_code=403, detail="Management access required")
    return user

async def verify_admin_supervisor(user: User = Depends(get_current_user)):
    supervisor_roles = ["Project Owner", "Management", "Community Manager", "Chief of Staff", "Chief Administrator"]
    if user.role not in supervisor_roles:
        raise HTTPException(status_code=403, detail="Admin Supervisor access required")
    return user

async def log_action(admin_id: str, admin_name: str, action_type: str, details: str, target_user_id: str = None, target_user_name: str = None):
    last_log = await db.action_logs.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_log.get('serial_number', 0) + 1) if last_log else 1
    
    log = ActionLog(
        serial_number=next_serial,
        admin_id=admin_id,
        admin_name=admin_name,
        action_type=action_type,
        target_user_id=target_user_id,
        target_user_name=target_user_name,
        details=details
    )
    doc = log.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.action_logs.insert_one(doc)

async def send_notification(user_id: str, notification_type: str, from_user_id: str, content: str, post_id: str = None, target_url: str = None):
    last_notif = await db.notifications.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_notif.get('serial_number', 0) + 1) if last_notif else 1
    
    notification = Notification(
        serial_number=next_serial,
        user_id=user_id,
        type=notification_type,
        from_user_id=from_user_id,
        content=content,
        post_id=post_id,
        target_url=target_url
    )
    doc = notification.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.notifications.insert_one(doc)
    
    # Send via WebSocket if user is online
    await manager.send_personal_message({
        "type": "notification",
        "notification": doc
    }, user_id)

async def send_otp_email(email: str, otp: str):
    html_content = f"""
    <div style="font-family: Arial, sans-serif; padding: 20px;">
        <h2 style="color: #2563EB;">BISD HUB - Email Verification</h2>
        <p>Your OTP for email verification is:</p>
        <h1 style="color: #111111; font-size: 32px; letter-spacing: 8px;">{otp}</h1>
        <p>This OTP will expire in 10 minutes.</p>
    </div>
    """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": "BISD HUB - Email Verification OTP",
        "html": html_content
    }
    
    try:
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        return email_response
    except Exception as e:
        logger.error(f"Failed to send email: {str(e)}")
        return None

async def send_status_email(email: str, name: str, status: str, reason: str = None):
    if status == "approved":
        subject = "BISD HUB - Registration Approved!"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: auto;">
            <h2 style="color: #2563EB;">BISD HUB</h2>
            <h3 style="color: #16a34a;">Registration Approved</h3>
            <p>Hi {name},</p>
            <p>Your registration has been <strong>approved</strong>. You can now login to BISD HUB with your ID number and the temporary password set by the admin.</p>
            <p>Please change your password after first login.</p>
            <p style="color: #4B4B4B; font-size: 12px;">— BISD HUB Team</p>
        </div>
        """
    else:
        subject = "BISD HUB - Registration Status Update"
        html_content = f"""
        <div style="font-family: Arial, sans-serif; padding: 20px; max-width: 500px; margin: auto;">
            <h2 style="color: #2563EB;">BISD HUB</h2>
            <h3 style="color: #ef4444;">Registration Not Approved</h3>
            <p>Hi {name},</p>
            <p>Unfortunately, your registration was not approved.</p>
            {f'<p><strong>Reason:</strong> {reason}</p>' if reason else ''}
            <p>You can contact an admin via the help chat on the registration status page.</p>
            <p style="color: #4B4B4B; font-size: 12px;">— BISD HUB Team</p>
        </div>
        """
    
    params = {
        "from": SENDER_EMAIL,
        "to": [email],
        "subject": subject,
        "html": html_content
    }
    
    try:
        email_response = await asyncio.to_thread(resend.Emails.send, params)
        return email_response
    except Exception as e:
        logger.error(f"Failed to send status email: {str(e)}")
        return None

# ============= ROUTES =============

async def broadcast_punishment(message: str):
    """Broadcast staff punishment announcements to General chat."""
    last_msg = await db.chat_messages.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_msg.get('serial_number', 0) + 1) if last_msg else 1
    
    system_msg = ChatMessage(
        serial_number=next_serial,
        chat_room="general",
        user_id="SYSTEM",
        content=message
    )
    doc = system_msg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.chat_messages.insert_one(doc)
    
    await manager.broadcast_to_room({
        "type": "chat_message",
        "message_id": doc['message_id'],
        "serial_number": next_serial,
        "chat_room": "general",
        "user_id": "SYSTEM",
        "content": message,
        "created_at": doc['created_at'],
        "is_system": True,
        "user": {"display_name": "SYSTEM", "profile_picture": None}
    }, "general")

@api_router.get("/")
async def root():
    return {"message": "BISD HUB API"}

# OTP Management
otp_storage = {}  # In production, use Redis

@api_router.post("/auth/send-otp")
async def send_otp(request: dict):
    email = request.get('email')
    if not email:
        raise HTTPException(status_code=400, detail="Email required")
    
    # Generate 6-digit OTP
    otp = str(random.randint(100000, 999999))
    otp_storage[email] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    
    # Send OTP via email
    email_sent = await send_otp_email(email, otp)
    
    if email_sent:
        return {"status": "success", "message": "OTP sent to email"}
    else:
        # For development/testing without valid Resend API key
        logger.info(f"OTP for {email}: {otp}")
        return {"status": "success", "message": "OTP sent (check logs)", "dev_otp": otp}

@api_router.post("/auth/verify-otp")
async def verify_otp(request: OTPVerification):
    stored = otp_storage.get(request.email)
    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found or expired")
    
    if stored['expires_at'] < datetime.now(timezone.utc):
        del otp_storage[request.email]
        raise HTTPException(status_code=400, detail="OTP expired")
    
    if stored['otp'] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    del otp_storage[request.email]
    return {"status": "success", "message": "Email verified"}

# Registration
@api_router.post("/auth/register")
async def register(reg_request: RegistrationRequest):
    # Grade restriction: must be class 4 or above for current students
    if not reg_request.is_ex_student:
        try:
            cls = int(reg_request.current_class)
            if cls < 4:
                raise HTTPException(status_code=400, detail="GRADE_TOO_LOW")
        except (ValueError, TypeError):
            pass

    # Check if ID already exists
    existing = await db.registrations.find_one({"id_number": reg_request.id_number}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="ID number already registered")

    existing_user = await db.users.find_one({"id_number": reg_request.id_number}, {"_id": 0})
    if existing_user:
        raise HTTPException(status_code=400, detail="User already exists")

    # Validate and clean username if provided
    requested_username = None
    if reg_request.username:
        requested_username = re.sub(r"[^a-zA-Z0-9_]+", "", reg_request.username.lower())[:24]
        if requested_username:
            taken = await db.users.find_one({"username": requested_username}, {"_id": 0})
            if taken:
                raise HTTPException(status_code=400, detail="Username already taken")

    # Hash password if provided
    requested_password_hash = None
    if reg_request.password:
        requested_password_hash = await asyncio.to_thread(
            lambda: bcrypt.hashpw(reg_request.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
        )

    # Get next serial number
    last_reg = await db.registrations.find_one({}, {"_id": 0, "serial_number": 1}, sort=[("serial_number", -1)])
    next_serial = (last_reg.get("serial_number", 0) + 1) if last_reg else 1

    reg_data = reg_request.model_dump(exclude={"password", "username"})
    registration = Registration(**reg_data)
    registration.serial_number = next_serial
    registration.editable_until = (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    registration.requested_password_hash = requested_password_hash
    registration.requested_username = requested_username

    doc = registration.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()

    await db.registrations.insert_one(doc)
    return {
        "status": "success",
        "message": "Registration submitted for approval",
        "reg_id": registration.reg_id,
        "serial_number": next_serial,
        "editable_until": registration.editable_until,
        "registration": {k: v for k, v in doc.items() if k not in ["_id", "requested_password_hash"]}
    }

# Admin: Get pending registrations (only shows ones past 10-min edit window)
@api_router.get("/admin/registrations/pending")
async def get_pending_registrations(admin: User = Depends(verify_admin)):
    now = datetime.now(timezone.utc).isoformat()
    registrations = await db.registrations.find({
        "status": "pending",
        "$or": [
            {"editable_until": {"$lte": now}},
            {"editable_until": None}
        ]
    }, {"_id": 0}).to_list(1000)
    for reg in registrations:
        if isinstance(reg.get("created_at"), str):
            reg["created_at"] = datetime.fromisoformat(reg["created_at"])
    return registrations

# Admin: Approve/Reject registration
@api_router.post("/admin/registrations/action")
async def admin_action_registration(action: AdminAction, admin: User = Depends(verify_admin)):
    registration = await db.registrations.find_one({"reg_id": action.reg_id}, {"_id": 0})
    if not registration:
        raise HTTPException(status_code=404, detail="Registration not found")
    
    if action.action == "approve":
        # Use admin-provided password, or fall back to user's self-set password
        if action.password:
            password_hash = await asyncio.to_thread(
                lambda: bcrypt.hashpw(action.password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
            )
        elif registration.get("requested_password_hash"):
            password_hash = registration["requested_password_hash"]
        else:
            raise HTTPException(status_code=400, detail="Password required — user did not set one during registration")

        # Use user-chosen username or fall back to ID-based
        chosen_username = registration.get("requested_username") or             (re.sub(r"[^a-zA-Z0-9_]+", "", registration["id_number"].lower()) or "user")[:24]

        name_parts = registration["full_name"].split()
        display_name = f"{name_parts[0]} {name_parts[-1]}" if len(name_parts) > 1 else registration["full_name"]

        user = User(
            id_number=registration["id_number"],
            username=chosen_username,
            full_name=registration["full_name"],
            display_name=display_name,
            date_of_birth=registration["date_of_birth"],
            current_class=registration["current_class"],
            section=registration["section"],
            email=registration["email"],
            phone_number=registration.get("phone_number"),
            is_ex_student=registration["is_ex_student"],
            date_of_leaving=registration.get("date_of_leaving"),
            last_class=registration.get("last_class"),
            current_status=registration.get("current_status"),
            password_hash=password_hash
        )
        
        user_doc = user.model_dump()
        user_doc['created_at'] = user_doc['created_at'].isoformat()
        
        # Anti-duplication: check if user already exists before creating
        existing_user = await db.users.find_one({"id_number": registration["id_number"]}, {"_id": 0, "user_id": 1})
        if existing_user:
            # Already created (double-click scenario) - just mark as approved
            await db.registrations.update_one({"reg_id": action.reg_id}, {"$set": {"status": "approved"}})
            return {"status": "success", "message": "User already exists — marked as approved"}
        
        await db.users.insert_one(user_doc)
        
        # Update registration status
        await db.registrations.update_one(
            {"reg_id": action.reg_id},
            {"$set": {"status": "approved"}}
        )
        
        # Log action
        await log_action(
            admin.user_id,
            admin.display_name,
            "approve",
            f"Approved registration for {registration['full_name']} (ID: {registration['id_number']})",
            user.user_id,
            registration['full_name']
        )
        
        # Send approval email notification
        try:
            await send_status_email(registration['email'], registration['full_name'], "approved")
        except Exception as e:
            logger.error(f"Failed to send approval email: {e}")
        
        return {"status": "success", "message": "User approved and account created"}
    
    elif action.action == "reject":
        await db.registrations.update_one(
            {"reg_id": action.reg_id},
            {"$set": {"status": "rejected", "rejection_reason": action.rejection_reason}}
        )
        
        # Log action
        await log_action(
            admin.user_id,
            admin.display_name,
            "reject",
            f"Rejected registration for {registration['full_name']} (ID: {registration['id_number']}): {action.rejection_reason}",
            None,
            registration['full_name']
        )
        
        # Send rejection email notification
        try:
            await send_status_email(registration['email'], registration['full_name'], "rejected", action.rejection_reason)
        except Exception as e:
            logger.error(f"Failed to send rejection email: {e}")
        
        return {"status": "success", "message": "Registration rejected"}
    
    raise HTTPException(status_code=400, detail="Invalid action")

# Login
@api_router.post("/auth/login")
async def login(login_request: UserLogin):
    user = await db.users.find_one({"id_number": login_request.id_number}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_hash = user.get("password_hash")
    if not password_hash:
        logger.error(f"User {login_request.id_number} is missing password_hash")
        raise HTTPException(status_code=500, detail="Account data is corrupted")

    try:
        password_ok = bcrypt.checkpw(
            login_request.password.encode("utf-8"),
            password_hash.encode("utf-8")
        )
    except Exception as e:
        logger.exception(f"Password verification failed for {login_request.id_number}: {e}")
        raise HTTPException(status_code=500, detail="Internal Server Error")

    if not password_ok:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    normalized_user = _normalize_user_doc(user)

    missing_updates = {}
    for key, value in normalized_user.items():
        original = user.get(key)
        comparable = value.isoformat() if isinstance(value, datetime) else value
        if original is None or key not in user:
            missing_updates[key] = comparable

    if missing_updates:
        await db.users.update_one(
            {"id_number": login_request.id_number},
            {"$set": missing_updates}
        )

    token_payload = {
        "user_id": normalized_user["user_id"],
        "id_number": normalized_user["id_number"],
        "exp": datetime.now(timezone.utc) + timedelta(days=7)
    }
    token = jwt.encode(token_payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

    user_data = User(**normalized_user)
    response_data = user_data.model_dump(exclude={"password_hash"})

    if user_data.is_banned:
        response_data["registration_status"] = "banned"

    return {
        "token": token,
        "user": response_data
    }


# Get current user profile
@api_router.get("/users/me")
async def get_my_profile(user: User = Depends(get_current_user)):
    return user.model_dump(exclude={'password_hash'})

# Update profile
@api_router.put("/users/me")
async def update_profile(update: ProfileUpdate, user: User = Depends(get_current_user)):
    update_data = {k: v for k, v in update.model_dump().items() if v is not None}
    # Never allow real name or ID changes via self-service
    for field in ("display_name", "full_name", "id_number"):
        update_data.pop(field, None)

    if "username" in update_data:
        username = re.sub(r"[^a-zA-Z0-9_]+", "", update_data["username"].lower())[:24]
        if not username:
            raise HTTPException(status_code=400, detail="Invalid username")

        # 7-day cooldown check
        current_doc = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
        last_change = current_doc.get("last_username_change")
        if last_change:
            try:
                last_dt = datetime.fromisoformat(last_change.replace("Z", "+00:00"))
                if (datetime.now(timezone.utc) - last_dt).days < 7:
                    days_left = 7 - (datetime.now(timezone.utc) - last_dt).days
                    raise HTTPException(status_code=400, detail=f"You can change your username again in {days_left} day(s)")
            except (ValueError, AttributeError):
                pass

        existing_user = await db.users.find_one({"username": username, "user_id": {"$ne": user.user_id}}, {"_id": 0})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")

        # Store old username in history (keep last 3)
        old_username = current_doc.get("username")
        if old_username:
            history = current_doc.get("username_history", [])
            if old_username not in history:
                history = [old_username] + history
            update_data["username_history"] = history[:3]
        update_data["username"] = username
        update_data["last_username_change"] = datetime.now(timezone.utc).isoformat()

    if update_data:
        await db.users.update_one({"user_id": user.user_id}, {"$set": update_data})

    updated_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0})
    result = _normalize_user_doc(updated_user)
    return {k: v for k, v in result.items() if k != "password_hash"}

# Search users (must come before /users/{id_number} to avoid route conflict)
@api_router.get("/users/search")
async def search_users(
    query: str = Query(..., min_length=1),
    user: User = Depends(get_current_user)
):
    # Search by name, ID, class, or section
    users = await db.users.find({
        "$or": [
            {"full_name": {"$regex": query, "$options": "i"}},
            {"display_name": {"$regex": query, "$options": "i"}},
            {"username": {"$regex": query, "$options": "i"}},
            {"id_number": {"$regex": query, "$options": "i"}},
            {"current_class": {"$regex": query, "$options": "i"}},
            {"section": {"$regex": query, "$options": "i"}}
        ]
    }, {"_id": 0}).to_list(50)
    
    # Filter out private profiles
    results = []
    for u in users:
        user_obj = User(**_normalize_user_doc(u))
        if user_obj.is_profile_public or user_obj.user_id == user.user_id:
            results.append(user_obj.model_dump(exclude={'password_hash'}))
    
    return results

# Get user profile by ID number

@api_router.get("/users/{id_number}")
async def get_user_profile(id_number: str, user: User = Depends(get_current_user)):
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    normalized_target = _normalize_user_doc(target_user)
    user_obj = User(**normalized_target)
    can_view_full = user_obj.is_profile_public or user_obj.user_id == user.user_id or user.user_id in user_obj.followers or user.user_id in user_obj.friends

    payload = user_obj.model_dump(exclude={'password_hash'})
    payload['profile_locked'] = not can_view_full
    if not can_view_full:
        payload['bio'] = ''
    return payload

# Follow/Unfollow user
@api_router.post("/users/{id_number}/follow")
async def follow_user(id_number: str, user: User = Depends(get_current_user)):
    if id_number == user.id_number:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    # If private profile, create follow request instead
    if not target_user.get("is_profile_public", True):
        already_following = user.user_id in target_user.get("followers", [])
        if already_following:
            raise HTTPException(status_code=400, detail="Already following")
        already_requested = user.user_id in target_user.get("follow_requests_received", [])
        if already_requested:
            raise HTTPException(status_code=400, detail="Follow request already sent")
        await db.users.update_one(
            {"user_id": target_user["user_id"]},
            {"$addToSet": {"follow_requests_received": user.user_id}}
        )
        await send_notification(target_user["user_id"], "follow_request", user.user_id,
            f"{user.display_name} sent you a follow request")
        return {"status": "pending", "message": "Follow request sent"}

    await db.users.update_one({"user_id": user.user_id}, {"$addToSet": {"following": target_user["user_id"]}})
    await db.users.update_one({"user_id": target_user["user_id"]}, {"$addToSet": {"followers": user.user_id}})
    await send_notification(target_user["user_id"], "follow", user.user_id, f"{user.display_name} started following you")
    return {"status": "success", "message": "User followed"}

@api_router.post("/users/{id_number}/follow-request/accept")
async def accept_follow_request(id_number: str, user: User = Depends(get_current_user)):
    requester = await db.users.find_one({"id_number": id_number}, {"_id": 0, "user_id": 1, "display_name": 1})
    if not requester:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"user_id": user.user_id}, {
        "$pull": {"follow_requests_received": requester["user_id"]},
        "$addToSet": {"followers": requester["user_id"]}
    })
    await db.users.update_one({"user_id": requester["user_id"]}, {"$addToSet": {"following": user.user_id}})
    await send_notification(requester["user_id"], "follow", user.user_id, f"{user.display_name} accepted your follow request")
    return {"status": "success"}

@api_router.post("/users/{id_number}/follow-request/reject")
async def reject_follow_request(id_number: str, user: User = Depends(get_current_user)):
    requester = await db.users.find_one({"id_number": id_number}, {"_id": 0, "user_id": 1})
    if not requester:
        raise HTTPException(status_code=404, detail="User not found")
    await db.users.update_one({"user_id": user.user_id}, {"$pull": {"follow_requests_received": requester["user_id"]}})
    return {"status": "success"}

@api_router.get("/users/me/follow-requests")
async def get_my_follow_requests(user: User = Depends(get_current_user)):
    me = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "follow_requests_received": 1})
    request_ids = me.get("follow_requests_received", []) if me else []
    if not request_ids:
        return []
    requesters = await db.users.find(
        {"user_id": {"$in": request_ids}},
        {"_id": 0, "user_id": 1, "display_name": 1, "username": 1, "id_number": 1, "profile_picture": 1}
    ).to_list(100)
    return requesters

@api_router.delete("/users/{id_number}/follow")
async def unfollow_user(id_number: str, user: User = Depends(get_current_user)):
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Remove from following list
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$pull": {"following": target_user['user_id']}}
    )
    
    # Remove from followers list
    await db.users.update_one(
        {"user_id": target_user['user_id']},
        {"$pull": {"followers": user.user_id}}
    )
    
    return {"status": "success", "message": "User unfollowed"}

# Get followers list
@api_router.get("/users/{id_number}/followers")
async def get_followers(id_number: str, user: User = Depends(get_current_user)):
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check privacy
    if not target_user.get('is_followers_public', True) and target_user['user_id'] != user.user_id:
        raise HTTPException(status_code=403, detail="Followers list is private")
    
    followers = []
    for follower_id in target_user.get('followers', []):
        follower = await db.users.find_one({"user_id": follower_id}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1})
        if follower:
            followers.append(follower)
    
    return followers

# Get following list
@api_router.get("/users/{id_number}/following")
async def get_following(id_number: str, user: User = Depends(get_current_user)):
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Check privacy
    if not target_user.get('is_following_public', True) and target_user['user_id'] != user.user_id:
        raise HTTPException(status_code=403, detail="Following list is private")
    
    following = []
    for following_id in target_user.get('following', []):
        following_user = await db.users.find_one({"user_id": following_id}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1})
        if following_user:
            following.append(following_user)
    
    return following

# Friend Request System
@api_router.post("/friends/request/{id_number}")
async def send_friend_request(id_number: str, user: User = Depends(get_current_user)):
    if id_number == user.id_number:
        raise HTTPException(status_code=400, detail="Cannot send friend request to yourself")
    
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Must follow the user first
    if target_user['user_id'] not in user.following:
        raise HTTPException(status_code=400, detail="You must follow this user before sending a friend request")
    
    # Check if already friends
    if target_user['user_id'] in user.friends:
        raise HTTPException(status_code=400, detail="Already friends")
    
    # Check if request already sent
    if target_user['user_id'] in user.friend_requests_sent:
        raise HTTPException(status_code=400, detail="Friend request already sent")
    
    # Add to sent and received lists
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$addToSet": {"friend_requests_sent": target_user['user_id']}}
    )
    
    await db.users.update_one(
        {"user_id": target_user['user_id']},
        {"$addToSet": {"friend_requests_received": user.user_id}}
    )
    
    # Send notification
    await send_notification(
        target_user['user_id'],
        "friend_request",
        user.user_id,
        f"{user.display_name} sent you a friend request"
    )
    
    return {"status": "success", "message": "Friend request sent"}

@api_router.post("/friends/accept/{user_id}")
async def accept_friend_request(user_id: str, user: User = Depends(get_current_user)):
    # Check if request exists
    if user_id not in user.friend_requests_received:
        raise HTTPException(status_code=400, detail="No friend request from this user")
    
    # Add to friends list for both users
    await db.users.update_one(
        {"user_id": user.user_id},
        {
            "$addToSet": {"friends": user_id},
            "$pull": {"friend_requests_received": user_id}
        }
    )
    
    await db.users.update_one(
        {"user_id": user_id},
        {
            "$addToSet": {"friends": user.user_id},
            "$pull": {"friend_requests_sent": user.user_id}
        }
    )
    
    # Send notification
    await send_notification(
        user_id,
        "friend_accept",
        user.user_id,
        f"{user.display_name} accepted your friend request"
    )
    
    return {"status": "success", "message": "Friend request accepted"}

@api_router.post("/friends/reject/{user_id}")
async def reject_friend_request(user_id: str, user: User = Depends(get_current_user)):
    # Remove from both lists
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$pull": {"friend_requests_received": user_id}}
    )
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$pull": {"friend_requests_sent": user.user_id}}
    )
    
    return {"status": "success", "message": "Friend request rejected"}

@api_router.delete("/friends/{user_id}")
async def remove_friend(user_id: str, user: User = Depends(get_current_user)):
    # Remove from both friends lists
    await db.users.update_one(
        {"user_id": user.user_id},
        {"$pull": {"friends": user_id}}
    )
    
    await db.users.update_one(
        {"user_id": user_id},
        {"$pull": {"friends": user.user_id}}
    )
    
    return {"status": "success", "message": "Friend removed"}

@api_router.get("/friends/requests")
async def get_friend_requests(user: User = Depends(get_current_user)):
    # Get all received friend requests with user details
    requests = []
    for requester_id in user.friend_requests_received:
        requester = await db.users.find_one({"user_id": requester_id}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1})
        if requester:
            requests.append(requester)
    
    return requests

@api_router.get("/friends/list")
async def get_friends_list(user: User = Depends(get_current_user)):
    # Get all friends with user details
    friends = []
    for friend_id in user.friends:
        friend = await db.users.find_one({"user_id": friend_id}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1})
        if friend:
            friends.append(friend)
    
    return friends

# Posts
@api_router.post("/posts")
async def create_post(post_create: PostCreate, user: User = Depends(get_current_user)):
    # Check if user is muted
    if user.is_muted:
        if user.mute_until:
            try:
                mute_end = datetime.fromisoformat(str(user.mute_until))
                if mute_end > datetime.now(timezone.utc):
                    raise HTTPException(status_code=403, detail="You are muted and cannot post")
            except (ValueError, TypeError):
                pass
    
    # Get next serial number
    last_post = await db.posts.find_one({}, {"_id": 0, "serial_number": 1}, sort=[("serial_number", -1)])
    next_serial = (last_post.get('serial_number', 0) + 1) if last_post else 1
    
    # Determine if official based on visibility
    is_official = post_create.visibility == "official" and (user.is_admin or user.is_moderator)
    
    post = Post(
        serial_number=next_serial,
        user_id=user.user_id,
        content=post_create.content,
        images=post_create.images,
        visibility=post_create.visibility,
        is_official=is_official
    )
    
    doc = post.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['voice_url'] = post_create.voice_url
    await db.posts.insert_one(doc)
    
    return post

@api_router.get("/posts/feed/{feed_type}")
async def get_feed(feed_type: str, user: User = Depends(get_current_user), skip: int = 0, limit: int = 50):
    if feed_type == "official":
        posts = await db.posts.find({"visibility": "official", "repost_of": None}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    elif feed_type == "following":
        posts = await db.posts.find({
            "user_id": {"$in": user.following},
            "visibility": {"$in": ["public"]},
            "repost_of": None
        }, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    elif feed_type == "friends":
        posts = await db.posts.find({
            "user_id": {"$in": user.friends},
            "visibility": {"$in": ["public", "friends_only"]},
            "repost_of": None
        }, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    else:  # public feed
        posts = await db.posts.find({
            "visibility": "public",
            "repost_of": None  # reposts only show on user profile Reposts tab
        }, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Collect all post_ids to check which ones the user has reposted
    post_ids = [p['post_id'] for p in posts]
    user_reposts = await db.posts.find({"user_id": user.user_id, "repost_of": {"$in": post_ids}}, {"_id": 0, "repost_of": 1}).to_list(200)
    reposted_ids = {r['repost_of'] for r in user_reposts}

    # Enrich with user data
    for post in posts:
        if isinstance(post.get('created_at'), str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
        post_user = await db.users.find_one({"user_id": post['user_id']}, {"_id": 0, "user_id": 1, "display_name": 1, "username": 1, "id_number": 1, "profile_picture": 1, "badges": 1, "role": 1})
        post['user'] = post_user
        # Tell frontend if current user reposted this
        post['is_reposted_by_me'] = post['post_id'] in reposted_ids
        # Enrich repost with original poster info
        if post.get('repost_of') and post.get('repost_user_id') and not post.get('repost_original_username'):
            orig_poster = await db.users.find_one({"user_id": post['repost_user_id']}, {"_id": 0, "username": 1, "display_name": 1})
            if orig_poster:
                post['repost_original_username'] = orig_poster.get('username') or orig_poster.get('display_name', 'Unknown')
    
    return posts

@api_router.get("/posts/user/{id_number}")
async def get_user_posts(id_number: str, user: User = Depends(get_current_user), skip: int = 0, limit: int = 20):
    target_user = await db.users.find_one({"id_number": id_number}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Show all posts if viewing own profile, otherwise filter visibility
    if target_user['user_id'] == user.user_id:
        posts = await db.posts.find({"user_id": target_user['user_id']}, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    else:
        if not target_user.get('is_profile_public', True) and user.user_id not in target_user.get('followers', []) and user.user_id not in target_user.get('friends', []):
            return []
        allowed_vis = ["public", "official"]
        if user.user_id in target_user.get('friends', []):
            allowed_vis.append("friends_only")
        posts = await db.posts.find({
            "user_id": target_user['user_id'],
            "visibility": {"$in": allowed_vis}
        }, {"_id": 0}).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    for post in posts:
        if isinstance(post.get('created_at'), str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
        post['user'] = {
            "user_id": target_user['user_id'],
            "display_name": target_user['display_name'],
            "username": target_user.get('username'),
            "id_number": target_user['id_number'],
            "profile_picture": target_user.get('profile_picture'),
            "badges": [b for b in target_user.get('badges', []) if b != "Superior"],
            "role": target_user.get('role')
        }
    
    return posts

@api_router.post("/posts/{post_id}/like")
async def like_post(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.posts.update_one(
        {"post_id": post_id},
        {"$addToSet": {"likes": user.user_id}}
    )
    
    # Send notification to post owner
    if post['user_id'] != user.user_id:
        await send_notification(
            post['user_id'],
            "like",
            user.user_id,
            f"{user.display_name} liked your post",
            post_id
        )
    
    return {"status": "success"}

@api_router.delete("/posts/{post_id}/like")
async def unlike_post(post_id: str, user: User = Depends(get_current_user)):
    await db.posts.update_one(
        {"post_id": post_id},
        {"$pull": {"likes": user.user_id}}
    )
    return {"status": "success"}

@api_router.post("/posts/{post_id}/comment")
async def add_comment(post_id: str, comment: CommentCreate, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    comment_data = {
        "comment_id": str(uuid.uuid4()),
        "user_id": user.user_id,
        "display_name": user.display_name,
        "profile_picture": user.profile_picture,
        "content": comment.content,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.posts.update_one(
        {"post_id": post_id},
        {"$push": {"comments": comment_data}}
    )
    
    # Send notification to post owner
    if post['user_id'] != user.user_id:
        await send_notification(
            post['user_id'],
            "comment",
            user.user_id,
            f"{user.display_name} commented on your post",
            post_id
        )
    
    return {
        "status": "success",
        "comment": {
            **comment_data,
            "user": {
                "display_name": user.display_name,
                "profile_picture": user.profile_picture,
                "id_number": user.id_number
            }
        }
    }

@api_router.get("/posts/{post_id}/likes")
async def get_post_likes(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    # Only post owner can see who liked
    if post['user_id'] != user.user_id:
        raise HTTPException(status_code=403, detail="Only post owner can see likes")
    
    # Get user details for each like
    like_users = []
    for user_id in post.get('likes', []):
        like_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1})
        if like_user:
            like_users.append(like_user)
    
    return like_users

# Repost endpoint
@api_router.post("/posts/{post_id}/repost")
async def repost(post_id: str, user: User = Depends(get_current_user)):
    original = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")
    existing = await db.posts.find_one({"user_id": user.user_id, "repost_of": post_id}, {"_id": 0, "post_id": 1})
    if existing:
        raise HTTPException(status_code=400, detail="You already reposted this post")
    
    # Get next serial number
    last_post = await db.posts.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_post.get('serial_number', 0) if last_post else 0) + 1
    
    # Get original poster username for display
    original_poster = await db.users.find_one({"user_id": original['user_id']}, {"_id": 0, "username": 1, "display_name": 1})
    original_username = original_poster.get('username') or original_poster.get('display_name', 'Unknown') if original_poster else 'Unknown'

    repost_data = Post(
        user_id=user.user_id,
        content=original['content'],
        images=original.get('images', []),
        visibility="public",
        repost_of=post_id,
        repost_user_id=original['user_id'],
        serial_number=next_serial
    )
    doc = repost_data.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['repost_original_username'] = original_username
    # Carry over ALL media fields from the original post — not just text/images
    for field in ['voice_url', 'video_url', 'video', 'attachments', 'links']:
        if original.get(field):
            doc[field] = original.get(field)
    await db.posts.insert_one(doc)
    
    # Increment share count on original
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"share_count": 1}})
    
    # Notify original poster
    if original['user_id'] != user.user_id:
        await send_notification(
            original['user_id'], "repost", user.user_id,
            f"{user.display_name} reposted your post", post_id
        )
    
    return {"status": "success", "post_id": repost_data.post_id}

@api_router.get("/posts/search")
async def search_posts(query: str = Query(..., min_length=1), user: User = Depends(get_current_user)):
    posts = await db.posts.find(
        {"content": {"$regex": query, "$options": "i"}},
        {"_id": 0}
    ).sort("created_at", -1).to_list(50)
    
    for post in posts:
        if isinstance(post.get('created_at'), str):
            post['created_at'] = datetime.fromisoformat(post['created_at'])
        post_user = await db.users.find_one({"user_id": post['user_id']}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1, "badges": 1})
        post['user'] = post_user
    
    return posts

# Global Chat
@api_router.get("/chat/{chat_room}/messages")
async def get_chat_messages(chat_room: str, user: User = Depends(get_current_user), limit: int = 50):
    section = user.section.upper() if user.section else ""
    is_boy = section.startswith('B')
    is_girl = section.startswith('G')
    
    # Verify user has access to chat room
    if chat_room == "boys_only" and not is_boy:
        raise HTTPException(status_code=403, detail="Access denied - Boys Only")
    elif chat_room == "girls_only" and not is_girl:
        raise HTTPException(status_code=403, detail="Access denied - Girls Only")
    elif chat_room.startswith("class_") and user.is_ex_student:
        raise HTTPException(status_code=403, detail="Ex-students cannot access class chats")
    elif chat_room == "ex_students" and not user.is_ex_student:
        raise HTTPException(status_code=403, detail="Only ex-students can access this chat")
    
    # Filter messages: only show last 24 hours for normal view
    cutoff = (datetime.now(timezone.utc) - timedelta(hours=24)).isoformat()
    messages = await db.chat_messages.find(
        {"chat_room": chat_room, "created_at": {"$gte": cutoff}},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for msg in messages:
        msg_user = await db.users.find_one({"user_id": msg['user_id']}, {"_id": 0, "display_name": 1, "profile_picture": 1, "id_number": 1, "badges": 1, "role": 1})
        msg['user'] = msg_user or {"display_name": "SYSTEM", "profile_picture": None}
        
        # Get reply data if present
        if msg.get('reply_to'):
            reply_msg = await db.chat_messages.find_one({"message_id": msg['reply_to']}, {"_id": 0, "content": 1, "user_id": 1})
            if reply_msg:
                reply_user = await db.users.find_one({"user_id": reply_msg['user_id']}, {"_id": 0, "display_name": 1})
                msg['reply_data'] = {"content": reply_msg['content'], "user": reply_user}
    
    return list(reversed(messages))

# Direct Messages
@api_router.get("/dm/conversations")
async def get_dm_conversations(user: User = Depends(get_current_user)):
    messages = await db.direct_messages.find(
        {"$or": [{"sender_id": user.user_id}, {"receiver_id": user.user_id}]},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    # Group by conversation
    conversations = {}
    for msg in messages:
        other_user_id = msg['receiver_id'] if msg['sender_id'] == user.user_id else msg['sender_id']
        if other_user_id not in conversations:
            conversations[other_user_id] = []
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
        conversations[other_user_id].append(msg)
    
    # Enrich with user data
    result = []
    for other_user_id, msgs in conversations.items():
        other_user = await db.users.find_one({"user_id": other_user_id}, {"_id": 0, "user_id": 1, "display_name": 1, "id_number": 1, "profile_picture": 1})
        unread_count = sum(1 for m in msgs if m['receiver_id'] == user.user_id and not m['read'])
        result.append({
            "user": other_user,
            "last_message": msgs[0],
            "unread_count": unread_count
        })
    
    return result

@api_router.get("/dm/{other_user_id}/messages")
async def get_dm_messages(other_user_id: str, user: User = Depends(get_current_user), limit: int = 200):
    messages = await db.direct_messages.find(
        {"$or": [
            {"sender_id": user.user_id, "receiver_id": other_user_id},
            {"sender_id": other_user_id, "receiver_id": user.user_id}
        ]},
        {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    
    # Populate reply_to context — embed snippet of the replied message
    reply_ids = [m["reply_to"] for m in messages if m.get("reply_to")]
    if reply_ids:
        replied = await db.direct_messages.find(
            {"dm_id": {"$in": reply_ids}}, {"_id": 0}
        ).to_list(len(reply_ids))
        replied_map = {r["dm_id"]: r for r in replied}
        for m in messages:
            if m.get("reply_to") and m["reply_to"] in replied_map:
                r = replied_map[m["reply_to"]]
                m["reply_context"] = {
                    "dm_id": r["dm_id"],
                    "sender_id": r["sender_id"],
                    "content": (r.get("content") or "")[:120],
                    "deleted": r.get("deleted", False)
                }
    
    # Mark messages from other user as read
    await db.direct_messages.update_many(
        {"sender_id": other_user_id, "receiver_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    # Notify the sender via WS that their messages were read
    await manager.send_personal_message(
        {"type": "dm_read", "reader_id": user.user_id, "from_id": other_user_id},
        other_user_id
    )
    
    for msg in messages:
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages

# DM search
@api_router.get("/dm/search")
async def search_dms(query: str = "", user: User = Depends(get_current_user)):
    if not query.strip():
        return []
    
    results = await db.direct_messages.find({
        "$and": [
            {"$or": [{"sender_id": user.user_id}, {"receiver_id": user.user_id}]},
            {"content": {"$regex": query, "$options": "i"}}
        ]
    }, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    for msg in results:
        other_id = msg['receiver_id'] if msg['sender_id'] == user.user_id else msg['sender_id']
        other_user = await db.users.find_one({"user_id": other_id}, {"_id": 0, "display_name": 1, "id_number": 1, "profile_picture": 1})
        msg['other_user'] = other_user
    
    return results


# ── DM Edit ───────────────────────────────────────────────────────────────────
@api_router.put("/dm/{dm_id}")
async def edit_dm(dm_id: str, body: dict, user: User = Depends(get_current_user)):
    dm = await db.direct_messages.find_one({"dm_id": dm_id}, {"_id": 0})
    if not dm:
        raise HTTPException(status_code=404, detail="Message not found")
    if dm["sender_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="You can only edit your own messages")
    if dm.get("deleted"):
        raise HTTPException(status_code=400, detail="Cannot edit a deleted message")
    new_content = (body.get("content") or "").strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="Content required")
    edit_entry = {
        "old_content": dm.get("content", ""),
        "edited_at": datetime.now(timezone.utc).isoformat()
    }
    await db.direct_messages.update_one(
        {"dm_id": dm_id},
        {"$set": {"content": new_content, "edited": True}, "$push": {"edit_history": edit_entry}}
    )
    updated = await db.direct_messages.find_one({"dm_id": dm_id}, {"_id": 0})
    # Notify both parties via WS
    payload = {**updated, "type": "dm_edit"}
    await manager.send_personal_message(payload, dm["receiver_id"])
    await manager.send_personal_message(payload, dm["sender_id"])
    return updated

# ── DM Delete (unsend — keeps record but marks as deleted) ────────────────────
@api_router.delete("/dm/{dm_id}")
async def delete_dm(dm_id: str, user: User = Depends(get_current_user)):
    dm = await db.direct_messages.find_one({"dm_id": dm_id}, {"_id": 0})
    if not dm:
        raise HTTPException(status_code=404, detail="Message not found")
    if dm["sender_id"] != user.user_id:
        raise HTTPException(status_code=403, detail="You can only unsend your own messages")
    now_iso = datetime.now(timezone.utc).isoformat()
    await db.direct_messages.update_one(
        {"dm_id": dm_id},
        {"$set": {"deleted": True, "deleted_at": now_iso, "content": "", "images": [], "voice_url": None}}
    )
    payload = {"type": "dm_delete", "dm_id": dm_id, "sender_id": dm["sender_id"], "receiver_id": dm["receiver_id"]}
    await manager.send_personal_message(payload, dm["receiver_id"])
    await manager.send_personal_message(payload, dm["sender_id"])
    return {"status": "success"}

# ── DM React ──────────────────────────────────────────────────────────────────
@api_router.post("/dm/{dm_id}/react")
async def react_dm(dm_id: str, body: dict, user: User = Depends(get_current_user)):
    emoji = body.get("emoji", "").strip()
    if not emoji:
        raise HTTPException(status_code=400, detail="Emoji required")
    dm = await db.direct_messages.find_one({"dm_id": dm_id}, {"_id": 0})
    if not dm:
        raise HTTPException(status_code=404, detail="Message not found")
    if user.user_id not in [dm["sender_id"], dm["receiver_id"]]:
        raise HTTPException(status_code=403, detail="Not allowed")
    reactions = dm.get("reactions", {})
    # Toggle: if user already reacted with same emoji, remove; else add
    cur = reactions.get(emoji, [])
    if user.user_id in cur:
        cur = [u for u in cur if u != user.user_id]
        if cur:
            reactions[emoji] = cur
        else:
            reactions.pop(emoji, None)
    else:
        # Remove user's other reactions on this msg (one reaction per user)
        for e in list(reactions.keys()):
            reactions[e] = [u for u in reactions[e] if u != user.user_id]
            if not reactions[e]:
                reactions.pop(e, None)
        reactions[emoji] = cur + [user.user_id]
    await db.direct_messages.update_one({"dm_id": dm_id}, {"$set": {"reactions": reactions}})
    payload = {"type": "dm_react", "dm_id": dm_id, "reactions": reactions,
               "sender_id": dm["sender_id"], "receiver_id": dm["receiver_id"]}
    await manager.send_personal_message(payload, dm["receiver_id"])
    await manager.send_personal_message(payload, dm["sender_id"])
    return {"reactions": reactions}

# ── Mark DM conversation as read ──────────────────────────────────────────────
@api_router.post("/dm/{other_user_id}/mark-read")
async def mark_dm_read(other_user_id: str, user: User = Depends(get_current_user)):
    """Mark all messages from other_user as read."""
    result = await db.direct_messages.update_many(
        {"sender_id": other_user_id, "receiver_id": user.user_id, "read": False},
        {"$set": {"read": True}}
    )
    # Notify the sender that their messages were read
    payload = {"type": "dm_read", "reader_id": user.user_id, "from_id": other_user_id}
    await manager.send_personal_message(payload, other_user_id)
    return {"marked": result.modified_count}

@api_router.post("/dm/{receiver_id}/send")
async def send_dm(receiver_id: str, message: dict, user: User = Depends(get_current_user)):
    last_dm = await db.direct_messages.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_dm.get('serial_number', 0) + 1) if last_dm else 1
    
    dm = DirectMessage(
        serial_number=next_serial,
        sender_id=user.user_id,
        receiver_id=receiver_id,
        content=message.get('content', ''),
        images=message.get('images', []),
        is_gif=message.get('is_gif', False),
        voice_url=message.get('voice_url'),
        message_type=message.get('message_type', 'text'),
    )
    
    doc = dm.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.direct_messages.insert_one(doc)
    
    # Send notification
    await send_notification(
        receiver_id,
        "dm",
        user.user_id,
        f"New message from {user.display_name}"
    )
    
    # Send realtime via WebSocket to both parties
    ws_payload = {**doc, "type": "dm"}
    await manager.send_personal_message(ws_payload, receiver_id)
    await manager.send_personal_message(ws_payload, user.user_id)
    return dm

# Admin: Get all users
@api_router.get("/admin/users")
async def get_all_users(admin: User = Depends(verify_admin)):
    users = await db.users.find({}, {"_id": 0, "password_hash": 0}).to_list(5000)
    return users

# Admin: Update user badges
@api_router.put("/admin/users/{user_id}/badges")
async def update_user_badges(user_id: str, badges: List[str], admin: User = Depends(verify_admin)):
    await db.users.update_one(
        {"user_id": user_id},
        {"$set": {"badges": badges}}
    )
    
    target_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    await log_action(admin.user_id, admin.display_name, "update_badges", f"Updated badges for {target_user['display_name']}", user_id, target_user['display_name'])
    
    return {"status": "success"}

# ============= NOTIFICATION SYSTEM =============

@api_router.get("/notifications")
async def get_notifications(user: User = Depends(get_current_user), limit: int = 50):
    notifications = await db.notifications.find(
        {"user_id": user.user_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(limit).to_list(limit)
    
    for notif in notifications:
        if isinstance(notif.get('created_at'), str):
            notif['created_at'] = datetime.fromisoformat(notif['created_at'])
        # Get sender info
        sender = await db.users.find_one({"user_id": notif['from_user_id']}, {"_id": 0, "display_name": 1, "profile_picture": 1})
        notif['from_user'] = sender
    
    return notifications

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str, user: User = Depends(get_current_user)):
    await db.notifications.update_one(
        {"notification_id": notification_id, "user_id": user.user_id},
        {"$set": {"read": True}}
    )
    return {"status": "success"}

@api_router.get("/notifications/unread/count")
async def get_unread_count(user: User = Depends(get_current_user)):
    count = await db.notifications.count_documents({"user_id": user.user_id, "read": False})
    return {"count": count}

# ============= MODERATION SYSTEM =============

@api_router.post("/mod/posts/{post_id}/report")
async def report_post(post_id: str, reason: dict, user: User = Depends(get_current_user)):
    # Get next serial number
    last_report = await db.post_reports.find_one({}, {"_id": 0, "serial_number": 1}, sort=[("serial_number", -1)])
    next_serial = (last_report.get('serial_number', 0) + 1) if last_report else 1
    
    report = PostReport(
        serial_number=next_serial,
        post_id=post_id,
        reporter_id=user.user_id,
        reason=reason.get('reason', ''),
        category=reason.get('category', 'other')
    )
    doc = report.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.post_reports.insert_one(doc)
    
    return {"status": "success", "message": "Post reported", "serial_number": next_serial}

@api_router.get("/mod/reports")
async def get_reports(mod: User = Depends(verify_moderator), status: str = "pending"):
    reports = await db.post_reports.find({"status": status}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for report in reports:
        if isinstance(report.get('created_at'), str):
            report['created_at'] = datetime.fromisoformat(report['created_at'])
        # Get post and reporter info
        post = await db.posts.find_one({"post_id": report['post_id']}, {"_id": 0})
        reporter = await db.users.find_one({"user_id": report['reporter_id']}, {"_id": 0, "display_name": 1, "id_number": 1, "user_id": 1})
        report['post'] = post
        report['reporter'] = reporter
        # Get post author (violator) info
        if post:
            violator = await db.users.find_one({"user_id": post.get('user_id')}, {"_id": 0, "display_name": 1, "id_number": 1, "user_id": 1, "current_class": 1, "section": 1})
            report['violator'] = violator
    
    return reports

@api_router.get("/mod/chat-reports")
async def get_chat_reports(mod: User = Depends(verify_moderator), status: str = "pending"):
    reports = await db.reports.find({"status": status, "type": "chat_message"}, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    for report in reports:
        if isinstance(report.get('created_at'), str):
            report['created_at'] = datetime.fromisoformat(report['created_at'])
        # Get reporter info
        reporter = await db.users.find_one({"user_id": report.get('reporter_id')}, {"_id": 0, "display_name": 1, "id_number": 1, "user_id": 1})
        report['reporter'] = reporter
        # Get the chat message
        msg = await db.chat_messages.find_one({"message_id": report.get('message_id')}, {"_id": 0})
        report['message'] = msg
        if msg:
            violator = await db.users.find_one({"user_id": msg.get('user_id')}, {"_id": 0, "display_name": 1, "id_number": 1, "user_id": 1, "current_class": 1, "section": 1})
            report['violator'] = violator
    
    return reports

@api_router.put("/mod/chat-reports/{report_id}/resolve")
async def resolve_chat_report(report_id: str, status: str, mod: User = Depends(verify_moderator)):
    await db.reports.update_one({"report_id": report_id}, {"$set": {"status": status}})
    return {"status": "success"}

@api_router.post("/mod/users/action")
async def moderate_user(action: ModerationAction, mod: User = Depends(verify_moderator)):
    target_user = await db.users.find_one({"user_id": action.target_user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if action.action == "ban":
        await db.users.update_one(
            {"user_id": action.target_user_id},
            {"$set": {"is_banned": True, "ban_reason": action.reason}}
        )
        await log_action(mod.user_id, mod.display_name, "ban", f"Banned {target_user['display_name']}: {action.reason}", action.target_user_id, target_user['display_name'])
        
        # Broadcast punishment to General chat
        punishment_msg = f"{mod.role} - {mod.id_number} {mod.display_name} has BANNED {target_user.get('id_number')} {target_user['display_name']}. Reason: {action.reason}"
        await broadcast_punishment(punishment_msg)
        
    elif action.action == "unban":
        if mod.role not in ["Chief Moderator", "Head Moderator", "Moderator", "Administrator", "Head Administrator", "Chief Administrator", "Chief of Staff", "Community Manager", "Management", "Project Owner"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions to unban")
        
        await db.users.update_one(
            {"user_id": action.target_user_id},
            {"$set": {"is_banned": False, "ban_reason": None}}
        )
        await log_action(mod.user_id, mod.display_name, "unban", f"Unbanned {target_user['display_name']}", action.target_user_id, target_user['display_name'])
        
    elif action.action == "mute":
        duration = action.mute_duration_hours or 24
        mute_until = datetime.now(timezone.utc) + timedelta(hours=duration)
        await db.users.update_one(
            {"user_id": action.target_user_id},
            {"$set": {"is_muted": True, "mute_until": mute_until.isoformat()}}
        )
        await log_action(mod.user_id, mod.display_name, "mute", f"Muted {target_user['display_name']} for {duration} hours", action.target_user_id, target_user['display_name'])
        
        # Broadcast punishment to General chat
        punishment_msg = f"{mod.role} - {mod.id_number} {mod.display_name} has MUTED {target_user.get('id_number')} {target_user['display_name']} for {duration} hours. Reason: {action.reason}"
        await broadcast_punishment(punishment_msg)
        
    elif action.action == "unmute":
        if mod.role not in ["Chief Moderator", "Head Moderator", "Moderator", "Administrator", "Head Administrator", "Chief Administrator", "Chief of Staff", "Community Manager", "Management", "Project Owner"]:
            raise HTTPException(status_code=403, detail="Insufficient permissions to unmute")
        
        await db.users.update_one(
            {"user_id": action.target_user_id},
            {"$set": {"is_muted": False, "mute_until": None}}
        )
        await log_action(mod.user_id, mod.display_name, "unmute", f"Unmuted {target_user['display_name']}", action.target_user_id, target_user['display_name'])
    
    return {"status": "success", "message": f"User {action.action}ed successfully"}

@api_router.delete("/mod/posts/{post_id}")
async def mod_delete_post(post_id: str, reason: dict, mod: User = Depends(verify_moderator)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    await db.posts.delete_one({"post_id": post_id})
    
    post_owner = await db.users.find_one({"user_id": post['user_id']}, {"_id": 0})
    await log_action(mod.user_id, mod.display_name, "delete_post", f"Deleted post by {post_owner['display_name']}: {reason.get('reason', 'No reason provided')}", post['user_id'], post_owner['display_name'])
    
    return {"status": "success", "message": "Post deleted"}

@api_router.put("/mod/reports/{report_id}/resolve")
async def resolve_report(report_id: str, status: str, mod: User = Depends(verify_moderator)):
    await db.post_reports.update_one(
        {"report_id": report_id},
        {"$set": {"status": status}}
    )
    return {"status": "success"}

# ============= MANAGEMENT PANEL =============

@api_router.post("/management/assign-role")
async def assign_role(assignment: RoleAssignment, manager: User = Depends(verify_management)):
    target_user = await db.users.find_one({"user_id": assignment.user_id}, {"_id": 0})
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Determine is_admin and is_moderator based on role
    admin_roles = ["Administrator", "Head Administrator", "Chief Administrator", "Chief of Staff", "Community Manager", "Management", "Project Owner"]
    mod_roles = ["Moderator", "Head Moderator", "Chief Moderator"]
    
    is_admin = assignment.role in admin_roles
    is_moderator = assignment.role in mod_roles or is_admin
    
    # Auto-assign badges based on role
    auto_badges = []
    if assignment.role == "Project Owner":
        auto_badges = ["Project Owner"]
    elif assignment.role == "Management":
        auto_badges = ["Management"]
    elif assignment.role == "Community Manager":
        auto_badges = ["Community Manager"]
    elif assignment.role == "Chief of Staff":
        auto_badges = ["Chief of Staff"]
    elif assignment.role == "Chief Administrator":
        auto_badges = ["Chief Administrator"]
    elif assignment.role == "Head Administrator":
        auto_badges = ["Head Administrator"]
    elif assignment.role == "Administrator":
        auto_badges = ["Administrator"]
    elif assignment.role == "Chief Moderator":
        auto_badges = ["Chief Moderator"]
    elif assignment.role == "Head Moderator":
        auto_badges = ["Head Moderator"]
    elif assignment.role == "Moderator":
        auto_badges = ["Moderator"]
    
    # Merge auto badges with custom badges, remove duplicates
    final_badges = list(set(auto_badges + assignment.badges))
    
    await db.users.update_one(
        {"user_id": assignment.user_id},
        {"$set": {
            "role": assignment.role,
            "badges": final_badges,
            "is_admin": is_admin,
            "is_moderator": is_moderator
        }}
    )
    
    await log_action(manager.user_id, manager.display_name, "assign_role", f"Assigned role '{assignment.role}' with badges {final_badges} to {target_user['display_name']}", assignment.user_id, target_user['display_name'])
    
    return {"status": "success", "message": "Role assigned successfully", "badges": final_badges}

@api_router.get("/management/all-users-with-passwords")
async def get_all_users_with_passwords(manager: User = Depends(verify_management)):
    users = await db.users.find({}, {"_id": 0}).to_list(5000)
    return users

@api_router.get("/management/action-logs")
async def get_action_logs(
    manager: User = Depends(verify_admin),
    search: str = None,
    limit: int = 100
):
    query = {}
    if search:
        or_conditions = [
            {"admin_name": {"$regex": search, "$options": "i"}},
            {"target_user_name": {"$regex": search, "$options": "i"}},
            {"action_type": {"$regex": search, "$options": "i"}},
            {"details": {"$regex": search, "$options": "i"}}
        ]
        try:
            serial_int = int(search.strip().lstrip('#'))
            or_conditions.append({"serial_number": serial_int})
        except ValueError:
            pass
        query = {"$or": or_conditions}
    
    logs = await db.action_logs.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    for log in logs:
        if isinstance(log.get('created_at'), str):
            log['created_at'] = datetime.fromisoformat(log['created_at'])
    
    return logs

# ============= HELP CHAT SYSTEM =============

@api_router.post("/help-chat/{registration_id}/message")
async def send_help_message(registration_id: str, message: dict, user_type: str = "user"):
    # Check if user or admin
    sender_id = message.get('sender_id')
    
    help_msg = HelpChatMessage(
        registration_id=registration_id,
        sender_type=user_type,
        sender_id=sender_id,
        content=message['content']
    )
    
    doc = help_msg.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    await db.help_chat.insert_one(doc)
    
    return {"status": "success"}

@api_router.get("/help-chat/{registration_id}/messages")
async def get_help_messages(registration_id: str, limit: int = 100):
    messages = await db.help_chat.find(
        {"registration_id": registration_id},
        {"_id": 0}
    ).sort("created_at", 1).limit(limit).to_list(limit)
    
    for msg in messages:
        if isinstance(msg.get('created_at'), str):
            msg['created_at'] = datetime.fromisoformat(msg['created_at'])
    
    return messages

@api_router.get("/admin/help-chats")
async def get_all_help_chats(admin: User = Depends(verify_admin)):
    # Get all rejected registrations with help chat messages
    registrations = await db.registrations.find({"status": "rejected"}, {"_id": 0}).to_list(100)
    
    result = []
    for reg in registrations:
        message_count = await db.help_chat.count_documents({"registration_id": reg['reg_id']})
        if message_count > 0:
            result.append({
                "registration": reg,
                "message_count": message_count
            })
    
    return result

# WebSocket for real-time chat
@app.websocket("/api/ws/{user_id}")
async def websocket_endpoint(websocket: WebSocket, user_id: str):
    await manager.connect(user_id, websocket)
    try:
        while True:
            data = await websocket.receive_json()
            
            if data['type'] == 'ping':
                await manager.send_personal_message({"type": "pong"}, user_id)
            
            elif data['type'] == 'join_room':
                manager.join_room(user_id, data['room'])
            
            elif data['type'] == 'chat_message':
                # Spam check
                if check_spam(user_id):
                    await manager.send_personal_message({"type": "error", "message": "You're sending messages too fast. Please wait."}, user_id)
                    continue
                
                # Get serial number
                last_msg = await db.chat_messages.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
                next_serial = (last_msg.get('serial_number', 0) + 1) if last_msg else 1
                
                chat_msg = ChatMessage(
                    serial_number=next_serial,
                    chat_room=data['chat_room'],
                    user_id=user_id,
                    content=data['content'],
                    reply_to=data.get('reply_to'),
                    is_gif=data.get('is_gif', False)
                )
                doc = chat_msg.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                if data.get('voice_url'):
                    doc['voice_url'] = data['voice_url']
                await db.chat_messages.insert_one(doc)
                
                ws_user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "display_name": 1, "username": 1, "profile_picture": 1, "id_number": 1, "badges": 1, "role": 1})
                
                # Get reply message if replying
                reply_data = None
                if data.get('reply_to'):
                    reply_msg = await db.chat_messages.find_one({"message_id": data['reply_to']}, {"_id": 0, "content": 1, "user_id": 1})
                    if reply_msg:
                        reply_user = await db.users.find_one({"user_id": reply_msg['user_id']}, {"_id": 0, "display_name": 1})
                        reply_data = {"content": reply_msg['content'], "user": reply_user}
                
                broadcast_data = {
                    "type": "chat_message",
                    "message_id": doc['message_id'],
                    "serial_number": next_serial,
                    "chat_room": doc['chat_room'],
                    "user_id": user_id,
                    "content": doc['content'],
                    "created_at": doc['created_at'],
                    "is_gif": doc.get('is_gif', False),
                    "voice_url": data.get('voice_url'),
                    "reply_to": doc.get('reply_to'),
                    "reply_data": reply_data,
                    "reactions": {},
                    "user": ws_user
                }
                await manager.broadcast_to_room(broadcast_data, data['chat_room'])
            
            elif data['type'] == 'reaction':
                # Add reaction to message
                msg_id = data['message_id']
                emoji = data['emoji']
                msg = await db.chat_messages.find_one({"message_id": msg_id}, {"_id": 0})
                if msg:
                    reactions = msg.get('reactions', {})
                    if emoji not in reactions:
                        reactions[emoji] = []
                    if user_id in reactions[emoji]:
                        reactions[emoji].remove(user_id)
                    else:
                        reactions[emoji].append(user_id)
                    if not reactions[emoji]:
                        del reactions[emoji]
                    await db.chat_messages.update_one({"message_id": msg_id}, {"$set": {"reactions": reactions}})
                    
                    await manager.broadcast_to_room({
                        "type": "reaction_update",
                        "message_id": msg_id,
                        "reactions": reactions
                    }, msg['chat_room'])
            
            elif data['type'] == 'dm':
                # Spam check
                if check_spam(user_id):
                    await manager.send_personal_message({"type": "error", "message": "You're sending messages too fast."}, user_id)
                    continue
                
                last_dm = await db.direct_messages.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
                next_dm_serial = (last_dm.get('serial_number', 0) + 1) if last_dm else 1
                
                dm = DirectMessage(
                    serial_number=next_dm_serial,
                    sender_id=user_id,
                    receiver_id=data['receiver_id'],
                    content=data['content'],
                    images=data.get('images', []),
                    is_gif=data.get('is_gif', False),
                    reply_to=data.get('reply_to')
                )
                doc = dm.model_dump()
                doc['created_at'] = doc['created_at'].isoformat()
                doc['voice_url'] = data.get('voice_url')
                await db.direct_messages.insert_one(doc)
                
                dm_data = {
                    "type": "dm",
                    "dm_id": doc['dm_id'],
                    "serial_number": next_dm_serial,
                    "sender_id": user_id,
                    "receiver_id": data['receiver_id'],
                    "content": doc['content'],
                    "images": doc.get('images', []),
                    "is_gif": doc.get('is_gif', False),
                    "voice_url": doc.get('voice_url'),
                    "created_at": doc['created_at'],
                    "read": False
                }
                await manager.send_personal_message(dm_data, data['receiver_id'])
                await manager.send_personal_message(dm_data, user_id)
            
            # WebRTC call signaling
            elif data['type'] == 'dm_typing':
                target_id = data.get('receiver_id')
                if target_id:
                    await manager.send_personal_message({
                        "type": "dm_typing",
                        "sender_id": user_id,
                        "typing": bool(data.get('typing', True))
                    }, target_id)
            
            elif data['type'] == 'call_offer':
                target_id = data['target_id']
                if target_id in manager.active_connections:
                    await manager.send_personal_message({
                        "type": "call_offer",
                        "caller_id": user_id,
                        "caller_name": data.get('caller_name', 'Someone'),
                        "caller_picture": data.get('caller_picture'),
                        "call_type": data.get('call_type', 'audio'),
                        "sdp": data['sdp']
                    }, target_id)
                else:
                    # Check if user exists at all
                    target_exists = await db.users.find_one({"user_id": target_id}, {"_id": 0, "user_id": 1})
                    reason = "offline" if not target_exists else "not_connected"
                    await manager.send_personal_message({
                        "type": "call_unavailable",
                        "target_id": target_id,
                        "reason": reason
                    }, user_id)
            
            elif data['type'] == 'call_answer':
                target_id = data['target_id']
                await manager.send_personal_message({
                    "type": "call_answer",
                    "answerer_id": user_id,
                    "sdp": data['sdp']
                }, target_id)
            
            elif data['type'] == 'ice_candidate':
                target_id = data['target_id']
                await manager.send_personal_message({
                    "type": "ice_candidate",
                    "candidate": data['candidate'],
                    "from_id": user_id
                }, target_id)
            
            elif data['type'] == 'call_end':
                target_id = data['target_id']
                await manager.send_personal_message({
                    "type": "call_end",
                    "from_id": user_id
                }, target_id)
            
            elif data['type'] == 'call_reject':
                target_id = data['target_id']
                await manager.send_personal_message({
                    "type": "call_reject",
                    "from_id": user_id
                }, target_id)
    
    except WebSocketDisconnect:
        manager.disconnect(user_id)

# File Upload endpoint
@api_router.post("/upload")
async def upload_file(file: UploadFile = File(...), user: User = Depends(get_current_user)):
    allowed_types = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/quicktime',
                     'audio/webm', 'audio/ogg', 'audio/mp4', 'audio/mpeg', 'audio/wav',
                     'audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/ogg;codecs=vorbis']
    # Normalise: strip codec params for the check (e.g. audio/webm;codecs=opus → audio/webm)
    base_type = (file.content_type or '').split(';')[0].strip()
    if base_type not in allowed_types and file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail=f"File type '{file.content_type}' not allowed. Allowed: images, video/mp4, audio files")
    
    max_size = 10 * 1024 * 1024  # 10MB
    content = await file.read()
    if len(content) > max_size:
        raise HTTPException(status_code=400, detail="File too large (max 10MB)")
    
    ext = file.filename.split('.')[-1] if '.' in file.filename else 'jpg'
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = UPLOAD_DIR / filename
    
    async with aiofiles.open(filepath, 'wb') as f:
        await f.write(content)
    
    return {"url": f"/api/uploads/{filename}"}

# Get user by user_id (for notification navigation)
@api_router.get("/users/by-id/{user_id}")
async def get_user_by_id(user_id: str, current_user: User = Depends(get_current_user)):
    user = await db.users.find_one({"user_id": user_id}, {"_id": 0, "password_hash": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user

# Serve uploaded files
@api_router.get("/uploads/{filename}")
async def get_upload(filename: str):
    from fastapi.responses import FileResponse
    filepath = UPLOAD_DIR / filename
    if not filepath.exists():
        raise HTTPException(status_code=404, detail="File not found")
    return FileResponse(filepath)

# Check registration status (for pending/rejected users to check)
@api_router.get("/auth/check-registration/{id_number}")
async def check_registration_status(id_number: str):
    reg = await db.registrations.find_one({"id_number": id_number}, {"_id": 0})
    if not reg:
        # Also check if user already exists (approved)
        user_exists = await db.users.find_one({"id_number": id_number}, {"_id": 0})
        if user_exists:
            return {"status": "approved", "message": "Your account has been approved. Please login."}
        return {"status": "not_found"}
    return {
        "status": reg['status'],
        "reg_id": reg['reg_id'],
        "serial_number": reg.get('serial_number'),
        "rejection_reason": reg.get('rejection_reason'),
        "editable_until": reg.get('editable_until'),
        "registration": {k: v for k, v in reg.items() if k not in ['_id']}
    }

# Check username availability
@api_router.get("/auth/check-username/{username}")
async def check_username_available(username: str):
    clean = re.sub(r"[^a-zA-Z0-9_]+", "", username.lower())[:24]
    if not clean or len(clean) < 2:
        return {"available": False, "reason": "Username too short"}
    existing = await db.users.find_one({"username": clean}, {"_id": 0, "user_id": 1})
    existing_reg = await db.registrations.find_one({"preset_username": clean, "status": "pending"}, {"_id": 0})
    return {"available": not existing and not existing_reg, "username": clean}

# Verify registration access (for pending/rejected users to check their own status)
@api_router.post("/auth/verify-registration-access")
async def verify_registration_access(request: dict):
    id_number = request.get('id_number')
    password = request.get('password')
    if not id_number or not password:
        raise HTTPException(status_code=400, detail="ID number and password required")
    reg = await db.registrations.find_one({"id_number": id_number}, {"_id": 0})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    preset_hash = reg.get('preset_password_hash')
    if not preset_hash:
        # No password set - allow access with just ID (for older registrations)
        return {"valid": True}
    try:
        valid = await asyncio.to_thread(
            lambda: bcrypt.checkpw(password.encode("utf-8"), preset_hash.encode("utf-8"))
        )
        return {"valid": valid}
    except Exception:
        return {"valid": False}

# Edit registration within 10-minute window
@api_router.put("/auth/registration/{reg_id}")
async def edit_registration(reg_id: str, updates: dict):
    reg = await db.registrations.find_one({"reg_id": reg_id}, {"_id": 0})
    if not reg:
        raise HTTPException(status_code=404, detail="Registration not found")
    if reg['status'] != 'pending':
        raise HTTPException(status_code=400, detail="Registration already processed")
    
    editable_until = reg.get('editable_until')
    if editable_until:
        deadline = datetime.fromisoformat(editable_until)
        if datetime.now(timezone.utc) > deadline:
            raise HTTPException(status_code=400, detail="Edit window has expired (10 minutes)")
    
    allowed_fields = ['full_name', 'date_of_birth', 'current_class', 'section', 'email', 'phone_number', 'is_ex_student', 'date_of_leaving', 'last_class', 'current_status', 'requested_username', 'requested_password_hash']
    update_data = {k: v for k, v in updates.items() if k in allowed_fields}
    
    if update_data:
        await db.registrations.update_one({"reg_id": reg_id}, {"$set": update_data})
    
    updated = await db.registrations.find_one({"reg_id": reg_id}, {"_id": 0})
    return {"status": "success", "registration": updated}

# Change password (for logged-in users)
@api_router.post("/auth/change-password")
async def change_password(request: dict, user: User = Depends(get_current_user)):
    old_password = request.get('old_password')
    new_password = request.get('new_password')
    if not old_password or not new_password:
        raise HTTPException(status_code=400, detail="Both old and new passwords required")
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters")
    
    db_user = await db.users.find_one({"user_id": user.user_id}, {"_id": 0, "password_hash": 1})
    if not db_user or not db_user.get("password_hash"):
        raise HTTPException(status_code=400, detail="Account has no password set")
    
    valid = await asyncio.to_thread(
        lambda: bcrypt.checkpw(old_password.encode("utf-8"), db_user["password_hash"].encode("utf-8"))
    )
    if not valid:
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    new_hash = await asyncio.to_thread(
        lambda: bcrypt.hashpw(new_password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")
    )
    await db.users.update_one({"user_id": user.user_id}, {"$set": {"password_hash": new_hash}})
    return {"status": "success", "message": "Password changed successfully"}

# Password reset - request OTP
@api_router.post("/auth/password-reset/request")
async def request_password_reset(req: PasswordResetRequest):
    user = await db.users.find_one({"id_number": req.id_number}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    email = user.get('email')
    if not email:
        raise HTTPException(status_code=400, detail="No email on account. Contact admin.")
    
    otp = str(random.randint(100000, 999999))
    otp_storage[f"reset_{req.id_number}"] = {
        "otp": otp,
        "expires_at": datetime.now(timezone.utc) + timedelta(minutes=10)
    }
    
    email_sent = await send_otp_email(email, otp)
    masked_email = email[:3] + "***" + email[email.index('@'):]
    
    if email_sent:
        return {"status": "success", "message": f"OTP sent to {masked_email}"}
    else:
        logger.info(f"Password reset OTP for {req.id_number}: {otp}")
        return {"status": "success", "message": f"OTP sent to {masked_email}", "dev_otp": otp}

# Password reset - verify OTP and set new password
@api_router.post("/auth/password-reset/verify")
async def verify_password_reset(req: PasswordResetVerify):
    stored = otp_storage.get(f"reset_{req.id_number}")
    if not stored:
        raise HTTPException(status_code=400, detail="OTP not found. Please request a new one.")
    if stored['expires_at'] < datetime.now(timezone.utc):
        del otp_storage[f"reset_{req.id_number}"]
        raise HTTPException(status_code=400, detail="OTP expired")
    if stored['otp'] != req.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    password_hash = bcrypt.hashpw(req.new_password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    await db.users.update_one({"id_number": req.id_number}, {"$set": {"password_hash": password_hash}})
    
    del otp_storage[f"reset_{req.id_number}"]
    return {"status": "success", "message": "Password reset successfully"}

# Post delete (owner or mod/admin)
@api_router.delete("/posts/{post_id}")
async def delete_post(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    
    if post['user_id'] != user.user_id and not user.is_admin and not user.is_moderator:
        raise HTTPException(status_code=403, detail="Not authorized to delete this post")
    
    await db.posts.delete_one({"post_id": post_id})
    
    # Log if staff deletion
    if post['user_id'] != user.user_id:
        await log_action(user.user_id, user.display_name, "delete_post", f"Deleted post #{post.get('serial_number', 'N/A')}", post['user_id'], None)
    
    return {"status": "success"}

# Admin edit user info
@api_router.put("/admin/users/{user_id}/edit")
async def admin_edit_user(user_id: str, edit: AdminEditUser, admin: User = Depends(verify_admin)):
    target = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_data = {}
    if edit.display_name is not None: update_data['display_name'] = edit.display_name
    if edit.full_name is not None: update_data['full_name'] = edit.full_name
    if edit.email is not None: update_data['email'] = edit.email
    if edit.current_class is not None: update_data['current_class'] = edit.current_class
    if edit.section is not None: update_data['section'] = edit.section
    if edit.bio is not None: update_data['bio'] = edit.bio
    if edit.badges is not None: update_data['badges'] = edit.badges
    
    if update_data:
        await db.users.update_one({"user_id": user_id}, {"$set": update_data})
        await log_action(admin.user_id, admin.display_name, "edit_user", f"Edited user {target.get('display_name')} ({target.get('id_number')}): {list(update_data.keys())}", user_id, target.get('display_name'))
    
    updated = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return updated

# Report chat message
@api_router.post("/chat/report")
async def report_chat_message(report: ChatMessageReport, user: User = Depends(get_current_user)):
    last_report = await db.reports.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_report.get('serial_number', 0) + 1) if last_report else 1
    
    report_doc = {
        "report_id": str(uuid.uuid4()),
        "serial_number": next_serial,
        "type": "chat_message",
        "message_id": report.message_id,
        "chat_room": report.chat_room,
        "reporter_id": user.user_id,
        "reason": report.reason,
        "category": report.category,
        "status": "pending",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.reports.insert_one(report_doc)
    return {"status": "success", "serial_number": next_serial}

# Search action logs by serial number
@api_router.get("/admin/logs/search/{serial_number}")
async def search_action_log(serial_number: int, user: User = Depends(get_current_user)):
    if not user.is_admin and not user.is_moderator:
        raise HTTPException(status_code=403, detail="Staff access required")
    log = await db.action_logs.find_one({"serial_number": serial_number}, {"_id": 0})
    if not log:
        raise HTTPException(status_code=404, detail="Action log not found")
    return log

# Chat room access check based on section (B=boys, G=girls)
@api_router.get("/chat/rooms")
async def get_available_rooms(user: User = Depends(get_current_user)):
    section = user.section.upper() if user.section else ""
    is_boy = section.startswith('B')
    is_girl = section.startswith('G')
    
    rooms = [{"id": "general", "name": "General", "color": "#3b82f6"}]
    
    if is_boy:
        rooms.append({"id": "boys_only", "name": "Boys Only", "color": "#ef4444"})
    if is_girl:
        rooms.append({"id": "girls_only", "name": "Girls Only", "color": "#ec4899"})
    
    if not user.is_ex_student:
        rooms.append({"id": f"class_{user.current_class}", "name": f"Class {user.current_class}", "color": "#8b5cf6"})
        rooms.append({"id": f"section_{user.current_class}_{user.section}", "name": f"Class {user.current_class} {user.section}", "color": "#f59e0b"})
    
    if user.is_ex_student:
        rooms.append({"id": "ex_students", "name": "EX Students", "color": "#a855f7"})
    
    return rooms


# ============= TICKET SYSTEM ROUTES =============

@api_router.post("/tickets")
async def create_ticket(ticket: TicketCreate, user: User = Depends(get_current_user)):
    last_ticket = await db.tickets.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_ticket.get('serial_number', 0) + 1) if last_ticket else 1

    new_ticket = Ticket(
        serial_number=next_serial,
        subject=ticket.subject,
        category=ticket.category,
        registration_id=ticket.registration_id,
        created_by=user.user_id,
        created_by_name=user.display_name,
        created_by_id_number=user.id_number,
        messages=[{
            "message_id": str(uuid.uuid4()),
            "sender_id": user.user_id,
            "sender_name": user.display_name,
            "sender_type": "user",
            "message": ticket.message,
            "created_at": datetime.now(timezone.utc).isoformat()
        }]
    )
    doc = new_ticket.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.tickets.insert_one(doc)
    return {"status": "success", "ticket_id": new_ticket.ticket_id, "serial_number": next_serial}

@api_router.post("/tickets/anonymous")
async def create_anonymous_ticket(ticket: TicketCreate, id_number: str, name: str):
    last_ticket = await db.tickets.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_ticket.get('serial_number', 0) + 1) if last_ticket else 1

    new_ticket = Ticket(
        serial_number=next_serial,
        subject=ticket.subject,
        category=ticket.category,
        registration_id=ticket.registration_id,
        created_by="anonymous",
        created_by_name=name,
        created_by_id_number=id_number,
        messages=[{
            "message_id": str(uuid.uuid4()),
            "sender_id": id_number,
            "sender_name": name,
            "sender_type": "user",
            "message": ticket.message,
            "created_at": datetime.now(timezone.utc).isoformat()
        }]
    )
    doc = new_ticket.model_dump()
    doc['created_at'] = doc['created_at'].isoformat()
    doc['updated_at'] = doc['updated_at'].isoformat()
    await db.tickets.insert_one(doc)
    return {"status": "success", "ticket_id": new_ticket.ticket_id, "serial_number": next_serial}

@api_router.get("/tickets")
async def get_my_tickets(user: User = Depends(get_current_user)):
    tickets = await db.tickets.find({"created_by": user.user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tickets

@api_router.get("/tickets/{ticket_id}")
async def get_ticket(ticket_id: str, user: User = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket['created_by'] != user.user_id and not user.is_admin and not user.is_moderator:
        raise HTTPException(status_code=403, detail="Not authorized")
    return ticket

@api_router.get("/tickets/anonymous/{ticket_id}")
async def get_anonymous_ticket(ticket_id: str, id_number: str):
    ticket = await db.tickets.find_one({"ticket_id": ticket_id, "created_by_id_number": id_number}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or ID mismatch")
    return ticket

@api_router.post("/tickets/{ticket_id}/reply")
async def reply_to_ticket(ticket_id: str, reply: TicketReply, user: User = Depends(get_current_user)):
    ticket = await db.tickets.find_one({"ticket_id": ticket_id}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    if ticket['created_by'] != user.user_id and not user.is_admin and not user.is_moderator:
        raise HTTPException(status_code=403, detail="Not authorized")

    message = {
        "message_id": str(uuid.uuid4()),
        "sender_id": user.user_id,
        "sender_name": user.display_name,
        "sender_type": "admin" if (user.is_admin or user.is_moderator) else "user",
        "message": reply.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    now = datetime.now(timezone.utc).isoformat()
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"messages": message}, "$set": {"updated_at": now, "status": "in_progress" if ticket['status'] == 'open' else ticket['status']}}
    )
    return {"status": "success"}

@api_router.post("/tickets/anonymous/{ticket_id}/reply")
async def reply_to_anonymous_ticket(ticket_id: str, reply: TicketReply, id_number: str):
    ticket = await db.tickets.find_one({"ticket_id": ticket_id, "created_by_id_number": id_number}, {"_id": 0})
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found or ID mismatch")

    message = {
        "message_id": str(uuid.uuid4()),
        "sender_id": id_number,
        "sender_name": ticket.get('created_by_name', id_number),
        "sender_type": "user",
        "message": reply.message,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$push": {"messages": message}, "$set": {"updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success"}

@api_router.put("/tickets/{ticket_id}/status")
async def update_ticket_status(ticket_id: str, status: str, priority: str = None, admin: User = Depends(verify_moderator)):
    update = {"status": status, "updated_at": datetime.now(timezone.utc).isoformat()}
    if priority:
        update["priority"] = priority
    if status == "resolved":
        update["resolved_at"] = datetime.now(timezone.utc).isoformat()
    await db.tickets.update_one({"ticket_id": ticket_id}, {"$set": update})
    return {"status": "success"}

@api_router.put("/tickets/{ticket_id}/assign")
async def assign_ticket(ticket_id: str, admin: User = Depends(verify_moderator)):
    await db.tickets.update_one(
        {"ticket_id": ticket_id},
        {"$set": {"assigned_to": admin.user_id, "status": "in_progress", "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    return {"status": "success"}

@api_router.get("/admin/tickets")
async def get_all_tickets(admin: User = Depends(verify_moderator), status: str = None, limit: int = 100):
    query = {}
    if status:
        query["status"] = status
    tickets = await db.tickets.find(query, {"_id": 0}).sort("updated_at", -1).limit(limit).to_list(limit)
    return tickets


# REST fallback: send chat message when WebSocket is not available
@api_router.post("/chat/{chat_room}/send")
async def send_chat_message_rest(chat_room: str, body: dict, user: User = Depends(get_current_user)):
    content = body.get("content", "").strip()
    if not content:
        raise HTTPException(status_code=400, detail="Content required")
    if check_spam(user.user_id):
        raise HTTPException(status_code=429, detail="Too many messages")
    last_msg = await db.chat_messages.find_one({}, {"serial_number": 1, "_id": 0}, sort=[("serial_number", -1)])
    next_serial = (last_msg.get("serial_number", 0) + 1) if last_msg else 1
    chat_msg = ChatMessage(
        serial_number=next_serial, chat_room=chat_room,
        user_id=user.user_id, content=content,
        reply_to=body.get("reply_to"), is_gif=body.get("is_gif", False)
    )
    doc = chat_msg.model_dump()
    doc["created_at"] = doc["created_at"].isoformat()
    await db.chat_messages.insert_one(doc)
    ws_user = await db.users.find_one({"user_id": user.user_id},
        {"_id": 0, "display_name": 1, "username": 1, "profile_picture": 1, "id_number": 1, "badges": 1, "role": 1})
    broadcast = {
        "type": "chat_message", "message_id": doc["message_id"],
        "serial_number": next_serial, "chat_room": chat_room,
        "user_id": user.user_id, "content": content,
        "created_at": doc["created_at"], "reactions": {}, "user": ws_user
    }
    await manager.broadcast_to_room(broadcast, chat_room)
    return broadcast


@api_router.put("/posts/{post_id}")
async def edit_post(post_id: str, update: dict, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0})
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post["user_id"] != user.user_id and not user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")
    new_content = update.get("content", "").strip()
    if not new_content:
        raise HTTPException(status_code=400, detail="Content cannot be empty")
    edit_record = {"old_content": post["content"], "new_content": new_content,
                   "edited_at": datetime.now(timezone.utc).isoformat()}
    await db.posts.update_one({"post_id": post_id}, {
        "$set": {"content": new_content, "edited": True},
        "$push": {"edit_history": edit_record}
    })
    return {"status": "success"}

@api_router.get("/posts/{post_id}/edit-history")
async def get_edit_history(post_id: str, user: User = Depends(get_current_user)):
    post = await db.posts.find_one({"post_id": post_id}, {"_id": 0, "edit_history": 1})
    if not post:
        raise HTTPException(status_code=404, detail="Not found")
    return post.get("edit_history", [])


@api_router.delete("/posts/{post_id}/repost")
async def unrepost(post_id: str, user: User = Depends(get_current_user)):
    """Remove user's repost of a given post"""
    repost_doc = await db.posts.find_one({"user_id": user.user_id, "repost_of": post_id}, {"_id": 0, "post_id": 1})
    if not repost_doc:
        raise HTTPException(status_code=404, detail="You haven't reposted this post")
    await db.posts.delete_one({"post_id": repost_doc["post_id"]})
    await db.posts.update_one({"post_id": post_id}, {"$inc": {"share_count": -1}})
    return {"status": "success", "message": "Repost removed"}


# ── Global Chat Archive ──────────────────────────────────────────────────────
async def archive_global_chat():
    """Archive all chat messages from a room into chat_archives collection"""
    now = datetime.now(timezone.utc)
    for room_id in ['general']:  # archive main rooms
        messages = await db.chat_messages.find({"chat_room": room_id}, {"_id": 0}).to_list(None)
        if messages:
            await db.chat_archives.insert_one({
                "archive_id": str(uuid.uuid4()),
                "chat_room": room_id,
                "archived_at": now.isoformat(),
                "message_count": len(messages),
                "messages": messages
            })
    await db.chat_messages.delete_many({})
    logger.info(f"Global chat archived at {now.isoformat()}")

async def scheduled_chat_archive():
    """Archive global chat every 12h at 1:00 AM and 1:00 PM UTC+3 (22:00 and 10:00 UTC)"""
    while True:
        try:
            now = datetime.now(timezone.utc)
            utc3 = now + timedelta(hours=3)
            # Next archive times in UTC+3
            candidates = [
                utc3.replace(hour=1,  minute=0, second=0, microsecond=0),
                utc3.replace(hour=13, minute=0, second=0, microsecond=0),
                (utc3 + timedelta(days=1)).replace(hour=1, minute=0, second=0, microsecond=0),
            ]
            next_local = min((t for t in candidates if t > utc3), default=candidates[-1])
            next_utc = next_local - timedelta(hours=3)
            wait = max(0, (next_utc - now).total_seconds())
            logger.info(f"Next chat archive in {wait/3600:.1f}h at {next_utc.isoformat()}")
            await asyncio.sleep(wait)
            await archive_global_chat()
        except Exception as e:
            logger.error(f"Chat archive error: {e}")
            await asyncio.sleep(3600)  # retry in 1h on error

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(scheduled_chat_archive())

@api_router.get("/chat/archives")
async def get_chat_archives(user: User = Depends(verify_moderator), skip: int = 0, limit: int = 20):
    """Get list of archived chat sessions (mods only)"""
    archives = await db.chat_archives.find({}, {"_id": 0, "messages": 0}).sort("archived_at", -1).skip(skip).limit(limit).to_list(limit)
    return archives

@api_router.get("/chat/archives/{archive_id}")
async def get_archive_detail(archive_id: str, user: User = Depends(verify_moderator)):
    """Get full archived chat session (mods only)"""
    archive = await db.chat_archives.find_one({"archive_id": archive_id}, {"_id": 0})
    if not archive:
        raise HTTPException(status_code=404, detail="Archive not found")
    return archive

@api_router.post("/chat/archive-now")
async def trigger_archive_now(user: User = Depends(verify_moderator)):
    """Manually trigger chat archive (mods only)"""
    await archive_global_chat()
    return {"status": "success", "message": "Chat archived"}


# ICE/TURN configuration for WebRTC calls
@api_router.get("/call/ice-config")
async def get_ice_config(user: User = Depends(get_current_user)):
    """Returns ICE server list. Set METERED_API_KEY env var for reliable TURN."""
    servers = [
        {"urls": "stun:stun.l.google.com:19302"},
        {"urls": "stun:stun1.l.google.com:19302"},
        {"urls": "stun:stun2.l.google.com:19302"},
        {"urls": "stun:stun3.l.google.com:19302"},
    ]
    
    # If Metered.ca API key is set — fetch fresh ephemeral TURN credentials
    metered_key = os.environ.get("METERED_API_KEY", "")
    if metered_key:
        try:
            import httpx
            url = f"https://bisdhub.metered.live/api/v1/turn/credentials?apiKey={metered_key}"
            r = httpx.get(url, timeout=5)
            if r.status_code == 200:
                metered_servers = r.json()
                servers.extend(metered_servers)
                logger.info(f"Loaded {len(metered_servers)} TURN servers from Metered")
        except Exception as e:
            logger.warning(f"Could not fetch Metered TURN credentials: {e}")
    
    # Always add free public TURN fallbacks — multiple providers, UDP+TCP+TLS
    servers.extend([
        # freestun.net (UDP + TLS)
        {"urls": ["turn:freestun.net:3478"],  "username": "free", "credential": "free"},
        {"urls": ["turns:freestun.net:5349"], "username": "free", "credential": "free"},
        # Open Relay (multiple ports including TCP for restrictive networks)
        {"urls": ["turn:openrelay.metered.ca:80"],  "username": "openrelayproject", "credential": "openrelayproject"},
        {"urls": ["turn:openrelay.metered.ca:80?transport=tcp"], "username": "openrelayproject", "credential": "openrelayproject"},
        {"urls": ["turn:openrelay.metered.ca:443"], "username": "openrelayproject", "credential": "openrelayproject"},
        {"urls": ["turn:openrelay.metered.ca:443?transport=tcp"], "username": "openrelayproject", "credential": "openrelayproject"},
        {"urls": ["turns:openrelay.metered.ca:443"], "username": "openrelayproject", "credential": "openrelayproject"},
    ])
    
    return {"ice_servers": servers, "has_metered": bool(metered_key)}

# Spam detection - rate limiting per user
spam_tracker = {}
SPAM_WINDOW = 10  # seconds
SPAM_MAX_MESSAGES = 5

def check_spam(user_id: str) -> bool:
    now = datetime.now(timezone.utc).timestamp()
    if user_id not in spam_tracker:
        spam_tracker[user_id] = []
    
    # Clean old entries
    spam_tracker[user_id] = [t for t in spam_tracker[user_id] if now - t < SPAM_WINDOW]
    
    if len(spam_tracker[user_id]) >= SPAM_MAX_MESSAGES:
        return True  # is spam
    
    spam_tracker[user_id].append(now)
    return False

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
