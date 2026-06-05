from fastapi.testclient import TestClient
from main import app
import pytest

client = TestClient(app)


# ─── Signup Tests ─────────────────────────────────────────────────────────────

def test_signup_success():
    response = client.post("/signup", json={"username": "testuser", "password": "test123"})
    assert response.status_code == 200
    assert "message" in response.json()

def test_signup_duplicate_username():
    client.post("/signup", json={"username": "dupuser", "password": "test123"})
    response = client.post("/signup", json={"username": "dupuser", "password": "test123"})
    assert response.json()["error"] == "Username already exists"

def test_signup_short_password():
    response = client.post("/signup", json={"username": "shortpass", "password": "ab"})
    assert response.status_code == 422  # Pydantic validation error


# ─── Login Tests ──────────────────────────────────────────────────────────────

def test_login_success():
    client.post("/signup", json={"username": "loginuser", "password": "pass123"})
    response = client.post("/login", json={"username": "loginuser", "password": "pass123"})
    assert response.status_code == 200
    assert "token" in response.json()
    assert response.json()["username"] == "loginuser"

def test_login_wrong_password():
    client.post("/signup", json={"username": "wrongpass", "password": "correct123"})
    response = client.post("/login", json={"username": "wrongpass", "password": "wrong"})
    assert response.json()["error"] == "Wrong password"

def test_login_unknown_user():
    response = client.post("/login", json={"username": "nobody", "password": "test123"})
    assert response.json()["error"] == "Username not found"


# ─── Log Tests ────────────────────────────────────────────────────────────────

def test_log_without_token():
    response = client.post("/log", json={
        "username": "testuser",
        "song": "song1.mp3",
        "latitude": 12.97,
        "longitude": 77.59
    })
    assert response.json()["error"] == "Invalid or missing token"

def test_log_with_valid_token():
    client.post("/signup", json={"username": "loguser", "password": "pass123"})
    login = client.post("/login", json={"username": "loguser", "password": "pass123"})
    token = login.json()["token"]

    response = client.post("/log",
        json={"username": "loguser", "song": "song1.mp3", "latitude": 12.97, "longitude": 77.59},
        headers={"token": token}
    )
    assert response.status_code == 200
    assert "match" in response.json()


# ─── Chat Tests ───────────────────────────────────────────────────────────────

def test_send_message_without_token():
    response = client.post("/chat/send", json={"receiver": "someone", "content": "hello"})
    assert response.json()["error"] == "Invalid or missing token"

def test_send_and_receive_message():
    client.post("/signup", json={"username": "sender", "password": "pass123"})
    client.post("/signup", json={"username": "receiver", "password": "pass123"})

    login = client.post("/login", json={"username": "sender", "password": "pass123"})
    token = login.json()["token"]

    send = client.post("/chat/send",
        json={"receiver": "receiver", "content": "Hello!"},
        headers={"token": token}
    )
    assert send.status_code == 200

    messages = client.get("/chat/messages/receiver", headers={"token": token})
    assert messages.status_code == 200
    assert len(messages.json()["messages"]) > 0
    assert messages.json()["messages"][0]["content"] == "Hello!"
