let audio            = new Audio();
let matchInterval;
let chatInterval;
let currentSongIndex = 0;
let matchedUser      = null;
let chatShown        = false;
let chatWs           = null;
let notifyWs         = null;
let typingTimeout    = null;

const allSongs = ["song1.mp3", "song2.mp3", "song3.mp3", "song4.mp3"];
const API      = "";
const WS_HOST  = (location.protocol === "https:" ? "wss://" : "ws://") + location.host;


window.onload = () => {
    const username = localStorage.getItem("username");
    if (username) showApp(username);
};


// ─── Auth ─────────────────────────────────────────────────────────────────────

async function signup() {
    const username = document.getElementById("username").value.trim();
    const password = document.getElementById("password").value;
    const msg      = document.getElementById("authMessage");

    if (!username || !password) { msg.textContent = "Please fill in both fields."; return; }
    msg.textContent = "Creating account...";

    try {
        const res  = await fetch(`${API}/signup`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
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

    if (!username || !password) { msg.textContent = "Please fill in both fields."; return; }
    msg.textContent = "Logging in...";

    try {
        const res  = await fetch(`${API}/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
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
    closeChatWs();
    matchedUser = null;
    document.getElementById("authSection").classList.remove("hidden");
    document.getElementById("appSection").classList.add("hidden");
    document.getElementById("chatSection").classList.add("hidden");
}

function showApp(username) {
    document.getElementById("authSection").classList.add("hidden");
    document.getElementById("appSection").classList.remove("hidden");
    document.getElementById("userGreeting").textContent = "👋 Hello, " + username;
    openNotifyWs(username);
}

function openNotifyWs(username) {
    if (notifyWs) notifyWs.close();
    notifyWs = new WebSocket(`${WS_HOST}/ws/notify`);
    notifyWs.onopen = () => {
        notifyWs.send(JSON.stringify({ type: "register", username }));
    };
    notifyWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.type === "match_found") {
            const matchEl = document.getElementById("matchResult");
            matchEl.textContent = "🎵 Finding where they are...";
            matchEl.style.color = "#fff";
            showListenersList(data.listeners, matchEl);
        }
    };
    notifyWs.onclose = () => setTimeout(() => openNotifyWs(username), 3000);
    notifyWs.onerror = () => { notifyWs.close(); };
}


// ─── Location ─────────────────────────────────────────────────────────────────

async function getCityName(latitude, longitude) {
    if (latitude && longitude && latitude !== 0 && longitude !== 0) {
        try {
            const res  = await fetch(
                `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&format=json`
            );
            const data = await res.json();
            const city    = data.address.city || data.address.town || data.address.village || data.address.county || "";
            const country = data.address.country_code?.toUpperCase() || "";
            if (city || country) return `📍 ${city}${city && country ? ", " : ""}${country}`;
        } catch {}
    }

    try {
        const res  = await fetch("https://ipapi.co/json/");
        const data = await res.json();
        const city    = data.city || "";
        const country = data.country_code || "";
        if (city || country) return `📍 ${city}${city && country ? ", " : ""}${country}`;
    } catch {}

    return "📍 Location unknown";
}


// ─── Match ────────────────────────────────────────────────────────────────────

function checkMatch(songFile, latitude, longitude) {
    const token    = localStorage.getItem("token");
    const username = localStorage.getItem("username");
    if (!token || !username) return;

    fetch(`${API}/log`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "token": token },
        body: JSON.stringify({ username, song: songFile, latitude, longitude })
    })
    .then(res => res.json())
    .then(async data => {
        const matchEl = document.getElementById("matchResult");
        if (data.match === true) {
            matchEl.textContent = "🎵 Finding where they are...";
            matchEl.style.color = "#fff";
            showListenersList(data.listeners, matchEl);
        } else {
            matchEl.textContent = "No match yet — keep listening!";
            matchEl.style.color = "rgba(255,255,255,0.7)";
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
    }, 1000);
}


// ─── Player ───────────────────────────────────────────────────────────────────

function playSong(songFile, element) {
    const username = localStorage.getItem("username");
    if (!username) { alert("Please login first."); return; }

    document.getElementById("listenersList").classList.add("hidden");
    document.getElementById("chatSection").classList.add("hidden");
    clearInterval(chatInterval);
    closeChatWs();
    matchedUser = null;

    currentSongIndex = allSongs.indexOf(songFile);
    audio.src        = "music/" + songFile;
    audio.play();

    document.getElementById("nowPlaying").textContent   = songFile.replace(".mp3", "");
    document.getElementById("playPauseBtn").textContent = "⏸";
    document.getElementById("vinylDisc").classList.add("playing");

    document.querySelectorAll(".track-card").forEach(c => c.classList.remove("active"));
    element.classList.add("active");

    checkMatch(songFile, 0, 0);
    startPolling(songFile);

    navigator.geolocation.getCurrentPosition(pos => {
        checkMatch(songFile, pos.coords.latitude, pos.coords.longitude);
    }, () => {});
}

function nextSong() {
    currentSongIndex = (currentSongIndex + 1) % allSongs.length;
    playSong(allSongs[currentSongIndex], document.querySelectorAll(".track-card")[currentSongIndex]);
}

function previousSong() {
    currentSongIndex = (currentSongIndex - 1 + allSongs.length) % allSongs.length;
    playSong(allSongs[currentSongIndex], document.querySelectorAll(".track-card")[currentSongIndex]);
}

function togglePlayPause() {
    if (!audio.src || audio.src === window.location.href) {
        playSong(allSongs[currentSongIndex], document.querySelectorAll(".track-card")[currentSongIndex]);
    } else if (audio.paused) {
        audio.play();
        document.getElementById("playPauseBtn").textContent = "⏸";
        document.getElementById("vinylDisc").classList.add("playing");
    } else {
        audio.pause();
        document.getElementById("playPauseBtn").textContent = "▶";
        document.getElementById("vinylDisc").classList.remove("playing");
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


// ─── Listeners ────────────────────────────────────────────────────────────────

async function showListenersList(listeners, matchEl) {
    const currentUser = localStorage.getItem("username");
    const listEl      = document.getElementById("listenersList");
    const others      = listeners.filter(l => l.username !== currentUser);

    if (others.length === 0) { listEl.classList.add("hidden"); return; }

    listEl.innerHTML = `<p class="listeners-title">🎧 LISTENING NEARBY</p>`;

    const cityResults = [];

    for (const listener of others) {
        const city     = await getCityName(listener.latitude, listener.longitude);
        cityResults.push({ listener, city });
        const initials = listener.username.slice(0, 2).toUpperCase();
        const div      = document.createElement("div");
        div.className  = "listener-item";
        div.innerHTML  = `
            <div class="listener-avatar">${initials}</div>
            <div class="listener-info">
                <span class="listener-name">${listener.username}</span>
                <span class="listener-loc">${city}</span>
            </div>
            <button type="button" onclick="startChat('${listener.username}')">💬 Chat</button>
        `;
        listEl.appendChild(div);
    }

    listEl.classList.remove("hidden");

    if (matchEl) {
        if (cityResults.length === 1) {
            const { listener, city } = cityResults[0];
            const loc = city.replace("📍 ", "");
            matchEl.textContent = `🎵 ${listener.username}${loc ? " from " + loc : ""} is listening too!`;
        } else {
            matchEl.textContent = `🎵 ${cityResults.length} people are listening to this!`;
        }
    }
}


// ─── WebSocket ────────────────────────────────────────────────────────────────

function openChatWs(otherUser) {
    closeChatWs();
    const me = localStorage.getItem("username");
    chatWs   = new WebSocket(`${WS_HOST}/ws/chat`);

    chatWs.onopen = () => {
        chatWs.send(JSON.stringify({ type: "join", sender: me, receiver: otherUser }));
    };

    chatWs.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.sender !== otherUser) return;

        if (data.type === "typing")         showTypingIndicator(data.text || "");
        if (data.type === "stopped_typing") hideTypingIndicator();
        if (data.type === "message")        { hideTypingIndicator(); loadMessages(otherUser); }
    };

    chatWs.onclose = () => {};
    chatWs.onerror = (e) => console.error("WebSocket error", e);
}

function closeChatWs() {
    if (chatWs && chatWs.readyState === WebSocket.OPEN) chatWs.close();
    chatWs = null;
}


// ─── Typing Indicator ─────────────────────────────────────────────────────────

function showTypingIndicator(liveText) {
    const chatBox = document.getElementById("chatBox");
    let typingEl  = document.getElementById("typingIndicator");

    if (!typingEl) {
        typingEl    = document.createElement("div");
        typingEl.id = "typingIndicator";
        typingEl.classList.add("message", "theirs", "typing-message");
        typingEl.innerHTML = `
            <span class="msg-text typing-bubble">
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-dot"></span>
                <span class="typing-live-text" id="typingLiveText"></span>
            </span>
        `;
        chatBox.appendChild(typingEl);
    }

    const liveTextEl = document.getElementById("typingLiveText");
    if (liveTextEl && liveText) {
        liveTextEl.textContent   = liveText;
        liveTextEl.style.display = "inline";
    } else if (liveTextEl) {
        liveTextEl.style.display = "none";
    }

    chatBox.scrollTop = chatBox.scrollHeight;
}

function hideTypingIndicator() {
    const typingEl = document.getElementById("typingIndicator");
    if (typingEl) typingEl.remove();
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
    openChatWs(otherUser);
}

function closeChat() {
    document.getElementById("chatSection").classList.add("hidden");
    clearInterval(chatInterval);
    closeChatWs();
    hideTypingIndicator();
    matchedUser = null;
    chatShown   = false;
}

async function loadMessages(otherUser) {
    const token = localStorage.getItem("token");

    try {
        const res  = await fetch(`${API}/chat/messages/${otherUser}`, {
            headers: { "token": token }
        });
        const data = await res.json();
        const chatBox  = document.getElementById("chatBox");
        const wasAtBottom = chatBox.scrollHeight - chatBox.clientHeight <= chatBox.scrollTop + 50;
        const prevCount   = chatBox.querySelectorAll(".message:not(.typing-message)").length;

        chatBox.querySelectorAll(".message:not(.typing-message)").forEach(el => el.remove());

        data.messages.forEach((m, index) => {
            const div = document.createElement("div");
            div.classList.add("message", m.mine ? "mine" : "theirs");
            if (index >= prevCount) div.classList.add("message-new");
            div.innerHTML = `
                <span class="msg-text">${escapeHtml(m.content)}</span>
                <span class="msg-time">${m.timestamp}</span>
            `;
            const typingEl = document.getElementById("typingIndicator");
            typingEl ? chatBox.insertBefore(div, typingEl) : chatBox.appendChild(div);
        });

        if (wasAtBottom) chatBox.scrollTop = chatBox.scrollHeight;
    } catch {
        console.error("Failed to load messages.");
    }
}

async function sendMessage() {
    const token   = localStorage.getItem("token");
    const input   = document.getElementById("chatInput");
    const content = input.value.trim();
    const me      = localStorage.getItem("username");

    if (!content || !matchedUser) return;
    input.value = "";

    if (chatWs && chatWs.readyState === WebSocket.OPEN) {
        chatWs.send(JSON.stringify({ type: "message", sender: me, receiver: matchedUser, text: content }));
    }

    try {
        await fetch(`${API}/chat/send`, {
            method: "POST",
            headers: { "Content-Type": "application/json", "token": token },
            body: JSON.stringify({ receiver: matchedUser, content })
        });
        loadMessages(matchedUser);
    } catch {
        console.error("Failed to send message.");
    }
}

function handleChatTyping(e) {
    const me   = localStorage.getItem("username");
    const text = e.target.value;
    if (!chatWs || chatWs.readyState !== WebSocket.OPEN) return;

    if (text.length > 0) {
        chatWs.send(JSON.stringify({ type: "typing", sender: me, receiver: matchedUser, text }));
    }

    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        if (chatWs && chatWs.readyState === WebSocket.OPEN) {
            chatWs.send(JSON.stringify({ type: "stopped_typing", sender: me, receiver: matchedUser }));
        }
    }, 1500);
}

function escapeHtml(text) {
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(text));
    return div.innerHTML;
}

document.getElementById("chatInput").addEventListener("keypress", function (e) {
    if (e.key === "Enter") sendMessage();
});

document.getElementById("chatInput").addEventListener("input", handleChatTyping);
