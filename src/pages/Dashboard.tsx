import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ChevronRight, TrendingUp, TrendingDown, Info, ArrowUpDown } from 'lucide-react';

const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

// Calcola l'anno esercizio corrente da una data
const getAnnoEsercizio = (date: Date = new Date()) => {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
};

const getPrevAnno = (yl: string) => {
  const [s, e] = yl.split('/').map(Number);
  return `${String(s - 1).padStart(2, '0')}/${String(e - 1).padStart(2, '0')}`;
};

const ripartiRata = (tot: number) => {
  const m = 3.394 + 0.576 + 0.059;
  return {
    casa:    parseFloat((tot * 3.394 / m).toFixed(2)),
    box:     parseFloat((tot * 0.576 / m).toFixed(2)),
    cantina: parseFloat((tot * 0.059 / m).toFixed(2)),
  };
};

const annoFromDate = (d: string) => {
  if (!d) return '';
  const dt = new Date(d), m = dt.getMonth() + 1, y = dt.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
};

function PctDetailModal({
  title, curLabel, curVal, prevLabel, prevVal, pct, onClose
}: {
  title: string; curLabel: string; curVal: number;
  prevLabel: string; prevVal: number; pct: number; onClose: () => void;
}) {
  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.55)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div className="card fade-up" style={{ width: '100%', maxWidth: 340, padding: 24, boxShadow: 'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 16 }}>{title}</p>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', fontSize: 18, lineHeight: 1 }}>✕</button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{prevLabel}</p>
              <p style={{ fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-display)' }}>€{f0(prevVal)}</p>
            </div>
            <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '10px 12px', textAlign: 'center' }}>
              <p style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>{curLabel}</p>
              <p style={{ fontWeight: 800, fontSize: 20, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>€{f0(curVal)}</p>
            </div>
          </div>
          <div style={{ background: 'var(--bg3)', borderRadius: 10, padding: '10px 12px' }}>
            <p style={{ fontSize: 11, color: 'var(--text2)', marginBottom: 4 }}>Formula</p>
            <p style={{ fontSize: 12, fontFamily: 'monospace', color: 'var(--text)' }}>
              ({f0(curVal)} − {f0(prevVal)}) / |{f0(prevVal)}| × 100
            </p>
            <p style={{ fontSize: 14, fontWeight: 800, color: pct > 0 ? 'var(--red)' : 'var(--green)', marginTop: 6 }}>
              = {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </p>
          </div>
          <p style={{ fontSize: 11, color: 'var(--text3)', textAlign: 'center' }}>
            {pct > 0 ? '▲ Aumentato' : '▼ Diminuito'} di €{f0(Math.abs(curVal - prevVal))}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [currentYear,  setCurrentYear]  = useState<any>(null);
  const [prevYear,     setPrevYear]     = useState<any>(null);
  const [rates,        setRates]        = useState<any[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [showForm,     setShowForm]     = useState(false);
  const [saving,       setSaving]       = useState(false);
  const [ratesSortAsc, setRatesSortAsc] = useState(false); // desc di default
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
  const [pctModal, setPctModal] = useState<null | {
    title: string; curLabel: string; curVal: number; prevLabel: string; prevVal: number; pct: number;
  }>(null);

  const annoCorrente = getAnnoEsercizio();
  const annoPrecedente = getPrevAnno(annoCorrente);

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: yearsData }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }),
    ]);
    const all = yearsData || [];
    // Trova l'anno corrente e il precedente
    const cur  = all.find((y: any) => y.year_label === annoCorrente) || all[0] || null;
    const prev = all.find((y: any) => y.year_label === annoPrecedente) || (all.length > 1 ? all[1] : null);
    setCurrentYear(cur);
    setPrevYear(prev);
    setRates(ratesData || []);
    setLoading(false);
  };

  const saveRate = async () => {
    const tot = parseFloat(form.importo);
    if (!tot || isNaN(tot)) return;
    setSaving(true);
    const yl = annoFromDate(form.data);
    const { count } = await supabase.from('rate_pagamenti').select('*', { count: 'exact', head: true }).eq('property_id', property.id).eq('year_label', yl);
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
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '60px 0', gap: 10, color: 'var(--text3)' }}>
      <div style={{ width: 20, height: 20, borderRadius: '50%', border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  const sC  = currentYear ? calcSaldo(currentYear.balance_start_casa,    currentYear.rates_paid_casa,    currentYear.spese_totali_casa    || 0) : null;
  const sB  = currentYear ? calcSaldo(currentYear.balance_start_box,     currentYear.rates_paid_box,     currentYear.spese_totali_box     || 0) : null;
  const sCa = currentYear ? calcSaldo(currentYear.balance_start_cantina, currentYear.rates_paid_cantina, currentYear.spese_totali_cantina || 0) : null;
  const sTot = sC !== null ? sC + sB! + sCa! : null;

  const pC  = prevYear ? calcSaldo(prevYear.balance_start_casa,    prevYear.rates_paid_casa,    prevYear.spese_totali_casa    || 0) : null;
  const pTot = pC !== null
    ? pC
      + calcSaldo(prevYear.balance_start_box, prevYear.rates_paid_box, prevYear.spese_totali_box || 0)
      + calcSaldo(prevYear.balance_start_cantina, prevYear.rates_paid_cantina, prevYear.spese_totali_cantina || 0)
    : null;

  const totRateAnno = rates
    .filter(r => r.year_label === annoCorrente)
    .reduce((s: number, r: any) => s + (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0), 0);

  const preview   = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);

  const saldoPct = (sTot !== null && pTot !== null && pTot !== 0)
    ? ((sTot - pTot) / Math.abs(pTot)) * 100
    : null;

  const sortedRates = [...rates].sort((a, b) => {
    const da = new Date(a.data_pagamento).getTime();
    const db = new Date(b.data_pagamento).getTime();
    return ratesSortAsc ? da - db : db - da;
  });

  const displayYear = currentYear?.year_label || annoCorrente;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── Hero intestazione ── */}
      <div style={{
        background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
        borderRadius: 18,
        padding: '22px 20px 18px',
        color: '#fff',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* sfondo decorativo */}
        <div style={{
          position: 'absolute', top: -30, right: -30, width: 140, height: 140,
          borderRadius: '50%', background: 'rgba(255,255,255,0.07)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, left: -20, width: 90, height: 90,
          borderRadius: '50%', background: 'rgba(255,255,255,0.05)',
          pointerEvents: 'none',
        }} />

        <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', opacity: 0.7, marginBottom: 4 }}>
          Cohabitat Lambrate · Via Pitteri 93
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: '#fff', lineHeight: 1.2, marginBottom: 6 }}>
          App C63 · Box 13 · Cant. 10
        </h1>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'rgba(255,255,255,0.18)', borderRadius: 20, padding: '4px 12px', fontSize: 12, fontWeight: 700 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#6ee7b7', display: 'inline-block' }} />
          Esercizio {displayYear}
        </div>
      </div>

      {/* ── Saldo esercizio corrente — unico numero grande ── */}
      {sTot !== null && (
        <div style={{
          background: 'var(--bg2)',
          border: `2px solid ${sTot >= 0 ? '#a7f3d0' : '#fecaca'}`,
          borderRadius: 16,
          padding: '20px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <p style={{ fontSize: 12, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)', marginBottom: 6 }}>
                Saldo esercizio {displayYear}
              </p>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 900, lineHeight: 1,
                color: sTot >= 0 ? 'var(--green)' : 'var(--red)',
              }}>
                {sTot >= 0 ? '+' : '-'}€{f0(sTot)}
              </p>
              <p style={{
                fontSize: 12, fontWeight: 700, marginTop: 6,
                color: sTot >= 0 ? 'var(--green)' : 'var(--red)',
                background: sTot >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                border: `1px solid ${sTot >= 0 ? '#a7f3d0' : '#fecaca'}`,
                display: 'inline-block', borderRadius: 20, padding: '3px 10px',
              }}>
                {sTot >= 0 ? '▲ In credito' : '▼ In debito'}
              </p>
            </div>

            {/* Confronto anno precedente */}
            {pTot !== null && saldoPct !== null && (
              <button
                onClick={() => setPctModal({
                  title: 'Variazione saldo',
                  prevLabel: prevYear.year_label,
                  prevVal: pTot,
                  curLabel: displayYear,
                  curVal: sTot,
                  pct: saldoPct,
                })}
                style={{
                  background: 'var(--bg3)', border: '1.5px solid var(--border2)',
                  borderRadius: 12, padding: '12px 14px', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4, minWidth: 120,
                }}
                title="Clicca per vedere il calcolo"
              >
                <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600 }}>vs {prevYear.year_label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                  {sTot > pTot ? <TrendingUp size={15} color="var(--green)" /> : <TrendingDown size={15} color="var(--red)" />}
                  <span style={{ fontSize: 15, fontWeight: 800, color: sTot > pTot ? 'var(--green)' : 'var(--red)' }}>
                    {sTot > pTot ? '+' : '-'}€{f0(Math.abs(sTot - pTot))}
                  </span>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 800,
                  color: saldoPct > 0 ? 'var(--green)' : 'var(--red)',
                  background: saldoPct > 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                  borderRadius: 8, padding: '2px 8px',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {saldoPct > 0 ? '+' : ''}{saldoPct.toFixed(1)}% <Info size={9} />
                </span>
              </button>
            )}
          </div>

          {/* Nota se l'anno corrente non ha dati */}
          {!currentYear && (
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, fontStyle: 'italic' }}>
              Nessun dato per l'esercizio {annoCorrente}. I valori mostrati si riferiscono all'ultimo esercizio disponibile.
            </p>
          )}
        </div>
      )}

      {sTot === null && !loading && (
        <div style={{ background: 'var(--amber-bg)', border: '1px solid #fde68a', borderRadius: 14, padding: '16px 18px' }}>
          <p style={{ fontWeight: 700, color: 'var(--amber)', marginBottom: 4 }}>Nessun rendiconto inserito</p>
          <p style={{ fontSize: 13, color: 'var(--amber)', opacity: 0.85 }}>
            Vai in <strong>Dati → Rendiconto</strong> per inserire i dati dell'esercizio {annoCorrente}.
          </p>
        </div>
      )}

      {/* ── Azione rapida: Registra pagamento ── */}
      <div>
        <p className="section-label">Azioni rapide</p>
        {!showForm ? (
          <button onClick={() => setShowForm(true)} style={{
            width: '100%', background: 'linear-gradient(135deg, var(--accent) 0%, var(--accent2) 100%)',
            color: '#fff', borderRadius: 14, padding: '16px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 4px 14px rgba(22,128,60,0.3)',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            <div style={{ background: 'rgba(255,255,255,0.2)', borderRadius: 10, padding: 10, display: 'flex', flexShrink: 0 }}>
              <CreditCard size={20} color="#fff" />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Registra pagamento rata</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
                {totRateAnno > 0
                  ? `${annoCorrente} · €${f0(totRateAnno)} versati finora`
                  : 'Inserisci la rata appena pagata'}
              </p>
            </div>
            <Plus size={20} color="rgba(255,255,255,0.8)" />
          </button>
        ) : (
          <div className="card" style={{ border: '2px solid var(--accent)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18 }}>Nuovo pagamento</p>
              <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4, fontSize: 18, lineHeight: 1 }}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label>Importo totale (€)</label>
                <input type="number" step="0.01" placeholder="es. 413.50" value={form.importo}
                  onChange={e => setForm(p => ({ ...p, importo: e.target.value }))}
                  style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', padding: '14px' }} autoFocus />
              </div>
              <div>
                <label>Data pagamento</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))} />
              </div>
              <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '12px 14px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? 10 : 0 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Esercizio rilevato automaticamente</p>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{ylPreview || '—'}</span>
                </div>
                {preview ? (
                  <div style={{ background: '#fff', borderRadius: 8, padding: '10px 12px', fontSize: 13, color: 'var(--text2)' }}>
                    Totale: <strong style={{ color: 'var(--accent)' }}>€{fa(preview.casa + preview.box + preview.cantina)}</strong>
                    <span style={{ fontSize: 11, marginLeft: 8 }}>(ripartito per millesimi)</span>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: 'var(--accent)', opacity: 0.8 }}>Ripartizione per millesimi calcolata automaticamente</p>
                )}
              </div>
              <div>
                <label>Note (opzionale)</label>
                <input placeholder="es. Acconto, Conguaglio..." value={form.nota} onChange={e => setForm(p => ({ ...p, nota: e.target.value }))} />
              </div>
              <button className="btn-primary" onClick={saveRate} disabled={saving || !form.importo}
                style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15 }}>
                {saving ? 'Salvataggio...' : <><Check size={16} /> Salva pagamento</>}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* ── Ultimi pagamenti con ordinamento ── */}
      {rates.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <p className="section-label" style={{ margin: 0 }}>Pagamenti recenti</p>
            <button
              onClick={() => setRatesSortAsc(v => !v)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                background: 'var(--bg3)', border: '1px solid var(--border)',
                borderRadius: 20, padding: '4px 10px', fontSize: 11, fontWeight: 600,
                color: 'var(--text2)', cursor: 'pointer',
              }}
            >
              <ArrowUpDown size={11} />
              {ratesSortAsc ? 'Dal più vecchio' : 'Dal più recente'}
            </button>
          </div>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {sortedRates.slice(0, 5).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0);
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                  borderBottom: i < Math.min(sortedRates.length, 5) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <CreditCard size={16} color="var(--accent)" />
                  </div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>
                      {r.numero_rata}
                      <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 12, marginLeft: 6 }}>{r.year_label}</span>
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 1 }}>
                      {fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}
                    </p>
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>€{fa(tot)}</p>
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
            { page: 'dati' as Page, title: 'Dati annuali e analisi', sub: 'Rendiconto · Spese · Consumi · Grafici · Confronto · Preventivo', emoji: '📊' },
            { page: 'note' as Page, title: 'Note e scadenze', sub: 'Appunti · Comunicazioni SSA · Scadenze', emoji: '📝' },
          ]).map(({ page, title, sub, emoji }) => (
            <button key={page} onClick={() => setPage(page)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'var(--bg2)', border: '1.5px solid var(--border)',
              borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-body)',
              transition: 'border-color 0.15s, box-shadow 0.15s',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <span style={{ fontSize: 22 }}>{emoji}</span>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</p>
                  <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{sub}</p>
                </div>
              </div>
              <ChevronRight size={18} color="var(--text3)" style={{ flexShrink: 0 }} />
            </button>
          ))}
        </div>
      </div>

      {/* ── Modal dettaglio % ── */}
      {pctModal && (
        <PctDetailModal {...pctModal} onClose={() => setPctModal(null)} />
      )}
    </div>
  );
}
