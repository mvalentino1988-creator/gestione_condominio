import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ChevronRight, TrendingUp, TrendingDown, ArrowUpDown, AlertCircle } from 'lucide-react';

// ── utils ─────────────────────────────────────────────────────
const f2  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtFull = (s: string) => s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort = (s: string) => s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

/**
 * Calcola l'anno esercizio dalla data passata.
 * Il ciclo SSA va da ottobre a settembre:
 *   ottobre 2025 → febbraio 2026  →  "25/26"
 *   marzo 2025   → settembre 2025 →  "24/25"
 */
const getAnnoEsercizio = (date: Date = new Date()): string => {
  const m = date.getMonth() + 1; // 1–12
  const y = date.getFullYear();
  if (m >= 10) {
    // da ottobre in poi: l'anno INIZIA quest'anno
    return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
  } else {
    // da gennaio a settembre: siamo DENTRO l'anno iniziato l'anno scorso
    return `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
  }
};

const getPrevAnno = (yl: string): string => {
  const [a, b] = yl.split('/').map(Number);
  return `${String(a - 1).padStart(2, '0')}/${String(b - 1).padStart(2, '0')}`;
};

const annoFromDate = (d: string): string => {
  if (!d) return '';
  const dt = new Date(d), m = dt.getMonth() + 1, y = dt.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
};

const ripartiRata = (tot: number) => {
  const m = 3.394 + 0.576 + 0.059;
  return {
    casa:    parseFloat((tot * 3.394 / m).toFixed(2)),
    box:     parseFloat((tot * 0.576 / m).toFixed(2)),
    cantina: parseFloat((tot * 0.059 / m).toFixed(2)),
  };
};

// ── Modale confronto ──────────────────────────────────────────
function ConfrontoModal({
  curLabel, curVal, prevLabel, prevVal, onClose
}: { curLabel: string; curVal: number; prevLabel: string; prevVal: number; onClose: () => void }) {
  const delta = curVal - prevVal;
  const pct   = prevVal !== 0 ? (delta / Math.abs(prevVal)) * 100 : 0;
  const pos   = delta >= 0;

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.45)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="card fade-up" style={{ width: '100%', maxWidth: 320, padding: 24, boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700 }}>Confronto saldi</p>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
          {[{ label: prevLabel, val: prevVal }, { label: curLabel, val: curVal }].map(({ label, val }) => (
            <div key={label} style={{ background: 'var(--bg3)', borderRadius: 10, padding: '12px 10px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)', marginBottom: 6 }}>{label}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: val >= 0 ? 'var(--green)' : 'var(--red)' }}>
                {val >= 0 ? '+' : '−'}€{f0(val)}
              </p>
            </div>
          ))}
        </div>

        <div style={{ background: pos ? 'var(--green-bg)' : 'var(--red-bg)', border: `1px solid ${pos ? 'var(--accent-mid)' : '#f0b8b4'}`, borderRadius: 10, padding: '12px 14px', textAlign: 'center' }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>Variazione</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: pos ? 'var(--green)' : 'var(--red)' }}>
            {pos ? '+' : '−'}€{f0(Math.abs(delta))}
          </p>
          <p style={{ fontSize: 13, fontWeight: 700, color: pos ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>
            {pct >= 0 ? '+' : ''}{pct.toFixed(1)}%
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Componente principale ─────────────────────────────────────
export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [allYears,     setAllYears]     = useState<any[]>([]);
  const [rates,        setRates]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [sortAsc,      setSortAsc]      = useState(false);
  const [showModal,    setShowModal]    = useState(false);
  const [form, setForm] = useState({
    importo: '', data: new Date().toISOString().split('T')[0], nota: '',
  });

  // Anno corrente SEMPRE calcolato dalla data di oggi — mai hardcoded
  const annoCorrente   = getAnnoEsercizio(new Date());
  const annoPrecedente = getPrevAnno(annoCorrente);

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    setLoading(true);
    const [{ data: yrs }, { data: rts }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }),
    ]);
    setAllYears(yrs || []);
    setRates(rts || []);
    setLoading(false);
  };

  const saveRate = async () => {
    const tot = parseFloat(form.importo);
    if (!tot || isNaN(tot)) return;
    setSaving(true);
    const yl = annoFromDate(form.data);
    const { count } = await supabase
      .from('rate_pagamenti').select('*', { count: 'exact', head: true })
      .eq('property_id', property.id).eq('year_label', yl);
    const { casa, box, cantina } = ripartiRata(tot);
    await supabase.from('rate_pagamenti').insert({
      property_id: property.id, year_label: yl,
      numero_rata: `Rata ${(count || 0) + 1}`,
      data_pagamento: form.data,
      importo_casa: casa, importo_box: box, importo_cantina: cantina,
      descrizione: form.nota,
    });
    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: '60px 0', gap: 10, color: 'var(--text3)' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', animation: 'spin 0.6s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Cerca i dati ESATTAMENTE per l'anno corrente
  const curYearData  = allYears.find(y => y.year_label === annoCorrente) ?? null;
  // Cerca i dati per l'anno precedente
  const prevYearData = allYears.find(y => y.year_label === annoPrecedente) ?? null;

  // Saldo anno corrente (solo se i dati esistono)
  const saldoCur = curYearData
    ? calcSaldo(curYearData.balance_start_casa, curYearData.rates_paid_casa, curYearData.spese_totali_casa || 0)
    + calcSaldo(curYearData.balance_start_box,  curYearData.rates_paid_box,  curYearData.spese_totali_box  || 0)
    + calcSaldo(curYearData.balance_start_cantina, curYearData.rates_paid_cantina, curYearData.spese_totali_cantina || 0)
    : null;

  // Saldo anno precedente
  const saldoPrev = prevYearData
    ? calcSaldo(prevYearData.balance_start_casa, prevYearData.rates_paid_casa, prevYearData.spese_totali_casa || 0)
    + calcSaldo(prevYearData.balance_start_box,  prevYearData.rates_paid_box,  prevYearData.spese_totali_box  || 0)
    + calcSaldo(prevYearData.balance_start_cantina, prevYearData.rates_paid_cantina, prevYearData.spese_totali_cantina || 0)
    : null;

  // Rate anno corrente
  const rateCurAnno = rates.filter(r => r.year_label === annoCorrente);
  const totRateCur  = rateCurAnno.reduce((s: number, r: any) =>
    s + (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0), 0);

  // Preview
  const preview   = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);

  // Rates sorted
  const sortedRates = [...rates].sort((a, b) => {
    const da = new Date(a.data_pagamento).getTime();
    const db = new Date(b.data_pagamento).getTime();
    return sortAsc ? da - db : db - da;
  });

  const creditoDebito = saldoCur !== null
    ? { label: saldoCur >= 0 ? 'In credito' : 'In debito', color: saldoCur >= 0 ? 'var(--green)' : 'var(--red)', bg: saldoCur >= 0 ? 'var(--green-bg)' : 'var(--red-bg)', border: saldoCur >= 0 ? 'var(--accent-mid)' : '#f0b8b4' }
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

      {/* ── Intestazione: solo nome immobile, no unità ── */}
      <div>
        <p style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
          {property.address || 'Il tuo immobile'}
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: 'var(--ink)', letterSpacing: '-0.01em', lineHeight: 1.2 }}>
          {property.name}
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text3)', marginTop: 5 }}>
          Esercizio corrente:&ensp;
          <span style={{ fontWeight: 700, color: 'var(--ink)', fontFamily: 'var(--font-display)' }}>{annoCorrente}</span>
        </p>
      </div>

      {/* ── Saldo anno corrente ── */}
      {saldoCur !== null ? (
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 16, overflow: 'hidden' }}>
          {/* header card */}
          <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p style={{ fontSize: 11, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.09em', color: 'var(--text3)' }}>
              Saldo esercizio {annoCorrente}
            </p>
            <span style={{ fontSize: 11, fontWeight: 700, color: creditoDebito!.color, background: creditoDebito!.bg, border: `1px solid ${creditoDebito!.border}`, borderRadius: 20, padding: '2px 10px' }}>
              {creditoDebito!.label}
            </span>
          </div>

          {/* numero grande */}
          <div style={{ padding: '20px 20px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 12, flexWrap: 'wrap' }}>
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 48,
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1,
                color: saldoCur >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {saldoCur >= 0 ? '+' : '−'}€{f0(Math.abs(saldoCur))}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                {saldoCur >= 0
                  ? 'Il condominio ti è in credito'
                  : 'Hai un debito residuo con il condominio'}
              </p>
            </div>

            {/* confronto anno precedente */}
            {saldoPrev !== null && (
              <button
                onClick={() => setShowModal(true)}
                style={{
                  background: 'var(--bg3)', border: '1px solid var(--border)',
                  borderRadius: 10, padding: '10px 14px', cursor: 'pointer',
                  textAlign: 'right',
                }}
              >
                <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>
                  vs {annoPrecedente}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  {saldoCur > saldoPrev ? <TrendingUp size={13} color="var(--green)" /> : <TrendingDown size={13} color="var(--red)" />}
                  <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: saldoCur > saldoPrev ? 'var(--green)' : 'var(--red)' }}>
                    {saldoCur > saldoPrev ? '+' : '−'}€{f0(Math.abs(saldoCur - saldoPrev))}
                  </span>
                </div>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>
                  {(() => {
                    const p = saldoPrev !== 0 ? ((saldoCur - saldoPrev) / Math.abs(saldoPrev)) * 100 : 0;
                    return `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;
                  })()}
                </p>
              </button>
            )}
          </div>
        </div>
      ) : (
        /* nessun dato per l'anno corrente */
        <div style={{ background: 'var(--amber-bg)', border: '1px solid #f0d880', borderRadius: 14, padding: '16px 18px', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
          <AlertCircle size={18} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
          <div>
            <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--amber)' }}>
              Nessun rendiconto per il {annoCorrente}
            </p>
            <p style={{ fontSize: 12, color: 'var(--amber)', opacity: 0.85, marginTop: 3 }}>
              Quando ricevi il rendiconto SSA, inserisci i dati in{' '}
              <button
                onClick={() => setPage('dati')}
                style={{ background: 'transparent', border: 'none', color: 'var(--amber)', fontWeight: 700, textDecoration: 'underline', cursor: 'pointer', fontSize: 12, padding: 0 }}
              >
                Dati → Rendiconto
              </button>
            </p>
          </div>
        </div>
      )}

      {/* ── Registra rata ── */}
      <div>
        <p className="section-label">Azioni rapide</p>
        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%', background: 'var(--accent)', color: '#fff',
              borderRadius: 13, padding: '15px 18px',
              display: 'flex', alignItems: 'center', gap: 13,
              boxShadow: '0 3px 12px rgba(45,106,79,0.28)',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 9, padding: 9, flexShrink: 0 }}>
              <CreditCard size={18} color="#fff" />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 15, color: '#fff' }}>Registra pagamento rata</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 2 }}>
                {totRateCur > 0
                  ? `Esercizio ${annoCorrente} · €${f0(totRateCur)} versati finora`
                  : `Nessun pagamento inserito per il ${annoCorrente}`}
              </p>
            </div>
            <Plus size={18} color="rgba(255,255,255,0.7)" />
          </button>
        ) : (
          <div className="card" style={{ border: '2px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18 }}>Nuovo pagamento</p>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 0, fontSize: 20, lineHeight: 1 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Importo totale (€)</label>
                <input
                  type="number" step="0.01" placeholder="es. 413,50"
                  value={form.importo}
                  onChange={e => setForm(p => ({ ...p, importo: e.target.value }))}
                  style={{ fontSize: 26, fontWeight: 700, textAlign: 'center', fontFamily: 'var(--font-display)' }}
                  autoFocus
                />
              </div>
              <div>
                <label>Data pagamento</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>

              {/* Preview ripartizione */}
              <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? 10 : 0 }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent)' }}>Esercizio rilevato automaticamente</p>
                  <span style={{ fontWeight: 800, fontSize: 14, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{ylPreview || '—'}</span>
                </div>
                {preview ? (
                  <div className="grid3">
                    {([['App', preview.casa], ['Box', preview.box], ['Cant.', preview.cantina]] as [string, number][]).map(([l, v]) => (
                      <div key={l} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '7px 4px' }}>
                        <p style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 2 }}>{l}</p>
                        <p style={{ fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>€{f2(v)}</p>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p style={{ fontSize: 11, color: 'var(--accent)', opacity: 0.75 }}>Ripartizione per millesimi calcolata automaticamente</p>
                )}
              </div>

              <div>
                <label>Note (opzionale)</label>
                <input placeholder="es. Acconto, Conguaglio…" value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} />
              </div>

              <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                <button className="btn-ghost" onClick={() => setShowForm(false)}><X size={13} /> Annulla</button>
                <button className="btn-primary" onClick={saveRate} disabled={saving || !form.importo}>
                  {saving ? 'Salvataggio…' : <><Check size={13} /> Salva</>}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Storico pagamenti ── */}
      {rates.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="section-label" style={{ margin: 0 }}>Pagamenti recenti</p>
            <button
              onClick={() => setSortAsc(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '4px 10px', fontSize: 10, fontWeight: 700,
                color: 'var(--text3)', cursor: 'pointer', letterSpacing: '0.06em', textTransform: 'uppercase',
              }}
            >
              <ArrowUpDown size={9} />
              {sortAsc ? 'Meno recenti' : 'Più recenti'}
            </button>
          </div>

          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {sortedRates.slice(0, 5).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0);
              const isLast = i === Math.min(sortedRates.length, 5) - 1;
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                  }}
                >
                  <div style={{ width: 34, height: 34, borderRadius: 9, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CreditCard size={15} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>
                      {r.numero_rata}
                      <span style={{ color: 'var(--text3)', fontWeight: 500, fontSize: 12, marginLeft: 6 }}>· {r.year_label}</span>
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      {fmtShort(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)', flexShrink: 0 }}>
                    €{f2(tot)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Link sezioni ── */}
      <div>
        <p className="section-label">Sezioni</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            {
              page: 'dati' as Page,
              title: 'Dati annuali',
              sub: 'Rendiconto · Spese · Consumi · Rate · Confronto · Preventivo',
            },
            {
              page: 'note' as Page,
              title: 'Note e scadenze',
              sub: 'Appunti · Comunicazioni SSA · Scadenze',
            },
          ]).map(({ page, title, sub }) => (
            <button
              key={page}
              onClick={() => setPage(page)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '14px 16px',
                background: 'var(--bg2)', border: '1px solid var(--border)',
                borderRadius: 13, cursor: 'pointer', fontFamily: 'var(--font-body)',
                transition: 'border-color 0.14s',
              }}
              onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--accent)')}
              onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--border)')}
            >
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--ink)' }}>{title}</p>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</p>
              </div>
              <ChevronRight size={16} color="var(--text3)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Modal confronto ── */}
      {showModal && saldoCur !== null && saldoPrev !== null && (
        <ConfrontoModal
          curLabel={annoCorrente}
          curVal={saldoCur}
          prevLabel={annoPrecedente}
          prevVal={saldoPrev}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
