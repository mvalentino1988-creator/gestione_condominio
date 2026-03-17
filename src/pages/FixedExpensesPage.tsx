import { useState, useEffect } from 'react';
import { getFixedExpenses, upsertFixedExpenses, deleteFixedExpenses } from '../lib/db';
import type { Property, FixedExpenses } from '../types';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const emptyFixed = (pid: string): Omit<FixedExpenses, 'id' | 'created_at'> => ({
  property_id: pid, year_label: '', spese_personali: 0,
  prop_casa: 0, prop_box: 0, prop_cantina: 0,
  gen_prop_casa: 0, gen_prop_box: 0, gen_prop_cantina: 0,
  prop_alloggi: 0, man_ord_casa: 0, man_ord_box: 0, man_ord_cantina: 0,
  scale_prop_casa: 0, scale_prop_box: 0, scale_prop_cantina: 0,
  scala_c_casa: 0, scala_c_box: 0, scala_c_cantina: 0,
  asc_c_casa: 0, asc_c_box: 0, asc_c_cantina: 0,
  addebiti_unita: 0, addebiti_unita_imm: 0, prop_box_extra: 0,
});

function TripleInput({ label, prefix, data, onChange }: { label: string; prefix: string; data: any; onChange: (f: string, v: string) => void }) {
  return (
    <div>
      <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>{label}</p>
      <div className="grid3">
        {['casa', 'box', 'cantina'].map(t => (
          <div key={t}>
            <label style={{ color: 'var(--text2)', fontSize: 11, display: 'block', marginBottom: 4, textTransform: 'capitalize' }}>{t}</label>
            <input type="number" step="0.01" value={data[`${prefix}_${t}`] || 0} onChange={e => onChange(`${prefix}_${t}`, e.target.value)} />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function FixedExpensesPage({ property }: { property: Property }) {
  const [records, setRecords] = useState<FixedExpenses[]>([]);
  const [editing, setEditing] = useState<Partial<FixedExpenses> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getFixedExpenses(property.id).then(setRecords).finally(() => setLoading(false));
  }, [property.id]);

  const openNew = () => { setEditing(emptyFixed(property.id)); setIsNew(true); };
  const openEdit = (r: FixedExpenses) => { setEditing({ ...r }); setIsNew(false); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    const saved = await upsertFixedExpenses(editing as any);
    if (isNew) setRecords(p => [...p, saved]);
    else setRecords(p => p.map(r => r.id === saved.id ? saved : r));
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm('Eliminare?')) return;
    await deleteFixedExpenses(id);
    setRecords(p => p.filter(r => r.id !== id));
  };

  const num = (f: string, v: string) => setEditing(p => ({ ...p, [f]: parseFloat(v) || 0 }));

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;

  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Spese Fisse</h2>
        <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Nuovo</button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16, fontSize: 18 }}>{isNew ? 'Nuovo anno' : `Modifica ${editing.year_label}`}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="grid2">
              <div>
                <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Anno</label>
                <input value={editing.year_label || ''} onChange={e => setEditing(p => ({ ...p, year_label: e.target.value }))} placeholder="24/25" />
              </div>
              <div>
                <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Spese personali</label>
                <input type="number" step="0.01" value={editing.spese_personali || 0} onChange={e => num('spese_personali', e.target.value)} />
              </div>
            </div>
            <TripleInput label="Spese Proprietà" prefix="prop" data={editing} onChange={num} />
            <TripleInput label="Spese Generali di Proprietà" prefix="gen_prop" data={editing} onChange={num} />
            <div>
              <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500, marginBottom: 8 }}>Proprietà alloggi/negozi</p>
              <input type="number" step="0.01" style={{ maxWidth: 160 }} value={editing.prop_alloggi || 0} onChange={e => num('prop_alloggi', e.target.value)} />
            </div>
            <TripleInput label="Manutenzioni Ordinarie" prefix="man_ord" data={editing} onChange={num} />
            <TripleInput label="Spese Scale di Proprietà" prefix="scale_prop" data={editing} onChange={num} />
            <TripleInput label="Scala C" prefix="scala_c" data={editing} onChange={num} />
            <TripleInput label="Ascensore C" prefix="asc_c" data={editing} onChange={num} />
            <div className="grid3">
              {[['addebiti_unita', 'Addebiti unità'], ['addebiti_unita_imm', 'Addebiti imm.'], ['prop_box_extra', 'Proprietà Box']].map(([f, l]) => (
                <div key={f}>
                  <label style={{ color: 'var(--text2)', fontSize: 11, display: 'block', marginBottom: 4 }}>{l}</label>
                  <input type="number" step="0.01" value={(editing as any)[f] || 0} onChange={e => num(f, e.target.value)} />
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
        {[...records].reverse().map(r => {
          const totCasa = r.prop_casa + r.gen_prop_casa + r.man_ord_casa + r.scale_prop_casa + r.scala_c_casa + r.asc_c_casa;
          const totBox = r.prop_box + r.gen_prop_box + r.man_ord_box + r.scale_prop_box + r.scala_c_box + r.asc_c_box + r.prop_box_extra;
          const totCantina = r.prop_cantina + r.gen_prop_cantina + r.man_ord_cantina + r.scale_prop_cantina + r.scala_c_cantina + r.asc_c_cantina;
          const tot = totCasa + totBox + totCantina + r.spese_personali;
          const isExp = expanded === r.id;
          return (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="tag tag-gold">{r.year_label}</span>
                  {r.spese_personali > 0 && <span className="tag tag-blue" style={{ marginLeft: 6 }}>€ {fmt(r.spese_personali)} pers.</span>}
                  <p style={{ marginTop: 8, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>€ {fmt(tot)}</p>
                  <p style={{ color: 'var(--text2)', fontSize: 11 }}>totale spese</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" onClick={() => setExpanded(isExp ? null : r.id)} style={{ padding: '6px 10px' }}>{isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                  <button className="btn-ghost" onClick={() => openEdit(r)} style={{ padding: '6px 10px' }}><Pencil size={14} /></button>
                  <button className="btn-danger" onClick={() => del(r.id)} style={{ padding: '6px 10px' }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                {[['Casa', totCasa], ['Box', totBox], ['Cantina', totCantina]].map(([l, v]) => (
                  <div key={l as string} style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text2)', fontSize: 11 }}>{l}</p>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>€ {fmt(v as number)}</p>
                  </div>
                ))}
              </div>
              {isExp && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {[
                    ['Spese Proprietà', r.prop_casa, r.prop_box, r.prop_cantina],
                    ['Spese Generali', r.gen_prop_casa, r.gen_prop_box, r.gen_prop_cantina],
                    ['Manutenzioni', r.man_ord_casa, r.man_ord_box, r.man_ord_cantina],
                    ['Scale Prop.', r.scale_prop_casa, r.scale_prop_box, r.scale_prop_cantina],
                    ['Scala C', r.scala_c_casa, r.scala_c_box, r.scala_c_cantina],
                    ['Ascensore C', r.asc_c_casa, r.asc_c_box, r.asc_c_cantina],
                  ].map(([l, c, b, ca]) => (
                    <div key={l as string} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 4, fontSize: 12 }}>
                      <span style={{ color: 'var(--text2)' }}>{l}</span>
                      <span style={{ textAlign: 'right' }}>€ {fmt(c as number)}</span>
                      <span style={{ textAlign: 'right' }}>€ {fmt(b as number)}</span>
                      <span style={{ textAlign: 'right' }}>€ {fmt(ca as number)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
