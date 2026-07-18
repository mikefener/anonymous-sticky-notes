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

  const emojiCategories = {
    Smileys: ['😀', '😄', '😊', '😂', '😍', '😎', '🤩', '🥳', '🤗', '😇'],
    Symbols: ['🔥', '💡', '✨', '💬', '🎉', '❤️', '👍', '🌟', '🚀', '⚡'],
    Objects: ['📌', '📎', '📅', '🖊️', '🧩', '🎁', '📝', '📦', '🔔', '💼'],
    Nature: ['🌿', '🌸', '🌞', '🌈', '🍃', '🌺', '🌊', '🍂', '🍁', '🌻'],
  };

  const categoryKeys = Object.keys(emojiCategories);
  const [selectedCategory, setSelectedCategory] = useState(categoryKeys[0]);
  const [selectedEmoji, setSelectedEmoji] = useState(emojiCategories[categoryKeys[0]][0]);

  const handleAddNote = () => {
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
    };
    setNotes((prev) => [note, ...prev]);
    setText('');
    setAttachments([]);
    setSearch('');
    setSearchResults([]);
    setShowCreate(true);
  };

  const addEmoji = (emoji) => {
    setText((prev) => prev + emoji);
  };

  const handleFiles = (event) => {
    const files = Array.from(event.target.files).map((file) => {
      const url = URL.createObjectURL(file);
      return { name: file.name, url, type: file.type };
    });

    setAttachments((prev) => [...prev, ...files]);
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
    if (saved) {
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
    const url = `${window.location.origin}${window.location.pathname}?note=${noteId}`;
    navigator.clipboard.writeText(url);
  };

  const sendEmail = (noteId) => {
    const subject = encodeURIComponent('Check out this sticky note');
    const body = encodeURIComponent(`View this note: ${window.location.origin}${window.location.pathname}?note=${noteId}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const updateReaction = (noteId, type) => {
    setNotes((prev) =>
      prev.map((note) =>
        note.id === noteId
          ? {
              ...note,
              likes: type === 'like' ? note.likes + 1 : note.likes,
              dislikes: type === 'dislike' ? note.dislikes + 1 : note.dislikes,
            }
          : note
      )
    );
  };

  return (
    <div className="app-shell">
      <header>
        <h1>Anonymous Sticky Notes</h1>
        <p>Tap the big + button to create a note with text, image, video, audio, and emojis.</p>
      </header>

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
              placeholder="Search by note ID"
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
                    👍 {note.likes}
                  </button>
                  <button type="button" onClick={() => updateReaction(note.id, 'dislike')}>
                    👎 {note.dislikes}
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
