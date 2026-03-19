import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Property, FixedExpenses, ConsumptionData } from '../types';
import {
  Plus, Pencil, Trash2, X, Check, AlertCircle, CreditCard,
  BarChart2, Table, CalendarDays
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from 'recharts';

// ── Utils ──────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';

const MILL = { casa: 3.394, box: 0.576, cantina: 0.059 };
const MILL_TOT = MILL.casa + MILL.box + MILL.cantina;

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

const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

// ── Tooltip grafico ────────────────────────────────────────────
const ChartTip = ({ active, payload, label, prefix = '€', suffix = '' }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px', fontSize: 12, boxShadow: 'var(--shadow-md)' }}>
      <p style={{ fontWeight: 700, marginBottom: 4, color: 'var(--text)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, marginTop: 2 }}>
          {p.name}: {typeof p.value === 'number' ? `${prefix}${p.value.toLocaleString('it-IT', { maximumFractionDigits: 0 })}${suffix}` : p.value}
        </p>
      ))}
    </div>
  );
};

// ── SEZIONE GRAFICI ────────────────────────────────────────────
function SezioneGrafici({ years, fixed, consumi, rates }: {
  years: any[]; fixed: FixedExpenses[]; consumi: ConsumptionData[]; rates: any[];
}) {
  const allAnni = [...new Set([
    ...years.map(y => y.year_label),
    ...fixed.map(f => f.year_label),
    ...consumi.map(c => c.year_label),
  ])].sort();

  if (allAnni.length === 0) return (
    <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
      Nessun dato storico disponibile. Inserisci almeno un anno dalla sezione "Storico".
    </div>
  );

  const sfTot = (f: FixedExpenses) =>
    f.prop_casa + f.gen_prop_casa + f.man_ord_casa + f.scale_prop_casa +
    f.scala_c_casa + f.asc_c_casa + f.prop_alloggi + f.addebiti_unita +
    f.addebiti_unita_imm + f.spese_personali;

  const dati = allAnni.map(anno => {
    const y = years.find(r => r.year_label === anno);
    const f = fixed.find(r => r.year_label === anno);
    const c = consumi.find(r => r.year_label === anno);
    const speseFisse = f ? sfTot(f) : 0;
    const speseConsumi = c ? c.totale_casa : 0;
    const totale = speseFisse + speseConsumi;
    const rateAnno = rates.filter(r => r.year_label === anno)
      .reduce((s: number, r: any) => s + (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0), 0);
    const saldo = y ? calcSaldo(
      y.balance_start_casa + y.balance_start_box + y.balance_start_cantina,
      y.rates_paid_casa + y.rates_paid_box + y.rates_paid_cantina,
      (y.spese_totali_casa||0) + (y.spese_totali_box||0) + (y.spese_totali_cantina||0)
    ) : null;
    const rKwh = c?.risc_lettura_finale && c?.risc_lettura_iniziale ? c.risc_lettura_finale - c.risc_lettura_iniziale : null;
    const aL   = c?.acqua_calda_lettura_finale && c?.acqua_calda_lettura_iniziale ? c.acqua_calda_lettura_finale - c.acqua_calda_lettura_iniziale : null;
    const rUnit = rKwh && c?.riscaldamento_consumo ? c.riscaldamento_consumo / rKwh : null;
    const aUnit = aL && c?.acqua_calda_consumo ? c.acqua_calda_consumo / aL : null;
    return { anno, speseFisse, speseConsumi, totale, saldo, rateAnno, rKwh, aL, rUnit, aUnit };
  });

  const vData = allAnni.slice(1).map((anno, i) => {
    const cur = dati.find(d => d.anno === anno)!;
    const prv = dati.find(d => d.anno === allAnni[i])!;
    const pct = (c: number, p: number) => p !== 0 ? parseFloat(((c - p) / Math.abs(p) * 100).toFixed(1)) : 0;
    return {
      anno,
      'Spese fisse %': pct(cur.speseFisse, prv.speseFisse),
      'Consumi %': pct(cur.speseConsumi, prv.speseConsumi),
      'Totale %': pct(cur.totale, prv.totale),
    };
  });

  const GrafCard = ({ title, sub, children }: { title: string; sub?: string; children: React.ReactNode }) => (
    <div className="card">
      <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', marginBottom: sub ? 2 : 12 }}>{title}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 12 }}>{sub}</p>}
      {children}
    </div>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* 1. Spese fisse vs consumi */}
      <GrafCard title="Spese fisse vs Consumi" sub="Andamento annuo delle due componenti principali">
        <ResponsiveContainer width="100%" height={200}>
          <AreaChart data={dati} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
            <defs>
              <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
            <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
            <Tooltip content={<ChartTip />} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Area type="monotone" dataKey="speseFisse" name="Spese fisse" stroke="#2563eb" fill="url(#gF)" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 3 }} />
            <Area type="monotone" dataKey="speseConsumi" name="Consumi" stroke="#7c3aed" fill="url(#gC)" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 3 }} />
          </AreaChart>
        </ResponsiveContainer>
      </GrafCard>

      {/* 2. Totale spese */}
      <GrafCard title="Totale spese annuo" sub="Somma di spese fisse e consumi per ogni esercizio">
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={dati} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
            <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
            <Tooltip content={<ChartTip />} />
            <Bar dataKey="totale" name="Totale spese" fill="#2563eb" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </GrafCard>

      {/* 3. Saldo esercizio */}
      {dati.some(d => d.saldo !== null) && (
        <GrafCard title="Saldo esercizio" sub="Positivo = credito verso il condominio, negativo = debito">
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={dati.filter(d => d.saldo !== null)} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
              <Tooltip content={<ChartTip />} />
              <ReferenceLine y={0} stroke="#e5e7eb" strokeWidth={2} />
              <Bar dataKey="saldo" name="Saldo" radius={[5, 5, 0, 0]}
                fill="#16a34a"
                label={false}
              />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
            {dati.filter(d => d.saldo !== null).map(d => (
              <span key={d.anno} style={{
                fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: (d.saldo || 0) >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                color: (d.saldo || 0) >= 0 ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${(d.saldo || 0) >= 0 ? '#a7f3d0' : '#fecaca'}`,
              }}>
                {d.anno}: {(d.saldo || 0) >= 0 ? '+' : '-'}€{f0(d.saldo || 0)}
              </span>
            ))}
          </div>
        </GrafCard>
      )}

      {/* 4. Variazioni % */}
      {vData.length > 0 && (
        <GrafCard title="Variazioni anno su anno" sub="Percentuale di aumento o diminuzione rispetto all'esercizio precedente">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={vData} margin={{ left: -10, right: 8, top: 4, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="anno" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip content={<ChartTip prefix="" suffix="%" />} />
              <ReferenceLine x={0} stroke="#e5e7eb" strokeWidth={2} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Bar dataKey="Spese fisse %" fill="#2563eb" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Consumi %" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Totale %" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginTop: 10 }}>
            {vData.map(r => (
              <div key={r.anno} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', background: 'var(--bg3)', borderRadius: 8, fontSize: 12, flexWrap: 'wrap' }}>
                <span className="tag tag-blue" style={{ flexShrink: 0 }}>{r.anno}</span>
                {([['Fisse', r['Spese fisse %']], ['Consumi', r['Consumi %']], ['Totale', r['Totale %']]] as [string, number][]).map(([l, v]) => (
                  <span key={l} style={{
                    fontWeight: 700, fontSize: 11, padding: '2px 8px', borderRadius: 5,
                    color: v > 0 ? 'var(--red)' : 'var(--green)',
                    background: v > 0 ? 'var(--red-bg)' : 'var(--green-bg)',
                  }}>
                    {l}: {v > 0 ? '+' : ''}{v}%
                  </span>
                ))}
              </div>
            ))}
          </div>
        </GrafCard>
      )}

      {/* 5. Costo unitario riscaldamento e acqua */}
      {dati.some(d => d.rUnit) && (
        <GrafCard title="Costo unitario consumi" sub="€ per caloria (riscaldamento) e € per litro (acqua calda) — indica l'efficienza tariffaria">
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={dati.filter(d => d.rUnit || d.aUnit)} margin={{ left: -10, right: 8, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v.toFixed(2)}`} width={55} />
              <Tooltip content={<ChartTip prefix="€" />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line type="monotone" dataKey="rUnit" name="€/cal risc." stroke="#ef4444" strokeWidth={2.5} dot={{ fill: '#ef4444', r: 4 }} connectNulls />
              <Line type="monotone" dataKey="aUnit" name="€/L ACS" stroke="#f97316" strokeWidth={2.5} dot={{ fill: '#f97316', r: 4 }} connectNulls />
            </LineChart>
          </ResponsiveContainer>
        </GrafCard>
      )}

    </div>
  );
}

// ── STORICO RAPIDO ─────────────────────────────────────────────
function SezioneStorico({ propertyId, years, fixed, consumi, onRefresh }: {
  propertyId: string;
  years: any[];
  fixed: FixedExpenses[];
  consumi: ConsumptionData[];
  onRefresh: () => void;
}) {
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newAnno, setNewAnno] = useState({ 
    year_label: '',
    spese_fisse: '', 
    consumi_totali: '', 
    rates_paid: '',
    balance_start: '',
  });

  const allAnni = [...new Set([
    ...years.map(y => y.year_label),
    ...fixed.map(f => f.year_label),
    ...consumi.map(c => c.year_label),
  ])].sort().reverse();

  const sfTot = (f: FixedExpenses) =>
    f.prop_casa + f.gen_prop_casa + f.man_ord_casa + f.scale_prop_casa +
    f.scala_c_casa + f.asc_c_casa + f.prop_alloggi + f.addebiti_unita +
    f.addebiti_unita_imm + f.spese_personali;

  const saveAnnoRapido = async () => {
    if (!newAnno.year_label) return;
    setSaving(true);
    const yl = newAnno.year_label;
    const speseFisse = parseFloat(newAnno.spese_fisse) || 0;
    const consTot = parseFloat(newAnno.consumi_totali) || 0;
    const ratesPaid = parseFloat(newAnno.rates_paid) || 0;
    const balanceStart = parseFloat(newAnno.balance_start) || 0;

    // Salva rendiconto
    const existingY = years.find(y => y.year_label === yl);
    if (!existingY) {
      await supabase.from('exercise_years').insert({
        property_id: propertyId,
        year_label: yl,
        balance_start_casa: balanceStart,
        balance_start_box: 0,
        balance_start_cantina: 0,
        rates_paid_casa: ratesPaid,
        rates_paid_box: 0,
        rates_paid_cantina: 0,
        spese_totali_casa: speseFisse + consTot,
        spese_totali_box: 0,
        spese_totali_cantina: 0,
      });
    }

    // Salva spese fisse (solo totale App)
    if (speseFisse > 0 && !fixed.find(f => f.year_label === yl)) {
      await supabase.from('fixed_expenses').insert({
        property_id: propertyId,
        year_label: yl,
        prop_casa: speseFisse * 0.22,
        gen_prop_casa: speseFisse * 0.57,
        man_ord_casa: speseFisse * 0.07,
        scale_prop_casa: 0, scala_c_casa: speseFisse * 0.08,
        asc_c_casa: speseFisse * 0.06,
        prop_alloggi: 0, addebiti_unita: 0, addebiti_unita_imm: 0,
        spese_personali: 0,
        prop_box: 0, gen_prop_box: 0, man_ord_box: 0,
        scale_prop_box: 0, scala_c_box: 0, asc_c_box: 0, prop_box_extra: 0,
        prop_cantina: 0, gen_prop_cantina: 0, man_ord_cantina: 0,
        scale_prop_cantina: 0, scala_c_cantina: 0, asc_c_cantina: 0,
        addebiti_unita_imm: 0,
      });
    }

    // Salva consumi (solo totale)
    if (consTot > 0 && !consumi.find(c => c.year_label === yl)) {
      await supabase.from('consumption_data').insert({
        property_id: propertyId,
        year_label: yl,
        totale_casa: consTot,
        totale_box: 0, totale_cantina: 0,
        acqua_potabile: 0, riscaldamento_involontario: 0, riscaldamento_consumo: 0,
        acqua_calda_involontaria: 0, acqua_calda_consumo: 0, energia_elettrica_box: 0,
        movimenti_personali: 0,
        risc_lettura_iniziale: null, risc_lettura_finale: null,
        acqua_calda_lettura_iniziale: null, acqua_calda_lettura_finale: null,
        acqua_fredda_lettura_iniziale: null, acqua_fredda_lettura_finale: null,
      });
    }

    setNewAnno({ year_label: '', spese_fisse: '', consumi_totali: '', rates_paid: '', balance_start: '' });
    setShowAdd(false);
    setSaving(false);
    onRefresh();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ background: 'var(--blue-bg)', border: '1px solid #bfdbfe', borderRadius: 10, padding: '10px 14px', fontSize: 12, color: 'var(--blue)' }}>
        <strong>Inserimento rapido dati storici.</strong> Inserisci solo i totali — puoi aggiungere il dettaglio completo nel tab dell'anno specifico.
      </div>

      {/* Tabella riepilogo storico */}
      <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: 'var(--bg3)' }}>
                {['Anno', 'Spese fisse', 'Consumi', 'Totale spese', 'Rate versate', 'Saldo'].map(h => (
                  <th key={h} style={{ padding: '10px 12px', textAlign: h === 'Anno' ? 'left' : 'right', fontWeight: 700, color: 'var(--text2)', fontSize: 11, whiteSpace: 'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {allAnni.length === 0 && (
                <tr><td colSpan={6} style={{ textAlign: 'center', padding: 24, color: 'var(--text3)', fontSize: 13 }}>Nessun anno inserito</td></tr>
              )}
              {allAnni.map((anno, i) => {
                const y = years.find(r => r.year_label === anno);
                const f = fixed.find(r => r.year_label === anno);
                const c = consumi.find(r => r.year_label === anno);
                const speseFisse = f ? sfTot(f) : null;
                const consTot = c ? c.totale_casa : null;
                const totale = (speseFisse || 0) + (consTot || 0);
                const rateVersate = y ? y.rates_paid_casa + y.rates_paid_box + y.rates_paid_cantina : null;
                const saldo = y ? calcSaldo(
                  y.balance_start_casa + y.balance_start_box + y.balance_start_cantina,
                  y.rates_paid_casa + y.rates_paid_box + y.rates_paid_cantina,
                  (y.spese_totali_casa||0) + (y.spese_totali_box||0) + (y.spese_totali_cantina||0)
                ) : null;

                const cell = (v: number | null, color?: string) => (
                  <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                    {v !== null
                      ? <span style={{ fontWeight: 700, color: color || 'var(--text)' }}>€{f0(v)}</span>
                      : <span style={{ color: 'var(--text3)' }}>—</span>}
                  </td>
                );

                return (
                  <tr key={anno} style={{ borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? '#fff' : 'var(--bg3)' }}>
                    <td style={{ padding: '10px 12px' }}>
                      <span className="tag tag-blue">{anno}</span>
                    </td>
                    {cell(speseFisse)}
                    {cell(consTot)}
                    {cell(totale > 0 ? totale : null)}
                    {cell(rateVersate, 'var(--accent)')}
                    <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {saldo !== null
                        ? <span style={{ fontWeight: 800, color: saldo >= 0 ? 'var(--green)' : 'var(--red)' }}>
                            {saldo >= 0 ? '+' : '-'}€{f0(saldo)}
                          </span>
                        : <span style={{ color: 'var(--text3)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Form aggiunta anno rapido */}
      {showAdd ? (
        <div className="card" style={{ border: '2px solid var(--accent)' }}>
          <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 14 }}>Aggiungi anno storico</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div>
              <label>Anno esercizio</label>
              <input
                placeholder="es. 22/23"
                value={newAnno.year_label}
                onChange={e => setNewAnno(p => ({ ...p, year_label: e.target.value }))}
              />
            </div>
            <div className="grid2">
              <div>
                <label>Spese fisse totali (€)</label>
                <input type="number" step="0.01" placeholder="es. 820"
                  value={newAnno.spese_fisse}
                  onChange={e => setNewAnno(p => ({ ...p, spese_fisse: e.target.value }))} />
              </div>
              <div>
                <label>Consumi totali (€)</label>
                <input type="number" step="0.01" placeholder="es. 450"
                  value={newAnno.consumi_totali}
                  onChange={e => setNewAnno(p => ({ ...p, consumi_totali: e.target.value }))} />
              </div>
              <div>
                <label>Rate versate totali (€)</label>
                <input type="number" step="0.01" placeholder="es. 1200"
                  value={newAnno.rates_paid}
                  onChange={e => setNewAnno(p => ({ ...p, rates_paid: e.target.value }))} />
              </div>
              <div>
                <label>Saldo iniziale (€)</label>
                <input type="number" step="0.01" placeholder="es. 50 (pos=credito)"
                  value={newAnno.balance_start}
                  onChange={e => setNewAnno(p => ({ ...p, balance_start: e.target.value }))} />
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--text3)' }}>
              Puoi aggiungere il dettaglio completo (voci singole, letture contatori) dal tab dell'anno specifico.
            </p>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowAdd(false)}><X size={13} /> Annulla</button>
              <button className="btn-primary" onClick={saveAnnoRapido} disabled={saving || !newAnno.year_label}>
                {saving ? 'Salvataggio...' : <><Check size={13} /> Salva</>}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button className="btn-primary" onClick={() => setShowAdd(true)} style={{ alignSelf: 'flex-start', gap: 6 }}>
          <Plus size={14} /> Aggiungi anno storico
        </button>
      )}
    </div>
  );
}

// ── SEZIONE RENDICONTO ─────────────────────────────────────────
function SezioneRendiconto({ anno, year, onSave, onDelete }: {
  anno: string; year: any | null;
  onSave: (data: any) => void; onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>(year || {
    year_label: anno,
    balance_start_casa: 0, balance_start_box: 0, balance_start_cantina: 0,
    rates_paid_casa: 0, rates_paid_box: 0, rates_paid_cantina: 0,
    spese_totali_casa: 0, spese_totali_box: 0, spese_totali_cantina: 0,
  });
  useEffect(() => { if (year) setForm(year); }, [year]);
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
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Saldo = Inizio − Rate + Spese assegnate</p>
        </div>
        {year && !editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon" onClick={() => setEditing(true)}><Pencil size={13} /></button>
            <button className="btn-danger" onClick={() => onDelete(year.id)}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {!year && !editing && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 10 }}>Nessun rendiconto inserito.</p>
          <button className="btn-primary" onClick={() => setEditing(true)}><Plus size={14} /> Inserisci</button>
        </div>
      )}

      {year && !editing && (
        <>
          <div style={{
            padding: '12px 14px', marginBottom: 12,
            background: (tot || 0) >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `2px solid ${(tot || 0) >= 0 ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontWeight: 700, color: (tot || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {(tot || 0) >= 0 ? '▲ Credito' : '▼ Debito'} totale
            </span>
            <span style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: (tot || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
              €{fa(tot || 0)}
            </span>
          </div>
          <div className="grid3">
            {([['App C63', sC], ['Box 13', sB], ['Cantina', sCa]] as [string, number | null][]).map(([l, v]) => (
              <div key={l} style={{ textAlign: 'center', padding: '8px 4px', background: 'var(--bg3)', borderRadius: 8 }}>
                <p style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, marginBottom: 3 }}>{l}</p>
                <p style={{ fontSize: 15, fontWeight: 800, color: (v || 0) >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {(v || 0) >= 0 ? '+' : '-'}€{fa(v || 0)}
                </p>
              </div>
            ))}
          </div>
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { lbl: 'Saldo iniziale (da esercizio precedente)', pfx: 'balance_start' },
            { lbl: 'Rate versate nell\'esercizio', pfx: 'rates_paid' },
            { lbl: 'Spese totali assegnate (dal riparto)', pfx: 'spese_totali' },
          ].map(({ lbl, pfx }) => (
            <div key={pfx} style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)', textTransform: 'uppercase', marginBottom: 8 }}>{lbl}</p>
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

// ── SEZIONE SPESE FISSE ────────────────────────────────────────
function SezioneSpese({ anno, fixed, onSave, onDelete }: {
  anno: string; fixed: FixedExpenses | null;
  onSave: (data: any) => void; onDelete: (id: string) => void;
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

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Spese Fisse</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Voci dal Riparto Consuntivo SSA</p>
        </div>
        {fixed && !editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon" onClick={() => setEditing(true)}><Pencil size={13} /></button>
            <button className="btn-danger" onClick={() => onDelete(fixed.id)}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {!fixed && !editing && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 10 }}>Nessuna spesa fissa inserita.</p>
          <button className="btn-primary" onClick={() => setEditing(true)}><Plus size={14} /> Inserisci</button>
        </div>
      )}

      {fixed && !editing && (
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
              ['Spese Proprietà', fixed.prop_casa],
              ['Spese Generali', fixed.gen_prop_casa],
              ['Manutenzioni', fixed.man_ord_casa],
              ['Scale + Scala C', fixed.scale_prop_casa + fixed.scala_c_casa],
              ['Ascensore C', fixed.asc_c_casa],
              ['Prop. alloggi', fixed.prop_alloggi],
              ['Teleletture', fixed.addebiti_unita_imm],
              ['Mov. personali', fixed.spese_personali],
            ] as [string, number][]).map(([l, v]) => v > 0 ? (
              <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 10px', background: 'var(--bg3)', borderRadius: 7, fontSize: 13 }}>
                <span style={{ color: 'var(--text2)' }}>{l}</span>
                <span style={{ fontWeight: 700 }}>€{fa(v)}</span>
              </div>
            ) : null)}
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 10px', background: 'var(--accent-light)', borderRadius: 7, fontSize: 13, fontWeight: 800, marginTop: 4 }}>
              <span style={{ color: 'var(--accent)' }}>Totale</span>
              <span style={{ color: 'var(--accent)' }}>€{fa(sfTot(fixed))}</span>
            </div>
          </div>
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[
            { lbl: 'Spese Proprietà', pfx: 'prop' },
            { lbl: 'Spese Generali', pfx: 'gen_prop' },
            { lbl: 'Manutenzioni Ordinarie', pfx: 'man_ord' },
            { lbl: 'Scale di Proprietà', pfx: 'scale_prop' },
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
                <input type="number" step="0.01" value={form[f] ?? 0} onChange={e => num(f, e.target.value)} />
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

// ── SEZIONE CONSUMI ────────────────────────────────────────────
function SezioneConsumi({ anno, consumo, tuttiConsumi, onSave, onDelete }: {
  anno: string; consumo: ConsumptionData | null; tuttiConsumi: ConsumptionData[];
  onSave: (data: any) => void; onDelete: (id: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const emptyC = {
    year_label: anno, acqua_potabile: 0, riscaldamento_involontario: 0,
    riscaldamento_consumo: 0, acqua_calda_involontaria: 0, acqua_calda_consumo: 0,
    energia_elettrica_box: 0, movimenti_personali: 0,
    risc_lettura_iniziale: null, risc_lettura_finale: null,
    acqua_calda_lettura_iniziale: null, acqua_calda_lettura_finale: null,
    acqua_fredda_lettura_iniziale: null, acqua_fredda_lettura_finale: null,
    totale_casa: 0, totale_box: 0, totale_cantina: 0,
  };
  const [form, setForm] = useState<any>(consumo || emptyC);
  useEffect(() => { if (consumo) setForm(consumo); }, [consumo]);
  const num = (f: string, v: string) => setForm((p: any) => ({ ...p, [f]: v === '' ? null : parseFloat(v) || 0 }));

  const rKwh = consumo?.risc_lettura_finale && consumo?.risc_lettura_iniziale ? consumo.risc_lettura_finale - consumo.risc_lettura_iniziale : null;
  const aL   = consumo?.acqua_calda_lettura_finale && consumo?.acqua_calda_lettura_iniziale ? consumo.acqua_calda_lettura_finale - consumo.acqua_calda_lettura_iniziale : null;
  const afL  = consumo?.acqua_fredda_lettura_finale && consumo?.acqua_fredda_lettura_iniziale ? consumo.acqua_fredda_lettura_finale - consumo.acqua_fredda_lettura_iniziale : null;
  const rU   = rKwh && consumo?.riscaldamento_consumo ? consumo.riscaldamento_consumo / rKwh : null;
  const aU   = aL && consumo?.acqua_calda_consumo ? consumo.acqua_calda_consumo / aL : null;
  const afU  = afL && consumo?.acqua_potabile ? consumo.acqua_potabile / afL : null;

  // Alert solo per questo anno
  const errori: { msg: string; severity: 'error' | 'warn' }[] = [];
  if (consumo) {
    if (rKwh !== null && rKwh < 0) errori.push({ msg: 'Riscaldamento: lettura finale < iniziale', severity: 'error' });
    if (aL !== null && aL < 0) errori.push({ msg: 'Acqua calda: lettura finale < iniziale', severity: 'error' });
    if (afL !== null && afL < 0) errori.push({ msg: 'Acqua fredda: lettura finale < iniziale', severity: 'error' });
    const sorted = [...tuttiConsumi].sort((a, b) => a.year_label.localeCompare(b.year_label));
    const idx = sorted.findIndex(x => x.id === consumo.id);
    const prev = idx > 0 ? sorted[idx - 1] : null;
    if (prev?.risc_lettura_finale !== null && consumo.risc_lettura_iniziale !== null && prev?.risc_lettura_finale !== consumo.risc_lettura_iniziale)
      errori.push({ msg: `Risc.: finale ${prev?.year_label} (${prev?.risc_lettura_finale}) ≠ iniziale ${anno} (${consumo.risc_lettura_iniziale})`, severity: 'warn' });
    if (prev?.acqua_calda_lettura_finale !== null && consumo.acqua_calda_lettura_iniziale !== null && prev?.acqua_calda_lettura_finale !== consumo.acqua_calda_lettura_iniziale)
      errori.push({ msg: `ACS: discontinuità con ${prev?.year_label}`, severity: 'warn' });
    if (prev?.acqua_fredda_lettura_finale !== null && consumo.acqua_fredda_lettura_iniziale !== null && prev?.acqua_fredda_lettura_finale !== consumo.acqua_fredda_lettura_iniziale)
      errori.push({ msg: `Acq.fr.: discontinuità con ${prev?.year_label}`, severity: 'warn' });
  }

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div>
          <p style={{ fontWeight: 700, fontSize: 15 }}>Consumi</p>
          <p style={{ fontSize: 12, color: 'var(--text3)' }}>Letture contatori e costi dal riparto</p>
        </div>
        {consumo && !editing && (
          <div style={{ display: 'flex', gap: 6 }}>
            <button className="btn-icon" onClick={() => setEditing(true)}><Pencil size={13} /></button>
            <button className="btn-danger" onClick={() => onDelete(consumo.id)}><Trash2 size={13} /></button>
          </div>
        )}
      </div>

      {!consumo && !editing && (
        <div style={{ textAlign: 'center', padding: '16px 0' }}>
          <p style={{ color: 'var(--text3)', fontSize: 13, marginBottom: 10 }}>Nessun dato consumi inserito.</p>
          <button className="btn-primary" onClick={() => setEditing(true)}><Plus size={14} /> Inserisci</button>
        </div>
      )}

      {consumo && !editing && (
        <>
          {errori.length > 0 && (
            <div style={{ background: '#fffbeb', border: '1.5px solid #f59e0b', borderRadius: 10, padding: '10px 12px', marginBottom: 12 }}>
              <p style={{ fontWeight: 700, fontSize: 12, color: '#b45309', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={13} /> Anomalie letture — esercizio {anno}
              </p>
              {errori.map((e, i) => (
                <p key={i} style={{ fontSize: 12, color: e.severity === 'error' ? '#dc2626' : '#92400e', marginTop: 3 }}>• {e.msg}</p>
              ))}
              <button className="btn-ghost" onClick={() => setEditing(true)} style={{ marginTop: 8, fontSize: 12, padding: '5px 10px', gap: 4 }}>
                <Pencil size={12} /> Correggi
              </button>
            </div>
          )}

          <div className="grid3" style={{ marginBottom: 12 }}>
            {([['Totale', consumo.totale_casa + consumo.totale_box + consumo.totale_cantina]] as [string, number][]).map(([l, v]) => (
              <div key={l} style={{ gridColumn: '1/-1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', background: 'var(--bg3)', borderRadius: 10 }}>
                <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Totale consumi</span>
                <span style={{ fontSize: 20, fontWeight: 800 }}>€{f0(v)}</span>
              </div>
            ))}
          </div>

          {(rKwh !== null || aL !== null || afL !== null) && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
              {([
                ['Riscaldamento', rKwh, 'cal', rU, '€/cal', '#ef4444', consumo.risc_lettura_iniziale, consumo.risc_lettura_finale],
                ['Acqua calda', aL, 'L', aU, '€/L', '#f97316', consumo.acqua_calda_lettura_iniziale, consumo.acqua_calda_lettura_finale],
                ['Acqua fredda', afL, 'L', afU, '€/L', '#3b82f6', consumo.acqua_fredda_lettura_iniziale, consumo.acqua_fredda_lettura_finale],
              ] as [string, number | null, string, number | null, string, string, number | null, number | null][]).map(([nome, cons, unit, cu, cuLabel, col, ini, fin]) => cons !== null ? (
                <div key={nome} style={{ background: 'var(--bg3)', borderRadius: 8, padding: '8px 10px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontWeight: 700, fontSize: 13, color: col }}>{nome}</span>
                    <span style={{ fontWeight: 800 }}>{cons.toLocaleString('it-IT')} {unit}</span>
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>
                    {ini?.toLocaleString('it-IT')} → {fin?.toLocaleString('it-IT')} {unit}
                    {cu && <span style={{ fontWeight: 700, color: col, marginLeft: 8 }}>{cuLabel}: €{cu.toFixed(2)}</span>}
                  </div>
                </div>
              ) : null)}
            </div>
          )}
        </>
      )}

      {editing && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Letture contatori</p>
            <div className="grid2">
              {[['Risc. iniziale','risc_lettura_iniziale'],['Risc. finale','risc_lettura_finale'],
                ['ACS iniziale','acqua_calda_lettura_iniziale'],['ACS finale','acqua_calda_lettura_finale'],
                ['Acq.fr. iniziale','acqua_fredda_lettura_iniziale'],['Acq.fr. finale','acqua_fredda_lettura_finale'],
              ].map(([l, f]) => (
                <div key={f}><label>{l}</label>
                  <input type="number" step="0.01" value={form[f] ?? ''} placeholder="—" onChange={e => num(f, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Costi dal riparto (€)</p>
            <div className="grid2">
              {[['Risc. consumo','riscaldamento_consumo'],['Risc. involontario','riscaldamento_involontario'],
                ['ACS consumo','acqua_calda_consumo'],['ACS involontaria','acqua_calda_involontaria'],
                ['Acqua potabile','acqua_potabile'],['Energia box','energia_elettrica_box'],
              ].map(([l, f]) => (
                <div key={f}><label>{l}</label>
                  <input type="number" step="0.01" value={form[f] ?? 0} onChange={e => num(f, e.target.value)} />
                </div>
              ))}
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: 12 }}>
            <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', marginBottom: 8 }}>Totali gestione</p>
            <div className="grid3">
              {[['App C63','totale_casa'],['Box 13','totale_box'],['Cantina','totale_cantina']].map(([l, f]) => (
                <div key={f}><label>{l}</label>
                  <input type="number" step="0.01" value={form[f] ?? 0} onChange={e => num(f, e.target.value)} />
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

// ── SEZIONE RATE ───────────────────────────────────────────────
function SezioneRate({ anno, rates, propertyId, onRefresh }: {
  anno: string; rates: any[]; propertyId: string; onRefresh: () => void;
}) {
  const rateAnno = rates.filter(r => r.year_label === anno);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
  const totAnno = rateAnno.reduce((s: number, r: any) =>
    s + (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0), 0);
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
      property_id: propertyId, year_label: anno,
      numero_rata: `Rata ${rateAnno.length + 1}`,
      data_pagamento: form.data, importo_casa: casa, importo_box: box, importo_cantina: cantina, descrizione: form.nota,
    });
    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false);
    onRefresh();
  };
  const delRata = async (id: string) => {
    if (!confirm('Eliminare?')) return;
    await supabase.from('rate_pagamenti').delete().eq('id', id);
    onRefresh();
  };
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
              <div><label>Importo totale (€)</label>
                <input type="number" step="0.01" placeholder="es. 413.50" value={form.importo}
                  onChange={e => setForm(p => ({ ...p, importo: e.target.value }))} /></div>
              <div><label>Data pagamento</label>
                <input type="date" value={form.data}
                  onChange={e => setForm(p => ({ ...p, data: e.target.value }))} /></div>
            </div>
            {preview && (
              <div className="grid3">
                {([['App C63', preview.casa], ['Box 13', preview.box], ['Cantina', preview.cantina]] as [string, number][]).map(([l, v]) => (
                  <div key={l} style={{ textAlign: 'center', background: 'var(--accent-light)', borderRadius: 8, padding: '6px 4px' }}>
                    <p style={{ fontSize: 10, color: 'var(--text2)', marginBottom: 2 }}>{l}</p>
                    <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>€{fa(v)}</p>
                  </div>
                ))}
              </div>
            )}
            <div><label>Note (opzionale)</label>
              <input placeholder="es. Acconto" value={form.nota}
                onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} /></div>
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn-ghost" onClick={() => setShowForm(false)}><X size={13} /> Annulla</button>
              <button className="btn-primary" onClick={saveRata}><Check size={13} /> Salva</button>
            </div>
          </div>
        </div>
      )}
      {rateAnno.length === 0 && !showForm && (
        <p style={{ color: 'var(--text3)', fontSize: 13, textAlign: 'center', padding: '10px 0' }}>Nessuna rata registrata.</p>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {rateAnno.map((r: any) => {
          const tot = (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0);
          return (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', background: 'var(--bg3)', borderRadius: 9 }}>
              <CreditCard size={13} color="var(--accent)" />
              <div style={{ flex: 1 }}>
                <p style={{ fontWeight: 700, fontSize: 13 }}>{r.numero_rata}</p>
                <p style={{ fontSize: 11, color: 'var(--text3)' }}>{fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}</p>
              </div>
              <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)' }}>€{fa(tot)}</span>
              <button className="btn-danger" style={{ padding: 5 }} onClick={() => delRata(r.id)}><Trash2 size={12} /></button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── SEZIONE PREVENTIVO ─────────────────────────────────────────
function SezionePreventivo() {
  return (
    <div className="card">
      <p style={{ fontWeight: 700, fontSize: 15, marginBottom: 4 }}>Preventivo 25/26</p>
      <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 14 }}>Spese fisse stimate in base ai tuoi millesimi</p>
      <div style={{ background: 'var(--amber-bg)', border: '1px solid #fde68a', borderRadius: 10, padding: '10px 12px', fontSize: 12, color: 'var(--amber)', marginBottom: 14 }}>
        I consumi saranno disponibili dopo ottobre 2026 con il riparto consuntivo SSA.
      </div>
      {([
        ['Spese Proprietà', PV.prop], ['Spese Generali', PV.gen], ['Manutenzioni', PV.man],
        ['Scale C', PV.scalac], ['Ascensore C', PV.asc], ['Teleletture', PV.tele],
        ['Risc. involontario', PV.risc_inv], ['ACS involontaria', PV.acs_inv],
      ] as [string, number][]).map(([l, v]) => (
        <div key={l} className="row">
          <span style={{ fontSize: 13 }}>{l}</span>
          <span style={{ fontWeight: 700 }}>€{fa(v)}</span>
        </div>
      ))}
      <div style={{ marginTop: 8, paddingTop: 8, borderTop: '2px solid var(--border)', display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ fontWeight: 800 }}>Totale stimato</span>
        <span style={{ fontWeight: 800, color: 'var(--accent)', fontSize: 16 }}>€{fa(SPESE_FISSE_STIMATE_2526)}</span>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// MAIN
// ══════════════════════════════════════════════════════════════
type MainTab = 'anno' | 'storico' | 'grafici';

export default function DatiPage({ property }: { property: Property }) {
  const [years,   setYears]   = useState<any[]>([]);
  const [fixed,   setFixed]   = useState<FixedExpenses[]>([]);
  const [consumi, setConsumi] = useState<ConsumptionData[]>([]);
  const [rates,   setRates]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<MainTab>('anno');
  const [annoAttivo, setAnnoAttivo] = useState<string>('');

  const load = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label'),
      supabase.from('fixed_expenses').select('*').eq('property_id', property.id).order('year_label'),
      supabase.from('consumption_data').select('*').eq('property_id', property.id).order('year_label'),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }),
    ]);
    setYears(a.data || []); setFixed(b.data || []); setConsumi(c.data || []); setRates(d.data || []);
    setLoading(false);
  }, [property.id]);

  useEffect(() => { load(); }, [load]);

  const tuttiGliAnni = [...new Set([
    ...years.map((y: any) => y.year_label),
    ...fixed.map((f: any) => f.year_label),
    ...consumi.map((c: any) => c.year_label),
    ...rates.map((r: any) => r.year_label),
  ])].sort().reverse();

  useEffect(() => {
    if (tuttiGliAnni.length > 0 && !annoAttivo) setAnnoAttivo(tuttiGliAnni[0]);
  }, [tuttiGliAnni.join(',')]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Caricamento...</div>;

  const yearData    = years.find((y: any)  => y.year_label === annoAttivo) || null;
  const fixedData   = fixed.find((f: any)  => f.year_label === annoAttivo) || null;
  const consumoData = consumi.find((c: any) => c.year_label === annoAttivo) || null;

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
  const delYear    = async (id: string) => { if (!confirm('Eliminare?')) return; await supabase.from('exercise_years').delete().eq('id', id); setYears(p => p.filter((r: any) => r.id !== id)); };
  const delFixed   = async (id: string) => { if (!confirm('Eliminare?')) return; await supabase.from('fixed_expenses').delete().eq('id', id); setFixed(p => p.filter((r: any) => r.id !== id)); };
  const delConsumo = async (id: string) => { if (!confirm('Eliminare?')) return; await supabase.from('consumption_data').delete().eq('id', id); setConsumi(p => p.filter((r: any) => r.id !== id)); };

  const mainTabs: { id: MainTab; label: string; icon: React.ReactNode }[] = [
    { id: 'anno',    label: 'Per anno',  icon: <CalendarDays size={14} /> },
    { id: 'storico', label: 'Storico',   icon: <Table size={14} /> },
    { id: 'grafici', label: 'Grafici',   icon: <BarChart2 size={14} /> },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800 }}>Dati</h2>

      {/* Tab principali */}
      <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 12, padding: 4, gap: 2 }}>
        {mainTabs.map(t => (
          <button key={t.id} onClick={() => setMainTab(t.id)} style={{
            flex: 1, padding: '9px 4px', borderRadius: 9, fontSize: 13, fontWeight: 600,
            background: mainTab === t.id ? '#fff' : 'transparent',
            color: mainTab === t.id ? 'var(--accent)' : 'var(--text2)',
            boxShadow: mainTab === t.id ? 'var(--shadow-xs)' : 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
          }}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* ── PER ANNO ── */}
      {mainTab === 'anno' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {tuttiGliAnni.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30, color: 'var(--text3)' }}>
              Nessun dato. Registra la prima rata dalla Home oppure usa il tab <strong>Storico</strong>.
            </div>
          ) : (
            <>
              {/* Selector anni */}
              <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 10, padding: 3, gap: 2, overflowX: 'auto', scrollbarWidth: 'none' }}>
                {tuttiGliAnni.map(anno => (
                  <button key={anno} onClick={() => setAnnoAttivo(anno)} style={{
                    flex: 'none', padding: '7px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
                    background: annoAttivo === anno ? '#fff' : 'transparent',
                    color: annoAttivo === anno ? 'var(--accent)' : 'var(--text2)',
                    boxShadow: annoAttivo === anno ? 'var(--shadow-xs)' : 'none',
                    whiteSpace: 'nowrap',
                  }}>{anno}</button>
                ))}
              </div>

              {annoAttivo && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <SezioneRendiconto anno={annoAttivo} year={yearData} onSave={saveYear} onDelete={delYear} />
                  <SezioneSpese anno={annoAttivo} fixed={fixedData as FixedExpenses | null} onSave={saveFixed} onDelete={delFixed} />
                  <SezioneConsumi anno={annoAttivo} consumo={consumoData as ConsumptionData | null} tuttiConsumi={consumi} onSave={saveConsumo} onDelete={delConsumo} />
                  {annoAttivo === '25/26' && <SezionePreventivo />}
                  <SezioneRate anno={annoAttivo} rates={rates} propertyId={property.id} onRefresh={load} />
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── STORICO ── */}
      {mainTab === 'storico' && (
        <SezioneStorico
          propertyId={property.id}
          years={years}
          fixed={fixed}
          consumi={consumi}
          onRefresh={load}
        />
      )}

      {/* ── GRAFICI ── */}
      {mainTab === 'grafici' && (
        <SezioneGrafici years={years} fixed={fixed} consumi={consumi} rates={rates} />
      )}
    </div>
  );
}
