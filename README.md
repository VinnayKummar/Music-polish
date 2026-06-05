# 🎵 Polish — Music Matching App

> **Connect with strangers who are listening to the same song as you, right now.**

Polish is a real-time full-stack web application that detects musical overlap between users and creates spontaneous human connections through shared listening moments and live chat.

---

## 📸 Preview

| Login | Dashboard | Listening Nearby |
|-------|-----------|-----------------|
| Dark minimal auth screen | Vinyl disc + library | Live matched users with chat |

---

## ✨ Features

- 🔐 **Secure Authentication** — JWT tokens + bcrypt password hashing
- 🎵 **Real-Time Music Matching** — detects users playing the same song within a 30-second live window
- 📍 **Geolocation** — shows where matched users are in the world
- 💬 **Live Chat** — message matched users with full history stored in database
- ⌨️ **Typing Indicators** — animated bouncing dots + live text preview via WebSocket
- 🎨 **Custom UI** — dark ambient theme, spinning vinyl disc, per-song gradient colours
- 📱 **Responsive** — works on mobile and desktop

---

## 🛠 Tech Stack

### Backend
| Technology | Purpose |
|-----------|---------|
| Python 3.11 | Core language |
| FastAPI | REST API + WebSocket server |
| SQLAlchemy | ORM — database models and queries |
| SQLite | Lightweight relational database |
| bcrypt | Password hashing |
| PyJWT | JWT token generation and verification |
| Uvicorn | ASGI server |

### Frontend
| Technology | Purpose |
|-----------|---------|
| HTML5 | Semantic page structure |
| CSS3 | Custom animations, responsive grid, glassmorphism |
| Vanilla JavaScript | DOM manipulation, fetch API, WebSocket client |

### APIs
| API | Purpose |
|-----|---------|
| Browser Geolocation API | GPS coordinates |
| Nominatim (OpenStreetMap) | Reverse geocoding (coordinates → city name) |
| WebSocket | Real-time bidirectional communication |

---

## 📁 Project Structure

```
Music/
├── backend/
│   ├── main.py          # API endpoints + WebSocket server
│   ├── database.py      # SQLAlchemy models (User, Message tables)
│   ├── auth.py          # bcrypt password hashing + verification
│   ├── models.py        # Pydantic request validation schemas
│   ├── requirements.txt # Python dependencies
│   └── test_main.py     # 10 automated unit tests
│
└── frontend/
    ├── index.html       # App structure
    ├── style.css        # All styling + animations
    ├── script.js        # App logic + WebSocket client
    └── music/
        ├── song1.mp3
        ├── song2.mp3
        ├── song3.mp3
        └── song4.mp3
```

---

## 🚀 Getting Started

### Prerequisites

- Python 3.9 or higher
- pip (Python package manager)
- A modern browser (Chrome, Firefox, Edge)
- VS Code with Live Server extension (for frontend)

### 1. Clone the repository

```bash
git clone https://github.com/VinnayKummar/Music-polish.git
cd Music-polish
```

### 2. Set up the backend

```bash
cd backend

# Create a virtual environment
python -m venv venv

# Activate it
# On Windows:
venv\Scripts\activate
# On Mac/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

### 3. Run the backend

```bash
python main.py
```

You should see:
```
INFO:     Uvicorn running on http://127.0.0.1:8000
INFO:     Application startup complete.
```

### 4. Run the frontend

Open `frontend/index.html` with **Live Server** in VS Code.

Or navigate to: `http://127.0.0.1:5500/frontend/`

### 5. Test the app

1. Open **two browser tabs**
2. Sign up with two different usernames
3. Both play **Song 1**
4. Watch the **"Listening Nearby"** panel appear
5. Click **💬 Chat** and message each other live

---

## 🧪 Running Tests

```bash
cd backend
pytest test_main.py -v
```

Expected output:
```
test_main.py::test_signup PASSED
test_main.py::test_login PASSED
test_main.py::test_wrong_password PASSED
test_main.py::test_duplicate_signup PASSED
... (10 tests total)
```

---

## 🔌 API Reference

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| POST | `/signup` | Create new account | No |
| POST | `/login` | Login, get JWT token | No |
| POST | `/log` | Log current song + find matches | Yes |
| POST | `/chat/send` | Send a message | Yes |
| GET | `/chat/messages/{user}` | Get message history | Yes |
| GET | `/users/active` | Get all active users | Yes |
| WS | `/ws/chat` | WebSocket for typing indicators | No |

### Authentication
All protected endpoints require a `token` header:
```
token: eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## ⚙️ Environment Variables

For production, set these environment variables:

```env
SECRET_KEY=your-secret-key-here
DATABASE_URL=sqlite:///./polish.db
```

---

## 🐛 Known Issues & Solutions

**WinError 10048 — Port already in use**
```bash
# Find and kill the process using port 8000
netstat -ano | findstr :8000
taskkill /PID <PID_NUMBER> /F
```

**Ghost users showing in Listening Nearby**
> Fixed — app uses a 30-second active window. Users who close the app disappear automatically within 30 seconds.

---

## 🗺 Roadmap

- [ ] Deploy to production (Render + Vercel)
- [ ] Add real song metadata (title, artist, album art)
- [ ] Migrate to PostgreSQL for production
- [ ] Add user profiles and avatars
- [ ] Push notifications for new matches
- [ ] TypeScript migration

---

## 👨‍💻 Author

**Vinay Kumar**
- GitHub: [@VinnayKummar](https://github.com/VinnayKummar)
- LinkedIn: [linkedin.com/in/vinaykumar](https://linkedin.com)

---

## 📄 License

This project is open source and available under the [MIT License](LICENSE).

---

<p align="center">Built with ❤️ — because music is better when shared</p>
