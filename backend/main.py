from fastapi import FastAPI, Header
from fastapi.middleware.cors import CORSMiddleware
from database import User, Message, Session
from auth import hash_password, verify_password
from models import LogRequest, SignupRequest, LoginRequest, ChatRequest
from datetime import datetime, timedelta
import jwt

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEY = "polish-secret-key-change-in-production"
ALGORITHM  = "HS256"


def create_jwt_token(username: str) -> str:
    payload = {
        "username": username,
        "exp": datetime.utcnow() + timedelta(days=7)
    }
    return jwt.encode(payload, SECRET_KEY, algorithm=ALGORITHM)


def verify_jwt_token(token: str) -> str:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload.get("username")
    except jwt.PyJWTError:
        return None


# ─── Signup ──────────────────────────────────────────────

@app.post("/signup")
async def signup(request: SignupRequest):
    session = Session()
    try:
        existing = session.query(User).filter_by(username=request.username).first()
        if existing:
            return {"error": "Username already exists"}

        new_user = User(
            username=request.username,
            password=hash_password(request.password),
            song="",
            latitude=0,
            longitude=0
        )
        session.add(new_user)
        session.commit()
        return {"message": "User created successfully"}
    finally:
        session.close()


# ─── Login ───────────────────────────────────────────────

@app.post("/login")
async def login(request: LoginRequest):
    session = Session()
    try:
        user = session.query(User).filter_by(username=request.username).first()
        if not user:
            return {"error": "Username not found"}
        if not verify_password(request.password, user.password):
            return {"error": "Wrong password"}

        token = create_jwt_token(request.username)
        return {
            "message": "Login successful",
            "token": token,
            "username": request.username
        }
    finally:
        session.close()


# ─── Log song + find match ───────────────────────────────

@app.post("/log")
async def log_data(request: LogRequest, token: str = Header(None)):
    username = verify_jwt_token(token)
    if not username:
        return {"error": "Invalid or missing token"}

    session = Session()
    try:
        # Update current user's song and location
        user = session.query(User).filter_by(username=username).first()
        if user:
            user.song        = request.song
            user.latitude    = request.latitude
            user.longitude   = request.longitude
            user.last_active = datetime.utcnow()
        else:
            user = User(
                username=username,
                song=request.song,
                latitude=request.latitude,
                longitude=request.longitude,
                last_active=datetime.utcnow()
            )
            session.add(user)
        session.commit()

        # Find ALL users listening to the same song
        listeners = session.query(User).filter(
            User.song == request.song,
            User.username != username
        ).all()

        if listeners:
            return {
                "match": True,
                "listeners": [
                    {
                        "username": listener.username,
                        "latitude": listener.latitude,
                        "longitude": listener.longitude
                    }
                    for listener in listeners
                ]
            }

        return {"match": False}
    finally:
        session.close()


# ─── Chat: Send message ──────────────────────────────────

@app.post("/chat/send")
async def send_message(request: ChatRequest, token: str = Header(None)):
    username = verify_jwt_token(token)
    if not username:
        return {"error": "Invalid or missing token"}

    session = Session()
    try:
        message = Message(
            sender=username,
            receiver=request.receiver,
            content=request.content,
            timestamp=datetime.utcnow().strftime("%H:%M")
        )
        session.add(message)
        session.commit()
        return {"message": "Message sent"}
    finally:
        session.close()


# ─── Chat: Get messages ──────────────────────────────────

@app.get("/chat/messages/{other_user}")
async def get_messages(other_user: str, token: str = Header(None)):
    username = verify_jwt_token(token)
    if not username:
        return {"error": "Invalid or missing token"}

    session = Session()
    try:
        messages = session.query(Message).filter(
            ((Message.sender == username) & (Message.receiver == other_user)) |
            ((Message.sender == other_user) & (Message.receiver == username))
        ).all()

        return {
            "messages": [
                {
                    "sender":    m.sender,
                    "content":   m.content,
                    "timestamp": m.timestamp,
                    "mine":      m.sender == username
                }
                for m in messages
            ]
        }
    finally:
        session.close()


# ─── Check Active Users ──────────────────────────────────

@app.get("/users/active")
async def get_active_users(token: str = Header(None)):
    username = verify_jwt_token(token)
    if not username:
        return {"error": "Invalid or missing token"}

    session = Session()
    try:
        total = session.query(User).count()
        active = session.query(User).filter(User.song != "").all()

        return {
            "total_users": total,
            "active_listening": len(active),
            "users": [
                {
                    "username": u.username,
                    "song": u.song,
                    "city": "checking..." if u.latitude == 0 else "cached"
                }
                for u in active
            ]
        }
    finally:
        session.close()
