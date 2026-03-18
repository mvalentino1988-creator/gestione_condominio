import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ChevronRight, TrendingUp, TrendingDown } from 'lucide-react';

const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

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

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [lastYear, setLastYear] = useState<any>(null);
  const [prevYear, setPrevYear] = useState<any>(null);
  const [rates,    setRates]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: years }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }).limit(2),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }).limit(5),
    ]);
    setLastYear(years?.[0] || null);
    setPrevYear(years?.[1] || null);
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

  const annoCorrente = lastYear?.year_label || '';
  const totRateAnno  = rates.filter(r => r.year_label === annoCorrente).reduce((s: number, r: any) => s + (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0), 0);

  const preview   = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Intestazione immobile ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 4 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>Cohabitat Lambrate · Via Pitteri 93</p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>App C63 · Box 13 · Cant.10</h1>
        </div>
        {lastYear && (
          <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '6px 14px', textAlign: 'center', flexShrink: 0 }}>
            <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Esercizio</p>
            <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{lastYear.year_label}</p>
          </div>
        )}
      </div>

      {/* ── Saldi 3 colonne ── */}
      {sTot !== null && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <p className="section-label">Saldo esercizio {lastYear.year_label}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {([['App C63', sC!], ['Box 13', sB!], ['Cantina', sCa!]] as [string,number][]).map(([l, v]) => (
              <div key={l} style={{
                background: 'var(--bg2)',
                border: `2px solid ${v >= 0 ? '#a7f3d0' : '#fecaca'}`,
                borderRadius: 12, padding: '14px 12px', textAlign: 'center',
              }}>
                <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>{l}</p>
                <p style={{ fontSize: 22, fontWeight: 800, fontFamily: 'var(--font-display)', color: v >= 0 ? 'var(--green)' : 'var(--red)', lineHeight: 1 }}>€{f0(v)}</p>
                <p style={{ fontSize: 11, fontWeight: 700, color: v >= 0 ? 'var(--green)' : 'var(--red)', marginTop: 4 }}>{v >= 0 ? '▲ credito' : '▼ debito'}</p>
              </div>
            ))}
          </div>
          {/* Totale e delta */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)' }}>Totale (C63 + Box + Cantina)</p>
              <p style={{ fontSize: 26, fontWeight: 800, fontFamily: 'var(--font-display)', color: sTot >= 0 ? 'var(--green)' : 'var(--red)' }}>€{fa(sTot)}</p>
            </div>
            {pTot !== null && sTot !== null && (
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontSize: 11, color: 'var(--text3)' }}>vs {prevYear.year_label}</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 3, justifyContent: 'flex-end', marginTop: 2 }}>
                  {sTot > pTot ? <TrendingUp size={14} color="var(--green)" /> : <TrendingDown size={14} color="var(--red)" />}
                  <span style={{ fontSize: 14, fontWeight: 700, color: sTot > pTot ? 'var(--green)' : 'var(--red)' }}>
                    {sTot > pTot ? '+' : '-'}€{f0(Math.abs(sTot - pTot))}
                  </span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Bottone pagamento ── */}
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
                {totRateAnno > 0 ? `${annoCorrente} · €${f0(totRateAnno)} versati finora` : 'Inserisci la rata appena pagata'}
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
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>{ylPreview || '—'}</span>
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

      {/* ── Ultimi pagamenti ── */}
      {rates.length > 0 && (
        <div>
          <p className="section-label">Ultimi pagamenti</p>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, overflow: 'hidden' }}>
            {rates.slice(0, 4).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0);
              return (
                <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderBottom: i < Math.min(rates.length, 4) - 1 ? '1px solid var(--border)' : 'none' }}>
                  <CreditCard size={16} color="var(--accent)" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>{r.numero_rata} <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}>· {r.year_label}</span></p>
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
    </div>
  );
}
