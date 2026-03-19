import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Property } from '../types';
import type { Page } from '../App';
import { Plus, Check, X, CreditCard, ChevronRight, TrendingUp, TrendingDown, AlertCircle, Calendar } from 'lucide-react';

// ── utils ──────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';

// Millesimi
const MILL = { casa: 3.394, box: 0.576, cantina: 0.059 };
const MILL_TOT = MILL.casa + MILL.box + MILL.cantina;

// Preventivo 25/26 spese fisse stimate App C63
const PREV_2526_FISSE = 176.56 + 508.36 + 33.94 + 91.30 + 77.16 + 17.16 + 119.97 + 107.39; // ~1332 circa

// Calcola l'anno esercizio da una data
// Esercizio va dal 01/10 al 30/09 dell'anno successivo
// es: 01/10/2025 → 25/26 ; 30/09/2026 → 25/26 ; 01/10/2026 → 26/27
const annoFromDate = (d: string): string => {
  if (!d) return '';
  const dt = new Date(d);
  const m = dt.getMonth() + 1; // 1-12
  const y = dt.getFullYear();
  if (m >= 10) {
    return `${String(y).slice(2)}/${String(y + 1).slice(2)}`;
  } else {
    return `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
  }
};

// Esercizio corrente basato su oggi
const esercizioCorrente = (): string => {
  return annoFromDate(new Date().toISOString().split('T')[0]);
};

const ripartiRata = (tot: number) => ({
  casa:    parseFloat((tot * MILL.casa    / MILL_TOT).toFixed(2)),
  box:     parseFloat((tot * MILL.box     / MILL_TOT).toFixed(2)),
  cantina: parseFloat((tot * MILL.cantina / MILL_TOT).toFixed(2)),
});

// Preventivo 25/26 per App C63 (spese fisse annue stimate)
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

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [lastYear,    setLastYear]    = useState<any>(null);
  const [rates,       setRates]       = useState<any[]>([]);
  const [allYears,    setAllYears]    = useState<any[]>([]);
  const [loading,     setLoading]     = useState(true);
  const [showForm,    setShowForm]    = useState(false);
  const [saving,      setSaving]      = useState(false);
  const [form, setForm] = useState({
    importo: '',
    data: new Date().toISOString().split('T')[0],
    nota: '',
  });

  const annoCorrente = esercizioCorrente();

  useEffect(() => { load(); }, [property.id]);

  const load = async () => {
    const [{ data: years }, { data: ratesData }] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id', property.id).order('year_label', { ascending: false }),
      supabase.from('rate_pagamenti').select('*').eq('property_id', property.id).order('data_pagamento', { ascending: false }).limit(5),
    ]);
    setAllYears(years || []);
    // Cerca l'anno corrente
    const curr = (years || []).find((y: any) => y.year_label === annoCorrente);
    setLastYear(curr || null);
    setRates(ratesData || []);
    setLoading(false);
  };

  const saveRate = async () => {
    const tot = parseFloat(form.importo);
    if (!tot || isNaN(tot)) return;
    setSaving(true);

    const yl = annoFromDate(form.data);
    const { casa, box, cantina } = ripartiRata(tot);

    // Controlla se esiste già l'esercizio per questo anno
    const esisteEsercizio = allYears.some((y: any) => y.year_label === yl);

    if (!esisteEsercizio) {
      // Crea automaticamente l'esercizio con spese stimate se è 25/26
      const speseFisse = yl === '25/26' ? SPESE_FISSE_STIMATE_2526 : 0;
      await supabase.from('exercise_years').insert({
        property_id: property.id,
        year_label: yl,
        balance_start_casa: 0,
        balance_start_box: 0,
        balance_start_cantina: 0,
        rates_paid_casa: 0,
        rates_paid_box: 0,
        rates_paid_cantina: 0,
        spese_totali_casa: speseFisse,
        spese_totali_box: 0,
        spese_totali_cantina: 0,
      });
    }

    // Conta le rate esistenti per questo anno
    const { count } = await supabase
      .from('rate_pagamenti')
      .select('*', { count: 'exact', head: true })
      .eq('property_id', property.id)
      .eq('year_label', yl);

    await supabase.from('rate_pagamenti').insert({
      property_id: property.id,
      year_label: yl,
      numero_rata: `Rata ${(count || 0) + 1}`,
      data_pagamento: form.data,
      importo_casa: casa,
      importo_box: box,
      importo_cantina: cantina,
      descrizione: form.nota,
    });

    setForm({ importo: '', data: new Date().toISOString().split('T')[0], nota: '' });
    setShowForm(false);
    setSaving(false);
    load();
  };

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text3)' }}>Caricamento...</div>;

  // ── Calcoli esercizio corrente ──────────────────────────────
  const rateCorrente = rates.filter(r => r.year_label === annoCorrente);
  const totRateAnno = rateCorrente.reduce((s: number, r: any) =>
    s + (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0), 0);

  // Spese stimate per l'anno corrente (dal preventivo se 25/26, altrimenti dal rendiconto)
  const speseStimate = annoCorrente === '25/26'
    ? SPESE_FISSE_STIMATE_2526
    : lastYear?.spese_totali_casa || 0;

  // Saldo stimato = rate versate - spese stimate
  const saldoStimato = totRateAnno - speseStimate;

  // Anno precedente per confronto
  const annoPrecedente = allYears.find((y: any) => y.year_label !== annoCorrente);
  const totRateAnnoPrecedente = annoPrecedente
    ? (annoPrecedente.rates_paid_casa || 0) + (annoPrecedente.rates_paid_box || 0) + (annoPrecedente.rates_paid_cantina || 0)
    : null;

  // Preview ripartizione
  const preview = form.importo && parseFloat(form.importo) > 0 ? ripartiRata(parseFloat(form.importo)) : null;
  const ylPreview = annoFromDate(form.data);
  const esercizioPreviewNuovo = !allYears.some((y: any) => y.year_label === ylPreview);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {/* ── Intestazione ── */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', paddingTop: 4 }}>
        <div>
          <p style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3 }}>
            Cohabitat Lambrate · Via Pitteri 93
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 800, color: 'var(--text)', lineHeight: 1.1 }}>
            App C63 · Box 13 · Cant.10
          </h1>
        </div>
        <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '6px 14px', textAlign: 'center', flexShrink: 0 }}>
          <p style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Esercizio</p>
          <p style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)' }}>{annoCorrente}</p>
        </div>
      </div>

      {/* ── Analisi rapida esercizio corrente ── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="section-label">Analisi esercizio {annoCorrente}</p>

        {/* Rate versate vs spese stimate */}
        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14, padding: '16px 18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>Rate versate</p>
              <p style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--accent)', lineHeight: 1 }}>
                €{f0(totRateAnno)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {rateCorrente.length} rata{rateCorrente.length !== 1 ? 'e' : ''} pagate
              </p>
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>Spese stimate</p>
              <p style={{ fontSize: 28, fontWeight: 800, fontFamily: 'var(--font-display)', color: 'var(--text)', lineHeight: 1 }}>
                €{f0(speseStimate)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 4 }}>
                {annoCorrente === '25/26' ? 'dal preventivo' : 'dal rendiconto'}
              </p>
            </div>
          </div>

          {/* Barra progressione */}
          {speseStimate > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text3)', marginBottom: 4 }}>
                <span>Copertura spese</span>
                <span>{Math.min(100, Math.round(totRateAnno / speseStimate * 100))}%</span>
              </div>
              <div style={{ background: 'var(--bg3)', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, totRateAnno / speseStimate * 100)}%`,
                  height: '100%',
                  background: totRateAnno >= speseStimate ? 'var(--green)' : 'var(--accent)',
                  borderRadius: 6,
                  transition: 'width 0.4s',
                }} />
              </div>
            </div>
          )}

          {/* Saldo stimato */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px',
            background: saldoStimato >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
            border: `1px solid ${saldoStimato >= 0 ? '#a7f3d0' : '#fecaca'}`,
            borderRadius: 10,
          }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: saldoStimato >= 0 ? 'var(--green)' : 'var(--red)' }}>
              Saldo previsto a fine esercizio
            </span>
            <span style={{ fontSize: 18, fontWeight: 800, fontFamily: 'var(--font-display)', color: saldoStimato >= 0 ? 'var(--green)' : 'var(--red)' }}>
              {saldoStimato >= 0 ? '+' : '-'}€{fa(saldoStimato)}
            </span>
          </div>
        </div>

        {/* Confronto anno precedente */}
        {totRateAnnoPrecedente !== null && totRateAnnoPrecedente > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 2 }}>Rate versate {annoPrecedente.year_label}</p>
              <p style={{ fontWeight: 700, fontSize: 16 }}>€{f0(totRateAnnoPrecedente)}</p>
            </div>
            <div style={{ textAlign: 'right' }}>
              {totRateAnno > 0 && (
                <>
                  <p style={{ fontSize: 11, color: 'var(--text3)' }}>vs anno corrente</p>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'flex-end', marginTop: 2 }}>
                    {totRateAnno >= totRateAnnoPrecedente
                      ? <TrendingUp size={14} color="var(--green)" />
                      : <TrendingDown size={14} color="var(--red)" />}
                    <span style={{ fontSize: 14, fontWeight: 700, color: totRateAnno >= totRateAnnoPrecedente ? 'var(--green)' : 'var(--red)' }}>
                      {totRateAnno >= totRateAnnoPrecedente ? '+' : '-'}€{f0(Math.abs(totRateAnno - totRateAnnoPrecedente))}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* Prossima rata stimata */}
        {rateCorrente.length > 0 && (
          <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ background: 'var(--accent-light)', borderRadius: 9, padding: 8 }}>
              <Calendar size={16} color="var(--accent)" />
            </div>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 1 }}>Importo medio per rata</p>
              <p style={{ fontWeight: 700, fontSize: 15 }}>
                €{fa(totRateAnno / rateCorrente.length)} · {rateCorrente.length} rata{rateCorrente.length !== 1 ? 'e' : ''} fin qui
              </p>
            </div>
          </div>
        )}

        {/* Nessun dato per l'anno corrente */}
        {!lastYear && totRateAnno === 0 && (
          <div style={{ background: 'var(--amber-bg)', border: '1px solid #fde68a', borderRadius: 12, padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 10 }}>
            <AlertCircle size={16} color="var(--amber)" />
            <p style={{ fontSize: 13, color: 'var(--amber)', fontWeight: 600 }}>
              Nessun dato per l'esercizio {annoCorrente}. Registra la prima rata per iniziare.
            </p>
          </div>
        )}
      </div>

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
                {totRateAnno > 0
                  ? `Esercizio ${annoCorrente} · €${f0(totRateAnno)} versati finora`
                  : 'Inserisci la rata appena pagata'}
              </p>
            </div>
            <Plus size={20} color="rgba(255,255,255,0.8)" />
          </button>
        </div>
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
              <input
                type="number" step="0.01" placeholder="es. 413.50"
                value={form.importo}
                onChange={e => setForm(p => ({ ...p, importo: e.target.value }))}
                style={{ fontSize: 24, fontWeight: 700, textAlign: 'center', padding: '14px' }}
                autoFocus
              />
            </div>
            <div>
              <label>Data pagamento</label>
              <input
                type="date" value={form.data}
                onChange={e => setForm(p => ({ ...p, data: e.target.value }))}
              />
            </div>

            {/* Anteprima esercizio e ripartizione */}
            <div style={{ background: 'var(--accent-light)', border: '1px solid var(--accent-mid)', borderRadius: 10, padding: '12px 14px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: preview ? 10 : 0 }}>
                <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent)' }}>Esercizio rilevato automaticamente</p>
                <span style={{ fontWeight: 800, fontSize: 15, color: 'var(--accent)', fontFamily: 'var(--font-display)' }}>
                  {ylPreview || '—'}
                </span>
              </div>
              {esercizioPreviewNuovo && ylPreview && (
                <div style={{ background: '#fff', border: '1px solid #fde68a', borderRadius: 8, padding: '8px 10px', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                  <AlertCircle size={13} color="var(--amber)" />
                  <p style={{ fontSize: 12, color: 'var(--amber)', fontWeight: 600 }}>
                    Nuovo esercizio {ylPreview}: verrà creato automaticamente
                    {ylPreview === '25/26' ? ' con spese stimate dal preventivo.' : '.'}
                  </p>
                </div>
              )}
              {preview ? (
                <div className="grid3">
                  {([['App C63', preview.casa], ['Box 13', preview.box], ['Cantina', preview.cantina]] as [string, number][]).map(([l, v]) => (
                    <div key={l} style={{ textAlign: 'center', background: '#fff', borderRadius: 8, padding: '8px 4px' }}>
                      <p style={{ fontSize: 11, color: 'var(--text2)', fontWeight: 600, marginBottom: 3 }}>{l}</p>
                      <p style={{ fontSize: 15, fontWeight: 800, color: 'var(--accent)' }}>€{fa(v)}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: 12, color: 'var(--accent)', opacity: 0.8 }}>
                  Ripartizione per millesimi calcolata automaticamente
                </p>
              )}
            </div>

            <div>
              <label>Note (opzionale)</label>
              <input
                placeholder="es. Acconto, Conguaglio..."
                value={form.nota}
                onChange={e => setForm(p => ({ ...p, nota: e.target.value }))}
              />
            </div>
            <button
              className="btn-primary"
              onClick={saveRate}
              disabled={saving || !form.importo}
              style={{ width: '100%', justifyContent: 'center', padding: '13px', fontSize: 15 }}
            >
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
              const tot = (parseFloat(r.importo_casa) || 0) + (parseFloat(r.importo_box) || 0) + (parseFloat(r.importo_cantina) || 0);
              return (
                <div key={r.id} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px',
                  borderBottom: i < Math.min(rates.length, 4) - 1 ? '1px solid var(--border)' : 'none',
                }}>
                  <CreditCard size={16} color="var(--accent)" />
                  <div style={{ flex: 1 }}>
                    <p style={{ fontWeight: 700, fontSize: 14 }}>
                      {r.numero_rata}
                      <span style={{ color: 'var(--text3)', fontWeight: 400, fontSize: 13 }}> · {r.year_label}</span>
                    </p>
                    <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>
                      {fmtDate(r.data_pagamento)}{r.descrizione ? ` · ${r.descrizione}` : ''}
                    </p>
                  </div>
                  <p style={{ fontWeight: 800, fontSize: 16, fontFamily: 'var(--font-display)', color: 'var(--text)' }}>
                    €{fa(tot)}
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
            { page: 'dati' as Page, title: 'Dati annuali e analisi', sub: 'Rendiconto · Spese · Consumi · Rate · Preventivo' },
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
