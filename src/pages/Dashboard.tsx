import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ChevronRight, TrendingUp, TrendingDown, Info, Star } from 'lucide-react';

const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

// ── Esercizio in corso ────────────────────────────────────────
function getCurrentExerciseLabel(): string {
  const now = new Date();
  const month = now.getMonth() + 1;
  const year = now.getFullYear();
  if (month >= 10) {
    return `${String(year).slice(2)}/${String(year + 1).slice(2)}`;
  } else {
    return `${String(year - 1).slice(2)}/${String(year).slice(2)}`;
  }
}

const CURRENT_EXERCISE = getCurrentExerciseLabel();

const ripartiRata = (tot: number) => {
  const m = 3.394 + 0.576 + 0.059;
  return {
    casa:     parseFloat((tot * 3.394 / m).toFixed(2)),
    box:      parseFloat((tot * 0.576 / m).toFixed(2)),
    cantina:  parseFloat((tot * 0.059 / m).toFixed(2)),
  };
};

const annoFromDate = (d: string) => {
  if (!d) return '';
  const dt = new Date(d), m = dt.getMonth() + 1, y = dt.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y+1).slice(2)}`
    : `${String(y-1).slice(2)}/${String(y).slice(2)}`;
};

// Modal per spiegare il calcolo di una variazione %
function PctDetailModal({
  title, curLabel, curVal, prevLabel, prevVal, pct, onClose
}: {
  title: string;
  curLabel: string; curVal: number;
  prevLabel: string; prevVal: number;
  pct: number;
  onClose: () => void;
}) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(26,31,46,0.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div
        className="card fade-up"
        style={{ width:'100%', maxWidth:360, padding:24, boxShadow:'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}
      >
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:17 }}>{title}</p>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer', padding:4 }}><X size={16}/></button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
            <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
              <p style={{ fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{prevLabel}</p>
              <p style={{ fontWeight:800, fontSize:18, fontFamily:'var(--font-display)' }}>€{f0(prevVal)}</p>
            </div>
            <div style={{ background:'var(--accent-light)', border:'1px solid var(--accent-mid)', borderRadius:10, padding:'10px 12px', textAlign:'center' }}>
              <p style={{ fontSize:10, color:'var(--accent)', fontWeight:700, textTransform:'uppercase', marginBottom:4 }}>{curLabel}</p>
              <p style={{ fontWeight:800, fontSize:18, fontFamily:'var(--font-display)', color:'var(--accent)' }}>€{f0(curVal)}</p>
            </div>
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
            <p style={{ fontSize:12, color:'var(--text2)', marginBottom:4 }}>Formula</p>
            <p style={{ fontSize:13, fontFamily:'monospace', color:'var(--text)' }}>
              ({f0(curVal)} − {f0(prevVal)}) / |{f0(prevVal)}| × 100
            </p>
            <p style={{ fontSize:13, fontWeight:800, color: pct > 0 ? 'var(--red)' : 'var(--green)', marginTop:6 }}>
              = {pct > 0 ? '+' : ''}{pct.toFixed(1)}%
            </p>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>
            {pct > 0 ? '▲ Aumentato' : '▼ Diminuito'} di €{f0(Math.abs(curVal - prevVal))}
          </p>
        </div>
      </div>
    </div>
  );
}

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [lastYear, setLastYear] = useState<any>(null);
  const [prevYear, setPrevYear] = useState<any>(null);
  const [currentYear, setCurrentYear] = useState<any>(null); // esercizio in corso
  const [rates,    setRates]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
  const [pctModal, setPctModal] = useState<null | {
    title: string; curLabel: string; curVal: number; prevLabel: string; prevVal: number; pct: number;
  }>(null);

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: years }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }).limit(5),
    ]);
    // Trova l'esercizio in corso, poi l'ultimo con dati, poi il precedente
    const currIdx = years?.findIndex(y => y.year_label === CURRENT_EXERCISE) ?? -1;
    const curr = currIdx !== -1 ? years![currIdx] : null;
    setCurrentYear(curr);
    // Per i saldi, usa l'esercizio in corso se disponibile, altrimenti l'ultimo
    const displayYear = curr || years?.[0] || null;
    const prevDisplayYear = displayYear ? (years?.find(y => y.year_label !== displayYear.year_label) || null) : null;
    setLastYear(displayYear);
    setPrevYear(prevDisplayYear);
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
      numero_rata: `Rata ${(count||0)+1}`,
      data_pagamento: form.data,
      importo_casa: casa, importo_box: box, importo_cantina: cantina,
      descrizione: form.nota,
    });
    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Caricamento...</div>;

  const sC  = lastYear ? calcSaldo(lastYear.balance_start_casa,    lastYear.rates_paid_casa,    lastYear.spese_totali_casa    || 0) : null;
  const sB  = lastYear ? calcSaldo(lastYear.balance_start_box,     lastYear.rates_paid_box,     lastYear.spese_totali_box     || 0) : null;
  const sCa = lastYear ? calcSaldo(lastYear.balance_start_cantina, lastYear.rates_paid_cantina, lastYear.spese_totali_cantina || 0) : null;
  const sTot = sC !== null ? sC + sB! + sCa! : null;

  const pC  = prevYear ? calcSaldo(prevYear.balance_start_casa,    prevYear.rates_paid_casa,    prevYear.spese_totali_casa    || 0) : null;
  const pTot = pC !== null ? pC + calcSaldo(prevYear.balance_start_box, prevYear.rates_paid_box, prevYear.spese_totali_box||0) + calcSaldo(prevYear.balance_start_cantina, prevYear.rates_paid_cantina, prevYear.spese_totali_cantina||0) : null;

  // Rate dell'esercizio in corso
  const annoCorrente = CURRENT_EXERCISE;
  const totRateAnno  = rates.filter(r => r.year_label === annoCorrente).reduce((s: number, r: any) => s + (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0), 0);
  const nRateAnno    = rates.filter(r => r.year_label === annoCorrente).length;

  const preview   = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);

  // calcolo % saldo vs anno precedente
  const saldoPct = (sTot !== null && pTot !== null && pTot !== 0)
    ? ((sTot - pTot) / Math.abs(pTot)) * 100
    : null;

  const displayedExerciseLabel = lastYear?.year_label || '';
  const isCurrentExerciseDisplayed = displayedExerciseLabel === CURRENT_EXERCISE;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Intestazione immobile ── */}
      <div style={{ paddingTop: 4 }}>
        <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
          Cohabitat Lambrate · Via Pitteri 93
        </p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 800, color: 'var(--text)', lineHeight: 1.15 }}>
          App C63 · Box 13 · Cant.10
        </h1>
        {lastYear && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' }}>
            <p style={{ fontSize: 13, color: 'var(--text3)' }}>
              Esercizio <strong style={{ color: isCurrentExerciseDisplayed ? '#b45309' : 'var(--accent)' }}>{displayedExerciseLabel}</strong>
            </p>
            {isCurrentExerciseDisplayed && (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:10, fontWeight:700, color:'#b45309', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:6, padding:'2px 8px' }}>
                <Star size={9} fill="#b45309" color="#b45309"/> IN CORSO
              </span>
            )}
          </div>
        )}
      </div>

      {/* ── Banner esercizio in corso (se non è già quello mostrato) ── */}
      {!isCurrentExerciseDisplayed && (
        <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10, padding:'8px 12px', display:'flex', alignItems:'center', gap:8 }}>
          <Star size={12} fill="#b45309" color="#b45309"/>
          <span style={{ fontSize:12, color:'#92400e' }}>
            Esercizio in corso: <strong>{CURRENT_EXERCISE}</strong>
            {totRateAnno > 0 && ` · €${f0(totRateAnno)} versati (${nRateAnno} ${nRateAnno===1?'rata':'rate'})`}
          </span>
        </div>
      )}

      {/* ── Saldi 3 colonne ── */}
      {sTot !== null && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <p className="section-label">
            Saldo esercizio {displayedExerciseLabel}
            {isCurrentExerciseDisplayed && <span style={{ marginLeft:6, fontSize:10, color:'#b45309' }}>★ in corso</span>}
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {([['App C63', sC!], ['Box 13', sB!], ['Cantina', sCa!]] as [string,number][]).map(([l, v]) => (
              <div key={l} style={{
                background: 'var(--bg2)',
                border: `2px solid ${v >= 0 ? '#a7f3d0' : '#fecaca'}`,
                borderRadius: 12, padding: '14px 12px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{l}</p>
                <p style={{ fontSize: 20, fontWeight: 800, fontFamily: 'var(--font-display)', color: v >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>€{f0(v)}</p>
                <p style={{ fontSize: 10, fontWeight: 700, color: v >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>{v >= 0 ? '▲ credito' : '▼ debito'}</p>
              </div>
            ))}
          </div>

          {/* Totale e delta cliccabile — confronto con esercizio in corso */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Totale (C63 + Box + Cantina)</p>
              <p style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: sTot >= 0 ? 'var(--green)' : 'var(--red)' }}>€{fa(sTot)}</p>
            </div>
            {pTot !== null && sTot !== null && saldoPct !== null && (
              <button
                onClick={() => setPctModal({
                  title: 'Variazione saldo',
                  prevLabel: prevYear.year_label,
                  prevVal: pTot,
                  curLabel: lastYear.year_label,
                  curVal: sTot,
                  pct: saldoPct,
                })}
                style={{
                  background: 'transparent', border: 'none', cursor: 'pointer',
                  display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2,
                  padding: '6px 8px', borderRadius: 8,
                  transition: 'background 0.15s',
                }}
                title="Clicca per vedere il calcolo"
              >
                <p style={{ fontSize: 11, color: 'var(--text3)' }}>vs {prevYear.year_label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                  {sTot > pTot ? <TrendingUp size={14} color="var(--green)" /> : <TrendingDown size={14} color="var(--red)" />}
                  <span style={{ fontSize: 14, fontWeight: 700, color: sTot > pTot ? 'var(--green)' : 'var(--red)' }}>
                    {sTot > pTot ? '+' : '-'}€{f0(Math.abs(sTot - pTot))}
                  </span>
                </div>
                <span style={{
                  fontSize: 11, fontWeight: 700,
                  color: saldoPct > 0 ? 'var(--green)' : 'var(--red)',
                  background: saldoPct > 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                  borderRadius: 5, padding: '1px 6px',
                  display: 'flex', alignItems: 'center', gap: 3,
                }}>
                  {saldoPct > 0 ? '+' : ''}{saldoPct.toFixed(1)}% <Info size={9}/>
                </span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* ── Bottone pagamento — associato all'esercizio in corso ── */}
      {!showForm ? (
        <div>
          <p className="section-label">Azioni rapide</p>
          <button onClick={() => setShowForm(true)} style={{
            width: '100%', background: 'var(--accent)', color: '#fff',
            borderRadius: 13, padding: '15px 20px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 3px 10px rgba(22,128,60,0.25)',
            border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
          }}>
            <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 9, padding: 9, display: 'flex', flexShrink: 0 }}>
              <CreditCard size={20} color="#fff" />
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ fontWeight: 800, fontSize: 16, color: '#fff' }}>Registra pagamento</p>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
                {totRateAnno > 0
                  ? `${annoCorrente} ★ · €${f0(totRateAnno)} versati finora`
                  : `Esercizio in corso: ${annoCorrente}`}
              </p>
            </div>
            <Plus size={20} color="rgba(255,255,255,0.8)" />
          </button>
        </div>
      ) : (
        <div className="card" style={{ border: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19 }}>Nuovo pagamento</p>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}><X size={18} /></button>
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
            {/* Anteprima */}
            <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? 10 : 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Esercizio rilevato automaticamente</p>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{ylPreview || '—'}</span>
                  {ylPreview === CURRENT_EXERCISE && (
                    <span style={{ fontSize:10, fontWeight:700, color:'#b45309', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:5, padding:'1px 6px' }}>★ in corso</span>
                  )}
                </div>
              </div>
              {preview ? (
                <div className="grid3">
                  {([['App C63', preview.casa], ['Box 13', preview.box], ['Cantina', preview.cantina]] as [string,number][]).map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '8px 4px' }}>
                      <p style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 3 }}>{l}</p>
                      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>€{fa(v)}</p>
                    </div>
                  ))}
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

      {/* ── Ultimi pagamenti — più recente in cima ── */}
      {rates.length > 0 && (
        <div>
          <p className="section-label">Ultimi pagamenti</p>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {rates.slice(0, 4).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0);
              const isCurrentExYear = r.year_label === CURRENT_EXERCISE;
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < Math.min(rates.length, 4) - 1 ? '1px solid var(--border)' : 'none', background: isCurrentExYear ? '#fffdf5' : 'transparent' }}>
                  <CreditCard size={16} color={isCurrentExYear ? '#b45309' : 'var(--accent)'} />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>
                      {r.numero_rata}
                      <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}> · {r.year_label}</span>
                      {isCurrentExYear && <span style={{ marginLeft:5, fontSize:10, fontWeight:700, color:'#b45309' }}>★</span>}
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>{fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}</p>
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
            { page: 'dati' as Page, title: 'Dati annuali e analisi', sub: 'Rendiconto · Spese · Consumi · Grafici · Confronto · Preventivo' },
            { page: 'note' as Page, title: 'Note e scadenze',        sub: 'Appunti · Comunicazioni SSA · Scadenze' },
          ]).map(({ page, title, sub }) => (
            <button key={page} onClick={() => setPage(page)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 12, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</p>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{sub}</p>
              </div>
              <ChevronRight size={18} color="var(--text3)" />
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
