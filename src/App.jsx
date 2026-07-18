import { useEffect, useMemo, useRef, useState } from 'react';
import './App.css';

const randomColor = () => {
  const colors = ['#ffeb3b', '#ff8a65', '#b39ddb', '#80cbc4', '#ffe082', '#c5e1a5', '#f8bbd0'];
  return colors[Math.floor(Math.random() * colors.length)];
};

const isAdminRoute = () => {
  const hash = window.location.hash || '';
  return hash.startsWith('#/admin') || window.location.pathname.endsWith('/admin');
};

const generateId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  const letters = Array.from({ length: 8 }, () => String.fromCharCode(97 + Math.floor(Math.random() * 26))).join('');
  const numbers = Math.floor(Math.random() * 9000000000000 + 1000000000000);
  return `${letters}-${numbers}`;
};

function App() {
  const [showCreate, setShowCreate] = useState(false);
  const [text, setText] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [notes, setNotes] = useState([]);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [serverError, setServerError] = useState('');

  const [adminUsername, setAdminUsername] = useState('admin');
  const [adminPassword, setAdminPassword] = useState('');
  const [adminToken, setAdminToken] = useState(localStorage.getItem('adminToken') || '');
  const [adminError, setAdminError] = useState('');
  const [adminNotes, setAdminNotes] = useState([]);
  const [showReported, setShowReported] = useState(false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [route, setRoute] = useState(isAdminRoute() ? 'admin' : 'app');
  const [adminSearch, setAdminSearch] = useState('');
  const [adminSearchResults, setAdminSearchResults] = useState([]);

  const emojiCategories = {
    Smileys: ['😀', '😄', '😊', '😂', '😍', '😎', '🤩', '🥳', '🤗', '😇'],
    Symbols: ['🔥', '💡', '✨', '💬', '🎉', '❤️', '👍', '🌟', '🚀', '⚡'],
    Objects: ['📌', '📎', '📅', '🖊️', '🧩', '🎁', '📝', '📦', '🔔', '💼'],
    Nature: ['🌿', '🌸', '🌞', '🌈', '🍃', '🌺', '🌊', '🍂', '🍁', '🌻'],
    'Hand signs': ['✋', '🤚', '👋', '👍', '👎', '✌️', '🤞', '🤟', '👌', '🤙'],
  };

  const categoryKeys = Object.keys(emojiCategories);
  const [selectedCategory, setSelectedCategory] = useState(categoryKeys[0]);
  const textAreaRef = useRef(null);

  const LOCAL_ADMIN_TOKEN = 'local-admin';
  const DEFAULT_ADMIN_USER = 'admin';
  const DEFAULT_ADMIN_PASSWORD = 'Mandarini55';

  const getAuthHeaders = () => ({
    Authorization: adminToken ? `Bearer ${adminToken}` : '',
  });

  const fetchApiNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      if (!response.ok) throw new Error('Unable to fetch notes');
      const contentType = response.headers.get('content-type') || '';
      if (!contentType.includes('application/json')) {
        throw new Error('Backend response is not JSON');
      }
      const json = await response.json();
      setNotes(json.notes);
      window.localStorage.setItem('stickyNotes', JSON.stringify(json.notes));
    } catch (error) {
      console.warn(error);
      const saved = window.localStorage.getItem('stickyNotes');
      if (saved) {
        setNotes(JSON.parse(saved));
      }
      setServerError('Backend unavailable. Notes are stored locally until the API server is available.');
    }
  };

  const fetchAdminNotes = async () => {
    if (!adminToken) return;
    if (adminToken === LOCAL_ADMIN_TOKEN) {
      setAdminLoading(false);
      const filtered = showReported ? notes.filter((note) => (note.reports || 0) > 0) : notes;
      setAdminNotes(filtered);
      setAdminError('');
      return;
    }

    setAdminLoading(true);
    try {
      const path = showReported ? '/api/admin/reported' : '/api/admin/notes';
      const response = await fetch(path, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error(`Unable to fetch admin notes (${response.status})`);
      const json = await response.json();
      setAdminNotes(json.notes);
      setAdminError('');
    } catch (error) {
      setAdminError('Could not load admin notes. Check your login and server.');
      console.warn(error);
    } finally {
      setAdminLoading(false);
    }
  };

  const persistNote = async (note) => {
    try {
      const response = await fetch('/api/notes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(note),
      });
      if (!response.ok) throw new Error('Failed to save note');
      const json = await response.json();
      setNotes((prev) => [json.note, ...prev.filter((item) => item.id !== note.id)]);
      setServerError('');
    } catch (error) {
      console.warn('Save note failed', error);
      setServerError('Note saved locally, but the backend is unavailable.');
    }
  };

  const patchNoteAction = async (noteId, action) => {
    const updateLocal = (note) => {
      if (action === 'like') return { ...note, likes: (note.likes || 0) + 1 };
      if (action === 'dislike') return { ...note, dislikes: (note.dislikes || 0) + 1 };
      if (action === 'report') return { ...note, reports: (note.reports || 0) + 1 };
      return note;
    };
    setNotes((prev) => prev.map((note) => (note.id === noteId ? updateLocal(note) : note)));

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!response.ok) throw new Error('Patch failed');
      const json = await response.json();
      setNotes((prev) => prev.map((note) => (note.id === noteId ? json.note : note)));
      setServerError('');
    } catch (error) {
      console.warn('Patch action failed', error);
      setServerError('Action queued locally. The backend was unavailable.');
    }
  };

  const deleteNoteByAdmin = async (noteId) => {
    const removeFromLocal = () => {
      setNotes((prev) => {
        const next = prev.filter((note) => note.id !== noteId);
        window.localStorage.setItem('stickyNotes', JSON.stringify(next));
        return next;
      });
      setAdminNotes((prev) => prev.filter((note) => note.id !== noteId));
    };

    if (adminToken === LOCAL_ADMIN_TOKEN) {
      removeFromLocal();
      setAdminError('Deleted locally; backend unavailable.');
      return;
    }

    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Delete failed');
      removeFromLocal();
      setAdminError('');
    } catch (error) {
      console.warn('Delete failed', error);
      removeFromLocal();
      setAdminError('Unable to delete on backend. Deleted locally only.');
    }
  };

  const navigateToAdmin = () => {
    if (!window.location.hash.startsWith('#/admin')) {
      window.location.hash = '#/admin';
    }
    setRoute('admin');
  };

  const navigateToApp = () => {
    if (window.location.hash) {
      window.location.hash = '#/';
    } else {
      window.history.pushState({}, '', '/');
    }
    setRoute('app');
  };

  const handleAdminLogin = async () => {
    setAdminError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });

      if (response.status === 401) {
        setAdminError('Invalid credentials');
        return;
      }

      if (!response.ok) {
        throw new Error('Backend unreachable');
      }

      const json = await response.json();
      setAdminToken(json.token);
      localStorage.setItem('adminToken', json.token);
      setAdminPassword('');
      setAdminError('');
      navigateToAdmin();
    } catch (error) {
      const fallbackAllowed =
        adminUsername === DEFAULT_ADMIN_USER &&
        adminPassword === DEFAULT_ADMIN_PASSWORD;

      if (fallbackAllowed) {
        setAdminToken(LOCAL_ADMIN_TOKEN);
        localStorage.setItem('adminToken', LOCAL_ADMIN_TOKEN);
        setAdminPassword('');
        setAdminError('Logged in locally; backend unavailable. Admin actions work in this browser only.');
        navigateToAdmin();
        return;
      }

      if (error.message && error.message.includes('Invalid credentials')) {
        setAdminError('Invalid credentials');
      } else {
        setAdminError('Backend unavailable. Admin login requires the server to be running or correct local credentials.');
      }
    }
  };

  useEffect(() => {
    const handleLocationChange = () => setRoute(isAdminRoute() ? 'admin' : 'app');
    window.addEventListener('popstate', handleLocationChange);
    window.addEventListener('hashchange', handleLocationChange);
    return () => {
      window.removeEventListener('popstate', handleLocationChange);
      window.removeEventListener('hashchange', handleLocationChange);
    };
  }, []);

  useEffect(() => {
    if (route === 'app') {
      fetchApiNotes();
    }
    if (route === 'admin' && adminToken) {
      fetchAdminNotes();
    }
  }, [route, adminToken, showReported]);

  const handleAddNote = async () => {
    if (!text.trim() && attachments.length === 0) {
      return;
    }
    const id = generateId();
    const note = {
      id,
      text: text.trim(),
      attachments,
      color: randomColor(),
      createdAt: new Date().toISOString(),
      likes: 0,
      dislikes: 0,
      reports: 0,
    };
    setNotes((prev) => [note, ...prev]);
    setText('');
    setAttachments([]);
    setSearch('');
    setSearchResults([]);
    await persistNote(note);
  };

  const insertEmoji = (emoji) => {
    const textarea = textAreaRef.current;
    if (!textarea) {
      setText((prev) => `${prev}${emoji}`);
      return;
    }

    const { selectionStart, selectionEnd } = textarea;
    const before = text.slice(0, selectionStart);
    const after = text.slice(selectionEnd);
    const nextText = `${before}${emoji}${after}`;
    setText(nextText);

    requestAnimationFrame(() => {
      textarea.focus();
      const pos = selectionStart + emoji.length;
      textarea.setSelectionRange(pos, pos);
    });
  };

  const handleFiles = async (event) => {
    const files = Array.from(event.target.files);
    const readFiles = await Promise.all(
      files.map(
        (file) =>
          new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = () => {
              resolve({ name: file.name, url: reader.result, type: file.type, data: reader.result });
            };
            reader.readAsDataURL(file);
          })
      )
    );
    setAttachments((prev) => [...prev, ...readFiles]);
  };

  const handleSearch = () => {
    if (!search.trim()) {
      setSearchResults([]);
      return;
    }
    const query = search.trim().toLowerCase();
    setSearchResults(
      notes.filter(
        (note) =>
          note.id.toLowerCase().includes(query) ||
          note.text.toLowerCase().includes(query) ||
          note.attachments.some((attachment) => attachment.name.toLowerCase().includes(query))
      )
    );
  };

  const displayedNotes = searchResults.length ? searchResults : notes;

  useEffect(() => {
    const saved = window.localStorage.getItem('stickyNotes');
    if (saved && notes.length === 0) {
      setNotes(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem('stickyNotes', JSON.stringify(notes));
  }, [notes]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const noteParam = params.get('note');
    if (noteParam && notes.length > 0) {
      const matched = notes.filter((note) => note.id === noteParam);
      if (matched.length > 0) {
        setSearchResults(matched);
        setSearch(noteParam);
      }
    }
  }, [notes]);

  const noteCountText = useMemo(() => {
    if (displayedNotes.length === 0) return 'No notes yet.';
    return `${displayedNotes.length} note${displayedNotes.length === 1 ? '' : 's'}`;
  }, [displayedNotes.length]);

  const copyNoteLink = (noteId) => {
    const url = `${window.location.origin}${window.location.pathname.replace(/\/admin$/, '')}?note=${noteId}`;
    navigator.clipboard.writeText(url);
  };

  const sendEmail = (noteId) => {
    const subject = encodeURIComponent('Check out this sticky note');
    const body = encodeURIComponent(`View this note: ${window.location.origin}${window.location.pathname.replace(/\/admin$/, '')}?note=${noteId}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const updateReaction = (noteId, type) => {
    patchNoteAction(noteId, type);
  };

  const reportNote = (noteId) => {
    patchNoteAction(noteId, 'report');
  };

  const adminLoginWidget = (
    <div className="admin-login-widget">
      <div className="admin-login-row">
        <input
          type="text"
          value={adminUsername}
          onChange={(e) => setAdminUsername(e.target.value)}
          placeholder="Admin username"
          className="admin-login-input"
        />
        <input
          type="password"
          value={adminPassword}
          onChange={(e) => setAdminPassword(e.target.value)}
          placeholder="Password"
          className="admin-login-input"
        />
        <button type="button" className="admin-login-button" onClick={handleAdminLogin}>
          Login
        </button>
        <button type="button" className="admin-login-button" onClick={navigateToApp}>
          Back
        </button>
      </div>
      {adminError && <div className="admin-error">{adminError}</div>}
    </div>
  );

  const handleAdminSearch = () => {
    const query = adminSearch.trim().toLowerCase();
    if (!query) {
      setAdminSearchResults([]);
      return;
    }
    setAdminSearchResults(
      adminNotes.filter(
        (note) =>
          note.id.toLowerCase().includes(query) ||
          note.text.toLowerCase().includes(query) ||
          note.attachments.some((attachment) => attachment.name.toLowerCase().includes(query))
      )
    );
  };

  const displayedAdminNotes = adminSearchResults.length ? adminSearchResults : adminNotes;
  const reportedCount = notes.filter((note) => (note.reports || 0) > 0).length;

  const adminDashboard = (
    <div className="admin-dashboard">
      <div className="admin-actions admin-dashboard-header">
        <button type="button" onClick={() => setShowReported(false)}>
          View all notes
        </button>
        <button type="button" onClick={() => setShowReported(true)}>
          Reported notes ({reportedCount})
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('adminToken');
            setAdminToken('');
            setAdminNotes([]);
            setAdminSearch('');
            setAdminSearchResults([]);
          }}
        >
          Logout
        </button>
      </div>

      <div className="admin-search">
        <input
          type="text"
          value={adminSearch}
          onChange={(e) => setAdminSearch(e.target.value)}
          placeholder="Search notes by ID, text, or attachment"
        />
        <button type="button" onClick={handleAdminSearch}>
          Search
        </button>
      </div>

      {adminError && <div className="admin-error">{adminError}</div>}

      {adminLoading ? (
        <p>Loading notes…</p>
      ) : displayedAdminNotes.length === 0 ? (
        <p>No notes found.</p>
      ) : (
        displayedAdminNotes.map((note) => (
          <div key={note.id} className="admin-note-row">
            <strong>{note.id} — {new Date(note.createdAt).toLocaleString()}</strong>
            <p>{note.text || 'No text'}</p>
            <p>Likes: {note.likes || 0} · Dislikes: {note.dislikes || 0} · Reports: {note.reports || 0}</p>
            <div className="admin-actions">
              <button type="button" onClick={() => deleteNoteByAdmin(note.id)}>
                Delete note
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );

  return (
    <div className="app-shell">
      <header>
        <div className="header-top">
          <div>
            <h1>Anonymous Sticky Notes</h1>
            <p>Tap the big + button to create a note with text, image, video, audio, and emojis.</p>
          </div>
          <button type="button" className="admin-toggle-button" onClick={navigateToAdmin}>
            Admin
          </button>
        </div>
      </header>
      {serverError && <section className="notes-summary"><span>{serverError}</span></section>}

      {route === 'admin' && (
        <section className="admin-panel">
          {adminToken ? adminDashboard : (
            <div className="admin-login-panel">
              <h2>Admin access</h2>
              {adminLoginWidget}
            </div>
          )}
        </section>
      )}

      {!showCreate ? (
        <section className="welcome-screen">
          <div className="welcome-content">
            <h2>Welcome to Sticky Notes</h2>
            <p>Create a note in seconds. Just press the big + button and add text, images, video, audio, and emojis.</p>
            <button className="big-add-button" onClick={() => setShowCreate(true)}>
              +
            </button>
          </div>
        </section>
      ) : (
        <>
          <section className="panel">
            <div className="form-group">
              <label>Note text</label>
              <textarea
                ref={textAreaRef}
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your note here..."
              />
            </div>

            <div className="emoji-selector">
              <label>Insert emoji into note</label>
              <div className="emoji-selector-row">
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  {categoryKeys.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <div className="emoji-buttons">
                  {emojiCategories[selectedCategory].map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      className="emoji-button"
                      onClick={() => insertEmoji(emoji)}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="file-inputs">
              <label>
                Attachments (Image, Video, Audio, PDF, Text)
                <input
                  type="file"
                  accept="image/*,video/*,audio/*,.pdf,.txt"
                  multiple
                  onChange={handleFiles}
                />
              </label>
            </div>

            <button className="create-button" onClick={handleAddNote}>
              Create sticky note
            </button>
          </section>

          <section className="search-panel">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by note ID, text, or attachment name"
            />
            <button onClick={handleSearch}>Search</button>
          </section>

          <section className="notes-summary">
            <span>{noteCountText}</span>
          </section>

          <section className="notes-grid">
            {displayedNotes.map((note) => (
              <article key={note.id} className="note-card" style={{ backgroundColor: note.color }}>
                <div className="note-header">
                  <strong>{note.id}</strong>
                  <span>{new Date(note.createdAt).toLocaleString()}</span>
                </div>
                <div className="note-actions">
                  <button type="button" onClick={() => updateReaction(note.id, 'like')}>
                    👍 {note.likes || 0}
                  </button>
                  <button type="button" onClick={() => updateReaction(note.id, 'dislike')}>
                    👎 {note.dislikes || 0}
                  </button>
                  <button type="button" onClick={() => reportNote(note.id)}>
                    🚩 Report {note.reports || 0}
                  </button>
                  {adminToken && (
                    <button type="button" onClick={() => deleteNoteByAdmin(note.id)}>
                      Delete
                    </button>
                  )}
                  <button type="button" onClick={() => copyNoteLink(note.id)}>
                    🔗 Copy link
                  </button>
                  <button type="button" onClick={() => sendEmail(note.id)}>
                    ✉️ Email
                  </button>
                </div>
                {note.text && <p>{note.text}</p>}
                {note.attachments.length > 0 && (
                  <div className="media-grid">
                    {note.attachments.map((file, index) => (
                      <div key={index} className="attachment-item">
                        {file.type.startsWith('image/') && (
                          <img src={file.url} alt={file.name} />
                        )}
                        {file.type.startsWith('video/') && (
                          <video controls src={file.url} />
                        )}
                        {file.type.startsWith('audio/') && (
                          <audio controls src={file.url} />
                        )}
                        {(file.type === 'application/pdf' || file.type.startsWith('text/')) && (
                          <a href={file.url} download={file.name} className="file-link">
                            📄 {file.name}
                          </a>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </section>
        </>
      )}
    </div>
  );
}

export default App;
