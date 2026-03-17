import { useState, useEffect } from 'react';
import { getExerciseYears, getFixedExpenses, getConsumptionData } from '../lib/db';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData } from '../types';
import type { Page } from '../App';
import { TrendingUp, TrendingDown, Euro, Droplets, Flame, ArrowRight, Home, Box, Warehouse } from 'lucide-react';

const fmt = (n: number) => n.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default function Dashboard({ property, setPage }: { property: Property; setPage: (p: Page) => void }) {
  const [years, setYears] = useState<ExerciseYear[]>([]);
  const [fixed, setFixed] = useState<FixedExpenses[]>([]);
  const [consumi, setConsumi] = useState<ConsumptionData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getExerciseYears(property.id),
      getFixedExpenses(property.id),
      getConsumptionData(property.id),
    ]).then(([y, f, c]) => { setYears(y); setFixed(f); setConsumi(c); }).finally(() => setLoading(false));
  }, [property.id]);

  if (loading) return <Loader />;

  const lastYear = years[years.length - 1];
  const lastFixed = fixed[fixed.length - 1];
  const lastConsumo = consumi[consumi.length - 1];
  const prevFixed = fixed[fixed.length - 2];

  const speseFisse = lastFixed ? lastFixed.prop_casa + lastFixed.gen_prop_casa + lastFixed.man_ord_casa + lastFixed.scale_prop_casa + lastFixed.scala_c_casa + lastFixed.asc_c_casa : 0;
  const prevSpeseFisse = prevFixed ? prevFixed.prop_casa + prevFixed.gen_prop_casa + prevFixed.man_ord_casa + prevFixed.scale_prop_casa + prevFixed.scala_c_casa + prevFixed.asc_c_casa : 0;
  const deltaPct = prevSpeseFisse ? ((speseFisse - prevSpeseFisse) / prevSpeseFisse * 100) : 0;

  const saldoCasa = lastYear ? lastYear.balance_start_casa + lastYear.rates_paid_casa : null;
  const saldoBox = lastYear ? lastYear.balance_start_box + lastYear.rates_paid_box : null;
  const saldoCantina = lastYear ? lastYear.balance_start_cantina + lastYear.rates_paid_cantina : null;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

      {/* Intestazione immobile */}
      <div style={{ background: 'var(--accent)', borderRadius: 16, padding: '20px', color: '#fff', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', right: -20, top: -20, width: 100, height: 100, background: 'rgba(255,255,255,0.08)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', right: 20, bottom: -30, width: 80, height: 80, background: 'rgba(255,255,255,0.06)', borderRadius: '50%' }} />
        <p style={{ fontSize: 12, opacity: 0.8, marginBottom: 4, fontWeight: 500 }}>IMMOBILE</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, marginBottom: 2 }}>{property.name}</h1>
        {property.address && <p style={{ fontSize: 13, opacity: 0.75 }}>{property.address}</p>}
        {lastYear && (
          <div style={{ marginTop: 14, display: 'inline-block', background: 'rgba(255,255,255,0.2)', borderRadius: 8, padding: '4px 12px' }}>
            <span style={{ fontSize: 13, fontWeight: 600 }}>Esercizio corrente: {lastYear.year_label}</span>
          </div>
        )}
      </div>

      {/* Saldo finale */}
      {lastYear && (
        <div className="card">
          <p className="section-title">Saldo finale {lastYear.year_label}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
            {[
              { label: 'Casa', val: saldoCasa!, icon: <Home size={14} /> },
              { label: 'Box', val: saldoBox!, icon: <Box size={14} /> },
              { label: 'Cantina', val: saldoCantina!, icon: <Warehouse size={14} /> },
            ].map(({ label, val, icon }) => (
              <div key={label} style={{
                background: val >= 0 ? 'var(--green-bg)' : 'var(--red-bg)',
                border: `1px solid ${val >= 0 ? '#bbf7d0' : '#fecaca'}`,
                borderRadius: 12, padding: '12px 10px', textAlign: 'center'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4, color: 'var(--text2)', marginBottom: 6 }}>
                  {icon}<span style={{ fontSize: 11, fontWeight: 500 }}>{label}</span>
                </div>
                <p style={{ fontSize: 15, fontWeight: 700, color: val >= 0 ? 'var(--green)' : 'var(--red)' }}>
                  {val >= 0 ? '+' : ''}€ {fmt(val)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* KPI */}
      {years.length > 0 && (
        <div className="grid2">
          <KpiCard label="Spese fisse casa" value={lastFixed ? `€ ${fmt(speseFisse)}` : '—'} sub={lastFixed?.year_label} delta={deltaPct} color="var(--accent)" />
          <KpiCard label="Consumi casa" value={lastConsumo ? `€ ${fmt(lastConsumo.totale_casa)}` : '—'} sub={lastConsumo?.year_label} color="#7c3aed" />
          <KpiCard label="Riscaldamento" value={lastConsumo ? `€ ${fmt(lastConsumo.riscaldamento_consumo)}` : '—'} sub="a consumo" color="var(--orange)" />
          <KpiCard label="Anni registrati" value={String(years.length)} sub={`${years[0]?.year_label} → ${lastYear?.year_label}`} color="var(--green)" />
        </div>
      )}

      {/* Navigazione rapida */}
      <div>
        <p className="section-title">Sezioni</p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {([
            { page: 'esercizi' as Page, label: 'Esercizi annuali', desc: 'Saldi e rate versate', color: '#2563eb' },
            { page: 'spese-fisse' as Page, label: 'Spese fisse', desc: 'Proprietà, scale, ascensore', color: '#7c3aed' },
            { page: 'consumi' as Page, label: 'Consumi', desc: 'Acqua, riscaldamento, energia', color: '#0891b2' },
            { page: 'grafici' as Page, label: 'Grafici storici', desc: 'Trend e variazioni anno su anno', color: '#16a34a' },
            { page: 'note' as Page, label: 'Note', desc: 'Appunti, scadenze, comunicazioni', color: '#d97706' },
          ]).map(({ page, label, desc, color }) => (
            <button key={page} onClick={() => setPage(page)} style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '14px 16px', background: '#fff', border: '1px solid var(--border)',
              borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-body)', textAlign: 'left',
              boxShadow: 'var(--shadow)',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ width: 4, height: 36, background: color, borderRadius: 4 }} />
                <div>
                  <p style={{ fontWeight: 600, fontSize: 14 }}>{label}</p>
                  <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>{desc}</p>
                </div>
              </div>
              <ArrowRight size={16} color="var(--text3)" />
            </button>
          ))}
        </div>
      </div>

      {years.length === 0 && (
        <div style={{ textAlign: 'center', padding: '30px 20px', background: '#fff', borderRadius: 16, border: '1px solid var(--border)' }}>
          <p style={{ color: 'var(--text2)', marginBottom: 16 }}>Nessun dato. Inizia aggiungendo un anno di esercizio.</p>
          <button className="btn-primary" onClick={() => setPage('esercizi')}>Aggiungi primo anno</button>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, delta, color }: { label: string; value: string; sub?: string; delta?: number; color: string }) {
  return (
    <div className="card" style={{ borderLeft: `3px solid ${color}` }}>
      <p style={{ fontSize: 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{value}</p>
      <p style={{ fontSize: 12, fontWeight: 500, color: 'var(--text2)' }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{sub}</p>}
      {delta !== undefined && delta !== 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginTop: 6, fontSize: 12, color: delta > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>
          {delta > 0 ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {delta > 0 ? '+' : ''}{delta.toFixed(1)}% vs anno prec.
        </div>
      )}
    </div>
  );
}

function Loader() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;
}
