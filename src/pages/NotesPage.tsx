import { useState, useEffect } from 'react';
import { getNotes, upsertNote, deleteNote } from '../lib/db';
import type { Property, Note } from '../types';
import { Plus, Pencil, Trash2, X, Check, FileText } from 'lucide-react';

const fmtDate = (s: string) => new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

export default function NotesPage({ property }: { property: Property }) {
  const [notes, setNotes] = useState<Note[]>([]);
  const [editing, setEditing] = useState<Partial<Note> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getNotes(property.id).then(setNotes).finally(() => setLoading(false));
  }, [property.id]);

  const openNew = () => { setEditing({ property_id: property.id, title: '', content: '', year_label: null }); setIsNew(true); };
  const openEdit = (n: Note) => { setEditing({ ...n }); setIsNew(false); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing || !editing.title) return;
    const saved = await upsertNote(editing as any);
    if (isNew) setNotes(p => [saved, ...p]);
    else setNotes(p => p.map(n => n.id === saved.id ? saved : n));
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm('Eliminare nota?')) return;
    await deleteNote(id);
    setNotes(p => p.filter(n => n.id !== id));
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;

  return (
    <div style={{ padding: '0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Note</h2>
        <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Nuova nota</button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Titolo</label>
              <input value={editing.title || ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))} placeholder="Titolo nota" />
            </div>
            <div>
              <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Anno (opzionale)</label>
              <input value={editing.year_label || ''} onChange={e => setEditing(p => ({ ...p, year_label: e.target.value || null }))} placeholder="es. 24/25" />
            </div>
            <div>
              <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Contenuto</label>
              <textarea value={editing.content || ''} onChange={e => setEditing(p => ({ ...p, content: e.target.value }))} rows={5} placeholder="Scrivi la nota..." style={{ resize: 'vertical' }} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={cancel}><X size={14} /> Annulla</button>
              <button className="btn-primary" onClick={save}><Check size={14} /> Salva</button>
            </div>
          </div>
        </div>
      )}

      {notes.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text2)' }}>
          <FileText size={32} style={{ marginBottom: 12, opacity: 0.3 }} />
          <p>Nessuna nota. Usa le note per ricordare scadenze, comunicazioni del condominio, o qualsiasi cosa.</p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {notes.map(n => (
          <div key={n.id} className="card" style={{ cursor: 'pointer' }} onClick={() => setExpanded(expanded === n.id ? null : n.id)}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <p style={{ fontWeight: 500, fontSize: 15 }}>{n.title}</p>
                  {n.year_label && <span className="tag tag-gold" style={{ fontSize: 10 }}>{n.year_label}</span>}
                </div>
                <p style={{ color: 'var(--text3)', fontSize: 11 }}>{fmtDate(n.created_at)}</p>
                {expanded !== n.id && n.content && (
                  <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 6, overflow: 'hidden', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>{n.content}</p>
                )}
              </div>
              <div style={{ display: 'flex', gap: 4, marginLeft: 8 }} onClick={e => e.stopPropagation()}>
                <button className="btn-ghost" onClick={() => openEdit(n)} style={{ padding: '5px 8px' }}><Pencil size={13} /></button>
                <button className="btn-danger" onClick={() => del(n.id)} style={{ padding: '5px 8px' }}><Trash2 size={13} /></button>
              </div>
            </div>
            {expanded === n.id && n.content && (
              <p style={{ color: 'var(--text)', fontSize: 14, marginTop: 12, lineHeight: 1.6, whiteSpace: 'pre-wrap', borderTop: '1px solid var(--border)', paddingTop: 12 }}>{n.content}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
