import { useState, useEffect } from 'react';
import { getExerciseYears, getFixedExpenses, getConsumptionData } from '../lib/db';
import type { Property } from '../types';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';

const fmt = (n: number) => `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--accent)', marginBottom: 6, fontWeight: 600 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color }}>
          {p.name}: {typeof p.value === 'number' ? fmt(p.value) : p.value}
        </p>
      ))}
    </div>
  );
};

export default function ChartsPage({ property }: { property: Property }) {
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);
  const [consumiData, setConsumiData] = useState<any[]>([]);
  const [active, setActive] = useState<'spese' | 'saldo' | 'consumi'>('spese');

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
        const saldoCasa = y ? y.balance_start_casa + y.rates_paid_casa : null;
        return {
          anno: yl,
          'Spese Fisse Casa': speseFisse,
          'Consumi Casa': speseConsumi,
          'Totale': speseFisse + speseConsumi,
          'Saldo Casa': saldoCasa,
          'Saldo Box': y ? y.balance_start_box + y.rates_paid_box : null,
          'Saldo Cantina': y ? y.balance_start_cantina + y.rates_paid_cantina : null,
        };
      });

      const consumiMerged = allYears.map(yl => {
        const c = consumi.find(r => r.year_label === yl);
        return {
          anno: yl,
          'Riscaldamento': c?.riscaldamento_consumo || 0,
          'ACS': c?.acqua_calda_consumo || 0,
          'Acqua': c?.acqua_potabile || 0,
          'Energia': c?.energia_elettrica_box || 0,
        };
      });

      setChartData(merged);
      setConsumiData(consumiMerged);
    }).finally(() => setLoading(false));
  }, [property.id]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Caricamento...</div>;
  if (chartData.length === 0) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text2)' }}>Nessun dato disponibile per i grafici.</div>;

  return (
    <div style={{ padding: '20px 16px' }}>
      <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, marginBottom: 20 }}>Grafici Storici</h2>

      {/* Tab */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, background: 'var(--card)', borderRadius: 12, padding: 4 }}>
        {[['spese', 'Spese'], ['saldo', 'Saldo'], ['consumi', 'Consumi']].map(([id, label]) => (
          <button key={id} onClick={() => setActive(id as any)} style={{
            flex: 1, padding: '8px 0', borderRadius: 9, fontFamily: 'var(--font-body)', fontSize: 13,
            background: active === id ? 'var(--accent)' : 'transparent',
            color: active === id ? '#0f0f1a' : 'var(--text2)',
          }}>{label}</button>
        ))}
      </div>

      {active === 'spese' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <ChartCard title="Spese totali per anno">
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <defs>
                  <linearGradient id="gFixed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#e8b86d" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#e8b86d" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gConsumi" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d5030" />
                <XAxis dataKey="anno" tick={{ fill: '#6060a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Legend wrapperStyle={{ fontSize: 12, color: '#a0a0c0' }} />
                <Area type="monotone" dataKey="Spese Fisse Casa" stroke="#e8b86d" fill="url(#gFixed)" strokeWidth={2} />
                <Area type="monotone" dataKey="Consumi Casa" stroke="#60a5fa" fill="url(#gConsumi)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="Totale spese condominiali">
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#2d2d5030" />
                <XAxis dataKey="anno" tick={{ fill: '#6060a0', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={50} />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="Totale" fill="#e8b86d" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      )}

      {active === 'saldo' && (
        <ChartCard title="Saldo esercizio per anno">
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={chartData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d5030" />
              <XAxis dataKey="anno" tick={{ fill: '#6060a0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={55} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#a0a0c0' }} />
              <Bar dataKey="Saldo Casa" fill="#4ade80" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo Box" fill="#60a5fa" radius={[4, 4, 0, 0]} />
              <Bar dataKey="Saldo Cantina" fill="#e8b86d" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}

      {active === 'consumi' && (
        <ChartCard title="Dettaglio consumi per anno">
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={consumiData} margin={{ left: 0, right: 10, top: 10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2d2d5030" />
              <XAxis dataKey="anno" tick={{ fill: '#6060a0', fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#6060a0', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `€${v}`} width={50} />
              <Tooltip content={<CustomTooltip />} />
              <Legend wrapperStyle={{ fontSize: 12, color: '#a0a0c0' }} />
              <Bar dataKey="Riscaldamento" fill="#f87171" radius={[4, 4, 0, 0]} stackId="a" />
              <Bar dataKey="ACS" fill="#fb923c" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="Acqua" fill="#60a5fa" radius={[0, 0, 0, 0]} stackId="a" />
              <Bar dataKey="Energia" fill="#a78bfa" radius={[4, 4, 0, 0]} stackId="a" />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="card">
      <p style={{ color: 'var(--text2)', fontSize: 13, marginBottom: 16 }}>{title}</p>
      {children}
    </div>
  );
}
