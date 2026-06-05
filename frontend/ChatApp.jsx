import React, { useState, useEffect, useRef } from 'react';

export default function ChatApp() {
  // ═══════════════════════════════════════════════════════════════════════════
  // STATE: Variables that trigger re-renders when they change
  // ═══════════════════════════════════════════════════════════════════════════

  // Connection status (green dot or red dot)
  const [isConnected, setIsConnected] = useState(false);

  // All messages in the conversation
  // Format: { sender: "me"|"other", text: "hello", timestamp: Date.now() }
  const [messages, setMessages] = useState([]);

  // What the user is currently typing in the input box
  const [inputValue, setInputValue] = useState('');

  // Whether the OTHER person is typing right now (for typing indicator)
  const [otherIsTyping, setOtherIsTyping] = useState(false);

  // WebSocket connection object (kept in useRef so it persists between renders)
  const wsRef = useRef(null);

  // Timer for debouncing "typing" messages (so we don't send 100/sec)
  const typingTimeoutRef = useRef(null);

  // Auto-scroll ref — when new message comes in, scroll to bottom
  const messagesEndRef = useRef(null);

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDE EFFECT 1: WebSocket Connection (runs once on component mount)
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Connect to the backend WebSocket
    const ws = new WebSocket('ws://127.0.0.1:8000/ws/chat');
    wsRef.current = ws;

    // ─────────────────────────────────────────────────────────────────────────
    // ONOPEN: Server accepted our connection
    // ─────────────────────────────────────────────────────────────────────────
    ws.onopen = () => {
      console.log('✓ WebSocket connected');
      setIsConnected(true);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // ONMESSAGE: Server sent us something
    // Messages from the backend have this format:
    //   { type: "message", text: "hello", sender: "alice" }
    //   { type: "typing", sender: "alice" }
    // ─────────────────────────────────────────────────────────────────────────
    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);

      if (data.type === 'message') {
        // New message from the other person
        setMessages((prev) => [
          ...prev,
          {
            sender: 'other',
            text: data.text,
            timestamp: Date.now(),
          },
        ]);
        // Turn off typing indicator (they finished typing)
        setOtherIsTyping(false);
      } else if (data.type === 'typing') {
        // The other person is typing
        setOtherIsTyping(true);
      }
    };

    ws.onclose = () => {
      console.log('✗ WebSocket disconnected');
      setIsConnected(false);
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    // Cleanup when component unmounts
    return () => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.close();
      }
    };
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // SIDE EFFECT 2: Auto-scroll to newest message when messages change
  // ═══════════════════════════════════════════════════════════════════════════

  useEffect(() => {
    // Scroll to the bottom of the chat whenever a new message arrives
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCTION: Send a complete message (when user clicks Send)
  // ═══════════════════════════════════════════════════════════════════════════

  const sendMessage = () => {
    // Don't send empty messages
    if (inputValue.trim() === '' || !isConnected) return;

    // Create the message object
    const message = {
      type: 'message',
      text: inputValue,
      sender: 'me',
      timestamp: Date.now(),
    };

    // Send it to the server
    wsRef.current.send(JSON.stringify(message));

    // Show it in our chat immediately (optimistic update)
    setMessages((prev) => [...prev, message]);

    // Clear the input box
    setInputValue('');

    // Clear any pending typing indicators
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    setOtherIsTyping(false);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCTION: Handle typing (as user types in the input box)
  // This sends "live" characters to show them typing in real-time
  // ═══════════════════════════════════════════════════════════════════════════

  const handleTyping = (e) => {
    const newValue = e.target.value;
    setInputValue(newValue);

    // If we were waiting to send a "stopped typing" message, cancel it
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }

    // Send the updated text to the server (so they see it live)
    // This is the "live preview" feature — they see each character as you type
    if (newValue.length > 0) {
      wsRef.current.send(
        JSON.stringify({
          type: 'typing',
          text: newValue, // Send the current text
          sender: 'me',
        })
      );
    }

    // After 1.5 seconds of no typing, send a "stopped typing" message
    // This tells them the typing indicator should disappear
    typingTimeoutRef.current = setTimeout(() => {
      wsRef.current.send(JSON.stringify({ type: 'typing_stopped' }));
    }, 1500);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // FUNCTION: Handle Enter key (send message when they press Enter)
  // ═══════════════════════════════════════════════════════════════════════════

  const handleKeyPress = (e) => {
    // If they pressed Enter (not Shift+Enter), send the message
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
    // If they pressed Shift+Enter, let it create a new line (default behavior)
  };

  // ═════════════════════════════════════════════════════════════════════════════
  // RENDER: The HTML that shows on screen
  // ═════════════════════════════════════════════════════════════════════════════

  return (
    <div style={styles.container}>
      {/* ─── HEADER: Shows connection status ─── */}
      <div style={styles.header}>
        <h1>💬 Chat</h1>
        <div style={styles.status}>
          {/* Animated dot — green if connected, red if not */}
          <span
            style={{
              ...styles.dot,
              backgroundColor: isConnected ? '#1db954' : '#ff4444',
              animation: isConnected ? 'pulse 2s infinite' : 'none',
            }}
          ></span>
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      {/* ─── MESSAGE LIST: Shows all messages and typing indicator ─── */}
      <div style={styles.messageList}>
        {messages.map((msg, index) => (
          <div
            key={index}
            style={{
              ...styles.messageWrapper,
              justifyContent: msg.sender === 'me' ? 'flex-end' : 'flex-start',
              animation: `slideIn 0.3s ease-out`, // Message slides in
            }}
          >
            <div
              style={{
                ...styles.messageBubble,
                backgroundColor: msg.sender === 'me' ? '#1db954' : '#333333',
              }}
            >
              {msg.text}
            </div>
          </div>
        ))}

        {/* ─── TYPING INDICATOR: Shows when the other person is typing ─── */}
        {otherIsTyping && (
          <div style={{ ...styles.messageWrapper, justifyContent: 'flex-start' }}>
            <div style={styles.typingBubble}>
              {/* Three animated dots */}
              <span style={{ ...styles.typingDot, animationDelay: '0s' }}></span>
              <span style={{ ...styles.typingDot, animationDelay: '0.2s' }}></span>
              <span style={{ ...styles.typingDot, animationDelay: '0.4s' }}></span>
            </div>
          </div>
        )}

        {/* ─── AUTO-SCROLL: This invisible element is scrolled into view ─── */}
        <div ref={messagesEndRef} />
      </div>

      {/* ─── INPUT AREA: Text input and Send button ─── */}
      <div style={styles.inputArea}>
        <input
          type="text"
          placeholder="Type a message..."
          style={styles.input}
          value={inputValue}
          onChange={handleTyping} // Sends live characters as you type
          onKeyPress={handleKeyPress} // Send on Enter key
        />
        <button
          style={{
            ...styles.sendButton,
            // Fade out the button if input is empty or not connected
            opacity: inputValue.trim().length > 0 && isConnected ? 1 : 0.5,
          }}
          onClick={sendMessage}
        >
          Send
        </button>
      </div>

      {/* ─── INJECT CSS ANIMATIONS ─── */}
      <style>{`
        @keyframes slideIn {
          from {
            opacity: 0;
            transform: translateY(10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @keyframes pulse {
          0%, 100% {
            opacity: 1;
          }
          50% {
            opacity: 0.5;
          }
        }

        @keyframes bounce {
          0%, 100% {
            transform: translateY(0);
          }
          50% {
            transform: translateY(-6px);
          }
        }
      `}</style>
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════
// STYLES: All the CSS as JavaScript objects
// Each property is commented to explain what it does
// ═════════════════════════════════════════════════════════════════

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh', // Full height of screen
    backgroundColor: '#000', // Dark background like Snapchat
    color: 'white',
    fontFamily: 'Arial, sans-serif',
  },

  header: {
    padding: '15px',
    borderBottom: '1px solid #222',
    display: 'flex', // Arrange items in a row
    justifyContent: 'space-between', // Title on left, status on right
    alignItems: 'center',
  },

  status: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '14px',
  },

  dot: {
    width: '10px',
    height: '10px',
    borderRadius: '50%', // Make it a circle
  },

  messageList: {
    flex: 1, // Take up all remaining space
    overflowY: 'auto', // Scrollable if messages exceed screen height
    padding: '15px',
    display: 'flex',
    flexDirection: 'column', // Stack messages vertically
    gap: '10px',
  },

  messageWrapper: {
    display: 'flex',
    marginBottom: '5px',
  },

  messageBubble: {
    padding: '12px 16px',
    borderRadius: '18px', // Rounded like Snapchat
    maxWidth: '70%',
    wordWrap: 'break-word',
    fontSize: '15px',
    lineHeight: '1.4',
  },

  // ─────────────────────────────────────────────────────────────
  // TYPING BUBBLE: Shows when the other person is typing
  // Has a gray background and animated dots inside
  // ─────────────────────────────────────────────────────────────
  typingBubble: {
    padding: '12px 16px',
    borderRadius: '18px',
    backgroundColor: '#333333', // Gray like their message bubbles
    display: 'flex',
    gap: '4px',
    alignItems: 'center',
  },

  // ─────────────────────────────────────────────────────────────
  // TYPING DOT: The three bouncing dots
  // Each dot animates independently (staggered) for a wave effect
  // ─────────────────────────────────────────────────────────────
  typingDot: {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    backgroundColor: '#aaa',
    animation: 'bounce 1.4s infinite',
    display: 'inline-block',
  },

  inputArea: {
    display: 'flex',
    gap: '10px',
    padding: '15px',
    borderTop: '1px solid #222',
    backgroundColor: '#000', // Stay black at bottom
  },

  input: {
    flex: 1, // Take up remaining width
    padding: '12px',
    backgroundColor: '#222',
    color: 'white',
    border: '1px solid #444',
    borderRadius: '20px',
    fontSize: '14px',
    outline: 'none',
    transition: 'all 0.2s', // Smooth focus transition
    minHeight: '40px',
  },

  sendButton: {
    padding: '12px 24px',
    backgroundColor: '#1db954', // Spotify green
    color: 'black',
    border: 'none',
    borderRadius: '20px',
    cursor: 'pointer',
    fontWeight: 'bold',
    fontSize: '14px',
    transition: 'all 0.2s', // Smooth opacity/scale changes
    transformOrigin: 'center',
  },
};
