import { useEffect, useMemo, useState } from 'react';
import './App.css';

const randomColor = () => {
  const colors = ['#ffeb3b', '#ff8a65', '#b39ddb', '#80cbc4', '#ffe082', '#c5e1a5', '#f8bbd0'];
  return colors[Math.floor(Math.random() * colors.length)];
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
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false);

  const emojiCategories = {
    Smileys: ['😀', '😄', '😊', '😂', '😍', '😎', '🤩', '🥳', '🤗', '😇'],
    Symbols: ['🔥', '💡', '✨', '💬', '🎉', '❤️', '👍', '🌟', '🚀', '⚡'],
    Objects: ['📌', '📎', '📅', '🖊️', '🧩', '🎁', '📝', '📦', '🔔', '💼'],
    Nature: ['🌿', '🌸', '🌞', '🌈', '🍃', '🌺', '🌊', '🍂', '🍁', '🌻'],
  };

  const categoryKeys = Object.keys(emojiCategories);
  const [selectedCategory, setSelectedCategory] = useState(categoryKeys[0]);
  const [selectedEmoji, setSelectedEmoji] = useState(emojiCategories[categoryKeys[0]][0]);

  const getAuthHeaders = () => ({
    Authorization: adminToken ? `Bearer ${adminToken}` : '',
  });

  const fetchApiNotes = async () => {
    try {
      const response = await fetch('/api/notes');
      if (!response.ok) throw new Error('Unable to fetch notes');
      const json = await response.json();
      setNotes(json.notes);
      window.localStorage.setItem('stickyNotes', JSON.stringify(json.notes));
    } catch (error) {
      console.warn(error);
      const saved = window.localStorage.getItem('stickyNotes');
      if (saved) {
        setNotes(JSON.parse(saved));
      }
      setServerError('Backend unreachable. Notes are stored locally until the server is available.');
    }
  };

  const fetchAdminNotes = async () => {
    if (!adminToken) return;
    setAdminLoading(true);
    try {
      const path = showReported ? '/api/admin/reported' : '/api/admin/notes';
      const response = await fetch(path, { headers: getAuthHeaders() });
      if (!response.ok) throw new Error('Unable to fetch admin notes');
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
    try {
      const response = await fetch(`/api/notes/${noteId}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
      });
      if (!response.ok) throw new Error('Delete failed');
      setAdminNotes((prev) => prev.filter((note) => note.id !== noteId));
      setNotes((prev) => prev.filter((note) => note.id !== noteId));
      setAdminError('');
    } catch (error) {
      console.warn('Delete failed', error);
      setAdminError('Unable to delete note. Refresh and try again.');
    }
  };

  const handleAdminToggle = () => {
    setIsAdminPanelOpen((prev) => !prev);
  };

  const handleAdminClose = () => {
    setIsAdminPanelOpen(false);
  };

  const handleAdminLogin = async () => {
    setAdminError('');
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: adminUsername, password: adminPassword }),
      });
      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error || 'Login failed');
      }
      const json = await response.json();
      setAdminToken(json.token);
      localStorage.setItem('adminToken', json.token);
      setAdminPassword('');
      setAdminError('');
      setIsAdminPanelOpen(false);
    } catch (error) {
      setAdminError(error.message || 'Invalid credentials');
    }
  };

  useEffect(() => {
    fetchApiNotes();
  }, []);

  useEffect(() => {
    if (adminToken) {
      fetchAdminNotes();
    }
  }, [adminToken, showReported]);

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
        <button type="button" className="admin-login-button" onClick={handleAdminClose}>
          Close
        </button>
      </div>
      {adminError && <div className="admin-error">{adminError}</div>}
    </div>
  );

  const adminDashboard = (
    <div className="admin-dashboard">
      <div className="admin-actions">
        <button type="button" onClick={() => setShowReported(false)}>
          View all notes
        </button>
        <button type="button" onClick={() => setShowReported(true)}>
          View reported notes
        </button>
        <button
          type="button"
          onClick={() => {
            localStorage.removeItem('adminToken');
            setAdminToken('');
            setAdminNotes([]);
          }}
        >
          Logout
        </button>
      </div>

      {adminError && <div className="admin-error">{adminError}</div>}

      {adminLoading ? (
        <p>Loading notes…</p>
      ) : (
        adminNotes.map((note) => (
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
          <button type="button" className="admin-toggle-button" onClick={handleAdminToggle}>
            Admin
          </button>
        </div>
      </header>
      {isAdminPanelOpen && (
        <div className="admin-panel">
          {adminToken ? adminDashboard : adminLoginWidget}
        </div>
      )}
      {serverError && <section className="notes-summary"><span>{serverError}</span></section>}

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
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Write your note here..."
              />
            </div>

            <div className="emoji-selector">
              <label>Choose emoji</label>
              <div className="emoji-selector-row">
                <select value={selectedCategory} onChange={(e) => {
                  const category = e.target.value;
                  setSelectedCategory(category);
                  setSelectedEmoji(emojiCategories[category][0]);
                }}>
                  {categoryKeys.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <select value={selectedEmoji} onChange={(e) => setSelectedEmoji(e.target.value)}>
                  {emojiCategories[selectedCategory].map((emoji) => (
                    <option key={emoji} value={emoji}>
                      {emoji}
                    </option>
                  ))}
                </select>
                <button type="button" onClick={() => addEmoji(selectedEmoji)}>
                  Add emoji
                </button>
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
