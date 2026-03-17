import { useState, useEffect } from 'react';
import { getExerciseYears, getFixedExpenses, getConsumptionData } from '../lib/db';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData } from '../types';
import type { Page } from '../App';
import { TrendingUp, TrendingDown, Euro, Droplets, Flame, CalendarRange, ArrowRight } from 'lucide-react';

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

  const totaleSaldoFinale = lastYear
    ? (lastYear.balance_start_casa + lastYear.rates_paid_casa) +
      (lastYear.balance_start_box + lastYear.rates_paid_box) +
      (lastYear.balance_start_cantina + lastYear.rates_paid_cantina) -
      ((lastFixed?.prop_casa || 0) + (lastFixed?.gen_prop_casa || 0)) -
      ((lastConsumo?.totale_casa || 0))
    : null;

  const speseTot = lastFixed
    ? (lastFixed.prop_casa + lastFixed.prop_box + lastFixed.prop_cantina +
       lastFixed.gen_prop_casa + lastFixed.gen_prop_box + lastFixed.gen_prop_cantina)
    : 0;

  const prevSpeseTot = prevFixed
    ? (prevFixed.prop_casa + prevFixed.prop_box + prevFixed.prop_cantina +
       prevFixed.gen_prop_casa + prevFixed.gen_prop_box + prevFixed.gen_prop_cantina)
    : 0;

  const deltaPct = prevSpeseTot ? ((speseTot - prevSpeseTot) / prevSpeseTot * 100) : 0;

  return (
    <div style={{ padding: '20px 16px', display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Hero */}
      <div style={{ background: 'linear-gradient(135deg, #1e1e35, #252550)', border: '1px solid var(--border)', borderRadius: 20, padding: '24px 20px', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: -30, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'var(--accent)', opacity: 0.05 }} />
        <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 4 }}>Immobile</p>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, marginBottom: 4 }}>{property.name}</h1>
        {property.address && <p style={{ color: 'var(--text2)', fontSize: 13 }}>{property.address}</p>}
        {lastYear && (
          <div style={{ marginTop: 16, display: 'flex', gap: 16 }}>
            <div>
              <p style={{ color: 'var(--text2)', fontSize: 11 }}>Esercizio corrente</p>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: 'var(--accent)' }}>{lastYear.year_label}</p>
            </div>
          </div>
        )}
      </div>

      {/* KPI Row */}
      {years.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <KpiCard
            label="Spese condominiali"
            value={lastFixed ? `€ ${fmt(lastFixed.prop_casa + lastFixed.gen_prop_casa)}` : '—'}
            sub={lastFixed?.year_label}
            delta={deltaPct}
            icon={<Euro size={16} />}
          />
          <KpiCard
            label="Consumi casa"
            value={lastConsumo ? `€ ${fmt(lastConsumo.totale_casa)}` : '—'}
            sub={lastConsumo?.year_label}
            icon={<Droplets size={16} />}
          />
          <KpiCard
            label="Riscaldamento"
            value={lastConsumo ? `€ ${fmt(lastConsumo.riscaldamento_consumo)}` : '—'}
            sub="a consumo"
            icon={<Flame size={16} />}
          />
          <KpiCard
            label="Anni registrati"
            value={String(years.length)}
            sub={`${years[0]?.year_label} → ${lastYear?.year_label}`}
            icon={<CalendarRange size={16} />}
          />
        </div>
      )}

      {/* Ultimo saldo */}
      {lastYear && (
        <div className="card">
          <p style={{ color: 'var(--text2)', fontSize: 12, marginBottom: 12 }}>Saldo finale {lastYear.year_label}</p>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            {[
              { label: 'Casa', v: lastYear.balance_start_casa + lastYear.rates_paid_casa },
              { label: 'Box', v: lastYear.balance_start_box + lastYear.rates_paid_box },
              { label: 'Cantina', v: lastYear.balance_start_cantina + lastYear.rates_paid_cantina },
            ].map(({ label, v }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <p style={{ color: 'var(--text2)', fontSize: 11 }}>{label}</p>
                <p style={{ fontSize: 16, fontWeight: 600, color: v >= 0 ? 'var(--green)' : 'var(--red)' }}>€ {fmt(v)}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Shortcuts */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <p style={{ color: 'var(--text2)', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1 }}>Accesso rapido</p>
        {[
          { page: 'esercizi' as Page, label: 'Esercizi annuali', desc: 'Saldi e rate versate' },
          { page: 'spese-fisse' as Page, label: 'Spese fisse', desc: 'Proprietà, scale, ascensore' },
          { page: 'consumi' as Page, label: 'Consumi', desc: 'Acqua, riscaldamento, energia' },
          { page: 'grafici' as Page, label: 'Grafici storici', desc: 'Trend e variazioni' },
        ].map(({ page, label, desc }) => (
          <button key={page} onClick={() => setPage(page)} style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', background: 'var(--card)', border: '1px solid var(--border)',
            borderRadius: 12, color: 'var(--text)', fontFamily: 'var(--font-body)', textAlign: 'left',
          }}>
            <div>
              <p style={{ fontWeight: 500, fontSize: 14 }}>{label}</p>
              <p style={{ color: 'var(--text2)', fontSize: 12, marginTop: 2 }}>{desc}</p>
            </div>
            <ArrowRight size={16} color="var(--text3)" />
          </button>
        ))}
      </div>

      {years.length === 0 && (
        <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text2)' }}>
          <p style={{ marginBottom: 12 }}>Nessun dato ancora. Inizia aggiungendo un anno.</p>
          <button className="btn-primary" onClick={() => setPage('esercizi')}>Aggiungi primo anno</button>
        </div>
      )}
    </div>
  );
}

function KpiCard({ label, value, sub, delta, icon }: { label: string; value: string; sub?: string; delta?: number; icon: React.ReactNode }) {
  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text3)' }}>{icon}</span>
        {delta !== undefined && delta !== 0 && (
          <span style={{ display: 'flex', alignItems: 'center', gap: 3, fontSize: 11, color: delta > 0 ? 'var(--red)' : 'var(--green)' }}>
            {delta > 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
            {Math.abs(delta).toFixed(1)}%
          </span>
        )}
      </div>
      <p style={{ fontSize: 20, fontWeight: 600, fontFamily: 'var(--font-display)' }}>{value}</p>
      <p style={{ color: 'var(--text2)', fontSize: 11 }}>{label}</p>
      {sub && <p style={{ color: 'var(--text3)', fontSize: 10 }}>{sub}</p>}
    </div>
  );
}

function Loader() {
  return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;
}
