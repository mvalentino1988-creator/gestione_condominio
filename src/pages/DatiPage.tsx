import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Property, FixedExpenses, ConsumptionData } from '../types';
import {
  Plus, Pencil, Trash2, X, Check, AlertCircle, ChevronDown, ChevronUp, CreditCard
} from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

// ── Utils ──────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';

const MILL = { casa: 3.394, box: 0.576, cantina: 0.059 };
const MILL_TOT = MILL.casa + MILL.box + MILL.cantina;

// Preventivo 25/26
const PV = {
  prop:     52129.06 * 3.394 / 1000,
  gen:      149737.47 * 3.394 / 1000,
  man:      10000.00 * 3.394 / 1000,
  scalac:   4500.00 * 20.288 / 1000,
  asc:      3802.22 * 20.288 / 1000,
  tele:     5054.50 * 3.394 / 1000,
  risc_inv: 35349.04 * 3.394 / 1000,
  acs_inv:  31638.80 * 3.394 / 1000,
};
const SPESE_FISSE_STIMATE_2526 = Object.values(PV).reduce((s, v) => s + v, 0);

const annoFromDate = (d: string): string => {
  if (!d) return '';
  const dt = new Date(d);
  const m = dt.getMonth() + 1;
  const y = dt.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
};

// ── Sezione Rendiconto ─────────────────────────────────────────
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

function SezioneRendiconto({ anno, year, onSave, onDelete }: {
  anno: string;
  year: any | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(year || {
    year_label: anno,
    balance_start_casa: 0, balance_start_box: 0, balance_start_cantina: 0,
    rates_paid_casa: 0, rates_paid_box: 0, rates_paid_cantina: 0,
    spese_totali_casa: 0, spese_totali_box: 0, spese_totali_cantina: 0,
  });

  useEffect(() => {
    if (year) setForm(year);
  }, [year]);

  const num = (f: string, v: string) => setForm((p: any) => ({ ...p, [f]: parseFloat(v) || 0 }));

  const sC  = year ? calcSaldo(year.balance_start_casa, year.rates_paid_casa, year.spese_totali_casa || 0) : null;
  const sB  = year ? calcSaldo(year.balance_start_box, year.rates_paid_box, year.spese_totali_box || 0) : null;
  const sCa = year ? calcSaldo(year.balance_start_cantina, year.rates_paid_cantina, year.spese_totali_cantina || 0) : null;
  const tot = sC !== null ? sC + sB! + sCa! : null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Rendiconto SSA</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Saldo = Inizio − Rate versate + Spese assegnate</p>
        </div>
        {year && !editing && (
          <button className="btn-icon" onClick={() => setEditing(true)}><Pencil size={13} /></button>
        )}
      </div>

      {!year && !editing && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
            Nessun rendiconto per questo esercizio.
          </p>
          <button className="btn-primary" onClick={() => setEditing(true)} style={{ gap: 6 }}>
            <Plus size={14} /> Inserisci rendiconto
          </button>
        </div>
      )}

      {year && !editing && (
        <>
          {/* Saldo totale */}
          <div style={{
            padding: '14px 16px', marginBottom: 12,
            background: (tot || 0) >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `2px solid ${(tot || 0) >= 0 ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, color: (tot || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {(tot || 0) >= 0 ? '▲ CREDITO' : '▼ DEBITO'} totale
            </span>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: (tot || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              €{fa(tot || 0)}
            </span>
          </div>

          {/* Saldo per unità */}
          <div className="grid3" style={{ marginBottom: 12 }}>
            {([['App C63', sC], ['Box 13', sB], ['Cantina', sCa]] as [string, number | null][]).map(([l, v]) => (
              <div key={l} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg3)', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>{l}</p>
                <p style={{ fontSize: 16, fontWeight: 800, color: (v || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {(v || 0) >= 0 ? '+' : '-'}€{fa(v || 0)}
                </p>
              </div>
            ))}
          </div>

          {/* Dettaglio dati */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6, fontSize: 11 }}>
            {[
              ['Saldo inizio App', year.balance_start_casa],
              ['Saldo inizio Box', year.balance_start_box],
              ['Saldo inizio Cant.', year.balance_start_cantina],
              ['Rate versate App', year.rates_paid_casa],
              ['Rate versate Box', year.rates_paid_box],
              ['Rate versate Cant.', year.rates_paid_cantina],
              ['Spese App', year.spese_totali_casa || 0],
              ['Spese Box', year.spese_totali_box || 0],
              ['Spese Cant.', year.spese_totali_cantina || 0],
            ].map(([l, v]) => (
              <div key={l as string} style={{ background: 'var(--bg3)', borderRadius: 7, padding: '6px 8px' }}>
                <p style={{ color: 'var(--text3)', fontSize: 9, marginBottom: 2 }}>{l}</p>
                <p style={{ fontWeight: 600, fontSize: 12 }}>€{fa(v as number)}</p>
              </div>
            ))}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 6 }}>
            <button className="btn-danger" onClick={() => onDelete(year.id)}><Trash2 size={13} /></button>
          </div>
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8 }}>Saldo iniziale (da esercizio precedente)</p>
            <div className="grid3">
              {(['casa', 'box', 'cantina'] as const).map(t => (
                <div key={t}>
                  <label>{t === 'casa' ? 'App C63' : t === 'box' ? 'Box 13' : 'Cantina'}</label>
                  <input type="number" step="0.01" value={form[`balance_start_${t}`] ?? 0}
                    onChange={e => num(`balance_start_${t}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8 }}>Rate versate nell'esercizio</p>
            <div className="grid3">
              {(['casa', 'box', 'cantina'] as const).map(t => (
                <div key={t}>
                  <label>{t === 'casa' ? 'App C63' : t === 'box' ? 'Box 13' : 'Cantina'}</label>
                  <input type="number" step="0.01" value={form[`rates_paid_${t}`] ?? 0}
                    onChange={e => num(`rates_paid_${t}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8 }}>Spese totali assegnate (dal riparto)</p>
            <div className="grid3">
              {(['casa', 'box', 'cantina'] as const).map(t => (
                <div key={t}>
                  <label>{t === 'casa' ? 'App C63' : t === 'box' ? 'Box 13' : 'Cantina'}</label>
                  <input type="number" step="0.01" value={form[`spese_totali_${t}`] ?? 0}
                    onChange={e => num(`spese_totali_${t}`, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setEditing(false)}><X size={13} /> Annulla</button>
            <button className="btn-primary" onClick={() => { onSave({ ...form, year_label: anno }); setEditing(false); }}>
              <Check size={13} /> Salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sezione Spese Fisse ────────────────────────────────────────
function SezioneSpese({ anno, fixed, onSave, onDelete }: {
  anno: string;
  fixed: FixedExpenses | null;
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const emptyF = {
    year_label: anno, spese_personali: 0,
    prop_casa: 0, prop_box: 0, prop_cantina: 0,
    gen_prop_casa: 0, gen_prop_box: 0, gen_prop_cantina: 0,
    prop_alloggi: 0, man_ord_casa: 0, man_ord_box: 0, man_ord_cantina: 0,
    scale_prop_casa: 0, scale_prop_box: 0, scale_prop_cantina: 0,
    scala_c_casa: 0, scala_c_box: 0, scala_c_cantina: 0,
    asc_c_casa: 0, asc_c_box: 0, asc_c_cantina: 0,
    addebiti_unita: 0, addebiti_unita_imm: 0, prop_box_extra: 0,
  };
  const [form, setForm] = useState<any>(fixed || emptyF);
  useEffect(() => { if (fixed) setForm(fixed); }, [fixed]);

  const num = (f: string, v: string) => setForm((p: any) => ({ ...p, [f]: parseFloat(v) || 0 }));

  const sfTot = (f: any) => f.prop_casa + f.gen_prop_casa + f.man_ord_casa + f.scale_prop_casa + f.scala_c_casa + f.asc_c_casa + f.prop_alloggi + f.addebiti_unita + f.addebiti_unita_imm + f.spese_personali;
  const sfBox = (f: any) => f.prop_box + f.gen_prop_box + f.man_ord_box + f.scale_prop_box + f.scala_c_box + f.asc_c_box + f.prop_box_extra;
  const sfCant = (f: any) => f.prop_cantina + f.gen_prop_cantina + f.man_ord_cantina + f.scale_prop_cantina + f.scala_c_cantina + f.asc_c_cantina;

  const vociApp = fixed ? [
    ['Spese Proprietà', fixed.prop_casa],
    ['Spese Generali', fixed.gen_prop_casa],
    ['Manutenzioni Ord.', fixed.man_ord_casa],
    ['Scale C', fixed.scale_prop_casa + fixed.scala_c_casa],
    ['Ascensore C', fixed.asc_c_casa],
    ['Prop. alloggi', fixed.prop_alloggi],
    ['Teleletture', fixed.addebiti_unita_imm],
    ['Mov. personali', fixed.spese_personali],
  ] : [];

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Spese Fisse</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Voci dal Riparto Consuntivo SSA</p>
        </div>
        {fixed && !editing && (
          <button className="btn-icon" onClick={() => setEditing(true)}><Pencil size={13} /></button>
        )}
      </div>

      {!fixed && !editing && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>
            Nessuna spesa fissa per questo esercizio.
          </p>
          <button className="btn-primary" onClick={() => setEditing(true)} style={{ gap: 6 }}>
            <Plus size={14} /> Inserisci spese
          </button>
        </div>
      )}

      {fixed && !editing && (
        <>
          {/* Totali per unità */}
          <div className="grid3" style={{ marginBottom: 14 }}>
            {([['App C63', sfTot(fixed)], ['Box 13', sfBox(fixed)], ['Cantina', sfCant(fixed)]] as [string, number][]).map(([l, v]) => (
              <div key={l} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg3)', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>{l}</p>
                <p style={{ fontSize: 16, fontWeight: 800 }}>€{f0(v)}</p>
              </div>
            ))}
          </div>

          {/* Voci dettaglio App */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Dettaglio App C63</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {vociApp.map(([l, v]) => (v as number) > 0 ? (
              <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 7, fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{l}</span>
                <span style={{ fontWeight: 700 }}>€{fa(v as number)}</span>
              </div>
            ) : null)}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--accent-light)', borderRadius: 7, fontSize: 13, fontWeight: 800, marginTop: 4 }}>
              <span style={{ color: 'var(--accent)' }}>Totale App C63</span>
              <span style={{ color: 'var(--accent)' }}>€{fa(sfTot(fixed))}</span>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 6 }}>
            <button className="btn-danger" onClick={() => onDelete(fixed.id)}><Trash2 size={13} /></button>
          </div>
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { lbl: 'Spese Proprietà', pfx: 'prop' },
            { lbl: 'Spese Generali', pfx: 'gen_prop' },
            { lbl: 'Manutenzioni Ordinarie', pfx: 'man_ord' },
            { lbl: 'Scale di Proprietà (Scala C)', pfx: 'scale_prop' },
            { lbl: 'Scala C Gestione', pfx: 'scala_c' },
            { lbl: 'Ascensore C', pfx: 'asc_c' },
          ].map(({ lbl, pfx }) => (
            <div key={pfx} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>{lbl}</p>
              <div className="grid3">
                {(['casa', 'box', 'cantina'] as const).map(t => (
                  <div key={t}>
                    <label>{t === 'casa' ? 'App C63' : t === 'box' ? 'Box 13' : 'Cantina'}</label>
                    <input type="number" step="0.01" value={form[`${pfx}_${t}`] ?? 0}
                      onChange={e => num(`${pfx}_${t}`, e.target.value)} />
                  </div>
                ))}
              </div>
            </div>
          ))}
          <div className="grid3">
            {[['Prop. alloggi', 'prop_alloggi'], ['Teleletture', 'addebiti_unita_imm'], ['Mov. personali', 'spese_personali']].map(([l, f]) => (
              <div key={f}>
                <label>{l}</label>
                <input type="number" step="0.01" value={form[f] ?? 0}
                  onChange={e => num(f, e.target.value)} />
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setEditing(false)}><X size={13} /> Annulla</button>
            <button className="btn-primary" onClick={() => { onSave({ ...form, year_label: anno }); setEditing(false); }}>
              <Check size={13} /> Salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sezione Consumi ────────────────────────────────────────────
function SezioneConsumi({ anno, consumo, tuttiConsumi, onSave, onDelete }: {
  anno: string;
  consumo: ConsumptionData | null;
  tuttiConsumi: ConsumptionData[];
  onSave: (data: any) => void;
  onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const emptyC = {
    year_label: anno,
    acqua_potabile: 0, riscaldamento_involontario: 0, riscaldamento_consumo: 0,
    acqua_calda_involontaria: 0, acqua_calda_consumo: 0, energia_elettrica_box: 0,
    movimenti_personali: 0,
    risc_lettura_iniziale: null, risc_lettura_finale: null,
    acqua_calda_lettura_iniziale: null, acqua_calda_lettura_finale: null,
    acqua_fredda_lettura_iniziale: null, acqua_fredda_lettura_finale: null,
    totale_casa: 0, totale_box: 0, totale_cantina: 0,
  };
  const [form, setForm] = useState<any>(consumo || emptyC);
  useEffect(() => { if (consumo) setForm(consumo); }, [consumo]);

  const num = (f: string, v: string) => setForm((p: any) => ({ ...p, [f]: v === '' ? null : parseFloat(v) || 0 }));

  // Calcoli consumi
  const rKwh = consumo?.risc_lettura_finale && consumo?.risc_lettura_iniziale
    ? consumo.risc_lettura_finale - consumo.risc_lettura_iniziale : null;
  const aL = consumo?.acqua_calda_lettura_finale && consumo?.acqua_calda_lettura_iniziale
    ? consumo.acqua_calda_lettura_finale - consumo.acqua_calda_lettura_iniziale : null;
  const afL = consumo?.acqua_fredda_lettura_finale && consumo?.acqua_fredda_lettura_iniziale
    ? consumo.acqua_fredda_lettura_finale - consumo.acqua_fredda_lettura_iniziale : null;

  // Alert letture SOLO per questo anno
  const errori: { msg: string; severity: 'error' | 'warn' }[] = [];
  if (consumo) {
    if (rKwh !== null && rKwh < 0) errori.push({ msg: 'Riscaldamento: lettura finale < iniziale', severity: 'error' });
    if (aL !== null && aL < 0) errori.push({ msg: 'Acqua calda: lettura finale < iniziale', severity: 'error' });
    if (afL !== null && afL < 0) errori.push({ msg: 'Acqua fredda: lettura finale < iniziale', severity: 'error' });
    if (rKwh !== null && rKwh === 0 && consumo.riscaldamento_consumo > 0)
      errori.push({ msg: 'Riscaldamento: consumo zero ma costo > 0', severity: 'warn' });

    // Continuità con anno precedente/successivo
    const sorted = [...tuttiConsumi].sort((a, b) => a.year_label.localeCompare(b.year_label));
    const idx = sorted.findIndex(x => x.id === consumo.id);
    const prev = idx > 0 ? sorted[idx - 1] : null;
    const next = idx < sorted.length - 1 ? sorted[idx + 1] : null;

    if (prev && prev.risc_lettura_finale !== null && consumo.risc_lettura_iniziale !== null && prev.risc_lettura_finale !== consumo.risc_lettura_iniziale)
      errori.push({ msg: `Risc.: finale ${prev.year_label} (${prev.risc_lettura_finale}) ≠ iniziale ${anno} (${consumo.risc_lettura_iniziale})`, severity: 'warn' });
    if (next && consumo.risc_lettura_finale !== null && next.risc_lettura_iniziale !== null && consumo.risc_lettura_finale !== next.risc_lettura_iniziale)
      errori.push({ msg: `Risc.: finale ${anno} (${consumo.risc_lettura_finale}) ≠ iniziale ${next.year_label} (${next.risc_lettura_iniziale})`, severity: 'warn' });
    if (prev && prev.acqua_calda_lettura_finale !== null && consumo.acqua_calda_lettura_iniziale !== null && prev.acqua_calda_lettura_finale !== consumo.acqua_calda_lettura_iniziale)
      errori.push({ msg: `ACS: finale ${prev.year_label} ≠ iniziale ${anno}`, severity: 'warn' });
    if (prev && prev.acqua_fredda_lettura_finale !== null && consumo.acqua_fredda_lettura_iniziale !== null && prev.acqua_fredda_lettura_finale !== consumo.acqua_fredda_lettura_iniziale)
      errori.push({ msg: `Acq.fr.: finale ${prev.year_label} ≠ iniziale ${anno}`, severity: 'warn' });
  }

  const rU = rKwh && consumo?.riscaldamento_consumo ? consumo.riscaldamento_consumo / rKwh : null;
  const aU = aL && consumo?.acqua_calda_consumo ? consumo.acqua_calda_consumo / aL : null;
  const afU = afL && consumo?.acqua_potabile ? consumo.acqua_potabile / afL : null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Consumi</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Letture contatori e costi dal riparto</p>
        </div>
        {consumo && !editing && (
          <button className="btn-icon" onClick={() => setEditing(true)}><Pencil size={13} /></button>
        )}
      </div>

      {!consumo && !editing && (
        <div style={{ textAlign: 'center', padding: '20px 0' }}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 12 }}>Nessun dato consumi per questo esercizio.</p>
          <button className="btn-primary" onClick={() => setEditing(true)} style={{ gap: 6 }}>
            <Plus size={14} /> Inserisci consumi
          </button>
        </div>
      )}

      {consumo && !editing && (
        <>
          {/* Errori letture SOLO per questo anno */}
          {errori.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 12, color: '#b45309', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={13} /> Anomalie letture esercizio {anno}
              </p>
              {errori.map((e, i) => (
                <p key={i} style={{ fontSize: 12, color: e.severity === 'error' ? '#dc2626' : '#92400e', marginTop: 3, paddingLeft: 19 }}>
                  • {e.msg}
                </p>
              ))}
              <button className="btn-ghost" onClick={() => setEditing(true)} style={{ marginTop: 10, fontSize: 12, padding: '6px 12px', gap: 5 }}>
                <Pencil size={12} /> Correggi letture
              </button>
            </div>
          )}

          {/* Totali per unità */}
          <div className="grid3" style={{ marginBottom: 14 }}>
            {([['App C63', consumo.totale_casa], ['Box 13', consumo.totale_box], ['Cantina', consumo.totale_cantina]] as [string, number][]).map(([l, v]) => (
              <div key={l} style={{ textAlign: 'center', padding: '10px 6px', background: 'var(--bg3)', borderRadius: 10 }}>
                <p style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 4 }}>{l}</p>
                <p style={{ fontSize: 16, fontWeight: 800 }}>€{f0(v)}</p>
              </div>
            ))}
          </div>

          {/* Letture contatori */}
          {(rKwh !== null || aL !== null || afL !== null) && (
            <>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Letture contatori</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
                {([
                  ['Riscaldamento', rKwh, 'cal', rU, '€/cal', '#ef4444', consumo.risc_lettura_iniziale, consumo.risc_lettura_finale],
                  ['Acqua calda', aL, 'L', aU, '€/L', '#f97316', consumo.acqua_calda_lettura_iniziale, consumo.acqua_calda_lettura_finale],
                  ['Acqua fredda', afL, 'L', afU, '€/L', '#3b82f6', consumo.acqua_fredda_lettura_iniziale, consumo.acqua_fredda_lettura_finale],
                ] as [string, number | null, string, number | null, string, string, number | null, number | null][]).map(([nome, cons, unit, cu, cuLabel, col, ini, fin]) => (
                  cons !== null ? (
                    <div key={nome} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '9px 12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontWeight: 700, fontSize: 13, color: col }}>{nome}</span>
                        <span style={{ fontWeight: 800, fontSize: 14 }}>{cons.toLocaleString('it-IT')} {unit}</span>
                      </div>
                      <div style={{ display: 'flex', gap: 8, marginTop: 4, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
                        <span>{ini?.toLocaleString('it-IT')} → {fin?.toLocaleString('it-IT')} {unit}</span>
                        {cu && <span style={{ fontWeight: 700, color: col }}>{cuLabel}: €{cu.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>}
                      </div>
                    </div>
                  ) : null
                ))}
              </div>
            </>
          )}

          {/* Costi */}
          <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', marginBottom: 8 }}>Costi dal riparto</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
              ['Riscaldamento consumo', consumo.riscaldamento_consumo],
              ['Riscaldamento involontario', consumo.riscaldamento_involontario],
              ['Acqua calda consumo', consumo.acqua_calda_consumo],
              ['ACS involontaria', consumo.acqua_calda_involontaria],
              ['Acqua potabile', consumo.acqua_potabile],
              ['Energia el. Box', consumo.energia_elettrica_box],
            ] as [string, number][]).map(([l, v]) => v > 0 ? (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 7, fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{l}</span>
                <span style={{ fontWeight: 700 }}>€{fa(v)}</span>
              </div>
            ) : null)}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10, gap: 6 }}>
            <button className="btn-danger" onClick={() => onDelete(consumo.id)}><Trash2 size={13} /></button>
          </div>
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Letture contatori</p>
            <div className="grid2">
              {[
                ['Risc. iniziale', 'risc_lettura_iniziale'], ['Risc. finale', 'risc_lettura_finale'],
                ['ACS iniziale', 'acqua_calda_lettura_iniziale'], ['ACS finale', 'acqua_calda_lettura_finale'],
                ['Acqua fredda iniziale', 'acqua_fredda_lettura_iniziale'], ['Acqua fredda finale', 'acqua_fredda_lettura_finale'],
              ].map(([l, f]) => (
                <div key={f}>
                  <label>{l}</label>
                  <input type="number" step="0.01" value={form[f] ?? ''} placeholder="—"
                    onChange={e => num(f, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Costi dal riparto (€)</p>
            <div className="grid2">
              {[
                ['Risc. consumo', 'riscaldamento_consumo'], ['Risc. involontario', 'riscaldamento_involontario'],
                ['ACS consumo', 'acqua_calda_consumo'], ['ACS involontaria', 'acqua_calda_involontaria'],
                ['Acqua potabile', 'acqua_potabile'], ['Energia el. box', 'energia_elettrica_box'],
              ].map(([l, f]) => (
                <div key={f}>
                  <label>{l}</label>
                  <input type="number" step="0.01" value={form[f] ?? 0}
                    onChange={e => num(f, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Totali gestione</p>
            <div className="grid3">
              {[['App C63', 'totale_casa'], ['Box 13', 'totale_box'], ['Cantina', 'totale_cantina']].map(([l, f]) => (
                <div key={f}>
                  <label>{l}</label>
                  <input type="number" step="0.01" value={form[f] ?? 0}
                    onChange={e => num(f, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => setEditing(false)}><X size={13} /> Annulla</button>
            <button className="btn-primary" onClick={() => { onSave({ ...form, year_label: anno }); setEditing(false); }}>
              <Check size={13} /> Salva
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Sezione Rate ───────────────────────────────────────────────
function SezioneRate({ anno, rates, propertyId, onRefresh }: {
  anno: string;
  rates: any[];
  propertyId: string;
  onRefresh: () => void;
}) {
  const rateAnno = rates.filter(r => r.year_label === anno);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });

  const ripartiRata = (tot: number) => ({
    casa:    parseFloat((tot * MILL.casa    / MILL_TOT).toFixed(2)),
    box:     parseFloat((tot * MILL.box     / MILL_TOT).toFixed(2)),
    cantina: parseFloat((tot * MILL.cantina / MILL_TOT).toFixed(2)),
  });

  const saveRata = async () => {
    const tot = parseFloat(form.importo);
    if (!tot) return;
    const { casa, box, cantina } = ripartiRata(tot);
    await supabase.from('rate_pagamenti').insert({
      property_id: propertyId,
      year_label: anno,
      numero_rata: `Rata ${rateAnno.length + 1}`,
      data_pagamento: form.data,
      importo_casa: casa, importo_box: box, importo_cantina: cantina,
      descrizione: form.nota,
    });
    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false);
    onRefresh();
  };

  const delRata = async (id: string) => {
    if (!confirm('Eliminare questa rata?')) return;
    await supabase.from('rate_pagamenti').delete().eq('id', id);
    onRefresh();
  };

  const totAnno = rateAnno.reduce((s: number, r: any) =>
    s + (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0), 0);

  const preview = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Rate pagate</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>{rateAnno.length} pagamenti · totale €{f0(totAnno)}</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(v => !v)} style={{ padding: '8px 14px', fontSize: 13 }}>
          <Plus size={13} /> Aggiungi
        </button>
      </div>

      {showForm && (
        <div style={{ background: 'var(--bg3)', borderRadius: 12, padding: 14, marginBottom: 14 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="grid2">
              <div>
                <label>Importo totale (€)</label>
                <input type="number" step="0.01" placeholder="es. 413.50" value={form.importo}
                  onChange={e => setForm(p => ({ ...p, importo: e.target.value }))} />
              </div>
              <div>
                <label>Data pagamento</label>
                <input type="date" value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
            </div>
            {preview && (
              <div className="grid3">
                {([['App C63', preview.casa], ['Box 13', preview.box], ['Cantina', preview.cantina]] as [string, number][]).map(([l, v]) => (
                  <div key={l} style={{ textAlign: 'center', background: 'var(--accent-light)', borderRadius: 8, padding: '6px 4px' }}>
                    <p style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{l}</p>
                    <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>€{fa(v)}</p>
                  </div>
                ))}
              </div>
            )}
            <div>
              <label>Note (opzionale)</label>
              <input placeholder="es. Acconto" value={form.nota}
                onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} />
            </div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)}><X size={13} /> Annulla</button>
              <button className="btn-primary" onClick={saveRata}><Check size={13} /> Salva</button>
            </div>
          </div>
        </div>
      )}

      {rateAnno.length === 0 && !showForm && (
        <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '12px 0' }}>
          Nessuna rata registrata per questo esercizio.
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {rateAnno.map((r: any) => {
          const tot = (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: 'var(--bg3)', borderRadius: 9 }}>
              <CreditCard size={14} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 13 }}>{r.numero_rata}</p>
                <p style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}</p>
              </div>
              <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)' }}>€{fa(tot)}</span>
              <button className="btn-danger" style={{ padding: 6 }} onClick={() => delRata(r.id)}><Trash2 size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Sezione Preventivo (solo 25/26) ───────────────────────────
function SezionePreventivo() {
  return (
    <div className="card">
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 12 }}>Preventivo 25/26 — Spese fisse stimate App C63</p>
      <div style={{ background: 'var(--amber-bg)', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}>
        Quote calcolate sui tuoi millesimi (3,394‰ app · 20,288‰ scala C). I consumi saranno disponibili dopo ottobre 2026.
      </div>
      {([
        ['Spese Proprietà', PV.prop, '52.129 × 3,394‰'],
        ['Spese Generali', PV.gen, '149.737 × 3,394‰'],
        ['Manutenzioni', PV.man, '10.000 × 3,394‰'],
        ['Scale C', PV.scalac, '4.500 × 20,288‰'],
        ['Ascensore C', PV.asc, '3.802 × 20,288‰'],
        ['Teleletture', PV.tele, '5.054 × 3,394‰'],
        ['Risc. involontario', PV.risc_inv, '35.349 × 3,394‰'],
        ['ACS involontaria', PV.acs_inv, '31.638 × 3,394‰'],
      ] as [string, number, string][]).map(([l, v, note]) => (
        <div key={l} className="row">
          <div>
            <p style={{ fontWeight: 500, fontSize: 13 }}>{l}</p>
            <p style={{ fontSize: 10, color: 'var(--text3)' }}>{note}</p>
          </div>
          <span style={{ fontWeight: 800 }}>€{fa(v)}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800 }}>Totale spese fisse stimate</span>
        <span style={{ fontWeight: 800, color: 'var(--accent)', fontFamily: 'var(--font-display)', fontSize: 17 }}>
          €{fa(SPESE_FISSE_STIMATE_2526)}
        </span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ══════════════════════════════════════════════════════════════
export default function DatiPage({ property }: { property: Property }) {
  const [years,   setYears]   = useState<any[]>([]);
  const [fixed,   setFixed]   = useState<FixedExpenses[]>([]);
  const [consumi, setConsumi] = useState<ConsumptionData[]>([]);
  const [rates,   setRates]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [annoAttivo, setAnnoAttivo] = useState<string>('');

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label'),
      supabase.from('fixed_expenses').select('*').eq('property_id', property.id).order('year_label'),
      supabase.from('consumption_data').select('*').eq('property_id', property.id).order('year_label'),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }),
    ]);
    setYears(a.data || []);
    setFixed(b.data || []);
    setConsumi(c.data || []);
    setRates(d.data || []);
    setLoading(false);
  }, [property.id]);

  useEffect(() => { load(); }, [load]);

  // Calcola tutti gli anni disponibili (unione di tutte le tabelle)
  const tuttiGliAnni = [...new Set([
    ...years.map((y: any) => y.year_label),
    ...fixed.map((f: any) => f.year_label),
    ...consumi.map((c: any) => c.year_label),
    ...rates.map((r: any) => r.year_label),
  ])].sort().reverse(); // più recente prima

  // Seleziona automaticamente l'anno più recente
  useEffect(() => {
    if (tuttiGliAnni.length > 0 && !annoAttivo) {
      setAnnoAttivo(tuttiGliAnni[0]);
    }
  }, [tuttiGliAnni.join(',')]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Caricamento...</div>;

  if (tuttiGliAnni.length === 0) return (
    <div style={{ textAlign: 'center', padding: 40 }}>
      <p style={{ color: 'var(--text3)', marginBottom: 16 }}>Nessun dato inserito. Registra la prima rata dalla Home.</p>
    </div>
  );

  // Dati per l'anno attivo
  const yearData  = years.find((y: any)  => y.year_label === annoAttivo) || null;
  const fixedData = fixed.find((f: any)  => f.year_label === annoAttivo) || null;
  const consumoData = consumi.find((c: any) => c.year_label === annoAttivo) || null;

  // CRUD helpers
  const saveYear = async (data: any) => {
    const { data: saved } = data.id
      ? await supabase.from('exercise_years').update(data).eq('id', data.id).select().single()
      : await supabase.from('exercise_years').insert({ ...data, property_id: property.id }).select().single();
    if (saved) setYears(p => data.id ? p.map((r: any) => r.id === saved.id ? saved : r) : [...p, saved]);
  };

  const saveFixed = async (data: any) => {
    const { data: saved } = data.id
      ? await supabase.from('fixed_expenses').update(data).eq('id', data.id).select().single()
      : await supabase.from('fixed_expenses').insert({ ...data, property_id: property.id }).select().single();
    if (saved) setFixed(p => data.id ? p.map((r: any) => r.id === saved.id ? saved : r) : [...p, saved]);
  };

  const saveConsumo = async (data: any) => {
    const { data: saved } = data.id
      ? await supabase.from('consumption_data').update(data).eq('id', data.id).select().single()
      : await supabase.from('consumption_data').insert({ ...data, property_id: property.id }).select().single();
    if (saved) setConsumi(p => data.id ? p.map((r: any) => r.id === saved.id ? saved : r) : [...p, saved]);
  };

  const delYear = async (id: string) => {
    if (!confirm('Eliminare il rendiconto?')) return;
    await supabase.from('exercise_years').delete().eq('id', id);
    setYears(p => p.filter((r: any) => r.id !== id));
  };

  const delFixed = async (id: string) => {
    if (!confirm('Eliminare le spese fisse?')) return;
    await supabase.from('fixed_expenses').delete().eq('id', id);
    setFixed(p => p.filter((r: any) => r.id !== id));
  };

  const delConsumo = async (id: string) => {
    if (!confirm('Eliminare i dati consumi?')) return;
    await supabase.from('consumption_data').delete().eq('id', id);
    setConsumi(p => p.filter((r: any) => r.id !== id));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>Dati per esercizio</h2>

      {/* ── Selector anni ── */}
      <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 12, padding: 4, gap: 2, overflowX: 'auto', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
        {tuttiGliAnni.map(anno => (
          <button key={anno} onClick={() => setAnnoAttivo(anno)} style={{
            flex: 'none', padding: '8px 16px', borderRadius: 9, fontSize: 14, fontWeight: 700,
            background: annoAttivo === anno ? '#fff' : 'transparent',
            color: annoAttivo === anno ? 'var(--accent)' : 'var(--text2)',
            boxShadow: annoAttivo === anno ? 'var(--shadow-xs)' : 'none',
            whiteSpace: 'nowrap',
          }}>{anno}</button>
        ))}
      </div>

      {/* ── Contenuto anno selezionato ── */}
      {annoAttivo && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Info banner */}
          <div style={{ background: 'var(--blue-bg)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--blue)' }}>
            <strong>Esercizio {annoAttivo}</strong> — Inserisci i dati quando ricevi il documento SSA.
            {annoAttivo === '25/26' && ' Il preventivo 25/26 è già precompilato.'}
          </div>

          {/* Rendiconto */}
          <SezioneRendiconto
            anno={annoAttivo}
            year={yearData}
            onSave={saveYear}
            onDelete={delYear}
          />

          {/* Spese fisse */}
          <SezioneSpese
            anno={annoAttivo}
            fixed={fixedData as FixedExpenses | null}
            onSave={saveFixed}
            onDelete={delFixed}
          />

          {/* Consumi */}
          <SezioneConsumi
            anno={annoAttivo}
            consumo={consumoData as ConsumptionData | null}
            tuttiConsumi={consumi}
            onSave={saveConsumo}
            onDelete={delConsumo}
          />

          {/* Preventivo (solo 25/26) */}
          {annoAttivo === '25/26' && <SezionePreventivo />}

          {/* Rate */}
          <SezioneRate
            anno={annoAttivo}
            rates={rates}
            propertyId={property.id}
            onRefresh={load}
          />
        </div>
      )}
    </div>
  );
}
