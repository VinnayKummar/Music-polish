// ─── State ───────────────────────────────────────────────────────────────────
let audio            = new Audio();
let matchInterval;
let chatInterval;
let currentSongIndex = 0;
let matchedUser      = null;
let chatShown        = false;

const allSongs = ["song1.mp3", "song2.mp3", "song3.mp3", "song4.mp3"];
const API      = "http://127.0.0.1:8000";


// ─── On Page Load ────────────────────────────────────────────────────────────

window.onload = () => {
    const username = localStorage.getItem("username");
    if (username) showApp(username);
};


// ─── Auth ─────────────────────────────────────────────────────────────────────

async function signup() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const msg      = document.getElementById("authMessage");

    if (!username || !password) {
        msg.textContent = "Please fill in both fields.";
        return;
    }

    msg.textContent = "Creating account...";

    try {
        const res  = await fetch(`${API}/signup`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ username, password })
        });
        const data = await res.json();
        msg.textContent = data.error || "Account created! Now login.";
    } catch {
        msg.textContent = "Server error. Is the backend running?";
    }
}

async function login() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const msg      = document.getElementById("authMessage");

    if (!username || !password) {
        msg.textContent = "Please fill in both fields.";
        return;
    }

    msg.textContent = "Logging in...";

    try {
        const res  = await fetch(`${API}/login`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ username, password })
        });
        const data = await res.json();

        if (data.error) {
            msg.textContent = data.error;
        } else {
            localStorage.setItem("token",    data.token);
            localStorage.setItem("username", data.username);
            showApp(data.username);
        }
    } catch {
        msg.textContent = "Server error. Is the backend running?";
    }
}

function logout() {
    localStorage.removeItem("token");
    localStorage.removeItem("username");
    audio.pause();
    clearInterval(matchInterval);
    clearInterval(chatInterval);
    matchedUser = null;
    document.getElementById("authSection").classList.remove("hidden");
    document.getElementById("appSection").classList.add("hidden");
    document.getElementById("chatSection").classList.add("hidden");
}

function showApp(username) {
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("appSection").classList.remove("hidden");
    document.getElementById("userGreeting").textContent = "👋 Hello, " + username;
}


// ─── Location Helpers ─────────────────────────────────────────────────────────

async function getCityName(latitude, longitude) {
    try {
        const res  = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
        );
        const data = await res.json();
        const city    = data.address.city || data.address.town || data.address.village || "";
        const country = data.address.country || "";
        return `${city}, ${country}`;
    } catch {
        return "a nearby location";
    }
}


// ─── Match ───────────────────────────────────────────────────────────────────

function checkMatch(songFile, latitude, longitude) {
    const token    = localStorage.getItem("token");
    const username = localStorage.getItem("username");

    if (!token || !username) return;

    fetch(`${API}/log`, {
        method:  "POST",
        headers: {
            "Content-Type": "application/json",
            "token": token
        },
        body: JSON.stringify({ username, song: songFile, latitude, longitude })
    })
    .then(res => res.json())
    .then(async data => {
        const matchEl = document.getElementById("matchResult");

        if (data.match === true) {
            matchEl.textContent   = `${data.listeners.length} people listening to ${songFile}!`;
            matchEl.style.color   = "#1db954";
            showListenersList(data.listeners);
        } else {
            matchEl.textContent = "No match found yet. Keep listening!";
            matchEl.style.color = "#aaa";
        }
    })
    .catch(() => {
        document.getElementById("matchResult").textContent = "Connection error.";
    });
}

function startPolling(songFile) {
    clearInterval(matchInterval);
    matchInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
            pos => checkMatch(songFile, pos.coords.latitude, pos.coords.longitude),
            ()  => checkMatch(songFile, 0, 0)
        );
    }, 3000);
}


// ─── Player ──────────────────────────────────────────────────────────────────

function playSong(songFile, element) {
    const username = localStorage.getItem("username");

    if (!username) {
        alert("Please login first.");
        return;
    }

    // Hide listeners popup and chat when switching songs
    document.getElementById("listenersList").classList.add("hidden");
    document.getElementById("chatSection").classList.add("hidden");
    clearInterval(chatInterval);
    matchedUser = null;

    // Play song immediately — don't wait for GPS
    currentSongIndex = allSongs.indexOf(songFile);
    audio.src        = "music/" + songFile;
    audio.play();

    document.getElementById("nowPlaying").textContent   = "Now playing: " + songFile;
    document.getElementById("playPauseBtn").textContent = "⏸ Pause";

    document.querySelectorAll("#songList li").forEach(li => li.classList.remove("active"));
    element.classList.add("active");

    // Start matching immediately with default coords
    checkMatch(songFile, 0, 0);
    startPolling(songFile);

    // Update with real GPS in background if available
    navigator.geolocation.getCurrentPosition(pos => {
        const { latitude, longitude } = pos.coords;
        checkMatch(songFile, latitude, longitude);
    }, () => {
        // GPS not available — matching still works by song name
    });
}

function nextSong() {
    currentSongIndex = (currentSongIndex + 1) % allSongs.length;
    const el = document.querySelectorAll("#songList li")[currentSongIndex];
    playSong(allSongs[currentSongIndex], el);
}

function previousSong() {
    currentSongIndex = (currentSongIndex - 1 + allSongs.length) % allSongs.length;
    const el = document.querySelectorAll("#songList li")[currentSongIndex];
    playSong(allSongs[currentSongIndex], el);
}

function togglePlayPause() {
    if (!audio.src || audio.src === window.location.href) {
        const el = document.querySelectorAll("#songList li")[currentSongIndex];
        playSong(allSongs[currentSongIndex], el);
    } else if (audio.paused) {
        audio.play();
        document.getElementById("playPauseBtn").textContent = "⏸ Pause";
    } else {
        audio.pause();
        document.getElementById("playPauseBtn").textContent = "▶ Play";
    }
}

audio.addEventListener("ended", nextSong);

audio.addEventListener("timeupdate", () => {
    if (audio.duration) {
        document.getElementById("progressBar").value = (audio.currentTime / audio.duration) * 100;
    }
});

document.getElementById("progressBar").addEventListener("input", function () {
    audio.currentTime = (this.value / 100) * audio.duration;
});


// ─── Listeners List ───────────────────────────────────────────────────────────

async function showListenersList(listeners) {
    const currentUser = localStorage.getItem("username");
    const listEl = document.getElementById("listenersList");

    if (!listEl) {
        // Create listeners list popup if it doesn't exist
        const popup = document.createElement("div");
        popup.id = "listenersList";
        popup.className = "listeners-popup";
        document.getElementById("appSection").appendChild(popup);
    }

    const listEl2 = document.getElementById("listenersList");
    listEl2.innerHTML = "<h3>People listening to this song:</h3>";

    // Filter out current user and show only others
    const others = listeners.filter(l => l.username !== currentUser);

    if (others.length === 0) {
        listEl2.innerHTML += "<p>No one else listening right now.</p>";
        listEl2.classList.remove("hidden");
        return;
    }

    for (const listener of others) {
        const city = await getCityName(listener.latitude, listener.longitude);
        const div = document.createElement("div");
        div.className = "listener-item";
        div.innerHTML = `
            <span>${listener.username}</span>
            <span>${city}</span>
            <button type="button" onclick="startChat('${listener.username}')">Chat</button>
        `;
        listEl2.appendChild(div);
    }

    listEl2.classList.remove("hidden");
}

// ─── Chat ─────────────────────────────────────────────────────────────────────

function startChat(otherUser) {
    matchedUser = otherUser;
    document.getElementById("listenersList").classList.add("hidden");
    document.getElementById("chatSection").classList.remove("hidden");
    document.getElementById("chatWith").textContent = otherUser;
    loadMessages(otherUser);
    clearInterval(chatInterval);
    chatInterval = setInterval(() => loadMessages(otherUser), 3000);
}

function closeChat() {
    document.getElementById("chatSection").classList.add("hidden");
    clearInterval(chatInterval);
    matchedUser = null;
    chatShown = false;
}

async function loadMessages(otherUser) {
    const token = localStorage.getItem("token");

    try {
        const res  = await fetch(`${API}/chat/messages/${otherUser}`, {
            headers: { "token": token }
        });
        const data = await res.json();

        const chatBox = document.getElementById("chatBox");
        chatBox.innerHTML = "";

        data.messages.forEach(m => {
            const div       = document.createElement("div");
            div.classList.add("message", m.mine ? "mine" : "theirs");
            div.innerHTML   = `
                <span class="msg-text">${m.content}</span>
                <span class="msg-time">${m.timestamp}</span>
            `;
            chatBox.appendChild(div);
        });

        chatBox.scrollTop = chatBox.scrollHeight;
    } catch {
        console.error("Failed to load messages.");
    }
}

async function sendMessage() {
    const token   = localStorage.getItem("token");
    const content = document.getElementById("chatInput").value.trim();

    if (!content || !matchedUser) return;

    try {
        await fetch(`${API}/chat/send`, {
            method:  "POST",
            headers: {
                "Content-Type": "application/json",
                "token": token
            },
            body: JSON.stringify({ receiver: matchedUser, content })
        });

        document.getElementById("chatInput").value = "";
        loadMessages(matchedUser);
    } catch {
        console.error("Failed to send message.");
    }
}

// Send on Enter key
document.getElementById("chatInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage();
});
