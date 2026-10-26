
import { useState } from "react";
import "./App.css";

export default function App() {
  const [message, setMessage] = useState("");

  return (
    <div className="app">
      <aside className="sidebar">
        <h2>Ai_Chatbot</h2>
        <button onClick={() => setMessage("")}>
          + New Chat
        </button>
        <p>Your AI assistant</p>
      </aside>

      <main className="main">
        <div className="welcome">
          <h1>Welcome to Nova AI</h1>
          <p>Ask a question and start a conversation.</p>

          <form onSubmit={(event) => {
            event.preventDefault();
            if (message.trim()) {
              alert("Your message: " + message);
            }
          }}>
            <input
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Message Nova AI..."
            />
            <button type="submit">Send</button>
          </form>
        </div>
      </main>
    </div>
  );
}
