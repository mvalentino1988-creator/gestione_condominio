import { useState, useEffect } from 'react';
import { getExerciseYears, upsertExerciseYear, deleteExerciseYear } from '../lib/db';
import type { Property, ExerciseYear } from '../types';
import { Plus, Pencil, Trash2, X, Check } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const empty = (pid: string): Omit<ExerciseYear, 'id' | 'created_at'> => ({
  property_id: pid, year_label: '',
  balance_start_casa: 0, balance_start_box: 0, balance_start_cantina: 0,
  rates_paid_casa: 0, rates_paid_box: 0, rates_paid_cantina: 0,
});

export default function ExerciseYearsPage({ property }: { property: Property }) {
  const [years, setYears] = useState<ExerciseYear[]>([]);
  const [editing, setEditing] = useState<Partial<ExerciseYear> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getExerciseYears(property.id).then(setYears).finally(() => setLoading(false));
  }, [property.id]);

  const openNew = () => { setEditing(empty(property.id)); setIsNew(true); };
  const openEdit = (y: ExerciseYear) => { setEditing({ ...y }); setIsNew(false); };
  const cancel = () => { setEditing(null); };

  const save = async () => {
    if (!editing) return;
    const saved = await upsertExerciseYear(editing as any);
    if (isNew) setYears(p => [...p, saved]);
    else setYears(p => p.map(y => y.id === saved.id ? saved : y));
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm('Eliminare questo anno?')) return;
    await deleteExerciseYear(id);
    setYears(p => p.filter(y => y.id !== id));
  };

  const num = (field: string, val: string) => setEditing(p => ({ ...p, [field]: parseFloat(val) || 0 }));

  if (loading) return <Loader />;

  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Saldo Esercizio</h2>
        <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Nuovo anno</button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 20, position: 'relative' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16, fontSize: 18 }}>{isNew ? 'Nuovo anno' : `Modifica ${editing.year_label}`}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Anno (es. 24/25)</label>
              <input value={editing.year_label || ''} onChange={e => setEditing(p => ({ ...p, year_label: e.target.value }))} placeholder="24/25" />
            </div>
            <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>Saldi iniziali (da esercizio precedente)</p>
            <div className="grid3">
              {['casa', 'box', 'cantina'].map(t => (
                <div key={t}>
                  <label style={{ color: 'var(--text2)', fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{t}</label>
                  <input type="number" step="0.01" value={(editing as any)[`balance_start_${t}`] || 0} onChange={e => num(`balance_start_${t}`, e.target.value)} />
                </div>
              ))}
            </div>
            <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>Rate versate (negative = pagato)</p>
            <div className="grid3">
              {['casa', 'box', 'cantina'].map(t => (
                <div key={t}>
                  <label style={{ color: 'var(--text2)', fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{t}</label>
                  <input type="number" step="0.01" value={(editing as any)[`rates_paid_${t}`] || 0} onChange={e => num(`rates_paid_${t}`, e.target.value)} />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn-ghost" onClick={cancel}><X size={14} /> Annulla</button>
              <button className="btn-primary" onClick={save}><Check size={14} /> Salva</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {years.length === 0 && !editing && (
          <p style={{ color: 'var(--text2)', textAlign: 'center', padding: 20 }}>Nessun anno inserito.</p>
        )}
        {[...years].reverse().map(y => {
          const saldoCasa = y.balance_start_casa + y.rates_paid_casa;
          const saldoBox = y.balance_start_box + y.rates_paid_box;
          const saldoCantina = y.balance_start_cantina + y.rates_paid_cantina;
          const totale = saldoCasa + saldoBox + saldoCantina;
          return (
            <div key={y.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 }}>
                <div>
                  <span className="tag tag-gold">{y.year_label}</span>
                  <p style={{ marginTop: 8, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)', color: totale >= 0 ? 'var(--green)' : 'var(--red)' }}>€ {fmt(totale)}</p>
                  <p style={{ color: 'var(--text2)', fontSize: 11 }}>saldo totale</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" onClick={() => openEdit(y)} style={{ padding: '6px 10px' }}><Pencil size={14} /></button>
                  <button className="btn-danger" onClick={() => del(y.id)} style={{ padding: '6px 10px' }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                {[['Casa', saldoCasa], ['Box', saldoBox], ['Cantina', saldoCantina]].map(([label, val]) => (
                  <div key={label as string} style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text2)', fontSize: 11 }}>{label}</p>
                    <p style={{ fontSize: 14, fontWeight: 600, color: (val as number) >= 0 ? 'var(--green)' : 'var(--red)' }}>€ {fmt(val as number)}</p>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Loader() { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>; }
