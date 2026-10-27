
import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';
import './App.css';

const suggestions = [
  'Explain a difficult topic simply',
  'Help me write something',
  'Write code for my project',
  'Give me creative ideas',
];

function getDisplayName(user) {
  return (
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email?.split('@')[0] ||
    'there'
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [authMode, setAuthMode] = useState('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [authBusy, setAuthBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [authError, setAuthError] = useState('');

  const [chats, setChats] = useState([]);
  const [activeChatId, setActiveChatId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [chatError, setChatError] = useState('');
  const bottomRef = useRef(null);

  // Keep one source of truth for auth state. Supabase emits INITIAL_SESSION
  // after it has restored/exchanged the OAuth session from the callback URL.
  useEffect(() => {
    let mounted = true;
    let receivedAuthEvent = false;

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!mounted) return;
      receivedAuthEvent = true;

      setUser(session?.user ?? null);
      setAuthLoading(false);

      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        setAuthError('');
      }
    });

    // Backup restoration only if no auth event has arrived yet. This prevents
    // a late getSession() result from overwriting a newer OAuth event.
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted || receivedAuthEvent) return;
      if (error) setAuthError(error.message);
      setUser(data?.session?.user ?? null);
      setAuthLoading(false);
    }).catch((error) => {
      if (!mounted || receivedAuthEvent) return;
      setAuthError(error?.message || 'Could not restore your session.');
      setAuthLoading(false);
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const loadChats = useCallback(async () => {
    if (!user) return;

    const { data, error } = await supabase
      .from('chats')
      .select('id,title,messages,created_at,updated_at')
      .eq('user_id', user.id)
      .order('updated_at', { ascending: false });

    if (error) {
      setChatError(`Could not load chat history: ${error.message}`);
      return;
    }

    const rows = data || [];
    setChats(rows);

    if (activeChatId) {
      const current = rows.find((chat) => chat.id === activeChatId);

      if (current) {
        setMessages(
          Array.isArray(current.messages) ? current.messages : []
        );
      }
    }
  }, [user, activeChatId]);

  useEffect(() => {
    if (!user) {
      setChats([]);
      setActiveChatId(null);
      setMessages([]);
      return;
    }

    loadChats();
  }, [user, loadChats]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  async function handleAuth(event) {
    event.preventDefault();
    setAuthError('');
    setNotice('');

    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password) {
      setAuthError('Please enter your email and password.');
      return;
    }

    setAuthBusy(true);

    try {
      if (authMode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email: cleanEmail,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
          },
        });

        if (error) throw error;

        if (data.session) {
          setUser(data.session.user);
          setNotice('Account created successfully!');
        } else {
          setNotice(
            'Account created. Check your email to confirm your account.'
          );
          setAuthMode('login');
        }
      } else {
        const { data, error } = await supabase.auth.signInWithPassword({
          email: cleanEmail,
          password,
        });

        if (error) throw error;

        setUser(data.user);
      }
    } catch (error) {
      setAuthError(
        error.message || 'Authentication failed. Please try again.'
      );
    } finally {
      setAuthBusy(false);
    }
  }

  async function signInWithProvider(provider) {
    if (authBusy) return;

    setAuthError('');
    setNotice('');
    setAuthBusy(true);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/`,
        },
      });

      if (error) throw error;
      // Supabase redirects the browser to the OAuth provider.
    } catch (error) {
      setAuthError(
        error.message || 'Could not start sign-in. Please try again.'
      );
      setAuthBusy(false);
    }
  }

  async function signOut() {
    setAuthError('');

    const { error } = await supabase.auth.signOut();

    if (error) {
      setAuthError(error.message);
      return;
    }

    setUser(null);
    setChats([]);
    setActiveChatId(null);
    setMessages([]);
    setInput('');
  }

  function startNewChat() {
    setActiveChatId(null);
    setMessages([]);
    setInput('');
    setChatError('');
  }

  function openChat(chat) {
    setActiveChatId(chat.id);
    setMessages(Array.isArray(chat.messages) ? chat.messages : []);
    setChatError('');
  }

  async function persistChat(nextMessages, chatId) {
    if (!user) {
      throw new Error('Please sign in again.');
    }

    const firstUserMessage = nextMessages.find(
      (message) => message.role === 'user'
    );

    const title = (
      firstUserMessage?.content || 'New Chat'
    ).slice(0, 60);

    if (chatId) {
      const { data, error } = await supabase
        .from('chats')
        .update({
          messages: nextMessages,
          title,
          updated_at: new Date().toISOString(),
        })
        .eq('id', chatId)
        .eq('user_id', user.id)
        .select('id,title,messages,created_at,updated_at')
        .single();

      if (error) throw error;

      setActiveChatId(data.id);
      setChats((previous) => [
        data,
        ...previous.filter((chat) => chat.id !== data.id),
      ]);

      return data.id;
    }

    const { data, error } = await supabase
      .from('chats')
      .insert({
        user_id: user.id,
        title,
        messages: nextMessages,
      })
      .select('id,title,messages,created_at,updated_at')
      .single();

    if (error) throw error;

    setActiveChatId(data.id);
    setChats((previous) => [
      data,
      ...previous.filter((chat) => chat.id !== data.id),
    ]);

    return data.id;
  }

  async function sendMessage(text = input) {
    const cleanText = text.trim();

    if (!cleanText || sending || !user) return;

    setInput('');
    setChatError('');
    setSending(true);

    const userMessage = { role: 'user', content: cleanText };
    const nextMessages = [...messages, userMessage];

    setMessages(nextMessages);

    let chatId = activeChatId;

    try {
      chatId = await persistChat(nextMessages, chatId);

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000);

      let response;

      try {
        response = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: cleanText }),
          signal: controller.signal,
        });
      } finally {
        clearTimeout(timeoutId);
      }

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.error ||
            data.reply ||
            `Request failed (${response.status})`
        );
      }

      const reply = data.reply || data.text || data.message;

      if (!reply) {
        throw new Error('The AI returned an empty response.');
      }

      const assistantMessage = {
        role: 'assistant',
        content: reply,
      };

      const finalMessages = [...nextMessages, assistantMessage];

      setMessages(finalMessages);
      await persistChat(finalMessages, chatId);
    } catch (error) {
      const message =
        error.name === 'AbortError'
          ? 'The request took too long. Please try again.'
          : error.message || 'Something went wrong. Please try again.';

      setChatError(message);
    } finally {
      setSending(false);
    }
  }

  if (authLoading) {
    return (
      <main className="loading-screen">
        <div className="nova-mark">✦</div>
        <p>Loading Nova AI...</p>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="auth-screen">
        <section className="auth-card">
          <div className="brand-lockup">
            <div className="nova-mark">✦</div>
            <span>
              nova<span className="brand-light">.ai</span>
            </span>
          </div>

          <p className="eyebrow">YOUR PERSONAL AI ASSISTANT</p>

          <h1>
            {authMode === 'login'
              ? 'Welcome back'
              : 'Create your account'}
          </h1>

          <p className="auth-subtitle">
            {authMode === 'login'
              ? 'Sign in to continue your conversations.'
              : 'Sign up to start your own AI workspace.'}
          </p>

          <div className="social-buttons">
            <button
              type="button"
              className="social-button"
              disabled={authBusy}
              onClick={() => signInWithProvider('google')}
            >
              <span className="google-symbol">G</span>
              Continue with Google
            </button>

            <button
              type="button"
              className="social-button"
              disabled={authBusy}
              onClick={() => signInWithProvider('github')}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="currentColor"
                  d="M12 .9a11.1 11.1 0 0 0-3.51 21.63c.55.1.76-.24.76-.53v-2.08c-3.1.67-3.76-1.32-3.76-1.32-.5-1.28-1.23-1.62-1.23-1.62-1.01-.69.08-.68.08-.68 1.12.08 1.71 1.15 1.71 1.15.99 1.7 2.59 1.21 3.22.92.1-.72.39-1.21.7-1.49-2.48-.28-5.09-1.24-5.09-5.52 0-1.22.44-2.22 1.15-3-.12-.28-.5-1.42.11-2.96 0 0 .94-.3 3.05 1.15a10.6 10.6 0 0 1 5.55 0c2.11-1.45 3.05-1.15 3.05-1.15.61 1.54.23 2.68.11 2.96.72.78 1.15 1.78 1.15 3 0 4.29-2.62 5.24-5.11 5.51.4.35.75 1.03.75 2.08V22c0 .29.2.63.76.52A11.1 11.1 0 0 0 12 .9Z"
                />
              </svg>
              Continue with GitHub
            </button>
          </div>

          <div className="auth-divider">
            <span>or continue with email</span>
          </div>

          <form className="auth-form" onSubmit={handleAuth}>
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />

            <label htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              autoComplete={
                authMode === 'login'
                  ? 'current-password'
                  : 'new-password'
              }
              placeholder="At least 6 characters"
              minLength={6}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />

            {authError && (
              <p className="form-message error-message">
                {authError}
              </p>
            )}

            {notice && (
              <p className="form-message success-message">
                {notice}
              </p>
            )}

            <button
              className="primary-button"
              type="submit"
              disabled={authBusy}
            >
              {authBusy
                ? 'Please wait...'
                : authMode === 'login'
                  ? 'Sign in'
                  : 'Create account'}
              {!authBusy && <span>→</span>}
            </button>
          </form>

          <p className="auth-switch">
            {authMode === 'login'
              ? "Don't have an account?"
              : 'Already have an account?'}{' '}
            <button
              type="button"
              onClick={() => {
                setAuthMode(
                  authMode === 'login' ? 'signup' : 'login'
                );
                setAuthError('');
                setNotice('');
              }}
            >
              {authMode === 'login' ? 'Sign up' : 'Sign in'}
            </button>
          </p>

          <p className="auth-footnote">
            Your conversations are private to your account.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="nova-app">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="nova-mark">✦</div>
          <span>
            nova<span className="brand-light">.ai</span>
          </span>
        </div>

        <button className="new-chat-button" onClick={startNewChat}>
          <span>＋</span> New chat
        </button>

        <div className="history-heading">YOUR HISTORY</div>

        <div className="history-list">
          {chats.length === 0 && (
            <p className="history-empty">
              Your saved chats will appear here.
            </p>
          )}

          {chats.map((chat) => (
            <button
              key={chat.id}
              className={`history-item ${
                activeChatId === chat.id ? 'selected' : ''
              }`}
              onClick={() => openChat(chat)}
              title={chat.title}
            >
              <span>◷</span>
              <span className="history-title">
                {chat.title || 'New Chat'}
              </span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <div className="user-profile">
            <div className="avatar">
              {getDisplayName(user).slice(0, 1).toUpperCase()}
            </div>
            <div className="user-info">
              <strong>{getDisplayName(user)}</strong>
              <span>{user.email}</span>
            </div>
          </div>

          <button className="signout-button" onClick={signOut}>
            Sign out ↗
          </button>
        </div>
      </aside>

      <section className="chat-area">
        <header className="chat-header">
          <div className="mobile-brand">
            <div className="nova-mark">✦</div> nova.ai
          </div>

          <span className="status-indicator">
            <i /> AI assistant
          </span>

          <button className="mobile-new-chat" onClick={startNewChat}>
            ＋ New chat
          </button>
        </header>

        <div className="conversation">
          {messages.length === 0 ? (
            <div className="welcome-panel">
              <div className="welcome-icon">✦</div>
              <p className="eyebrow">YOUR SPACE TO THINK BIGGER</p>
              <h1>Welcome, {getDisplayName(user)}.</h1>
              <p className="welcome-subtitle">
                What would you like to work on today?
              </p>

              <div className="suggestion-grid">
                {suggestions.map((suggestion, index) => (
                  <button
                    key={suggestion}
                    onClick={() => sendMessage(suggestion)}
                    disabled={sending}
                  >
                    <span>{['✧', '✎', '⌘', '✳'][index]}</span>
                    {suggestion}
                    <b>↗</b>
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="message-list">
              {messages.map((message, index) => (
                <article
                  className={`message-row ${message.role}`}
                  key={`${index}-${message.role}`}
                >
                  <div className="message-avatar">
                    {message.role === 'user'
                      ? getDisplayName(user).slice(0, 1).toUpperCase()
                      : '✦'}
                  </div>

                  <div className="message-content">
                    <div className="message-label">
                      {message.role === 'user' ? 'You' : 'Nova AI'}
                    </div>
                    <div className="message-text">
                      {message.content}
                    </div>
                  </div>
                </article>
              ))}

              {sending && (
                <article className="message-row assistant">
                  <div className="message-avatar">✦</div>
                  <div className="message-content">
                    <div className="message-label">Nova AI</div>
                    <div className="typing-indicator">
                      <i />
                      <i />
                      <i />
                    </div>
                  </div>
                </article>
              )}

              <div ref={bottomRef} />
            </div>
          )}

          {chatError && <p className="chat-error">{chatError}</p>}
        </div>

        <div className="composer-wrap">
          <form
            className="composer"
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
            }}
          >
            <textarea
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey) {
                  event.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Message Nova AI..."
              rows={1}
              aria-label="Message Nova AI"
            />

            <button
              type="submit"
              disabled={!input.trim() || sending}
              aria-label="Send message"
            >
              {sending ? '…' : '↑'}
            </button>
          </form>

          <p className="composer-note">
            Nova AI can make mistakes. Check important information.
          </p>
        </div>
      </section>
    </main>
  );
}
