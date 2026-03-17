import { useState, useEffect } from 'react';
import { getConsumptionData, upsertConsumptionData, deleteConsumptionData } from '../lib/db';
import type { Property, ConsumptionData } from '../types';
import { Plus, Pencil, Trash2, X, Check, ChevronDown, ChevronUp } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtN = (n: number | null) => n !== null ? n.toLocaleString('it-IT') : '—';

const emptyC = (pid: string): Omit<ConsumptionData, 'id' | 'created_at'> => ({
  property_id: pid, year_label: '',
  acqua_potabile: 0, riscaldamento_involontario: 0, riscaldamento_consumo: 0,
  acqua_calda_involontaria: 0, acqua_calda_consumo: 0, energia_elettrica_box: 0,
  movimenti_personali: 0,
  risc_lettura_iniziale: null, risc_lettura_finale: null,
  acqua_calda_lettura_iniziale: null, acqua_calda_lettura_finale: null,
  acqua_fredda_lettura_iniziale: null, acqua_fredda_lettura_finale: null,
  totale_casa: 0, totale_box: 0, totale_cantina: 0,
});

export default function ConsumptionPage({ property }: { property: Property }) {
  const [records, setRecords] = useState<ConsumptionData[]>([]);
  const [editing, setEditing] = useState<Partial<ConsumptionData> | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    getConsumptionData(property.id).then(setRecords).finally(() => setLoading(false));
  }, [property.id]);

  const openNew = () => { setEditing(emptyC(property.id)); setIsNew(true); };
  const openEdit = (r: ConsumptionData) => { setEditing({ ...r }); setIsNew(false); };
  const cancel = () => setEditing(null);

  const save = async () => {
    if (!editing) return;
    const saved = await upsertConsumptionData(editing as any);
    if (isNew) setRecords(p => [...p, saved]);
    else setRecords(p => p.map(r => r.id === saved.id ? saved : r));
    setEditing(null);
  };

  const del = async (id: string) => {
    if (!confirm('Eliminare?')) return;
    await deleteConsumptionData(id);
    setRecords(p => p.filter(r => r.id !== id));
  };

  const num = (f: string, v: string) => setEditing(p => ({ ...p, [f]: v === '' ? null : parseFloat(v) || 0 }));

  const F = ({ label, field }: { label: string; field: string }) => (
    <div>
      <label style={{ color: 'var(--text2)', fontSize: 11, display: 'block', marginBottom: 4 }}>{label}</label>
      <input type="number" step="0.01" value={(editing as any)?.[field] ?? ''} placeholder="—"
        onChange={e => num(field, e.target.value)} />
    </div>
  );

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;

  return (
    <div style={{ padding: '20px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Dati Consumi</h2>
        <button className="btn-primary" onClick={openNew} style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Plus size={15} /> Nuovo</button>
      </div>

      {editing && (
        <div className="card" style={{ marginBottom: 20 }}>
          <h3 style={{ fontFamily: 'var(--font-display)', marginBottom: 16, fontSize: 18 }}>{isNew ? 'Nuovo anno' : `Modifica ${editing.year_label}`}</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>
              <label style={{ color: 'var(--text2)', fontSize: 12, display: 'block', marginBottom: 6 }}>Anno</label>
              <input value={editing.year_label || ''} onChange={e => setEditing(p => ({ ...p, year_label: e.target.value }))} placeholder="24/25" />
            </div>
            <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>Costi</p>
            <div className="grid2">
              <F label="Acqua potabile €" field="acqua_potabile" />
              <F label="Risc. involontario €" field="riscaldamento_involontario" />
              <F label="Risc. consumo €" field="riscaldamento_consumo" />
              <F label="ACS involontaria €" field="acqua_calda_involontaria" />
              <F label="ACS consumo €" field="acqua_calda_consumo" />
              <F label="Energia el. box €" field="energia_elettrica_box" />
              <F label="Movimenti personali €" field="movimenti_personali" />
            </div>
            <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>Totali gestione</p>
            <div className="grid3">
              <F label="Totale Casa" field="totale_casa" />
              <F label="Totale Box" field="totale_box" />
              <F label="Totale Cantina" field="totale_cantina" />
            </div>
            <p style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 500 }}>Letture contatori</p>
            <div className="grid2">
              <F label="Risc. iniziale" field="risc_lettura_iniziale" />
              <F label="Risc. finale" field="risc_lettura_finale" />
              <F label="ACS iniziale" field="acqua_calda_lettura_iniziale" />
              <F label="ACS finale" field="acqua_calda_lettura_finale" />
              <F label="Acqua fredda iniziale" field="acqua_fredda_lettura_iniziale" />
              <F label="Acqua fredda finale" field="acqua_fredda_lettura_finale" />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
              <button className="btn-ghost" onClick={cancel}><X size={14} /> Annulla</button>
              <button className="btn-primary" onClick={save}><Check size={14} /> Salva</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {records.length === 0 && !editing && <p style={{ color: 'var(--text2)', textAlign: 'center', padding: 20 }}>Nessun dato.</p>}
        {[...records].reverse().map(r => {
          const isExp = expanded === r.id;
          const tot = r.totale_casa + r.totale_box + r.totale_cantina;
          return (
            <div key={r.id} className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <span className="tag tag-gold">{r.year_label}</span>
                  <p style={{ marginTop: 8, fontSize: 22, fontWeight: 700, fontFamily: 'var(--font-display)' }}>€ {fmt(tot)}</p>
                  <p style={{ color: 'var(--text2)', fontSize: 11 }}>totale gestione</p>
                </div>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button className="btn-ghost" onClick={() => setExpanded(isExp ? null : r.id)} style={{ padding: '6px 10px' }}>{isExp ? <ChevronUp size={14} /> : <ChevronDown size={14} />}</button>
                  <button className="btn-ghost" onClick={() => openEdit(r)} style={{ padding: '6px 10px' }}><Pencil size={14} /></button>
                  <button className="btn-danger" onClick={() => del(r.id)} style={{ padding: '6px 10px' }}><Trash2 size={14} /></button>
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 12 }}>
                {[['Casa', r.totale_casa], ['Box', r.totale_box], ['Cantina', r.totale_cantina]].map(([l, v]) => (
                  <div key={l as string} style={{ textAlign: 'center' }}>
                    <p style={{ color: 'var(--text2)', fontSize: 11 }}>{l}</p>
                    <p style={{ fontSize: 14, fontWeight: 600 }}>€ {fmt(v as number)}</p>
                  </div>
                ))}
              </div>
              {isExp && (
                <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 12 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 13 }}>
                    {[
                      ['Acqua potabile', r.acqua_potabile],
                      ['Risc. consumo', r.riscaldamento_consumo],
                      ['Risc. involontario', r.riscaldamento_involontario],
                      ['ACS consumo', r.acqua_calda_consumo],
                      ['ACS involontaria', r.acqua_calda_involontaria],
                      ['Energia el. box', r.energia_elettrica_box],
                    ].map(([l, v]) => (
                      <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 8px', background: 'var(--bg)', borderRadius: 6 }}>
                        <span style={{ color: 'var(--text2)' }}>{l}</span>
                        <span>€ {fmt(v as number)}</span>
                      </div>
                    ))}
                  </div>
                  {r.risc_lettura_iniziale !== null && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ color: 'var(--text3)', fontSize: 11, marginBottom: 6 }}>LETTURE CONTATORI</p>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text2)' }}>Riscaldamento</span>
                          <span>{fmtN(r.risc_lettura_iniziale)} → {fmtN(r.risc_lettura_finale)} ({fmtN(r.risc_lettura_finale !== null && r.risc_lettura_iniziale !== null ? r.risc_lettura_finale - r.risc_lettura_iniziale : null)} kWh)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text2)' }}>Acqua calda</span>
                          <span>{fmtN(r.acqua_calda_lettura_iniziale)} → {fmtN(r.acqua_calda_lettura_finale)} ({fmtN(r.acqua_calda_lettura_finale !== null && r.acqua_calda_lettura_iniziale !== null ? r.acqua_calda_lettura_finale - r.acqua_calda_lettura_iniziale : null)} L)</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                          <span style={{ color: 'var(--text2)' }}>Acqua fredda</span>
                          <span>{fmtN(r.acqua_fredda_lettura_iniziale)} → {fmtN(r.acqua_fredda_lettura_finale)} ({fmtN(r.acqua_fredda_lettura_finale !== null && r.acqua_fredda_lettura_iniziale !== null ? r.acqua_fredda_lettura_finale - r.acqua_fredda_lettura_iniziale : null)} L)</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
