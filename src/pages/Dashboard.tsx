import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ChevronRight, TrendingUp, TrendingDown, AlertCircle, Calendar, ArrowRight } from 'lucide-react';

// ── utils ──────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';

const MILL = { casa: 3.394, box: 0.576, cantina: 0.059 };
const MILL_TOT = MILL.casa + MILL.box + MILL.cantina;

const PV = {
  prop: 52129.06 * 3.394 / 1000, gen: 149737.47 * 3.394 / 1000,
  man: 10000.00 * 3.394 / 1000, scalac: 4500.00 * 20.288 / 1000,
  asc: 3802.22 * 20.288 / 1000, tele: 5054.50 * 3.394 / 1000,
  risc_inv: 35349.04 * 3.394 / 1000, acs_inv: 31638.80 * 3.394 / 1000,
};
const SPESE_FISSE_STIMATE_2526 = Object.values(PV).reduce((s, v) => s + v, 0);

const annoFromDate = (d: string): string => {
  if (!d) return '';
  const dt = new Date(d), m = dt.getMonth() + 1, y = dt.getFullYear();
  return m >= 10 ? `${String(y).slice(2)}/${String(y+1).slice(2)}` : `${String(y-1).slice(2)}/${String(y).slice(2)}`;
};

const esercizioCorrente = () => annoFromDate(new Date().toISOString().split('T')[0]);

const ripartiRata = (tot: number) => ({
  casa:    parseFloat((tot * MILL.casa    / MILL_TOT).toFixed(2)),
  box:     parseFloat((tot * MILL.box     / MILL_TOT).toFixed(2)),
  cantina: parseFloat((tot * MILL.cantina / MILL_TOT).toFixed(2)),
});

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [allYears, setAllYears] = useState<any[]>([]);
  const [rates,    setRates]    = useState<any[]>([]);
  const [loading,  setLoading]  = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [saving,   setSaving]   = useState(false);
  const [form, setForm] = useState({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });

  const annoCorrente = esercizioCorrente();

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: years }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }).limit(6),
    ]);
    setAllYears(years || []);
    setRates(ratesData || []);
    setLoading(false);
  };

  const saveRate = async () => {
    const tot = parseFloat(form.importo);
    if (!tot || isNaN(tot)) return;
    setSaving(true);
    const yl = annoFromDate(form.data);
    const { casa, box, cantina } = ripartiRata(tot);
    const esisteEsercizio = allYears.some((y: any) => y.year_label === yl);
    if (!esisteEsercizio) {
      const speseFisse = yl === '25/26' ? SPESE_FISSE_STIMATE_2526 : 0;
      await supabase.from('exercise_years').insert({
        property_id: property.id, year_label: yl,
        balance_start_casa: 0, balance_start_box: 0, balance_start_cantina: 0,
        rates_paid_casa: 0, rates_paid_box: 0, rates_paid_cantina: 0,
        spese_totali_casa: speseFisse, spese_totali_box: 0, spese_totali_cantina: 0,
      });
    }
    const { count } = await supabase.from('rate_pagamenti').select('*', { count: 'exact', head: true }).eq('property_id', property.id).eq('year_label', yl);
    await supabase.from('rate_pagamenti').insert({
      property_id: property.id, year_label: yl,
      numero_rata: `Rata ${(count || 0) + 1}`,
      data_pagamento: form.data, importo_casa: casa, importo_box: box, importo_cantina: cantina, descrizione: form.nota,
    });
    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Caricamento...</div>;

  // Calcoli
  const rateCorrente = rates.filter(r => r.year_label === annoCorrente);
  const totRateAnno = rateCorrente.reduce((s: number, r: any) =>
    s + (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0), 0);
  const speseStimate = annoCorrente === '25/26' ? SPESE_FISSE_STIMATE_2526 : (allYears.find(y => y.year_label === annoCorrente)?.spese_totali_casa || 0);
  const saldoStimato = totRateAnno - speseStimate;
  const copertura = speseStimate > 0 ? Math.min(100, totRateAnno / speseStimate * 100) : 0;

  const annoPrecedente = allYears.find((y: any) => y.year_label !== annoCorrente);
  const totRateAnnoPrecedente = annoPrecedente
    ? (annoPrecedente.rates_paid_casa || 0) + (annoPrecedente.rates_paid_box || 0) + (annoPrecedente.rates_paid_cantina || 0)
    : null;

  const preview = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);
  const esercizioPreviewNuovo = !allYears.some((y: any) => y.year_label === ylPreview);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* ── HERO HEADER ── */}
      <div style={{
        background: 'linear-gradient(135deg, #16803c 0%, #0f5c2a 100%)',
        borderRadius: 20,
        padding: '22px 20px 20px',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Decorazione di sfondo */}
        <div style={{
          position: 'absolute', top: -30, right: -30,
          width: 140, height: 140, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)',
        }} />
        <div style={{
          position: 'absolute', bottom: -20, right: 40,
          width: 80, height: 80, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)',
        }} />

        <div style={{ position: 'relative' }}>
          {/* Anno esercizio */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.6)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
              Cohabitat Lambrate · Via Pitteri 93
            </span>
            <div style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.25)',
              borderRadius: 20, padding: '4px 12px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#4ade80' }} />
              <span style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>Esercizio {annoCorrente}</span>
            </div>
          </div>

          {/* Saldo principale */}
          <div style={{ marginBottom: 16 }}>
            <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', marginBottom: 4 }}>
              Saldo previsto a fine esercizio
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 10 }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 800,
                color: '#fff', lineHeight: 1, letterSpacing: '-1px',
              }}>
                {saldoStimato >= 0 ? '+' : '-'}€{f0(Math.abs(saldoStimato))}
              </p>
              <span style={{
                fontSize: 12, fontWeight: 700, padding: '3px 10px', borderRadius: 20,
                background: saldoStimato >= 0 ? 'rgba(74,222,128,0.2)' : 'rgba(248,113,113,0.2)',
                color: saldoStimato >= 0 ? '#4ade80' : '#f87171',
                border: `1px solid ${saldoStimato >= 0 ? 'rgba(74,222,128,0.4)' : 'rgba(248,113,113,0.4)'}`,
              }}>
                {saldoStimato >= 0 ? '▲ credito' : '▼ debito'}
              </span>
            </div>
          </div>

          {/* Mini stats */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>Rate versate</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>€{f0(totRateAnno)}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>{rateCorrente.length} rata{rateCorrente.length !== 1 ? 'e' : ''}</p>
            </div>
            <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 12, padding: '10px 12px' }}>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 3 }}>Spese stimate</p>
              <p style={{ fontSize: 20, fontWeight: 800, color: '#fff', fontFamily: 'var(--font-display)' }}>€{f0(speseStimate)}</p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
                {annoCorrente === '25/26' ? 'dal preventivo' : 'dal rendiconto'}
              </p>
            </div>
          </div>

          {/* Barra copertura */}
          {speseStimate > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>Copertura spese</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: copertura >= 100 ? '#4ade80' : 'rgba(255,255,255,0.8)' }}>
                  {Math.round(copertura)}%
                </span>
              </div>
              <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 6, height: 6 }}>
                <div style={{
                  width: `${copertura}%`, height: '100%',
                  background: copertura >= 100 ? '#4ade80' : 'rgba(255,255,255,0.7)',
                  borderRadius: 6, transition: 'width 0.5s ease',
                }} />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── CONFRONTO ANNO PRECEDENTE ── */}
      {totRateAnnoPrecedente !== null && totRateAnnoPrecedente > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '12px 16px',
        }}>
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>
              Rate versate {annoPrecedente.year_label}
            </p>
            <p style={{ fontWeight: 700, fontSize: 16, color: 'var(--text)' }}>€{f0(totRateAnnoPrecedente)}</p>
          </div>
          {totRateAnno > 0 && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: totRateAnno >= totRateAnnoPrecedente ? 'var(--green-bg)' : 'var(--red-bg)',
              border: `1px solid ${totRateAnno >= totRateAnnoPrecedente ? '#a7f3d0' : '#fecaca'}`,
              borderRadius: 20, padding: '5px 12px',
            }}>
              {totRateAnno >= totRateAnnoPrecedente
                ? <TrendingUp size={13} color="var(--green)" />
                : <TrendingDown size={13} color="var(--red)" />}
              <span style={{ fontSize: 13, fontWeight: 700, color: totRateAnno >= totRateAnnoPrecedente ? 'var(--green)' : 'var(--red)' }}>
                {totRateAnno >= totRateAnnoPrecedente ? '+' : '-'}€{f0(Math.abs(totRateAnno - totRateAnnoPrecedente))}
              </span>
            </div>
          )}
        </div>
      )}

      {/* ── RATA MEDIA ── */}
      {rateCorrente.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'var(--bg2)', border: '1px solid var(--border)',
          borderRadius: 14, padding: '12px 16px',
        }}>
          <div style={{
            background: 'var(--accent-light)', borderRadius: 10,
            width: 38, height: 38, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
          }}>
            <Calendar size={17} color="var(--accent)" />
          </div>
          <div>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Importo medio per rata</p>
            <p style={{ fontWeight: 700, fontSize: 16 }}>
              €{fa(totRateAnno / rateCorrente.length)}
              <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 400, marginLeft: 6 }}>
                · {rateCorrente.length} rata{rateCorrente.length !== 1 ? 'e' : ''} fin qui
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Nessun dato */}
      {totRateAnno === 0 && (
        <div style={{
          background: 'var(--amber-bg)', border: '1px solid #fde68a',
          borderRadius: 14, padding: '14px 16px',
          display: 'flex', alignItems: 'center', gap: 10,
        }}>
          <AlertCircle size={16} color="var(--amber)" />
          <p style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>
            Nessun dato per l'esercizio {annoCorrente}. Registra la prima rata.
          </p>
        </div>
      )}

      {/* ── REGISTRA PAGAMENTO ── */}
      {!showForm ? (
        <button onClick={() => setShowForm(true)} style={{
          width: '100%', borderRadius: 16, padding: '16px 20px',
          background: '#fff', border: '2px solid var(--accent)',
          display: 'flex', alignItems: 'center', gap: 14,
          cursor: 'pointer', fontFamily: 'var(--font-body)',
          boxShadow: '0 2px 8px rgba(22,128,60,0.1)',
          transition: 'all 0.15s',
        }}>
          <div style={{
            background: 'var(--accent)', borderRadius: 11,
            width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            boxShadow: '0 2px 8px rgba(22,128,60,0.3)',
          }}>
            <CreditCard size={20} color="#fff" />
          </div>
          <div style={{ textAlign: 'left', flex: 1 }}>
            <p style={{ fontWeight: 800, fontSize: 16, color: 'var(--accent)' }}>Registra pagamento</p>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
              {totRateAnno > 0 ? `Esercizio ${annoCorrente} · €${f0(totRateAnno)} versati` : 'Inserisci la rata appena pagata'}
            </p>
          </div>
          <Plus size={20} color="var(--accent)" />
        </button>
      ) : (
        <div className="card" style={{ border: '2px solid var(--accent)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 19 }}>Nuovo pagamento</p>
            <button onClick={() => setShowForm(false)} style={{ background: 'transparent', border: 'none', color: 'var(--text3)', cursor: 'pointer', padding: 4 }}>
              <X size={18} />
            </button>
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
            <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 12, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? 10 : 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Esercizio</p>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  {ylPreview || '—'}
                </span>
              </div>
              {esercizioPreviewNuovo && ylPreview && (
                <div style={{ background: '#fff7ed', border: '1px solid #fde68a', borderRadius: 8, padding: '7px 10px', marginBottom: 8, display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <AlertCircle size={13} color="var(--amber)" style={{ flexShrink: 0, marginTop: 1 }} />
                  <p style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                    Nuovo esercizio {ylPreview}: verrà creato automaticamente{ylPreview === '25/26' ? ' con spese stimate.' : '.'}
                  </p>
                </div>
              )}
              {preview ? (
                <div className="grid3">
                  {([['App C63', preview.casa], ['Box 13', preview.box], ['Cantina', preview.cantina]] as [string, number][]).map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '8px 4px' }}>
                      <p style={{ fontSize: 10, color: 'var(--text2)', fontWeight: 600, marginBottom: 2 }}>{l}</p>
                      <p style={{ fontSize: 14, fontWeight: 800, color: 'var(--accent)' }}>€{fa(v)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--accent)', opacity: 0.7 }}>Ripartizione per millesimi automatica</p>
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

      {/* ── ULTIMI PAGAMENTI ── */}
      {rates.length > 0 && (
        <div>
          <p className="section-label">Ultimi pagamenti</p>
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, overflow: 'hidden' }}>
            {rates.slice(0, 4).map((r: any, i: number) => {
              const tot = (parseFloat(r.importo_casa)||0) + (parseFloat(r.importo_box)||0) + (parseFloat(r.importo_cantina)||0);
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                  borderBottom: i < 3 && i < rates.length - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: 'var(--accent-light)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <CreditCard size={15} color="var(--accent)" />
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
                  <p style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-display)' }}>€{fa(tot)}</p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LINK SEZIONI ── */}
      <div>
        <p className="section-label">Sezioni</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            { page: 'dati' as Page, title: 'Dati e analisi', sub: 'Rendiconto · Spese · Consumi · Grafici storici' },
            { page: 'note' as Page, title: 'Note e scadenze', sub: 'Appunti · Comunicazioni SSA' },
          ]).map(({ page, title, sub }) => (
            <button key={page} onClick={() => setPage(page)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: 'var(--bg2)', border: '1px solid var(--border)',
              borderRadius: 14, cursor: 'pointer', fontFamily: 'var(--font-body)',
            }}>
              <div style={{ textAlign: 'left' }}>
                <p style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{title}</p>
                <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>{sub}</p>
              </div>
              <ArrowRight size={18} color="var(--text3)" />
            </button>
          ))}
        </div>
      </div>

    </div>
  );
}
