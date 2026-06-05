from fastapi import FastAPI, Header, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from database import User, Message, Session
from auth import hash_password, verify_password
from models import LogRequest, SignupRequest, LoginRequest, ChatRequest
from datetime import datetime, timedelta
import jwt
import json

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

# ─────────────────────────────────────────────────────────────────
# WebSocket: Store active connections (socket → username mapping)
# When someone connects to /ws/chat, we add them here
# When they disconnect, we remove them
# ─────────────────────────────────────────────────────────────────
active_connections = {}


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

        # Only show users active in the last 30 seconds
        # The app polls every 3 seconds, so 30s = 10 missed polls = truly offline
        thirty_seconds_ago = datetime.utcnow() - timedelta(seconds=30)
        listeners = session.query(User).filter(
            User.song        == request.song,
            User.username    != username,
            User.last_active >= thirty_seconds_ago   # ← Currently active only
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


# ─────────────────────────────────────────────────────────────────
# WebSocket: Real-time chat
# ─────────────────────────────────────────────────────────────────
# How it works:
# 1. Client connects to /ws/chat
# 2. Client sends messages with type: "message", "typing", etc.
# 3. Server broadcasts to ALL connected clients
# 4. Each client receives messages in real-time
# ─────────────────────────────────────────────────────────────────

@app.websocket("/ws/chat")
async def websocket_endpoint(websocket: WebSocket):
    """
    WebSocket endpoint for real-time chat.

    Accepts messages in this format:
    {
        "type": "message" | "typing" | "typing_stopped",
        "text": "hello world",
        "sender": "alice"
    }

    Broadcasts messages to all connected clients.
    """

    # Accept the WebSocket connection from the client
    # This is like saying "yes, I'll connect with you"
    await websocket.accept()

    # Add this connection to our active connections dictionary
    # Key: the WebSocket object itself
    # Value: the username (we'll extract this from the first message)
    connection_id = id(websocket)
    active_connections[connection_id] = {
        "websocket": websocket,
        "username": None
    }

    print(f"✓ Client connected. Total: {len(active_connections)}")

    try:
        # Keep listening for messages from this client
        # This loop runs forever until the client disconnects
        while True:
            # Wait for a message from the client
            # This is a blocking call — we pause here until data arrives
            data = await websocket.receive_text()

            # Parse the JSON message
            message = json.loads(data)
            print(f"Received: {message}")

            # Extract sender name for logging
            if message.get("sender"):
                active_connections[connection_id]["username"] = message.get("sender")

            # Broadcast this message to ALL connected clients
            # This lets everyone in the chat see what this person sent
            for conn_id, conn_info in active_connections.items():
                try:
                    # Send the message to this client
                    await conn_info["websocket"].send_text(json.dumps(message))
                except Exception as e:
                    # If sending fails, that client is probably disconnected
                    print(f"Failed to send to {conn_id}: {e}")

    except WebSocketDisconnect:
        # Client closed the connection (closed browser tab, navigation, etc.)
        print(f"✗ Client disconnected")
        # Remove them from active connections
        active_connections.pop(connection_id, None)
        print(f"  Total now: {len(active_connections)}")

    except Exception as e:
        print(f"WebSocket error: {e}")
        active_connections.pop(connection_id, None)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=False)
