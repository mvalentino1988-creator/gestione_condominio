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

function NumField({ label, field, data, onChange }: { label: string; field: string; data: any; onChange: (f: string, v: string) => void }) {
  return (
    <div>
      <label>{label}</label>
      <input type="number" step="0.01" value={data[field] ?? 0} onChange={e => onChange(field, e.target.value)} />
    </div>
  );
}

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
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing?.year_label) return;
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

  const num = (f: string, v: string) => setEditing(p => ({ ...p, [f]: parseFloat(v) || 0 }));

  if (loading) return <Loader />;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Saldo Esercizio</h2>
          <p style={{ color: 'var(--text2)', fontSize: 13, marginTop: 2 }}>{years.length} anni registrati</p>
        </div>
        <button className="btn-primary" onClick={openNew}><Plus size={15} /> Nuovo anno</button>
      </div>

      {editing && (
        <div className="card" style={{ border: '2px solid var(--accent)' }}>
          <h3 style={{ fontFamily: 'var(--font-display)', fontSize: 18, marginBottom: 16 }}>
            {isNew ? '+ Nuovo anno' : `Modifica ${editing.year_label}`}
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label>Anno esercizio</label>
              <input value={editing.year_label || ''} onChange={e => setEditing(p => ({ ...p, year_label: e.target.value }))} placeholder="es. 25/26" />
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '14px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>SALDI INIZIALI (da esercizio precedente)</p>
              <div className="grid3">
                <NumField label="Casa (€)" field="balance_start_casa" data={editing} onChange={num} />
                <NumField label="Box (€)" field="balance_start_box" data={editing} onChange={num} />
                <NumField label="Cantina (€)" field="balance_start_cantina" data={editing} onChange={num} />
              </div>
            </div>

            <div style={{ background: 'var(--bg2)', borderRadius: 10, padding: '14px' }}>
              <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 10 }}>RATE VERSATE (negative = hai pagato)</p>
              <div className="grid3">
                <NumField label="Casa (€)" field="rates_paid_casa" data={editing} onChange={num} />
                <NumField label="Box (€)" field="rates_paid_box" data={editing} onChange={num} />
                <NumField label="Cantina (€)" field="rates_paid_cantina" data={editing} onChange={num} />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={cancel}><X size={14} /> Annulla</button>
              <button className="btn-primary" onClick={save}><Check size={14} /> Salva</button>
            </div>
          </div>
        </div>
      )}

      {years.length === 0 && !editing && (
        <div style={{ textAlign: 'center', padding: 30, background: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text2)' }}>Nessun anno inserito.</p>
        </div>
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
                <span className="tag tag-blue">{y.year_label}</span>
                <p style={{ marginTop: 8, fontSize: 26, fontWeight: 700, fontFamily: 'var(--font-display)', color: totale >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {totale >= 0 ? '+' : ''}€ {fmt(totale)}
                </p>
                <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>saldo totale</p>
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button className="btn-icon" onClick={() => openEdit(y)}><Pencil size={14} /></button>
                <button className="btn-danger" onClick={() => del(y.id)}><Trash2 size={14} /></button>
              </div>
            </div>
            <div className="divider" />
            <div className="grid3">
              {[['Casa', saldoCasa], ['Box', saldoBox], ['Cantina', saldoCantina]].map(([l, v]) => (
                <div key={l as string} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg2)', borderRadius: 10 }}>
                  <p style={{ color: 'var(--text2)', fontSize: 11, fontWeight: 500, marginBottom: 4 }}>{l}</p>
                  <p style={{ fontSize: 15, fontWeight: 700, color: (v as number) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                    {(v as number) >= 0 ? '+' : ''}€ {fmt(v as number)}
                  </p>
                </div>
              ))}
            </div>
            <div className="divider" />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 12 }}>
              {[['Saldo ini. casa', y.balance_start_casa], ['Saldo ini. box', y.balance_start_box], ['Saldo ini. cantina', y.balance_start_cantina],
                ['Rate casa', y.rates_paid_casa], ['Rate box', y.rates_paid_box], ['Rate cantina', y.rates_paid_cantina]].map(([l, v]) => (
                <div key={l as string}>
                  <p style={{ color: 'var(--text3)', fontSize: 10, marginBottom: 2 }}>{l}</p>
                  <p style={{ fontWeight: 500, color: (v as number) < 0 ? 'var(--red)' : 'var(--text)' }}>€ {fmt(v as number)}</p>
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function Loader() { return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>; }
