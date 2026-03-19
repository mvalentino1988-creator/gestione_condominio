import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ArrowRight, TrendingUp, TrendingDown, ArrowUpDown } from 'lucide-react';

// ── utils ─────────────────────────────────────────────────────
const f2 = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT', { day: '2-digit', month: 'short' }) : '—';
const sign = (n: number) => n >= 0 ? '+' : '−';

// Calcola anno esercizio dalla data odierna
// L'anno SSA va da ottobre a settembre: ottobre 2024 → anno "24/25"
const getAnnoCorrente = (date: Date = new Date()): string => {
  const m = date.getMonth() + 1; // 1–12
  const y = date.getFullYear();
  if (m >= 10) {
    return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
  } else {
    return `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
  }
};

const getPrevAnno = (yl: string): string => {
  const [a, b] = yl.split('/').map(Number);
  return `${String(a - 1).padStart(2, '0')}/${String(b - 1).padStart(2, '0')}`;
};

const ripartiRata = (tot: number) => {
  const m = 3.394 + 0.576 + 0.059;
  return {
    casa:    parseFloat((tot * 3.394 / m).toFixed(2)),
    box:     parseFloat((tot * 0.576 / m).toFixed(2)),
    cantina: parseFloat((tot * 0.059 / m).toFixed(2)),
  };
};

const annoFromDate = (d: string): string => {
  if (!d) return '';
  const dt = new Date(d), m = dt.getMonth() + 1, y = dt.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
};

const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

// ── Modal dettaglio variazione % ──────────────────────────────
function DeltaModal({
  title, curLabel, curVal, prevLabel, prevVal, onClose
}: {
  title: string; curLabel: string; curVal: number;
  prevLabel: string; prevVal: number; onClose: () => void;
}) {
  const delta = curVal - prevVal;
  const pct = prevVal !== 0 ? (delta / Math.abs(prevVal)) * 100 : 0;
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(17,16,16,0.4)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(4px)' }}
      onClick={onClose}
    >
      <div className="card fade-up" style={{ width: '100%', maxWidth: 320, padding: 24 }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 400, letterSpacing: '-0.01em' }}>{title}</p>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: '0 0 0 8px', fontSize: 18, lineHeight: 1 }}>×</button>
        </div>
        <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg3)', borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{prevLabel}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400 }}>€{f0(prevVal)}</p>
          </div>
          <div style={{ flex: 1, padding: '12px', background: 'var(--bg3)', borderRadius: 8 }}>
            <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 6 }}>{curLabel}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 400 }}>€{f0(curVal)}</p>
          </div>
        </div>
        <div style={{ padding: '10px 12px', borderTop: '1px solid var(--border)', paddingTop: 14 }}>
          <p style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>Variazione</p>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, color: delta >= 0 ? 'var(--green)' : 'var(--red)', letterSpacing: '-0.02em' }}>
            {sign(delta)}€{f0(Math.abs(delta))}
            <span style={{ fontSize: 16, marginLeft: 10, opacity: 0.7 }}>{pct > 0 ? '+' : ''}{pct.toFixed(1)}%</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────
export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [allYears,    setAllYears]    = useState<any[]>([]);
  const [rates,       setRates]       = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [sortRatesAsc, setSortRatesAsc] = useState(false);
  const [deltaModal,  setDeltaModal]  = useState<null | { title: string; curLabel: string; curVal: number; prevLabel: string; prevVal: number }>(null);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });

  const annoCorrente  = getAnnoCorrente();
  const annoPrecedente = getPrevAnno(annoCorrente);

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: yearsData }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }),
    ]);
    setAllYears(yearsData || []);
    setRates(ratesData || []);
    setLoading(false);
  };

  const saveRate = async () => {
    const tot = parseFloat(form.importo);
    if (!tot || isNaN(tot)) return;
    setSaving(true);
    const yl = annoFromDate(form.data);
    const { count } = await supabase.from('rate_pagamenti').select('*', { count: 'exact', head: true })
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
    <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
      <div style={{ width: 18, height: 18, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--ink)', animation: 'spin 0.6s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // Trova anni per la dashboard
  const curYear  = allYears.find(y => y.year_label === annoCorrente) || allYears[0] || null;
  const prevYear = allYears.find(y => y.year_label === annoPrecedente) || (allYears.length > 1 ? allYears[1] : null);
  const displayAnno = curYear?.year_label || annoCorrente;

  // Calcola saldi
  const saldoCur = curYear ? {
    tot: calcSaldo(curYear.balance_start_casa, curYear.rates_paid_casa, curYear.spese_totali_casa || 0)
       + calcSaldo(curYear.balance_start_box,  curYear.rates_paid_box,  curYear.spese_totali_box  || 0)
       + calcSaldo(curYear.balance_start_cantina, curYear.rates_paid_cantina, curYear.spese_totali_cantina || 0),
  } : null;

  const saldoPrev = prevYear ? {
    tot: calcSaldo(prevYear.balance_start_casa, prevYear.rates_paid_casa, prevYear.spese_totali_casa || 0)
       + calcSaldo(prevYear.balance_start_box,  prevYear.rates_paid_box,  prevYear.spese_totali_box  || 0)
       + calcSaldo(prevYear.balance_start_cantina, prevYear.rates_paid_cantina, prevYear.spese_totali_cantina || 0),
  } : null;

  // Rate dell'anno corrente
  const rateCur = rates.filter(r => r.year_label === displayAnno);
  const totRateCur = rateCur.reduce((s: number, r: any) =>
    s + (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0), 0);

  // Preview ripartizione
  const preview = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);

  // Rates sorted
  const sortedRates = [...rates].sort((a, b) => {
    const da = new Date(a.data_pagamento).getTime();
    const db = new Date(b.data_pagamento).getTime();
    return sortRatesAsc ? da - db : db - da;
  });

  const saldoColor = (n: number) => n >= 0 ? 'var(--green)' : 'var(--red)';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Intestazione immobile ── */}
      <div style={{ paddingBottom: 24, borderBottom: '1px solid var(--border)', marginBottom: 28 }}>
        <p style={{ fontSize: 11, fontWeight: 500, color: 'var(--text3)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 6 }}>
          Via Pitteri 93 · Milano
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 400, letterSpacing: '-0.02em', color: 'var(--ink)', lineHeight: 1.15 }}>
          App C63 · Box 13 · Cant.&thinsp;10
        </h1>
        <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
          Esercizio in corso: <strong style={{ color: 'var(--ink)', fontWeight: 600 }}>{displayAnno}</strong>
          {!curYear && <span style={{ marginLeft: 8, color: 'var(--amber)', fontStyle: 'italic' }}>(nessun dato inserito)</span>}
        </p>
      </div>

      {/* ── Saldo esercizio ── */}
      {saldoCur !== null ? (
        <div style={{ marginBottom: 28 }}>
          <p className="section-label">Saldo esercizio {displayAnno}</p>

          <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
            {/* Numero grande */}
            <div>
              <p style={{
                fontFamily: 'var(--font-display)',
                fontSize: 52,
                fontWeight: 400,
                letterSpacing: '-0.04em',
                lineHeight: 1,
                color: saldoColor(saldoCur.tot),
              }}>
                {sign(saldoCur.tot)}€{f0(saldoCur.tot)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 6 }}>
                {saldoCur.tot >= 0 ? 'Sei in credito con il condominio' : 'Sei in debito con il condominio'}
              </p>
            </div>

            {/* Confronto anno precedente */}
            {saldoPrev !== null && (
              <button
                onClick={() => setDeltaModal({
                  title: 'Confronto saldo',
                  prevLabel: prevYear.year_label,
                  prevVal: saldoPrev.tot,
                  curLabel: displayAnno,
                  curVal: saldoCur.tot,
                })}
                style={{
                  background: 'transparent', border: '1px solid var(--border)',
                  borderRadius: 8, padding: '10px 14px', cursor: 'pointer',
                  textAlign: 'right', minWidth: 120,
                }}
              >
                <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 5 }}>
                  vs {prevYear.year_label}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end' }}>
                  {saldoCur.tot > saldoPrev.tot
                    ? <TrendingUp size={13} color="var(--green)" />
                    : <TrendingDown size={13} color="var(--red)" />}
                  <span style={{
                    fontFamily: 'var(--font-display)', fontSize: 18,
                    color: saldoCur.tot > saldoPrev.tot ? 'var(--green)' : 'var(--red)',
                  }}>
                    {saldoCur.tot > saldoPrev.tot ? '+' : '−'}€{f0(Math.abs(saldoCur.tot - saldoPrev.tot))}
                  </span>
                </div>
                <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 3 }}>
                  {(() => {
                    const pct = saldoPrev.tot !== 0 ? ((saldoCur.tot - saldoPrev.tot) / Math.abs(saldoPrev.tot)) * 100 : 0;
                    return `${pct >= 0 ? '+' : ''}${pct.toFixed(1)}%`;
                  })()}
                </p>
              </button>
            )}
          </div>
        </div>
      ) : (
        <div style={{ marginBottom: 28, padding: '16px 0', borderBottom: '1px solid var(--border)' }}>
          <p style={{ fontSize: 13, color: 'var(--text3)' }}>
            Nessun rendiconto per l'esercizio {annoCorrente}.{' '}
            <button onClick={() => setPage('dati')} style={{ background: 'transparent', border: 'none', color: 'var(--accent)', fontWeight: 600, fontSize: 13, padding: 0, cursor: 'pointer', textDecoration: 'underline' }}>
              Inserisci i dati →
            </button>
          </p>
        </div>
      )}

      {/* ── Registra pagamento ── */}
      <div style={{ marginBottom: 28 }}>
        <p className="section-label">Pagamenti</p>

        {!showForm ? (
          <button
            onClick={() => setShowForm(true)}
            style={{
              width: '100%',
              background: 'var(--ink)', color: '#fff',
              borderRadius: 10, padding: '14px 18px',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <CreditCard size={16} color="rgba(255,255,255,0.7)" />
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: '#fff' }}>Registra rata pagata</p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 1 }}>
                  {totRateCur > 0
                    ? `${displayAnno} · €${f0(totRateCur)} versati`
                    : `Nessun pagamento inserito per ${displayAnno}`}
                </p>
              </div>
            </div>
            <Plus size={16} color="rgba(255,255,255,0.5)" />
          </button>
        ) : (
          <div className="card" style={{ border: '1px solid var(--border2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 400 }}>Nuovo pagamento</p>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 20, lineHeight: 1, padding: 0 }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Importo totale (€)</label>
                <input
                  type="number" step="0.01" placeholder="0,00"
                  value={form.importo}
                  onChange={e => setForm(p => ({ ...p, importo: e.target.value }))}
                  style={{ fontSize: 28, fontWeight: 300, textAlign: 'center', fontFamily: 'var(--font-display)', letterSpacing: '-0.02em' }}
                  autoFocus
                />
              </div>
              <div>
                <label>Data pagamento</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>

              {/* Preview ripartizione */}
              <div style={{ background: 'var(--bg3)', borderRadius: 8, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? 10 : 0 }}>
                  <p style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
                    Esercizio rilevato
                  </p>
                  <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--ink)' }}>{ylPreview || '—'}</span>
                </div>
                {preview && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
                    {([['App', preview.casa], ['Box', preview.box], ['Cant.', preview.cantina]] as [string, number][]).map(([l, v]) => (
                      <div key={l} style={{ textAlign: 'center' }}>
                        <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', marginBottom: 2 }}>{l}</p>
                        <p style={{ fontSize: 13, fontWeight: 600 }}>€{f2(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
                {!preview && <p style={{ fontSize: 11, color: 'var(--text3)' }}>Ripartizione calcolata automaticamente per millesimi</p>}
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
        <div style={{ marginBottom: 28 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="section-label" style={{ margin: 0 }}>Ultimi pagamenti</p>
            <button
              onClick={() => setSortRatesAsc(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 4,
                background: 'transparent', border: '1px solid var(--border)',
                borderRadius: 4, padding: '3px 8px', fontSize: 10, fontWeight: 600,
                color: 'var(--text3)', cursor: 'pointer', letterSpacing: '0.05em', textTransform: 'uppercase',
              }}
            >
              <ArrowUpDown size={9} />
              {sortRatesAsc ? 'Meno recenti' : 'Più recenti'}
            </button>
          </div>

          <div style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {sortedRates.slice(0, 6).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0);
              const isLast = i === Math.min(sortedRates.length, 6) - 1;
              return (
                <div
                  key={r.id}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12,
                    padding: '12px 16px',
                    borderBottom: isLast ? 'none' : '1px solid var(--border)',
                    background: 'var(--bg2)',
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <p style={{ fontWeight: 500, fontSize: 13, color: 'var(--ink)' }}>{r.numero_rata}</p>
                      <span style={{ fontSize: 11, color: 'var(--text3)' }}>{r.year_label}</span>
                    </div>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      {fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}
                    </p>
                  </div>
                  <p style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 400, color: 'var(--ink)', flexShrink: 0 }}>
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
        <div style={{ display: 'flex', flexDirection: 'column', gap: 0, border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {([
            { page: 'dati' as Page, title: 'Dati annuali', sub: 'Rendiconto · Spese · Consumi · Rate · Confronto · Preventivo' },
            { page: 'note' as Page, title: 'Note e scadenze', sub: 'Appunti · Comunicazioni SSA · Scadenze' },
          ]).map(({ page, title, sub }, i) => (
            <button
              key={page}
              onClick={() => setPage(page)}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '15px 16px',
                background: 'var(--bg2)',
                border: 'none',
                borderBottom: i === 0 ? '1px solid var(--border)' : 'none',
                cursor: 'pointer', fontFamily: 'var(--font-body)',
                transition: 'background 0.12s',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg3)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--bg2)')}
            >
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>{title}</p>
                <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</p>
              </div>
              <ArrowRight size={14} color="var(--text3)" style={{ flexShrink: 0, marginLeft: 8 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Modal ── */}
      {deltaModal && <DeltaModal {...deltaModal} onClose={() => setDeltaModal(null)} />}
    </div>
  );
}
