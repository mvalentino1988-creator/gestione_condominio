import { useState, useEffect } from 'react';
import { getExerciseYears, getFixedExpenses, getConsumptionData } from '../lib/db';
import type { Property } from '../types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const fmt = (n: number) => `€ ${n.toLocaleString('it-IT', { maximumFractionDigits: 0 })}`;

const Tip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: '#fff', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 13, boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>
      <p style={{ fontWeight: 600, marginBottom: 6, color: 'var(--text)' }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, marginTop: 2 }}>{p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}</p>
      ))}
    </div>
  );
};

const tabs = [
  { id: 'spese', label: 'Spese' },
  { id: 'saldo', label: 'Saldo' },
  { id: 'consumi', label: 'Consumi' },
  { id: 'variazioni', label: 'Variazioni %' },
];

export default function ChartsPage({ property }: { property: Property }) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [consumiData, setConsumiData] = useState<any[]>([]);
  const [varData, setVarData] = useState<any[]>([]);
  const [active, setActive] = useState('spese');

  useEffect(() => {
    Promise.all([
      getExerciseYears(property.id),
      getFixedExpenses(property.id),
      getConsumptionData(property.id),
    ]).then(([years, fixed, consumi]) => {
      const allYears = [...new Set([...years.map(y => y.year_label), ...fixed.map(f => f.year_label), ...consumi.map(c => c.year_label)])].sort();

      const merged = allYears.map(yl => {
        const y = years.find(r => r.year_label === yl);
        const f = fixed.find(r => r.year_label === yl);
        const c = consumi.find(r => r.year_label === yl);
        const speseFisse = f ? f.prop_casa + f.gen_prop_casa + f.man_ord_casa + f.scale_prop_casa + f.scala_c_casa + f.asc_c_casa : 0;
        const speseConsumi = c ? c.totale_casa : 0;
        return {
          anno: yl,
          'Spese fisse': speseFisse,
          'Consumi': speseConsumi,
          'Totale': speseFisse + speseConsumi,
          'Saldo casa': y ? y.balance_start_casa + y.rates_paid_casa : 0,
          'Saldo box': y ? y.balance_start_box + y.rates_paid_box : 0,
          'Saldo cantina': y ? y.balance_start_cantina + y.rates_paid_cantina : 0,
        };
      });

      const consumiMerged = allYears.map(yl => {
        const c = consumi.find(r => r.year_label === yl);
        return {
          anno: yl,
          'Riscaldamento': c?.riscaldamento_consumo || 0,
          'Acqua calda': c?.acqua_calda_consumo || 0,
          'Acqua fredda': c?.acqua_potabile || 0,
          'Energia box': c?.energia_elettrica_box || 0,
        };
      });

      // Variazioni % anno su anno
      const varMerged = allYears.slice(1).map((yl, i) => {
        const cur = merged.find(r => r.anno === yl)!;
        const prev = merged.find(r => r.anno === allYears[i])!;
        const pct = (cur: number, prv: number) => prv !== 0 ? parseFloat(((cur - prv) / Math.abs(prv) * 100).toFixed(1)) : 0;
        return {
          anno: yl,
          'Spese fisse %': pct(cur['Spese fisse'], prev['Spese fisse']),
          'Consumi %': pct(cur['Consumi'], prev['Consumi']),
          'Totale %': pct(cur['Totale'], prev['Totale']),
        };
      });

      setChartData(merged);
      setConsumiData(consumiMerged);
      setVarData(varMerged);
    }).finally(() => setLoading(false));
  }, [property.id]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;
  if (chartData.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Nessun dato disponibile.</div>;

  return (
    <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22 }}>Grafici Storici</h2>

      {/* Tabs */}
      <div style={{ display: 'flex', background: 'var(--bg3)', borderRadius: 12, padding: 4, gap: 2 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setActive(t.id)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 9, fontFamily: 'var(--font-body)', fontSize: 13, fontWeight: 500,
            background: active === t.id ? '#fff' : 'transparent',
            color: active === t.id ? 'var(--accent)' : 'var(--text2)',
            boxShadow: active === t.id ? 'var(--shadow)' : 'none',
          }}>{t.label}</button>
        ))}
      </div>

      {active === 'spese' && <>
        <ChartCard title="Spese fisse vs consumi per anno">
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <defs>
                <linearGradient id="gF" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2563eb" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#2563eb" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gC" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Area type="monotone" dataKey="Spese fisse" stroke="#2563eb" fill="url(#gF)" strokeWidth={2.5} dot={{ fill: '#2563eb', r: 3 }} />
              <Area type="monotone" dataKey="Consumi" stroke="#7c3aed" fill="url(#gC)" strokeWidth={2.5} dot={{ fill: '#7c3aed', r: 3 }} />
            </AreaChart>
          </ResponsiveContainer>
        </ChartCard>
        <ChartCard title="Totale spese condominiali">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
              <Tooltip content={<Tip />} />
              <Bar dataKey="Totale" fill="#2563eb" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </>}

      {active === 'saldo' && (
        <ChartCard title="Saldo esercizio per unità">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={60} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Saldo casa" fill="#16a34a" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo box" fill="#2563eb" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo cantina" fill="#d97706" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {active === 'consumi' && (
        <ChartCard title="Dettaglio consumi (stacked)">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={consumiData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" />
              <XAxis dataKey="anno" tick={{ fill: '#9ca3af', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Riscaldamento" fill="#ef4444" stackId="a" />
              <Bar dataKey="Acqua calda" fill="#f97316" stackId="a" />
              <Bar dataKey="Acqua fredda" fill="#3b82f6" stackId="a" />
              <Bar dataKey="Energia box" fill="#8b5cf6" stackId="a" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {active === 'variazioni' && (
        <ChartCard title="Variazioni % anno su anno">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={varData} margin={{ left: -10, right: 10, top: 10, bottom: 0 }} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5" horizontal={false} />
              <XAxis type="number" tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${v}%`} />
              <YAxis type="category" dataKey="anno" tick={{ fill: '#6b7280', fontSize: 11 }} axisLine={false} tickLine={false} width={38} />
              <Tooltip content={<Tip />} />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="Spese fisse %" fill="#2563eb" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Consumi %" fill="#7c3aed" radius={[0, 4, 4, 0]} />
              <Bar dataKey="Totale %" fill="#16a34a" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 14 }}>
            {varData.map(r => (
              <div key={r.anno} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg2)', borderRadius: 8, fontSize: 13 }}>
                <span className="tag tag-blue">{r.anno}</span>
                <span style={{ color: r['Spese fisse %'] > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>Fisse: {r['Spese fisse %'] > 0 ? '+' : ''}{r['Spese fisse %']}%</span>
                <span style={{ color: r['Consumi %'] > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>Consumi: {r['Consumi %'] > 0 ? '+' : ''}{r['Consumi %']}%</span>
                <span style={{ color: r['Totale %'] > 0 ? 'var(--red)' : 'var(--green)', fontWeight: 600 }}>Tot: {r['Totale %'] > 0 ? '+' : ''}{r['Totale %']}%</span>
              </div>
            ))}
          </div>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <p style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)', marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );
}
