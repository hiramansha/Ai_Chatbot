
import { useState } from "react";
import "./App.css";

const starterChats = [
  { icon: "✳", title: "Coding Help", desc: "Help with code and programming", time: "Now", color: "purple" },
  { icon: "◈", title: "Creative Writing", desc: "Ideas, stories and content", time: "2m", color: "cyan" },
  { icon: "▤", title: "Study Assistant", desc: "Learn something new today", time: "5m", color: "blue" },
  { icon: "✧", title: "Business Ideas", desc: "Plan your next big idea", time: "12m", color: "pink" },
  { icon: "⌘", title: "Travel Planner", desc: "Discover places and trips", time: "18m", color: "orange" },
  { icon: "◉", title: "Daily Questions", desc: "Your everyday AI assistant", time: "1h", color: "green" },
];

const agents = [
  { icon: "⌘", title: "Coding Assistant", desc: "Build, debug and understand code.", color: "purple", prompt: "Help me write and debug code" },
  { icon: "✎", title: "Content Writer", desc: "Create engaging content and fresh ideas.", color: "cyan", prompt: "Help me write engaging content" },
  { icon: "◈", title: "Research Analyst", desc: "Explore topics and organize your thoughts.", color: "blue", prompt: "Help me research a topic" },
  { icon: "✧", title: "Creative Studio", desc: "Brainstorm ideas and unlock creativity.", color: "pink", prompt: "Give me creative ideas for a project" },
];

export default function App() {
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("Chat");
  const [search, setSearch] = useState("");
  const [selectedChat, setSelectedChat] = useState("");
  const [sentMessages, setSentMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function startNewChat() {
    setMessage("");
    setSelectedChat("");
    setSentMessages([]);
    setError("");
    setLoading(false);
  }

  async function sendMessage(event) {
    event.preventDefault();

    const text = message.trim();
    if (!text || loading) return;

    setSentMessages((previous) => [
      ...previous,
      { role: "user", text },
    ]);
    setSelectedChat(text);
    setMessage("");
    setLoading(true);
    setError("");

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ message: text }),
        signal: controller.signal,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error || `Server error (HTTP ${response.status}).`
        );
      }

      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("AI ne khali response diya. Dobara try karein.");
      }

      setSentMessages((previous) => [
        ...previous,
        { role: "assistant", text: data.reply.trim() },
      ]);
    } catch (err) {
      if (err.name === "AbortError") {
        setError(
          "Request 30 seconds mein complete nahi hui. Gemini API ya server ko check karein."
        );
      } else {
        setError(
          err.message || "Connection mein masla hai. Dobara try karein."
        );
      }
    } finally {
      clearTimeout(timeoutId);
      setLoading(false);
    }
  }

  const filteredChats = starterChats.filter((chat) =>
    chat.title.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="app-shell">
      <aside className="icon-rail">
        <div className="brand-mark">N</div>

        <div className="rail-links">
          {[
            ["◧", "Chat"],
            ["✎", "Prompts"],
            ["♧", "Agents"],
            ["▣", "Files"],
            ["♙", "Teams"],
            ["⚙", "Settings"],
          ].map(([icon, label]) => (
            <button
              key={label}
              className={`rail-button ${activeTab === label ? "active" : ""}`}
              onClick={() => setActiveTab(label)}
              title={label}
            >
              <span>{icon}</span>
              <small>{label}</small>
            </button>
          ))}
        </div>

        <button
          className="profile-button"
          onClick={() => setActiveTab("Profile")}
          title="Profile"
        >
          ◉
        </button>
      </aside>

      <aside className="chat-sidebar">
        <div className="sidebar-top">
          <div className="sidebar-heading">
            <div>
              <span className="eyebrow">YOUR WORKSPACE</span>
              <h2>Nova AI<span className="brand-dot">.</span></h2>
            </div>
            <span className="online-dot" title="Workspace ready" />
          </div>

          <button className="new-chat-button" onClick={startNewChat}>
            <span>＋</span> New Chat
          </button>

          <label className="search-box">
            <span>⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search conversations"
              aria-label="Search conversations"
            />
            <kbd>/</kbd>
          </label>
        </div>

        <div className="history-heading">
          <span>RECENT CHATS</span>
          <span className="history-count">{filteredChats.length}</span>
        </div>

        <div className="chat-history">
          {filteredChats.map((chat) => (
            <button
              className={`history-item ${selectedChat === chat.title ? "selected" : ""}`}
              key={chat.title}
              onClick={() => {
                setSelectedChat(chat.title);
                setActiveTab("Chat");
              }}
            >
              <span className={`history-icon ${chat.color}`}>{chat.icon}</span>
              <span className="history-copy">
                <strong>{chat.title}</strong>
                <small>{chat.desc}</small>
              </span>
              <span className="history-time">{chat.time}</span>
            </button>
          ))}

          {filteredChats.length === 0 && (
            <p className="empty-search">No matching chats found.</p>
          )}
        </div>

        <div className="sidebar-footer">
          <div className="plan-icon">✧</div>
          <div>
            <strong>Nova AI</strong>
            <span>Your creative workspace</span>
          </div>
          <span className="footer-menu">···</span>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <div className="breadcrumb">
            <span className="breadcrumb-muted">Workspace</span>
            <span className="breadcrumb-slash">/</span>
            <span>{activeTab}</span>
          </div>

          <div className="topbar-actions">
            <span className="status-label">
              <span className="online-dot" /> AI workspace
            </span>
            <button
              className="upgrade-button"
              onClick={() => alert("Upgrade options can be added here later.")}
            >
              ✧ <span>Explore Pro</span>
            </button>
          </div>
        </header>

        <div className="main-content">
          {activeTab !== "Chat" ? (
            <section className="section-placeholder">
              <div className="placeholder-icon">✧</div>
              <span className="eyebrow">NOVA AI WORKSPACE</span>
              <h1>{activeTab}</h1>
              <p>
                This workspace section is ready for its next step.
                Your AI chat is available from the Chat tab.
              </p>
              <button
                className="primary-button"
                onClick={() => setActiveTab("Chat")}
              >
                Return to Chat <span>→</span>
              </button>
            </section>
          ) : sentMessages.length > 0 ? (
            <section className="conversation-view">
              <div className="conversation-heading">
                <span className="eyebrow">YOUR CONVERSATION</span>
                <h1>{selectedChat || "New conversation"}</h1>
                <p>Chat with Nova AI and explore your ideas.</p>
              </div>

              {sentMessages.map((item, index) => (
                <div
                  className={
                    item.role === "user" ? "user-message" : "demo-notice"
                  }
                  key={`${item.role}-${index}`}
                >
                  <span className="message-avatar">
                    {item.role === "user" ? "Y" : "✧"}
                  </span>
                  <div>
                    <strong>
                      {item.role === "user" ? "You" : "Nova AI"}
                    </strong>
                    <p>{item.text}</p>
                  </div>
                </div>
              ))}

              {loading && (
                <div className="demo-notice" role="status" aria-live="polite">
                  <span>✧</span>
                  <div>
                    <strong>Nova AI</strong>
                    <p>Soch raha hoon...</p>
                  </div>
                </div>
              )}

              {error && (
                <div className="demo-notice" role="alert">
                  <span>!</span>
                  <div>
                    <strong>Connection error</strong>
                    <p>{error}</p>
                    <button
                      type="button"
                      className="primary-button"
                      onClick={() => {
                        setMessage(
                          sentMessages.filter((item) => item.role === "user").at(-1)?.text || ""
                        );
                        setError("");
                      }}
                    >
                      Try again
                    </button>
                  </div>
                </div>
              )}
            </section>
          ) : (
            <section className="welcome-screen">
              <div className="hero">
                <div className="orb-wrap">
                  <div className="orb-halo" />
                  <div className="orb">
                    <span>✧</span>
                  </div>
                  <div className="orb-spark spark-one" />
                  <div className="orb-spark spark-two" />
                </div>

                <span className="hero-badge">
                  <span className="online-dot" />
                  YOUR AI, REIMAGINED
                </span>

                <h1>
                  Ideas begin with
                  <br />
                  <span>a conversation.</span>
                </h1>

                <p className="hero-description">
                  Meet your creative companion. Ask questions, explore ideas,
                  <br className="desktop-break" />
                  and turn your thoughts into something extraordinary.
                </p>
              </div>

              <div className="agents-section">
                <div className="section-heading">
                  <div>
                    <span className="eyebrow">MADE FOR YOUR WORKFLOW</span>
                    <h2>Explore your AI assistants</h2>
                  </div>
                  <span className="section-count">04 assistants</span>
                </div>

                <div className="agent-grid">
                  {agents.map((agent) => (
                    <button
                      className="agent-card"
                      key={agent.title}
                      onClick={() => setMessage(agent.prompt)}
                    >
                      <span className={`agent-icon ${agent.color}`}>
                        {agent.icon}
                      </span>
                      <span className="agent-copy">
                        <strong>{agent.title}</strong>
                        <small>{agent.desc}</small>
                      </span>
                      <span className="agent-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="quick-prompts">
                <span>TRY ASKING</span>
                <button onClick={() => setMessage("Help me build a website")}>
                  Build a website <span>↗</span>
                </button>
                <button onClick={() => setMessage("Give me fresh project ideas")}>
                  Find inspiration <span>↗</span>
                </button>
                <button onClick={() => setMessage("Teach me something useful")}>
                  Learn something <span>↗</span>
                </button>
              </div>
            </section>
          )}

          <div className="composer-area">
            <form className="message-composer" onSubmit={sendMessage}>
              <div className="composer-top">
                <span className="composer-spark">✧</span>
                <input
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  placeholder="Message Nova AI... ask anything"
                  aria-label="Message Nova AI"
                  disabled={loading}
                />
                <kbd>↵</kbd>
              </div>

              <div className="composer-bottom">
                <div className="composer-tools">
                  <span className="model-chip">
                    <span className="model-indicator" />
                    Nova Assistant
                    <span className="chip-chevron">⌄</span>
                  </span>
                  <span className="composer-hint">
                    AI can make mistakes. Verify important information.
                  </span>
                </div>

                <button
                  className="send-button"
                  type="submit"
                  aria-label="Send message"
                  disabled={!message.trim() || loading}
                >
                  <span>{loading ? "…" : "↑"}</span>
                </button>
              </div>
            </form>
            <p className="composer-disclaimer">
              Powered by curiosity <span>·</span> Built with Nova AI
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
