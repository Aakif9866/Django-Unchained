import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';

function formatDate(iso) {
  return new Date(iso).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Notes() {
  const { user, logout } = useAuth();
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedId, setSelectedId] = useState(null);

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);

  const selected = notes.find((n) => n.id === selectedId) ?? null;

  useEffect(() => {
    refresh();
  }, []);

  useEffect(() => {
    setTitle(selected?.title ?? '');
    setContent(selected?.content ?? '');
    setDirty(false);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function refresh(keepSelection = true) {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listNotes();
      setNotes(data);
      if (!keepSelection || !data.some((n) => n.id === selectedId)) {
        setSelectedId(data[0]?.id ?? null);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleNewNote() {
    setError(null);
    try {
      const note = await api.createNote({ title: 'Untitled note', content: '' });
      setNotes((prev) => [note, ...prev]);
      setSelectedId(note.id);
    } catch (err) {
      setError(err.message);
    }
  }

  async function handleSave() {
    if (!selected) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await api.updateNote(selected.id, { title, content });
      setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
      setDirty(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id) {
    setError(null);
    try {
      await api.deleteNote(id);
      setNotes((prev) => prev.filter((n) => n.id !== id));
      if (selectedId === id) setSelectedId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="notes-layout">
      <aside className="sidebar">
        <div className="sidebar-header">
          <span className="brand">Notes</span>
          <button className="btn btn-ghost btn-small" onClick={handleNewNote}>
            + New
          </button>
        </div>

        <div className="note-list">
          {loading && <div className="muted sidebar-msg">Loading…</div>}
          {!loading && notes.length === 0 && (
            <div className="muted sidebar-msg">No notes yet — create one.</div>
          )}
          {notes.map((note) => (
            <button
              key={note.id}
              className={`note-list-item ${note.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(note.id)}
            >
              <span className="note-list-title">{note.title || 'Untitled note'}</span>
              <span className="note-list-date">{formatDate(note.updated_at)}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-nav">
          <Link to="/testing-dashboard" className="sidebar-nav-link">
            <span className="sidebar-nav-dot" />
            Phase 2 Testing Dashboard
          </Link>
        </div>

        <div className="sidebar-footer">
          <span className="muted">{user?.username}</span>
          <button className="btn btn-ghost btn-small" onClick={logout}>
            Log out
          </button>
        </div>
      </aside>

      <main className="editor-pane">
        {error && <div className="form-error editor-error">{error}</div>}

        {!selected && !loading && (
          <div className="center-screen muted">Select a note, or create a new one.</div>
        )}

        {selected && (
          <>
            <div className="editor-toolbar">
              <input
                className="editor-title-input"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setDirty(true);
                }}
                placeholder="Untitled note"
              />
              <div className="editor-actions">
                <button
                  className="btn btn-primary btn-small"
                  onClick={handleSave}
                  disabled={!dirty || saving}
                >
                  {saving ? 'Saving…' : 'Save'}
                </button>
                <button
                  className="btn btn-danger-ghost btn-small"
                  onClick={() => handleDelete(selected.id)}
                >
                  Delete
                </button>
              </div>
            </div>
            <textarea
              className="editor-textarea"
              value={content}
              onChange={(e) => {
                setContent(e.target.value);
                setDirty(true);
              }}
              placeholder="Start writing…"
            />
          </>
        )}
      </main>
    </div>
  );
}
