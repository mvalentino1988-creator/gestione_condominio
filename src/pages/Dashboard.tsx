import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import {
  Plus, Check, X, CreditCard, ChevronRight, ChevronDown,
  TrendingUp, TrendingDown, Star, FileText, BarChart2
} from 'lucide-react';

const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT', { day:'2-digit', month:'short' }) : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

function getCurrentExerciseLabel(): string {
  const now = new Date();
  const m = now.getMonth() + 1, y = now.getFullYear();
  return m >= 10 ? `${String(y).slice(2)}/${String(y+1).slice(2)}` : `${String(y-1).slice(2)}/${String(y).slice(2)}`;
}
const CURRENT_EXERCISE = getCurrentExerciseLabel();

const ripartiRata = (tot: number) => {
  const m = 3.394 + 0.576 + 0.059;
  return {
    casa: parseFloat((tot*3.394/m).toFixed(2)),
    box:  parseFloat((tot*0.576/m).toFixed(2)),
    cantina: parseFloat((tot*0.059/m).toFixed(2)),
  };
};

const annoFromDate = (d: string) => {
  if (!d) return '';
  const dt = new Date(d), m = dt.getMonth()+1, y = dt.getFullYear();
  return m >= 10 ? `${String(y).slice(2)}/${String(y+1).slice(2)}` : `${String(y-1).slice(2)}/${String(y).slice(2)}`;
};

// ── Sezione collassabile ──────────────────────────────────────
function Section({ title, badge, defaultOpen = false, accent = false, children }: {
  title: string; badge?: string; defaultOpen?: boolean; accent?: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{
      background: accent ? '#fffdf5' : 'var(--card)',
      border: `1.5px solid ${accent ? '#fde68a' : 'var(--border)'}`,
      borderRadius: 14, overflow: 'hidden',
    }}>
      <button onClick={() => setOpen(v => !v)} style={{
        width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '12px 16px', background: 'transparent', border: 'none',
        cursor: 'pointer', fontFamily: 'var(--font-body)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
          {accent && <Star size={11} fill="#b45309" color="#b45309"/>}
          <span style={{ fontWeight: 700, fontSize: 14, color: accent ? '#b45309' : 'var(--text)' }}>{title}</span>
          {badge && (
            <span style={{ fontSize: 11, fontWeight: 700,
              color: accent ? '#92400e' : 'var(--text3)',
              background: accent ? '#fde68a' : 'var(--bg3)',
              borderRadius: 20, padding: '1px 7px' }}>
              {badge}
            </span>
          )}
        </div>
        <ChevronDown size={15} color="var(--text3)"
          style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }}/>
      </button>
      {open && <div style={{ padding: '0 16px 14px' }}>{children}</div>}
    </div>
  );
}

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [lastYear, setLastYear]   = useState<any>(null);
  const [prevYear, setPrevYear]   = useState<any>(null);
  const [rates, setRates]         = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [saving, setSaving]       = useState(false);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: years }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }).limit(6),
    ]);
    const curr = years?.find(y => y.year_label === CURRENT_EXERCISE) || years?.[0] || null;
    const prev = years?.find(y => y.year_label !== curr?.year_label) || null;
    setLastYear(curr); setPrevYear(prev); setRates(ratesData || []);
    setLoading(false);
  };

  const saveRate = async () => {
    const tot = parseFloat(form.importo);
    if (!tot || isNaN(tot)) return;
    setSaving(true);
    const yl = annoFromDate(form.data);
    const { count } = await supabase.from('rate_pagamenti')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', property.id).eq('year_label', yl);
    const { casa, box, cantina } = ripartiRata(tot);
    await supabase.from('rate_pagamenti').insert({
      property_id: property.id, year_label: yl,
      numero_rata: `Rata ${(count||0)+1}`,
      data_pagamento: form.data,
      importo_casa: casa, importo_box: box, importo_cantina: cantina,
      descrizione: form.nota,
    });
    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false); setSaving(false); load();
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', padding:60, color:'var(--text3)' }}>
      Caricamento...
    </div>
  );

  // Saldo totale unico (somma tutte le unità)
  const sTot = lastYear
    ? calcSaldo(lastYear.balance_start_casa,     lastYear.rates_paid_casa,     lastYear.spese_totali_casa    ||0)
    + calcSaldo(lastYear.balance_start_box,      lastYear.rates_paid_box,      lastYear.spese_totali_box     ||0)
    + calcSaldo(lastYear.balance_start_cantina,  lastYear.rates_paid_cantina,  lastYear.spese_totali_cantina ||0)
    : null;

  const pTot = prevYear
    ? calcSaldo(prevYear.balance_start_casa,     prevYear.rates_paid_casa,     prevYear.spese_totali_casa    ||0)
    + calcSaldo(prevYear.balance_start_box,      prevYear.rates_paid_box,      prevYear.spese_totali_box     ||0)
    + calcSaldo(prevYear.balance_start_cantina,  prevYear.rates_paid_cantina,  prevYear.spese_totali_cantina ||0)
    : null;

  const rateCorrente = rates.filter(r => r.year_label === CURRENT_EXERCISE);
  const totRateAnno  = rateCorrente.reduce((s, r) =>
    s + (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0), 0);

  const preview   = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);

  const saldoPct = (sTot !== null && pTot !== null && pTot !== 0)
    ? ((sTot - pTot) / Math.abs(pTot)) * 100 : null;

  const isCurrent = lastYear?.year_label === CURRENT_EXERCISE;
  const isPositive = sTot !== null && sTot >= 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>

      {/* ── Hero card saldo ───────────────────────────────────── */}
      <div style={{
        background: sTot !== null
          ? (isPositive
              ? 'linear-gradient(140deg, #16803c 0%, #1ea84e 100%)'
              : 'linear-gradient(140deg, #b91c1c 0%, #dc2626 100%)')
          : 'var(--bg3)',
        borderRadius: 20, padding: '20px 20px 18px', color: '#fff',
        boxShadow: sTot !== null
          ? (isPositive ? '0 6px 24px rgba(22,128,60,0.3)' : '0 6px 24px rgba(185,28,28,0.3)')
          : 'none',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p style={{ fontSize: 10, opacity: 0.7, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 3 }}>
              Via Pitteri 93 · Lambrate
            </p>
            <p style={{ fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-display)' }}>
              App C63 + Box 13 + Cantina
            </p>
          </div>
          <div style={{ textAlign: 'right', flexShrink: 0 }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4,
              background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '3px 10px' }}>
              {isCurrent && <Star size={9} fill="#fde68a" color="#fde68a"/>}
              <span style={{ fontSize: 12, fontWeight: 700 }}>
                {lastYear?.year_label || CURRENT_EXERCISE}
              </span>
            </div>
            {isCurrent && <p style={{ fontSize: 9, opacity: 0.65, marginTop: 3, textAlign: 'center' }}>in corso</p>}
          </div>
        </div>

        {/* Saldo */}
        {sTot !== null ? (
          <>
            <p style={{ fontSize: 10, opacity: 0.65, marginBottom: 3, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Saldo esercizio
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 14, flexWrap: 'wrap' }}>
              <p style={{ fontSize: 40, fontWeight: 900, fontFamily: 'var(--font-display)', lineHeight: 1, letterSpacing: '-1.5px' }}>
                {sTot >= 0 ? '+' : '-'}€{f0(Math.abs(sTot))}
              </p>
              {saldoPct !== null && prevYear && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, paddingBottom: 4 }}>
                  {sTot > pTot! ? <TrendingUp size={13} style={{ opacity: 0.85 }}/> : <TrendingDown size={13} style={{ opacity: 0.85 }}/>}
                  <span style={{ fontSize: 13, fontWeight: 800, opacity: 0.9 }}>
                    {saldoPct > 0 ? '+' : ''}{saldoPct.toFixed(1)}%
                  </span>
                  <span style={{ fontSize: 10, opacity: 0.6 }}>vs {prevYear.year_label}</span>
                </div>
              )}
            </div>
            <p style={{ fontSize: 11, opacity: 0.6, marginTop: 6 }}>
              {sTot >= 0 ? '▲ credito verso il condominio' : '▼ debito verso il condominio'}
            </p>
          </>
        ) : (
          <p style={{ opacity: 0.7, fontSize: 14, marginTop: 4 }}>Nessun rendiconto inserito</p>
        )}

        {/* Pill rate */}
        {totRateAnno > 0 && (
          <div style={{ marginTop: 14, display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(255,255,255,0.15)', borderRadius: 20, padding: '5px 12px' }}>
            <CreditCard size={11}/>
            <span style={{ fontSize: 11, fontWeight: 700 }}>
              {CURRENT_EXERCISE} · €{f0(totRateAnno)} ({rateCorrente.length} {rateCorrente.length===1?'rata':'rate'})
            </span>
          </div>
        )}
      </div>

      {/* ── Pulsante / Form pagamento ──────────────────────────── */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{
          width: '100%', background: 'var(--accent)', color: '#fff',
          borderRadius: 13, padding: '12px 18px',
          display: 'flex', alignItems: 'center', gap: 12,
          boxShadow: '0 2px 10px rgba(22,128,60,0.2)',
          border: 'none', cursor: 'pointer', fontFamily: 'var(--font-body)',
        }}>
          <div style={{ background: 'rgba(255,255,255,0.18)', borderRadius: 8, padding: 7, display: 'flex', flexShrink: 0 }}>
            <CreditCard size={17} color="#fff"/>
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 14, color: '#fff' }}>Registra pagamento</p>
            <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.72)', marginTop: 1 }}>
              Esercizio {CURRENT_EXERCISE}
              {totRateAnno > 0 ? ` · €${f0(totRateAnno)} finora` : ' · nessuna rata'}
            </p>
          </div>
          <Plus size={17} color="rgba(255,255,255,0.8)"/>
        </button>
      ) : (
        <div className="card" style={{ border: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17 }}>Nuovo pagamento</p>
            <button onClick={() => setShowForm(false)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
              <X size={17}/>
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
            <div>
              <label>Importo totale (€)</label>
              <input type="number" step="0.01" placeholder="413.50" value={form.importo}
                onChange={e => setForm(p => ({ ...p, importo: e.target.value }))}
                style={{ fontSize: 28, fontWeight: 800, textAlign: 'center', padding: '12px' }} autoFocus/>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 10, alignItems: 'end' }}>
              <div>
                <label>Data</label>
                <input type="date" value={form.data} onChange={e => setForm(p => ({ ...p, data: e.target.value }))}/>
              </div>
              <div style={{ padding: '11px 12px', background: 'var(--bg3)', borderRadius: 10,
                border: '1.5px solid var(--border2)', textAlign: 'center', minWidth: 72 }}>
                <p style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 2 }}>Eserc.</p>
                <p style={{ fontWeight: 800, color: ylPreview === CURRENT_EXERCISE ? '#b45309' : 'var(--text)', fontSize: 14 }}>
                  {ylPreview || '—'}{ylPreview === CURRENT_EXERCISE && ' ★'}
                </p>
              </div>
            </div>
            {preview && (
              <div style={{ background: 'var(--accent-light)', borderRadius: 10, padding: '9px 12px' }}>
                <p style={{ fontSize: 10, color: 'var(--accent)', fontWeight: 700, marginBottom: 6 }}>Ripartizione per millesimi</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 6 }}>
                  {([['App C63', preview.casa], ['Box 13', preview.box], ['Cantina', preview.cantina]] as [string,number][]).map(([l,v]) => (
                    <div key={l} style={{ textAlign: 'center', background: '#fff', borderRadius: 7, padding: '6px 4px' }}>
                      <p style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600 }}>{l}</p>
                      <p style={{ fontSize: 13, fontWeight: 800, color: 'var(--accent)' }}>€{fa(v)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div>
              <label>Note (opzionale)</label>
              <input placeholder="Acconto, Conguaglio..." value={form.nota}
                onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}/>
            </div>
            <button className="btn-primary" onClick={saveRate} disabled={saving || !form.importo}
              style={{ width: '100%', justifyContent: 'center', padding: '12px', fontSize: 15 }}>
              {saving ? 'Salvataggio...' : <><Check size={15}/> Salva pagamento</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Ultimi pagamenti (collassabile) ───────────────────── */}
      {rates.length > 0 && (
        <Section
          title="Ultimi pagamenti"
          badge={String(rates.length)}
          defaultOpen={true}
          accent={rateCorrente.length > 0}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {rates.slice(0, 5).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0);
              const isCurrYear = r.year_label === CURRENT_EXERCISE;
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '9px 0',
                  borderBottom: i < Math.min(rates.length, 5) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <CreditCard size={13} color={isCurrYear ? '#b45309' : 'var(--text3)'} style={{ flexShrink: 0 }}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontWeight: 700, fontSize: 13 }}>
                      {r.numero_rata}
                      <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 11 }}> · {r.year_label}</span>
                      {isCurrYear && <span style={{ color: '#b45309', marginLeft: 3 }}>★</span>}
                    </p>
                    <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                      {fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}
                    </p>
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 14, fontFamily: 'var(--font-display)', flexShrink: 0 }}>
                    €{fa(tot)}
                  </p>
                </div>
              );
            })}
            {rates.length > 5 && (
              <button onClick={() => setPage('dati')}
                style={{ background: 'transparent', border: 'none', color: 'var(--accent)',
                  fontSize: 12, fontWeight: 700, padding: '8px 0', cursor: 'pointer', textAlign: 'left' }}>
                Vedi tutti in Dati →
              </button>
            )}
          </div>
        </Section>
      )}

      {/* ── Link sezioni ──────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {([
          { page: 'dati' as Page, Icon: BarChart2, label: 'Dati & Analisi', sub: 'Rendiconto · Spese · Consumi' },
          { page: 'note' as Page, Icon: FileText,  label: 'Note',           sub: 'Appunti · Scadenze' },
        ]).map(({ page, Icon, label, sub }) => (
          <button key={page} onClick={() => setPage(page)} style={{
            display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
            padding: '14px 14px 12px', background: 'var(--bg2)', border: '1px solid var(--border)',
            borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-body)', gap: 8,
          }}>
            <div style={{ background: 'var(--accent-light)', borderRadius: 8, padding: 7, display: 'flex' }}>
              <Icon size={15} color="var(--accent)"/>
            </div>
            <div style={{ textAlign: 'left', flex: 1 }}>
              <p style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{label}</p>
              <p style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{sub}</p>
            </div>
            <ChevronRight size={13} color="var(--text3)" style={{ alignSelf: 'flex-end' }}/>
          </button>
        ))}
      </div>

    </div>
  );
}
