import express from 'express';
import path from 'path';
import fs from 'fs/promises';
import crypto from 'crypto';

const app = express();
const PORT = process.env.PORT || 4000;
const ADMIN_USER = process.env.ADMIN_USER || 'admin';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Mandarini55';
const ADMIN_TOKEN = crypto.createHash('sha256').update(`${ADMIN_USER}:${ADMIN_PASSWORD}`).digest('hex');
const notesFile = path.join(process.cwd(), 'data', 'notes.json');

app.use(express.json({ limit: '15mb' }));

async function ensureNotesFile() {
  try {
    await fs.access(notesFile);
  } catch {
    await fs.mkdir(path.dirname(notesFile), { recursive: true });
    await fs.writeFile(notesFile, '[]', 'utf8');
  }
}

async function readNotes() {
  await ensureNotesFile();
  const content = await fs.readFile(notesFile, 'utf8');
  return JSON.parse(content || '[]');
}

async function writeNotes(notes) {
  await ensureNotesFile();
  await fs.writeFile(notesFile, JSON.stringify(notes, null, 2), 'utf8');
}

function adminAuth(req, res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.replace('Bearer ', '').trim();
  if (token !== ADMIN_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

app.get('/api/status', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/notes', async (_req, res) => {
  const notes = await readNotes();
  res.json({ notes: notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.post('/api/notes', async (req, res) => {
  const { id, text = '', attachments = [], color, createdAt, likes = 0, dislikes = 0 } = req.body;
  if (!id || (!text.trim() && attachments.length === 0)) {
    return res.status(400).json({ error: 'A note needs text or attachments and an id.' });
  }
  const note = {
    id,
    text: text.trim(),
    attachments: attachments.map((file) => ({
      name: file.name,
      type: file.type,
      data: file.data,
    })),
    color: color || '#ffeb3b',
    createdAt: createdAt || new Date().toISOString(),
    likes,
    dislikes,
    reports: 0,
  };

  const notes = await readNotes();
  await writeNotes([note, ...notes]);
  res.status(201).json({ note });
});

app.patch('/api/notes/:id', async (req, res) => {
  const { action } = req.body;
  const noteId = req.params.id;
  const notes = await readNotes();
  const note = notes.find((item) => item.id === noteId);

  if (!note) {
    return res.status(404).json({ error: 'Note not found' });
  }

  if (action === 'like') {
    note.likes = (note.likes || 0) + 1;
  } else if (action === 'dislike') {
    note.dislikes = (note.dislikes || 0) + 1;
  } else if (action === 'report') {
    note.reports = (note.reports || 0) + 1;
  } else if (action === 'unreport') {
    note.reports = Math.max(0, (note.reports || 0) - 1);
  } else {
    return res.status(400).json({ error: 'Unknown action' });
  }

  await writeNotes(notes);
  res.json({ note });
});

app.delete('/api/notes/:id', adminAuth, async (req, res) => {
  const noteId = req.params.id;
  const notes = await readNotes();
  const filtered = notes.filter((item) => item.id !== noteId);

  if (filtered.length === notes.length) {
    return res.status(404).json({ error: 'Note not found' });
  }

  await writeNotes(filtered);
  res.json({ success: true });
});

app.post('/api/admin/login', async (req, res) => {
  const { username, password } = req.body;
  if (username !== ADMIN_USER || password !== ADMIN_PASSWORD) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  res.json({ token: ADMIN_TOKEN });
});

app.get('/api/admin/notes', adminAuth, async (_req, res) => {
  const notes = await readNotes();
  res.json({ notes: notes.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)) });
});

app.get('/api/admin/reported', adminAuth, async (_req, res) => {
  const notes = await readNotes();
  res.json({ notes: notes.filter((note) => (note.reports || 0) > 0) });
});

const distPath = path.join(process.cwd(), 'dist');
app.use(express.static(distPath));

app.get('*', (_req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
