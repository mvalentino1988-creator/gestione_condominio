import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData } from '../types';
import {
  Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, CreditCard, AlertCircle, Layers, Star
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from 'recharts';

// ── utils ─────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const f2  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fN  = (n: number | null, dec = 0) => n !== null ? Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: dec }) : '—';
const pct = (c: number, p: number) => p !== 0 ? ((c - p) / Math.abs(p) * 100) : 0;
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;
const pluraleRate = (n: number) => n === 1 ? 'rata' : 'rate';

// ── Esercizio in corso ────────────────────────────────────────
// L'esercizio fiscale va da ottobre a settembre.
// Esempio: ottobre 2025 – settembre 2026 → label "25/26"
function getCurrentExerciseLabel(): string {
  const now = new Date();
  const month = now.getMonth() + 1; // 1-12
  const year = now.getFullYear();
  if (month >= 10) {
    return `${String(year).slice(2)}/${String(year + 1).slice(2)}`;
  } else {
    return `${String(year - 1).slice(2)}/${String(year).slice(2)}`;
  }
}

const CURRENT_EXERCISE = getCurrentExerciseLabel();

// Millesimi Valentino
const MILL = { prop: 3.394, gen: 3.394, scalac: 20.288, box_prop: 0.576, box_gen: 0.576, box_scalac: 3.443, cant_prop: 0.059, cant_gen: 0.059 };
// Preventivo 25/26 totali condominio
const P2526 = { prop: 52129.06, gen: 149737.47, man: 10000.00, scalac: 4500.00, asc_c: 3802.22, tele: 5054.50, risc_inv: 35349.04, acs_inv: 31638.80 };
const PV = {
  prop:    P2526.prop    * MILL.prop    / 1000,
  gen:     P2526.gen     * MILL.gen     / 1000,
  man:     P2526.man     * MILL.prop    / 1000,
  scalac:  P2526.scalac  * MILL.scalac  / 1000,
  asc:     P2526.asc_c   * MILL.scalac  / 1000,
  tele:    P2526.tele    * MILL.prop    / 1000,
  risc_inv:P2526.risc_inv* MILL.prop    / 1000,
  acs_inv: P2526.acs_inv * MILL.prop    / 1000,
};

const TABS = ['Riepilogo','Rendiconto','Spese','Consumi','Rate','Confronto'] as const;
type Tab = typeof TABS[number];

const TAB_LABELS: Record<Tab, string> = {
  'Riepilogo':  '📊 Riepilogo',
  'Rendiconto': '📋 Rendiconto',
  'Spese':      '💶 Spese fisse',
  'Consumi':    '🔥 Consumi',
  'Rate':       '💳 Rate',
  'Confronto':  '⚖️ Confronto',
};

function TabSelector({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ position: 'relative' }}>
      <select
        value={active}
        onChange={e => onChange(e.target.value as Tab)}
        style={{
          width: '100%', appearance: 'none', WebkitAppearance: 'none',
          background: 'var(--bg2)', border: '1.5px solid var(--border2)',
          borderRadius: 12, padding: '10px 40px 10px 14px',
          fontSize: 15, fontWeight: 700, color: 'var(--accent)',
          fontFamily: 'var(--font-body)', cursor: 'pointer', outline: 'none',
        }}
      >
        {TABS.map(t => (
          <option key={t} value={t}>{TAB_LABELS[t]}</option>
        ))}
      </select>
      <div style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M3 5l4 4 4-4" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </div>
  );
}
type PctModalData = { title: string; curLabel: string; curVal: number; prevLabel: string; prevVal: number; pct: number };

function PctModal({ title, curLabel, curVal, prevLabel, prevVal, pct: pctVal, onClose }: PctModalData & { onClose: () => void }) {
  return (
    <div
      style={{ position:'fixed', inset:0, background:'rgba(26,31,46,0.5)', zIndex:500,
        display:'flex', alignItems:'center', justifyContent:'center', padding:20, backdropFilter:'blur(4px)' }}
      onClick={onClose}
    >
      <div className="card fade-up" style={{ width:'100%', maxWidth:360, padding:24, boxShadow:'var(--shadow-lg)' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
          <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>{title}</p>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer', padding:4, fontSize:18 }}>✕</button>
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
            <p style={{ fontSize:12, fontFamily:'monospace', color:'var(--text)', lineHeight:1.6 }}>
              ({f0(curVal)} − {f0(prevVal)}) ÷ |{f0(prevVal)}| × 100
            </p>
            <p style={{ fontSize:15, fontWeight:800, color: pctVal > 0 ? 'var(--red)' : 'var(--green)', marginTop:6 }}>
              = {pctVal > 0 ? '+' : ''}{pctVal.toFixed(1)}%
            </p>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>
            {pctVal > 0 ? '▲ Aumentato' : '▼ Diminuito'} di €{f0(Math.abs(curVal - prevVal))}
          </p>
        </div>
      </div>
    </div>
  );
}

// ── micro-components ──────────────────────────────────────────
function validaContinuita(finPrec: number|null, iniCurr: number|null, label: string): { ok: boolean; msg: string; severity: 'ok'|'warn'|'error' } {
  if (finPrec === null || iniCurr === null) return { ok: true, msg: '', severity: 'ok' };
  if (finPrec !== iniCurr) return { ok: false, msg: `${label}: finale anno prec. (${finPrec.toLocaleString('it-IT')}) ≠ iniziale anno corr. (${iniCurr.toLocaleString('it-IT')}). Δ ${Math.abs(finPrec - iniCurr).toLocaleString('it-IT')}.`, severity: 'warn' };
  return { ok: true, msg: '', severity: 'ok' };
}

function validaLetture(ini: number|null, fin: number|null, costo: number, label: string): { ok: boolean; msg: string; severity: 'ok'|'warn'|'error' } {
  if (ini === null || fin === null) return { ok: true, msg: '', severity: 'ok' };
  const delta = fin - ini;
  if (delta < 0)  return { ok: false, msg: `${label}: lettura finale (${fin}) < iniziale (${ini}).`, severity: 'error' };
  if (delta === 0 && costo > 0) return { ok: false, msg: `${label}: consumo zero ma costo €${fa(costo)}.`, severity: 'warn' };
  if (costo <= 0 && delta > 0) return { ok: false, msg: `${label}: consumo ${delta} ma costo zero.`, severity: 'warn' };
  const u = costo / delta;
  if (label.includes('Risc') && (u < 0.05 || u > 2)) return { ok: false, msg: `${label}: costo unitario €${f2(u)}/cal anomalo.`, severity: 'warn' };
  if (label.includes('calda') && (u < 0.05 || u > 2)) return { ok: false, msg: `${label}: costo unitario €${f2(u)}/L anomalo.`, severity: 'warn' };
  if (label.includes('fredda') && (u < 0.005 || u > 0.5)) return { ok: false, msg: `${label}: costo unitario €${f2(u)}/L anomalo.`, severity: 'warn' };
  return { ok: true, msg: '', severity: 'ok' };
}


function Delta({ cur, prev, invert = false, onClick }: { cur: number; prev: number | null; invert?: boolean; onClick?: () => void }) {
  if (prev === null || prev === 0) return null;
  const d = pct(cur, prev), diff = cur - prev, up = diff > 0;
  const good = invert ? !up : up;
  const el = (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:700,
      color: good?'var(--red)':'var(--green)', background: good?'var(--red-bg)':'var(--green-bg)',
      borderRadius:5, padding:'1px 6px', marginLeft:6,
      cursor: onClick ? 'pointer' : 'default',
      textDecoration: onClick ? 'underline dotted' : 'none',
    }}>
      {up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
      {up?'+':'-'}{Math.abs(d).toFixed(1)}%
    </span>
  );
  if (onClick) return <button onClick={onClick} style={{ background:'transparent', border:'none', padding:0 }}>{el}</button>;
  return el;
}

function Chip({ v }: { v: number }) {
  return <span style={{ fontSize:11, fontWeight:700, color:v>=0?'var(--green)':'var(--red)', background:v>=0?'var(--green-bg)':'var(--red-bg)', borderRadius:6, padding:'2px 8px' }}>{v>=0?'▲ CREDITO':'▼ DEBITO'} €{fa(v)}</span>;
}

// Badge "Esercizio in corso"
function CurrentBadge() {
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', gap:4,
      fontSize:10, fontWeight:700,
      color:'#b45309', background:'#fffbeb',
      border:'1px solid #fde68a', borderRadius:6, padding:'2px 8px'
    }}>
      <Star size={9} fill="#b45309" color="#b45309"/>
      IN CORSO
    </span>
  );
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:12, boxShadow:'var(--shadow-md)' }}>
      <p style={{ fontWeight:700, marginBottom:4 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color:p.color, marginTop:2 }}>{p.name}: {typeof p.value==='number'?`€${p.value.toLocaleString('it-IT',{maximumFractionDigits:0})}`:p.value}</p>)}
    </div>
  );
};

const ChartTipRaw = ({ active, payload, label, suffix = '' }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:12, boxShadow:'var(--shadow-md)' }}>
      <p style={{ fontWeight:700, marginBottom:4 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color:p.color, marginTop:2 }}>{p.name}: {typeof p.value==='number'?`${p.value.toLocaleString('it-IT',{maximumFractionDigits:1})}${suffix}`:p.value}</p>)}
    </div>
  );
};

function NF({ lbl, fld, st, fn, ph, type }: { lbl:string; fld:string; st:any; fn:(f:string,v:string)=>void; ph?:string; type?:string }) {
  return (
    <div>
      <label>{lbl}</label>
      <input type={type||'number'} step="0.01" value={st?.[fld]??''} placeholder={ph||'0'} onChange={e => fn(fld, e.target.value)} />
    </div>
  );
}

function TI({ lbl, pfx, st, fn }: { lbl:string; pfx:string; st:any; fn:(f:string,v:string)=>void }) {
  return (
    <div>
      <p style={{ fontSize:11, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{lbl}</p>
      <div className="grid3">
        {(['casa','box','cantina'] as const).map(t => (
          <div key={t}>
            <label>{t==='casa'?'App C63':t==='box'?'Box 13':'Cantina'}</label>
            <input type="number" step="0.01" value={st?.[`${pfx}_${t}`]??0} onChange={e=>fn(`${pfx}_${t}`,e.target.value)}/>
          </div>
        ))}
      </div>
    </div>
  );
}

function FormActions({ onCancel, onSave }: { onCancel:()=>void; onSave:()=>void }) {
  return (
    <div style={{ display:'flex', gap:8, justifyContent:'flex-end', marginTop:8 }}>
      <button className="btn-ghost" onClick={onCancel}><X size={13}/>Annulla</button>
      <button className="btn-primary" onClick={onSave}><Check size={13}/>Salva</button>
    </div>
  );
}

function SectionHeader({ title, sub, onAdd }: { title:string; sub?:string; onAdd?:()=>void }) {
  return (
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
      <div>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:800 }}>{title}</h2>
        {sub && <p style={{ color:'var(--text3)', fontSize:11, marginTop:1 }}>{sub}</p>}
      </div>
      {onAdd && <button className="btn-primary" onClick={onAdd} style={{ padding:'7px 12px', fontSize:13 }}><Plus size={13}/>Nuovo</button>}
    </div>
  );
}

function ToggleBreakdown({ show, onToggle }: { show: boolean; onToggle: () => void }) {
  return (
    <button onClick={onToggle} style={{
      display:'inline-flex', alignItems:'center', gap:5, padding:'4px 10px',
      borderRadius:20, border:'1px solid var(--border)', background: show ? 'var(--accent-light)' : 'var(--bg2)',
      color: show ? 'var(--accent)' : 'var(--text3)', fontSize:11, fontWeight:600, cursor:'pointer',
    }}>
      <Layers size={11}/>
      {show ? 'Nascondi dettaglio unità' : 'Vedi per App/Box/Cantina'}
    </button>
  );
}

function ConsumoDetail({ r, rKwh, aL, afL, rU, aU, afU, valChecks, discChecksCard }: {
  r: any; rKwh:number|null; aL:number|null; afL:number|null;
  rU:number|null; aU:number|null; afU:number|null;
  valChecks: ReturnType<typeof validaLetture>[];
  discChecksCard: ReturnType<typeof validaLetture>[];
}) {
  const [dt, setDt] = useState<'letture'|'costi'|'totali'>('letture');
  const allIssues = [...valChecks, ...discChecksCard].filter(c=>!c.ok);

  const tabStyle = (active: boolean, hasAlert?: boolean) => ({
    flex:1, padding:'6px 4px', borderRadius:7, fontSize:12, fontWeight:700, whiteSpace:'nowrap' as const,
    background: active ? '#fff' : 'transparent',
    color: active ? (hasAlert ? '#b45309' : 'var(--accent)') : (hasAlert ? '#b45309' : 'var(--text2)'),
    boxShadow: active ? 'var(--shadow-xs)' : 'none',
  });

  return (
    <div style={{ marginTop:10 }}>
      <div className="divider"/>
      <div style={{ display:'flex', background:'var(--bg3)', borderRadius:10, padding:3, gap:2, marginBottom:10 }}>
        <button style={tabStyle(dt==='letture', allIssues.length>0)} onClick={()=>setDt('letture')}>
          Letture {allIssues.length>0 && <span style={{ display:'inline-block', width:6, height:6, background:'#f59e0b', borderRadius:'50%', marginLeft:3, verticalAlign:'middle' }}/>}
        </button>
        <button style={tabStyle(dt==='costi')} onClick={()=>setDt('costi')}>Costi</button>
        <button style={tabStyle(dt==='totali')} onClick={()=>setDt('totali')}>Totali</button>
      </div>

      {dt==='letture' && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {allIssues.length > 0 && (
            <div style={{ background:'#fffbeb', border:'1.5px solid #f59e0b', borderRadius:9, padding:'8px 10px', display:'flex', flexDirection:'column', gap:4 }}>
              {allIssues.map((c,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:6, fontSize:11, color:c.severity==='error'?'#dc2626':'#92400e', fontWeight:600 }}>
                  <AlertCircle size={11} style={{ flexShrink:0, marginTop:1 }}/>{c.msg}
                </div>
              ))}
            </div>
          )}
          {([
            [r.risc_lettura_iniziale,r.risc_lettura_finale,rKwh,r.riscaldamento_consumo,'Riscaldamento','cal','€/cal','#ef4444',valChecks[0]],
            [r.acqua_calda_lettura_iniziale,r.acqua_calda_lettura_finale,aL,r.acqua_calda_consumo,'Acqua calda','L','€/L','#f97316',valChecks[1]],
            [r.acqua_fredda_lettura_iniziale,r.acqua_fredda_lettura_finale,afL,r.acqua_potabile,'Acqua fredda','L','€/L','#3b82f6',valChecks[2]],
          ] as [number|null,number|null,number|null,number,string,string,string,string,ReturnType<typeof validaLetture>][]).map(([ini,fin,cons,costo,nome,unit,cuLabel,col,chk])=>{
            if (ini===null && fin===null) return null;
            const rowErr = chk && !chk.ok;
            const cu = cons && costo ? costo / cons : null;
            return (
              <div key={nome} style={{ background: rowErr?(chk.severity==='error'?'#fee2e2':'#fef3c7'):'var(--bg3)', border: rowErr?`1.5px solid ${chk.severity==='error'?'#fca5a5':'#fde68a'}`:'1px solid transparent', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontWeight:700, fontSize:12, color:rowErr?(chk.severity==='error'?'#dc2626':'#b45309'):col }}>{nome}</span>
                  {rowErr && <AlertCircle size={12} color={chk.severity==='error'?'#dc2626':'#f59e0b'}/>}
                </div>
                <div style={{ display:'flex', gap:10, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>
                  <span style={{ fontSize:11, color:'var(--text2)' }}>
                    {ini!==null?ini.toLocaleString('it-IT'):'—'} → {fin!==null?fin.toLocaleString('it-IT'):'—'} {unit}
                  </span>
                  {cons!==null && <span style={{ fontSize:12, fontWeight:700, color:'var(--text)' }}>Δ <strong>{fN(cons)} {unit}</strong></span>}
                  {cu && <span style={{ fontSize:11, fontWeight:700, color:col, background:'rgba(0,0,0,0.04)', borderRadius:5, padding:'1px 6px' }}>{cuLabel}: €{f2(cu)}</span>}
                  {costo>0 && <span style={{ fontSize:11, color:'var(--text3)' }}>€{fa(costo)}</span>}
                </div>
              </div>
            );
          })}
          {discChecksCard.filter(c=>!c.ok).length > 0 && (
            <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:8, padding:'7px 10px', fontSize:11, color:'#92400e', fontWeight:600 }}>
              <p style={{ fontWeight:700, marginBottom:3, color:'#c2410c' }}>Continuità con altri anni:</p>
              {discChecksCard.filter(c=>!c.ok).map((c,i)=><p key={i}>• {c.msg}</p>)}
            </div>
          )}
        </div>
      )}

      {dt==='costi' && (
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {([
            ['Risc. consumo',   r.riscaldamento_consumo,   rKwh, rU, 'cal', '#ef4444'],
            ['Risc. involont.', r.riscaldamento_involontario, null, null, '', '#94a3b8'],
            ['ACS consumo',     r.acqua_calda_consumo,     aL,   aU, 'L',   '#f97316'],
            ['ACS involontaria',r.acqua_calda_involontaria, null, null,'','#94a3b8'],
            ['Acqua potabile',  r.acqua_potabile,          afL,  afU,'L',   '#3b82f6'],
            ['Energia box',     r.energia_elettrica_box,   null, null,'','#94a3b8'],
            ['Mov. personali',  r.movimenti_personali,     null, null,'','#94a3b8'],
          ] as [string,number,number|null,number|null,string,string][]).map(([l,v,qty,cu,unit,col])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'7px 10px', background:'var(--bg3)', borderRadius:7, fontSize:12 }}>
              <span style={{ color:'var(--text2)', fontWeight:500 }}>{l}</span>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontWeight:700 }}>€{fa(v)}</span>
                {qty && <span style={{ fontSize:10, color:'var(--text3)', marginLeft:6 }}>{fN(qty)} {unit}</span>}
                {cu && <span style={{ fontSize:10, color:col, fontWeight:700, marginLeft:4 }}>€{f2(cu)}/{unit}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {dt==='totali' && (
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:6 }}>
            {([['App C63',r.totale_casa],['Box 13',r.totale_box],['Cantina',r.totale_cantina]] as [string,number][]).map(([l,v])=>(
              <div key={l} style={{ textAlign:'center', padding:'10px 4px', background:'var(--bg3)', borderRadius:8 }}>
                <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                <p style={{ fontSize:14, fontWeight:800 }}>€{fa(v)}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'var(--accent-light)', borderRadius:8, fontSize:13 }}>
            <span style={{ fontWeight:700 }}>Totale</span>
            <span style={{ fontWeight:800, color:'var(--accent)' }}>€{fa(r.totale_casa+r.totale_box+r.totale_cantina)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ordinamento: più recente in cima, più vecchio in fondo ─────
function sortNewestFirst<T extends { year_label: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (b.year_label || '').localeCompare(a.year_label || ''));
}

function sortNewestFirstByAnno<T extends { anno: string }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => (b.anno || '').localeCompare(a.anno || ''));
}

// ══════════════════════════════════════════════════════════════
export default function DatiPage({ property }: { property: Property }) {
  const [tab, setTab]     = useState<Tab>('Riepilogo');
  const [years,   setYears]   = useState<any[]>([]);
  const [fixed,   setFixed]   = useState<FixedExpenses[]>([]);
  const [consumi, setConsumi] = useState<ConsumptionData[]>([]);
  const [rates,   setRates]   = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editY,   setEditY]   = useState<any>(null);
  const [editF,   setEditF]   = useState<any>(null);
  const [editC,   setEditC]   = useState<any>(null);
  const [editR,   setEditR]   = useState<any>(null);
  const [isNew,   setIsNew]   = useState(false);
  const [expY,    setExpY]    = useState<string|null>(null);
  const [expF,    setExpF]    = useState<string|null>(null);
  const [expC,    setExpC]    = useState<string|null>(null);
  const [showBreakdownR, setShowBreakdownR] = useState(false);
  const [showBreakdownS, setShowBreakdownS] = useState(false);
  const [showBreakdownC, setShowBreakdownC] = useState(false);
  const [consumiView, setConsumiView] = useState<'euro'|'qty'>('euro');
  const [pctModal, setPctModal] = useState<PctModalData | null>(null);
  const consumiTopRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const [a,b,c,d] = await Promise.all([
      supabase.from('exercise_years').select('*').eq('property_id',property.id).order('year_label'),
      supabase.from('fixed_expenses').select('*').eq('property_id',property.id).order('year_label'),
      supabase.from('consumption_data').select('*').eq('property_id',property.id).order('year_label'),
      supabase.from('rate_pagamenti').select('*').eq('property_id',property.id).order('data_pagamento',{ascending:false}),
    ]);
    setYears(a.data||[]); setFixed(b.data||[]); setConsumi(c.data||[]); setRates(d.data||[]);
    setLoading(false);
  }, [property.id]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <div style={{ padding:40, textAlign:'center', color:'var(--text3)' }}>Caricamento...</div>;

  // ── CRUD ─────────────────────────────────────────────────
  const save = async (table: string, obj: any, setFn: (fn:(p:any[])=>any[])=>void) => {
    const { data } = obj.id
      ? await supabase.from(table).update(obj).eq('id',obj.id).select().single()
      : await supabase.from(table).insert(obj).select().single();
    if (data) setFn(p => isNew ? [...p,data] : p.map((r:any)=>r.id===data.id?data:r));
  };
  const del = async (table: string, id: string, setFn: (fn:(p:any[])=>any[])=>void) => {
    if (!confirm('Eliminare?')) return;
    await supabase.from(table).delete().eq('id',id);
    setFn(p => p.filter((r:any)=>r.id!==id));
  };

  const numY = (f:string,v:string) => setEditY((p:any)=>({...p,[f]:parseFloat(v)||0}));
  const numF = (f:string,v:string) => setEditF((p:any)=>({...p,[f]:parseFloat(v)||0}));
  const numC = (f:string,v:string) => setEditC((p:any)=>({...p,[f]:v===''?null:parseFloat(v)||0}));
  const strR = (f:string,v:string) => setEditR((p:any)=>({...p,[f]:v}));

  // ── Derived data ─────────────────────────────────────────
  const allYrs = [...new Set([...years.map(y=>y.year_label),...fixed.map(f=>f.year_label),...consumi.map(c=>c.year_label)])].sort();
  // Aggiungi l'esercizio in corso se non presente
  const allYrsWithCurrent = allYrs.includes(CURRENT_EXERCISE)
    ? allYrs
    : [...allYrs, CURRENT_EXERCISE].sort();

  const sfTot = (f: FixedExpenses) => f.prop_casa+f.gen_prop_casa+f.man_ord_casa+f.scale_prop_casa+f.scala_c_casa+f.asc_c_casa+f.prop_alloggi+f.addebiti_unita+f.addebiti_unita_imm+f.spese_personali;
  const sfBox = (f: FixedExpenses) => f.prop_box+f.gen_prop_box+f.man_ord_box+f.scale_prop_box+f.scala_c_box+f.asc_c_box+f.prop_box_extra;
  const sfCant= (f: FixedExpenses) => f.prop_cantina+f.gen_prop_cantina+f.man_ord_cantina+f.scale_prop_cantina+f.scala_c_cantina+f.asc_c_cantina;

  const riassunto = allYrsWithCurrent.map(yl => {
    const y = years.find(r=>r.year_label===yl);
    const f = fixed.find(r=>r.year_label===yl) as FixedExpenses|undefined;
    const c = consumi.find(r=>r.year_label===yl);
    const sf  = f ? sfTot(f) : null;
    const con = c ? c.totale_casa : null;
    const sC  = y ? calcSaldo(y.balance_start_casa,    y.rates_paid_casa,    y.spese_totali_casa||0)    : null;
    const sB  = y ? calcSaldo(y.balance_start_box,     y.rates_paid_box,     y.spese_totali_box||0)     : null;
    const sCa = y ? calcSaldo(y.balance_start_cantina, y.rates_paid_cantina, y.spese_totali_cantina||0) : null;
    const rKwh= c&&c.risc_lettura_finale&&c.risc_lettura_iniziale ? c.risc_lettura_finale-c.risc_lettura_iniziale : null;
    const aL  = c&&c.acqua_calda_lettura_finale&&c.acqua_calda_lettura_iniziale ? c.acqua_calda_lettura_finale-c.acqua_calda_lettura_iniziale : null;
    const afL = c&&c.acqua_fredda_lettura_finale&&c.acqua_fredda_lettura_iniziale ? c.acqua_fredda_lettura_finale-c.acqua_fredda_lettura_iniziale : null;
    const rateAnno = rates.filter(r=>r.year_label===yl).reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0),0);
    const rateCount = rates.filter(r=>r.year_label===yl).length;
    const isCurrent = yl === CURRENT_EXERCISE;
    return {
      anno:yl, sf, con, tot: sf!==null&&con!==null?sf+con:sf??con,
      sC, sB, sCa, sTot: sC!==null&&sB!==null&&sCa!==null?sC+sB+sCa:null,
      rKwh, rCosto:c?.riscaldamento_consumo, rUnit:rKwh&&c?.riscaldamento_consumo?c.riscaldamento_consumo/rKwh:null,
      aL,   aCosto:c?.acqua_calda_consumo,   aUnit:aL&&c?.acqua_calda_consumo?c.acqua_calda_consumo/aL:null,
      afL,  afCosto:c?.acqua_potabile,        afUnit:afL&&c?.acqua_potabile?c.acqua_potabile/afL:null,
      rateAnno, rateCount, isCurrent,
    };
  });

  // Esercizio in corso (usato per confronti)
  const currentRiassunto = riassunto.find(r => r.isCurrent) || riassunto[riassunto.length - 1];
  // Esercizio precedente rispetto all'in corso
  const prevOfCurrentIdx = riassunto.findIndex(r => r.isCurrent) - 1;
  const prevOfCurrent = prevOfCurrentIdx >= 0 ? riassunto[prevOfCurrentIdx] : null;

  const cData = riassunto.map(r => ({ anno:r.anno, 'Spese fisse':r.sf||0, 'Consumi':r.con||0, 'Totale':r.tot||0, 'Saldo C63':r.sC||0, 'Risc.':r.rCosto||0, 'ACS':r.aCosto||0, 'Acq.fr.':r.afCosto||0 }));
  const consumiQtyData = riassunto.map(r => ({ anno:r.anno, 'Riscaldamento (cal)':r.rKwh||0, 'Acqua calda (L)':r.aL||0, 'Acqua fredda (L)':r.afL||0 }));
  const vData = allYrsWithCurrent.slice(1).map((yl,i)=>{
    const cur=cData.find(r=>r.anno===yl)!, prv=cData.find(r=>r.anno===allYrsWithCurrent[i])!;
    const p=(c:number,v:number)=>v!==0?parseFloat(((c-v)/Math.abs(v)*100).toFixed(1)):0;
    return { anno:yl, prevAnno:allYrsWithCurrent[i], 'Fisse%':p(cur['Spese fisse'],prv['Spese fisse']), 'Consumi%':p(cur['Consumi'],prv['Consumi']), 'Totale%':p(cur['Totale'],prv['Totale']), isCurrent: yl === CURRENT_EXERCISE };
  });

  // Riassunto in ordine: più recente prima (più vecchio in fondo)
  const riassuntoDesc = sortNewestFirstByAnno(riassunto);

  // empties
  const emptyY = { property_id:property.id, year_label:CURRENT_EXERCISE, balance_start_casa:0, balance_start_box:0, balance_start_cantina:0, rates_paid_casa:0, rates_paid_box:0, rates_paid_cantina:0, spese_totali_casa:0, spese_totali_box:0, spese_totali_cantina:0 };
  const emptyF = { property_id:property.id, year_label:CURRENT_EXERCISE, spese_personali:0, prop_casa:0,prop_box:0,prop_cantina:0, gen_prop_casa:0,gen_prop_box:0,gen_prop_cantina:0, prop_alloggi:0, man_ord_casa:0,man_ord_box:0,man_ord_cantina:0, scale_prop_casa:0,scale_prop_box:0,scale_prop_cantina:0, scala_c_casa:0,scala_c_box:0,scala_c_cantina:0, asc_c_casa:0,asc_c_box:0,asc_c_cantina:0, addebiti_unita:0,addebiti_unita_imm:0,prop_box_extra:0 };
  const emptyC = { property_id:property.id, year_label:CURRENT_EXERCISE, acqua_potabile:0, riscaldamento_involontario:0, riscaldamento_consumo:0, acqua_calda_involontaria:0, acqua_calda_consumo:0, energia_elettrica_box:0, movimenti_personali:0, risc_lettura_iniziale:null, risc_lettura_finale:null, acqua_calda_lettura_iniziale:null, acqua_calda_lettura_finale:null, acqua_fredda_lettura_iniziale:null, acqua_fredda_lettura_finale:null, totale_casa:0, totale_box:0, totale_cantina:0 };
  const emptyR = { property_id:property.id, year_label:CURRENT_EXERCISE, numero_rata:'', data_pagamento:new Date().toISOString().split('T')[0], importo_casa:0, importo_box:0, importo_cantina:0, descrizione:'' };

  // helper per aprire il modal %
  const openPct = (title: string, curLabel: string, curVal: number, prevLabel: string, prevVal: number) => {
    const pctVal = prevVal !== 0 ? (curVal - prevVal) / Math.abs(prevVal) * 100 : 0;
    setPctModal({ title, curLabel, curVal, prevLabel, prevVal, pct: pctVal });
  };

  // ── Card stile per esercizio in corso ─────────────────────
  const currentCardStyle = {
    border:'2px solid #f59e0b',
    background:'#fffdf5',
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <TabSelector active={tab} onChange={t=>{setTab(t);setEditY(null);setEditF(null);setEditC(null);setEditR(null);}}/>

      {/* ── Banner esercizio in corso — compact ── */}
      <div style={{ display:'flex', alignItems:'center', gap:7, padding:'7px 12px', background:'#fffbeb', border:'1px solid #fde68a', borderRadius:10 }}>
        <Star size={11} fill="#b45309" color="#b45309"/>
        <span style={{ fontSize:12, fontWeight:700, color:'#b45309' }}>In corso: <strong>{CURRENT_EXERCISE}</strong></span>
        {currentRiassunto && currentRiassunto.rateAnno > 0 && (
          <span style={{ fontSize:11, color:'#92400e', marginLeft:2 }}>· €{f0(currentRiassunto.rateAnno)} ({currentRiassunto.rateCount} {pluraleRate(currentRiassunto.rateCount)})</span>
        )}
      </div>

      {/* ══ RIEPILOGO ══ */}
      {tab==='Riepilogo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:800 }}>Riepilogo annuale</h2>
            <ToggleBreakdown show={showBreakdownR} onToggle={()=>setShowBreakdownR(v=>!v)}/>
          </div>

          {/* Riepilogo esercizio in corso */}
          {currentRiassunto && (
            <div style={{ background:'#fffbeb', border:'2px solid #f59e0b', borderRadius:14, padding:'14px 16px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:8 }}>
                <Star size={13} fill="#b45309" color="#b45309"/>
                <span style={{ fontWeight:800, fontSize:14, color:'#b45309' }}>Esercizio in corso — {CURRENT_EXERCISE}</span>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
                <div>
                  <p style={{ fontSize:10, color:'#92400e', fontWeight:600, marginBottom:3 }}>RATE VERSATE</p>
                  <p style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-display)', color:'#92400e' }}>
                    {currentRiassunto.rateAnno > 0 ? `€${f0(currentRiassunto.rateAnno)}` : '—'}
                  </p>
                  {currentRiassunto.rateCount > 0 && <p style={{ fontSize:10, color:'#a16207' }}>{currentRiassunto.rateCount} {pluraleRate(currentRiassunto.rateCount)}</p>}
                </div>
                {currentRiassunto.sf !== null && (
                  <div>
                    <p style={{ fontSize:10, color:'#92400e', fontWeight:600, marginBottom:3 }}>SPESE FISSE</p>
                    <p style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-display)', color:'#92400e' }}>€{f0(currentRiassunto.sf)}</p>
                    {prevOfCurrent?.sf !== null && prevOfCurrent?.sf !== undefined && (
                      <button onClick={()=>openPct('Spese fisse — vs anno precedente', CURRENT_EXERCISE, currentRiassunto.sf!, prevOfCurrent.anno, prevOfCurrent.sf!)}
                        style={{ fontSize:10, color: currentRiassunto.sf > prevOfCurrent.sf! ? 'var(--red)' : 'var(--green)', background:'transparent', border:'none', cursor:'pointer', padding:0, fontWeight:700, textDecoration:'underline dotted' }}>
                        vs {prevOfCurrent.anno}: {currentRiassunto.sf > prevOfCurrent.sf! ? '▲' : '▼'}{Math.abs(pct(currentRiassunto.sf!, prevOfCurrent.sf!)).toFixed(1)}%
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Tabella riepilogo — più recente in cima */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg3)' }}>
                    <th style={{ padding:'8px 10px', textAlign:'left', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Anno</th>
                    <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Spese fisse</th>
                    <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Consumi</th>
                    <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Tot. spese</th>
                    <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Rate versate</th>
                    {!showBreakdownR && <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Saldo tot.</th>}
                    {showBreakdownR && <>
                      <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#16a34a', fontSize:10 }}>Saldo App</th>
                      <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#2563eb', fontSize:10 }}>Saldo Box</th>
                      <th style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'#d97706', fontSize:10 }}>Saldo Cant.</th>
                    </>}
                  </tr>
                </thead>
                <tbody>
                  {riassuntoDesc.map((r,i)=>{
                    const prv = riassunto[riassunto.findIndex(x => x.anno === r.anno) - 1] || null;
                    const totSaldo = r.sC!==null&&r.sB!==null&&r.sCa!==null?r.sC+r.sB+r.sCa:null;
                    const rowBg = r.isCurrent ? '#fffdf5' : i%2===0?'#fff':'var(--bg3)';
                    return (
                      <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)', background:rowBg, borderLeft: r.isCurrent ? '3px solid #f59e0b' : 'none' }}>
                        <td style={{ padding:'8px 10px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:5, flexWrap:'wrap' }}>
                            <span className="tag tag-blue">{r.anno}</span>
                            {r.isCurrent && <CurrentBadge/>}
                          </div>
                        </td>
                        {/* Spese fisse */}
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>
                          {r.sf!=null ? (
                            <>
                              <span style={{ fontWeight:700 }}>€{f0(r.sf)}</span>
                              {prv?.sf!=null && (
                                <div>
                                  <button onClick={()=>openPct('Spese fisse',r.anno,r.sf!,prv.anno,prv.sf!)}
                                    style={{ fontSize:9, fontWeight:700, color:r.sf>prv.sf! ? 'var(--red)' : 'var(--green)', background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                    {r.sf>prv.sf! ? '▲' : '▼'}{Math.abs(pct(r.sf!,prv.sf!)).toFixed(1)}%
                                  </button>
                                </div>
                              )}
                            </>
                          ) : <span style={{ color:'var(--text3)' }}>—</span>}
                        </td>
                        {/* Consumi */}
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>
                          {r.con!=null ? (
                            <>
                              <span style={{ fontWeight:700 }}>€{f0(r.con)}</span>
                              {prv?.con!=null && (
                                <div>
                                  <button onClick={()=>openPct('Consumi',r.anno,r.con!,prv.anno,prv.con!)}
                                    style={{ fontSize:9, fontWeight:700, color:r.con>prv.con! ? 'var(--red)' : 'var(--green)', background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                    {r.con>prv.con! ? '▲' : '▼'}{Math.abs(pct(r.con!,prv.con!)).toFixed(1)}%
                                  </button>
                                </div>
                              )}
                            </>
                          ) : <span style={{ color:'var(--text3)' }}>—</span>}
                        </td>
                        {/* Tot spese */}
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>
                          {r.tot!=null ? (
                            <>
                              <span style={{ fontWeight:800 }}>€{f0(r.tot)}</span>
                              {prv?.tot!=null && (
                                <div>
                                  <button onClick={()=>openPct('Totale spese',r.anno,r.tot!,prv.anno,prv.tot!)}
                                    style={{ fontSize:9, fontWeight:700, color:r.tot>prv.tot! ? 'var(--red)' : 'var(--green)', background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                    {r.tot>prv.tot! ? '▲' : '▼'}{Math.abs(pct(r.tot!,prv.tot!)).toFixed(1)}%
                                  </button>
                                </div>
                              )}
                            </>
                          ) : <span style={{ color:'var(--text3)' }}>—</span>}
                        </td>
                        {/* Rate versate */}
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>
                          <span style={{ fontWeight:700, color:'var(--accent)' }}>{r.rateAnno>0?`€${f0(r.rateAnno)}`:'—'}</span>
                          {r.rateCount>0&&<div style={{ fontSize:9, color:'var(--text3)' }}>{r.rateCount} {pluraleRate(r.rateCount)}</div>}
                        </td>
                        {!showBreakdownR && (
                          <td style={{ padding:'8px 10px', textAlign:'right' }}>
                            {totSaldo!=null?<span style={{ fontWeight:800, color:totSaldo>=0?'var(--green)':'var(--red)' }}>{totSaldo>=0?'+':'-'}€{f0(totSaldo)}</span>:<span style={{ color:'var(--text3)' }}>—</span>}
                          </td>
                        )}
                        {showBreakdownR && <>
                          {[r.sC,r.sB,r.sCa].map((v,j)=>(
                            <td key={j} style={{ padding:'8px 10px', textAlign:'right' }}>
                              {v!=null?<span style={{ fontWeight:700, color:v>=0?'var(--green)':'var(--red)' }}>{v>=0?'+':'-'}€{f0(v)}</span>:<span style={{ color:'var(--text3)' }}>—</span>}
                            </td>
                          ))}
                        </>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grafico spese totali — con riferimento esercizio in corso */}
          <div className="card" style={{ padding:'16px' }}>
            <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Andamento spese totali</p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={cData} margin={{ left:-20, right:8, top:4, bottom:0 }}>
                <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={52}/>
                <Tooltip content={<ChartTip/>}/>
                <ReferenceLine x={CURRENT_EXERCISE} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2" label={{ value:'in corso', position:'top', fontSize:9, fill:'#b45309' }}/>
                <Area type="monotone" dataKey="Spese fisse" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} dot={{ fill:'#2563eb', r:3 }}/>
                <Area type="monotone" dataKey="Consumi" stroke="#7c3aed" fill="#f5f3ff" strokeWidth={2} dot={{ fill:'#7c3aed', r:3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Variazioni % — confronto sempre con esercizio in corso */}
          {vData.length > 0 && (
            <div className="card">
              <p style={{ fontWeight:700, fontSize:14, marginBottom:6 }}>Variazioni anno su anno</p>
              <p style={{ fontSize:11, color:'var(--text3)', marginBottom:8 }}>
                Tocca una % per vedere il dettaglio · Le variazioni verso <strong>{CURRENT_EXERCISE}</strong> sono evidenziate
              </p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {vData.map(r => {
                  const curCData = cData.find(x=>x.anno===r.anno)!;
                  const prvCData = cData.find(x=>x.anno===r.prevAnno)!;
                  return (
                    <div key={r.anno} style={{
                      display:'flex', alignItems:'center', gap:8, padding:'8px 12px',
                      background: r.isCurrent ? '#fffbeb' : 'var(--bg2)',
                      border: r.isCurrent ? '1px solid #fde68a' : '1px solid transparent',
                      borderRadius:8, fontSize:12, flexWrap:'wrap'
                    }}>
                      <span className="tag tag-blue" style={{ flexShrink:0 }}>{r.anno}</span>
                      {r.isCurrent && <CurrentBadge/>}
                      {([['Fisse', r['Fisse%'], 'Spese fisse'] as const, ['Consumi', r['Consumi%'], 'Consumi'] as const, ['Totale', r['Totale%'], 'Totale'] as const]).map(([l, v, field]) => (
                        <button key={l}
                          onClick={() => openPct(`${field} — ${r.prevAnno} → ${r.anno}`, r.anno, curCData[field], r.prevAnno, prvCData[field])}
                          style={{
                            fontWeight:700, color:(v)>0?'var(--red)':'var(--green)',
                            background:(v)>0?'var(--red-bg)':'var(--green-bg)',
                            borderRadius:5, padding:'2px 8px', fontSize:11, border:'none', cursor:'pointer',
                            textDecoration:'underline dotted',
                          }}>
                          {l}: {(v)>0?'+':''}{(v).toFixed(1)}%
                        </button>
                      ))}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Confronto diretto esercizio in corso vs precedente */}
          {currentRiassunto && prevOfCurrent && (
            <div className="card" style={{ border:'1px solid #fde68a', background:'#fffdf5' }}>
              <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:12 }}>
                <Star size={13} fill="#b45309" color="#b45309"/>
                <p style={{ fontWeight:800, fontSize:14, color:'#b45309' }}>Confronto: {prevOfCurrent.anno} → {CURRENT_EXERCISE}</p>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {([
                  ['Spese fisse', currentRiassunto.sf, prevOfCurrent.sf, 'Spese fisse'],
                  ['Consumi', currentRiassunto.con, prevOfCurrent.con, 'Consumi'],
                  ['Tot. spese', currentRiassunto.tot, prevOfCurrent.tot, 'Totale spese'],
                  ['Rate versate', currentRiassunto.rateAnno, prevOfCurrent.rateAnno, 'Rate versate'],
                ] as [string, number|null, number|null, string][]).map(([l, cur, prv, field]) => {
                  if (cur === null || prv === null || prv === 0) return null;
                  const d = pct(cur, prv);
                  const up = cur > prv;
                  return (
                    <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'rgba(255,251,235,0.7)', borderRadius:8 }}>
                      <span style={{ fontSize:12, fontWeight:600, color:'#78350f' }}>{l}</span>
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:11, color:'#a16207' }}>€{f0(prv)} → €{f0(cur)}</span>
                        <button onClick={()=>openPct(`${field} — ${prevOfCurrent.anno} → ${CURRENT_EXERCISE}`, CURRENT_EXERCISE, cur, prevOfCurrent.anno, prv)}
                          style={{ fontWeight:700, fontSize:11, color:up?'var(--red)':'var(--green)', background:up?'var(--red-bg)':'var(--green-bg)', border:'none', borderRadius:5, padding:'2px 7px', cursor:'pointer', textDecoration:'underline dotted' }}>
                          {up?'+':''}{d.toFixed(1)}%
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Costi unitari consumi nel tempo */}
          {riassunto.some(r=>r.rUnit) && (
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--border)', background:'var(--bg3)' }}>
                <p style={{ fontWeight:700, fontSize:12 }}>Costo unitario consumi per anno</p>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'var(--bg3)' }}>
                      {['Anno','Risc. (cal)','€/cal Δ','ACS (L)','€/L Δ','Acq.fr. (L)','€/L Δ'].map(h=>(
                        <th key={h} style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {sortNewestFirstByAnno(riassunto.filter(r=>r.rKwh)).map((r,i,arr)=>{
                      const prv = arr[i+1]; // arr è già desc, quindi prv è il precedente (più vecchio)
                      const prvReal = riassunto[riassunto.findIndex(x=>x.anno===r.anno)-1];
                      return (
                        <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)', background: r.isCurrent ? '#fffdf5' : undefined, borderLeft: r.isCurrent ? '3px solid #f59e0b' : 'none' }}>
                          <td style={{ padding:'6px 10px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span className="tag tag-blue">{r.anno}</span>
                              {r.isCurrent && <CurrentBadge/>}
                            </div>
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.rKwh)}</td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <span style={{ fontWeight:700, color:'#ef4444' }}>{r.rUnit?f2(r.rUnit):'—'}</span>
                            {prvReal?.rUnit&&r.rUnit&&(
                              <button onClick={()=>openPct('Costo unitario riscaldamento',r.anno,r.rUnit!,prvReal.anno,prvReal.rUnit!)}
                                style={{ display:'block', fontSize:9, color:r.rUnit>prvReal.rUnit?'var(--red)':'var(--green)', fontWeight:700, background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                {r.rUnit>prvReal.rUnit?'▲':'▼'}{Math.abs(pct(r.rUnit,prvReal.rUnit)).toFixed(1)}%
                              </button>
                            )}
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.aL)}</td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <span style={{ fontWeight:700, color:'#f97316' }}>{r.aUnit?f2(r.aUnit):'—'}</span>
                            {prvReal?.aUnit&&r.aUnit&&(
                              <button onClick={()=>openPct('Costo unitario ACS',r.anno,r.aUnit!,prvReal.anno,prvReal.aUnit!)}
                                style={{ display:'block', fontSize:9, color:r.aUnit>prvReal.aUnit?'var(--red)':'var(--green)', fontWeight:700, background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                {r.aUnit>prvReal.aUnit?'▲':'▼'}{Math.abs(pct(r.aUnit,prvReal.aUnit)).toFixed(1)}%
                              </button>
                            )}
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.afL)}</td>
                          <td style={{ padding:'6px 10px', textAlign:'right' }}>
                            <span style={{ fontWeight:700, color:'#3b82f6' }}>{r.afUnit?f2(r.afUnit):'—'}</span>
                            {prvReal?.afUnit&&r.afUnit&&(
                              <button onClick={()=>openPct('Costo unitario acqua fredda',r.anno,r.afUnit!,prvReal.anno,prvReal.afUnit!)}
                                style={{ display:'block', fontSize:9, color:r.afUnit>prvReal.afUnit?'var(--red)':'var(--green)', fontWeight:700, background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                {r.afUnit>prvReal.afUnit?'▲':'▼'}{Math.abs(pct(r.afUnit,prvReal.afUnit)).toFixed(1)}%
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ RENDICONTO ══ */}
      {tab==='Rendiconto' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <SectionHeader title="Rendiconto annuale" sub="Saldo = Inizio + Rate − Spese" onAdd={()=>{setEditY({...emptyY});setIsNew(true);}}/>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci i dati <strong>una volta l'anno</strong> quando ricevi il rendiconto SSA (ottobre/novembre). L'esercizio in corso è <strong>{CURRENT_EXERCISE}</strong>.
          </div>
          {editY && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?`+ Nuovo anno (${CURRENT_EXERCISE})`:`Modifica ${editY.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label>Anno esercizio</label><input value={editY.year_label||''} onChange={e=>setEditY((p:any)=>({...p,year_label:e.target.value}))} placeholder={`es. ${CURRENT_EXERCISE}`}/></div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Saldo iniziale</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="balance_start_casa" st={editY} fn={numY}/>
                    <NF lbl="Box 13"  fld="balance_start_box"  st={editY} fn={numY}/>
                    <NF lbl="Cantina" fld="balance_start_cantina" st={editY} fn={numY}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Rate versate</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="rates_paid_casa" st={editY} fn={numY}/>
                    <NF lbl="Box 13"  fld="rates_paid_box"  st={editY} fn={numY}/>
                    <NF lbl="Cantina" fld="rates_paid_cantina" st={editY} fn={numY}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Spese totali (Totale gestione dal riparto)</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="spese_totali_casa" st={editY} fn={numY}/>
                    <NF lbl="Box 13"  fld="spese_totali_box"  st={editY} fn={numY}/>
                    <NF lbl="Cantina" fld="spese_totali_cantina" st={editY} fn={numY}/>
                  </div>
                </div>
                <FormActions onCancel={()=>setEditY(null)} onSave={async()=>{await save('exercise_years',editY,setYears);setEditY(null);}}/>
              </div>
            </div>
          )}
          {/* Ordinamento: più recente in cima */}
          {sortNewestFirst(years).map((y) => {
            const sC=calcSaldo(y.balance_start_casa,y.rates_paid_casa,y.spese_totali_casa||0);
            const sB=calcSaldo(y.balance_start_box,y.rates_paid_box,y.spese_totali_box||0);
            const sCa=calcSaldo(y.balance_start_cantina,y.rates_paid_cantina,y.spese_totali_cantina||0);
            const tot=sC+sB+sCa;
            const isExp=expY===y.id;
            const isCurrent = y.year_label === CURRENT_EXERCISE;
            return (
              <div key={y.id} className="card" style={isCurrent ? currentCardStyle : undefined}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                      <span className="tag tag-blue">{y.year_label}</span>
                      {isCurrent && <CurrentBadge/>}
                      <Chip v={tot}/>
                    </div>
                    <p style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-display)', color:tot>=0?'var(--green)':'var(--red)', lineHeight:1 }}>€{fa(tot)}</p>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn-icon" onClick={()=>setExpY(isExp?null:y.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditY({...y});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('exercise_years',y.id,setYears)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {isExp && (
                  <>
                    <div className="divider"/>
                    <div className="grid3">
                      {([['App C63',sC],['Box 13',sB],['Cantina',sCa]] as [string,number][]).map(([l,v])=>(
                        <div key={l} style={{ textAlign:'center', padding:'8px 4px', background:v>=0?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${v>=0?'#bbf7d0':'#fecaca'}`, borderRadius:8 }}>
                          <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:3 }}>{l}</p>
                          <p style={{ fontSize:14, fontWeight:800, color:v>=0?'var(--green)':'var(--red)' }}>€{fa(v)}</p>
                          <p style={{ fontSize:9, fontWeight:700, color:v>=0?'var(--green)':'var(--red)', marginTop:1 }}>{v>=0?'credito':'debito'}</p>
                        </div>
                      ))}
                    </div>
                    <div className="divider"/>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, fontSize:11 }}>
                      {[['Inizio casa',y.balance_start_casa],['Inizio box',y.balance_start_box],['Inizio cant.',y.balance_start_cantina],
                        ['Rate casa',y.rates_paid_casa],['Rate box',y.rates_paid_box],['Rate cant.',y.rates_paid_cantina],
                        ['Spese casa',y.spese_totali_casa||0],['Spese box',y.spese_totali_box||0],['Spese cant.',y.spese_totali_cantina||0],
                      ].map(([l,v])=>(
                        <div key={l as string}><p style={{ color:'var(--text3)', fontSize:9, marginBottom:1 }}>{l}</p><p style={{ fontWeight:600 }}>€{fa(v as number)}</p></div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ SPESE ══ */}
      {tab==='Spese' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <SectionHeader title="Spese Fisse" sub="Dettaglio voci dal riparto SSA" onAdd={()=>{setEditF({...emptyF});setIsNew(true);}}/>
          </div>
          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ToggleBreakdown show={showBreakdownS} onToggle={()=>setShowBreakdownS(v=>!v)}/>
          </div>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci <strong>una volta l'anno</strong> copiando i valori dal documento "Riparto Consuntivo" SSA. Anno in corso: <strong>{CURRENT_EXERCISE}</strong>.
          </div>
          {editF && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?`Nuovo anno (${CURRENT_EXERCISE})`:`Modifica ${editF.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="grid2">
                  <div><label>Anno</label><input value={editF.year_label||''} onChange={e=>setEditF((p:any)=>({...p,year_label:e.target.value}))} placeholder={CURRENT_EXERCISE}/></div>
                  <NF lbl="Movimenti personali €" fld="spese_personali" st={editF} fn={numF} ph="cert. + addebiti"/>
                </div>
                <TI lbl="Spese Proprietà" pfx="prop" st={editF} fn={numF}/>
                <TI lbl="Spese Generali" pfx="gen_prop" st={editF} fn={numF}/>
                <TI lbl="Manutenzioni Ordinarie" pfx="man_ord" st={editF} fn={numF}/>
                <TI lbl="Scale di Proprietà (Scala C)" pfx="scale_prop" st={editF} fn={numF}/>
                <TI lbl="Scala C Gestione" pfx="scala_c" st={editF} fn={numF}/>
                <TI lbl="Ascensore C" pfx="asc_c" st={editF} fn={numF}/>
                <div className="grid3">
                  <NF lbl="Prop. alloggi €" fld="prop_alloggi" st={editF} fn={numF}/>
                  <NF lbl="Addebiti unità €" fld="addebiti_unita" st={editF} fn={numF}/>
                  <NF lbl="Add. unità imm. €" fld="addebiti_unita_imm" st={editF} fn={numF}/>
                  <NF lbl="En.el. box €" fld="prop_box_extra" st={editF} fn={numF}/>
                </div>
                <FormActions onCancel={()=>setEditF(null)} onSave={async()=>{await save('fixed_expenses',editF,setFixed);setEditF(null);}}/>
              </div>
            </div>
          )}
          {/* Più recente in cima */}
          {sortNewestFirst(fixed).map((r,i,arr) => {
            const tC=sfTot(r), tB=sfBox(r), tCa=sfCant(r), tot=tC+tB+tCa;
            // Confronto con esercizio in corso se non è già l'in corso
            const isCurrent = r.year_label === CURRENT_EXERCISE;
            const prvFixed = !isCurrent ? fixed.find(x=>x.year_label===CURRENT_EXERCISE) : null;
            const prvForDelta = arr[i+1]; // anno precedente nella lista (più vecchio, i+1 perché desc)
            const prvTot = prvForDelta ? sfTot(prvForDelta)+sfBox(prvForDelta)+sfCant(prvForDelta) : null;
            const isExp=expF===r.id;
            return (
              <div key={r.id} className="card" style={isCurrent ? currentCardStyle : undefined}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:6, flexWrap:'wrap' }}>
                      <span className="tag tag-purple">{r.year_label}</span>
                      {isCurrent && <CurrentBadge/>}
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <p style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-display)', lineHeight:1 }}>€{f0(tot)}</p>
                      {prvTot !== null && (
                        <button onClick={()=>openPct('Spese fisse totali',r.year_label,tot,prvForDelta!.year_label,prvTot)}
                          style={{ background:'transparent', border:'none', padding:0, cursor:'pointer' }}>
                          <Delta cur={tot} prev={prvTot} invert/>
                        </button>
                      )}
                    </div>
                    <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>totale spese fisse</p>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn-icon" onClick={()=>setExpF(isExp?null:r.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditF({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('fixed_expenses',r.id,setFixed)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {showBreakdownS && (
                  <>
                    <div className="divider"/>
                    <div className="grid3">
                      {([['App C63',tC],['Box 13',tB],['Cantina',tCa]] as [string,number][]).map(([l,v])=>(
                        <div key={l} style={{ textAlign:'center', padding:'7px 4px', background:'var(--bg3)', borderRadius:8 }}>
                          <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                          <p style={{ fontSize:13, fontWeight:800 }}>€{fa(v)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {isExp && (
                  <div style={{ marginTop:10 }}>
                    <div className="divider"/>
                    {[['Proprietà',r.prop_casa,r.prop_box,r.prop_cantina],['Generali',r.gen_prop_casa,r.gen_prop_box,r.gen_prop_cantina],['Man. Ord.',r.man_ord_casa,r.man_ord_box,r.man_ord_cantina],['Scale C',r.scale_prop_casa,r.scale_prop_box,r.scale_prop_cantina],['Scala C g.',r.scala_c_casa,r.scala_c_box,r.scala_c_cantina],['Ascens. C',r.asc_c_casa,r.asc_c_box,r.asc_c_cantina]].map(([l,c,b,ca])=>(
                      <div key={l as string} style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr', gap:4, fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                        <span style={{ color:'var(--text2)', fontWeight:600 }}>{l}</span>
                        <span style={{ textAlign:'right', fontWeight:600 }}>€{fa(c as number)}</span>
                        <span style={{ textAlign:'right', fontWeight:600 }}>€{fa(b as number)}</span>
                        <span style={{ textAlign:'right', fontWeight:600 }}>€{fa(ca as number)}</span>
                      </div>
                    ))}
                    {[['Prop. alloggi',r.prop_alloggi],['Add. unità',r.addebiti_unita],['Add. u. imm.',r.addebiti_unita_imm],['Mov. pers.',r.spese_personali]].map(([l,v])=>(
                      <div key={l as string} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                        <span style={{ color:'var(--text2)' }}>{l}</span><span style={{ fontWeight:700 }}>€{fa(v as number)}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ CONSUMI ══ */}
      {tab==='Consumi' && (
        <div ref={consumiTopRef} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Consumi" sub="Letture contatori + costi dal riparto" onAdd={()=>{setEditC({...emptyC});setIsNew(true);}}/>

          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', background:'var(--bg3)', borderRadius:20, padding:3, gap:2 }}>
              {(['euro','qty'] as const).map(v=>(
                <button key={v} onClick={()=>setConsumiView(v)} style={{ padding:'5px 12px', borderRadius:18, fontSize:12, fontWeight:600, background:consumiView===v?'#fff':'transparent', color:consumiView===v?'var(--accent)':'var(--text2)', boxShadow:consumiView===v?'var(--shadow-xs)':'none' }}>
                  {v==='euro'?'€ Costi':'Quantità'}
                </button>
              ))}
            </div>
            <ToggleBreakdown show={showBreakdownC} onToggle={()=>setShowBreakdownC(v=>!v)}/>
          </div>

          <div className="card">
            <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>{consumiView==='euro'?'Costi consumi nel tempo':'Quantità consumate nel tempo'}</p>
            <ResponsiveContainer width="100%" height={180}>
              {consumiView==='euro' ? (
                <BarChart data={cData} margin={{ left:-10, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
                  <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={50}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine x={CURRENT_EXERCISE} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2"/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="Risc." fill="#ef4444" stackId="a"/>
                  <Bar dataKey="ACS" fill="#f97316" stackId="a"/>
                  <Bar dataKey="Acq.fr." fill="#3b82f6" stackId="a" radius={[4,4,0,0]}/>
                </BarChart>
              ) : (
                <LineChart data={consumiQtyData} margin={{ left:-10, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
                  <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} width={50}/>
                  <Tooltip content={<ChartTipRaw suffix=""/>}/>
                  <ReferenceLine x={CURRENT_EXERCISE} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2"/>
                  <Legend wrapperStyle={{ fontSize:11 }}/>
                  <Line type="monotone" dataKey="Riscaldamento (cal)" stroke="#ef4444" strokeWidth={2} dot={{ fill:'#ef4444', r:3 }}/>
                  <Line type="monotone" dataKey="Acqua calda (L)" stroke="#f97316" strokeWidth={2} dot={{ fill:'#f97316', r:3 }}/>
                  <Line type="monotone" dataKey="Acqua fredda (L)" stroke="#3b82f6" strokeWidth={2} dot={{ fill:'#3b82f6', r:3 }}/>
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {/* Tabella costi unitari storica — più recente in cima */}
          {riassunto.some(r=>r.rUnit) && (
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
              <div style={{ padding:'8px 12px', background:'var(--bg3)', borderBottom:'1px solid var(--border)' }}>
                <p style={{ fontWeight:700, fontSize:12 }}>Costo unitario e quantità — storico</p>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'var(--bg3)' }}>
                      <th style={{ padding:'6px 10px', textAlign:'left', fontWeight:700, color:'var(--text2)', fontSize:10 }}>Anno</th>
                      <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#ef4444', fontSize:10 }}>Risc. cal</th>
                      <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#ef4444', fontSize:10 }}>€/cal Δ</th>
                      <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#f97316', fontSize:10 }}>ACS L</th>
                      <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#f97316', fontSize:10 }}>€/L Δ</th>
                      <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#3b82f6', fontSize:10 }}>Acq.fr. L</th>
                      <th style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#3b82f6', fontSize:10 }}>€/L Δ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortNewestFirstByAnno(riassunto.filter(r=>r.rKwh||r.aL||r.afL)).map((r,i,arr)=>{
                      // Confronto con anno precedente nella sequenza
                      const prvReal = riassunto[riassunto.findIndex(x=>x.anno===r.anno)-1];
                      const cell = (val: number|null, prvVal: number|null, col: string, label: string) => (
                        <td style={{ padding:'6px 10px', textAlign:'right' }}>
                          {val ? (
                            <>
                              <span style={{ fontWeight:700, color:col }}>{f2(val)}</span>
                              {prvVal && (
                                <button onClick={()=>openPct(label,r.anno,val,prvReal.anno,prvVal)}
                                  style={{ display:'block', fontSize:9, fontWeight:700, color:val>prvVal?'var(--red)':'var(--green)', background:'transparent', border:'none', cursor:'pointer', padding:0, textDecoration:'underline dotted' }}>
                                  {val>prvVal?'▲':'▼'}{Math.abs(pct(val,prvVal)).toFixed(1)}%
                                </button>
                              )}
                            </>
                          ) : <span style={{ color:'var(--text3)' }}>—</span>}
                        </td>
                      );
                      return (
                        <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)', background: r.isCurrent ? '#fffdf5' : undefined, borderLeft: r.isCurrent ? '3px solid #f59e0b' : 'none' }}>
                          <td style={{ padding:'6px 10px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:4 }}>
                              <span className="tag tag-blue">{r.anno}</span>
                              {r.isCurrent && <CurrentBadge/>}
                            </div>
                          </td>
                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.rKwh)}</td>
                          {cell(r.rUnit||null, prvReal?.rUnit||null, '#ef4444', 'Costo unitario riscaldamento')}
                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.aL)}</td>
                          {cell(r.aUnit||null, prvReal?.aUnit||null, '#f97316', 'Costo unitario ACS')}
                          <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.afL)}</td>
                          {cell(r.afUnit||null, prvReal?.afUnit||null, '#3b82f6', 'Costo unitario acqua fredda')}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {editC && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?`Nuovo anno (${CURRENT_EXERCISE})`:`Modifica ${editC.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label>Anno</label><input value={editC.year_label||''} onChange={e=>setEditC((p:any)=>({...p,year_label:e.target.value}))} placeholder={CURRENT_EXERCISE}/></div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Letture contatori</p>
                  <div className="grid2">
                    <NF lbl="Risc. iniziale" fld="risc_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Risc. finale" fld="risc_lettura_finale" st={editC} fn={numC}/>
                    <NF lbl="ACS iniziale" fld="acqua_calda_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="ACS finale" fld="acqua_calda_lettura_finale" st={editC} fn={numC}/>
                    <NF lbl="Acqua fredda iniziale" fld="acqua_fredda_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Acqua fredda finale" fld="acqua_fredda_lettura_finale" st={editC} fn={numC}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Costi dal Riparto (€)</p>
                  <div className="grid2">
                    <NF lbl="Riscaldamento consumo" fld="riscaldamento_consumo" st={editC} fn={numC}/>
                    <NF lbl="Riscaldamento involont." fld="riscaldamento_involontario" st={editC} fn={numC}/>
                    <NF lbl="ACS consumo" fld="acqua_calda_consumo" st={editC} fn={numC}/>
                    <NF lbl="ACS involontaria" fld="acqua_calda_involontaria" st={editC} fn={numC}/>
                    <NF lbl="Acqua potabile" fld="acqua_potabile" st={editC} fn={numC}/>
                    <NF lbl="Energia el. box" fld="energia_elettrica_box" st={editC} fn={numC}/>
                    <NF lbl="Movimenti personali" fld="movimenti_personali" st={editC} fn={numC}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Totali gestione</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="totale_casa" st={editC} fn={numC}/>
                    <NF lbl="Box 13" fld="totale_box" st={editC} fn={numC}/>
                    <NF lbl="Cantina" fld="totale_cantina" st={editC} fn={numC}/>
                  </div>
                </div>
                <FormActions onCancel={()=>setEditC(null)} onSave={async()=>{await save('consumption_data',editC,setConsumi);setEditC(null);}}/>
              </div>
            </div>
          )}

          {/* Più recente in cima */}
          {sortNewestFirst(consumi).map((r,i,arr) => {
            const tot=r.totale_casa+r.totale_box+r.totale_cantina;
            const prvReal = riassunto[riassunto.findIndex(x=>x.anno===r.year_label)-1];
            const prvTot=prvReal?prvReal.con:null;
            const rKwh=r.risc_lettura_finale&&r.risc_lettura_iniziale?r.risc_lettura_finale-r.risc_lettura_iniziale:null;
            const aL  =r.acqua_calda_lettura_finale&&r.acqua_calda_lettura_iniziale?r.acqua_calda_lettura_finale-r.acqua_calda_lettura_iniziale:null;
            const afL =r.acqua_fredda_lettura_finale&&r.acqua_fredda_lettura_iniziale?r.acqua_fredda_lettura_finale-r.acqua_fredda_lettura_iniziale:null;
            const rU  =rKwh&&r.riscaldamento_consumo?r.riscaldamento_consumo/rKwh:null;
            const aU  =aL&&r.acqua_calda_consumo?r.acqua_calda_consumo/aL:null;
            const afU =afL&&r.acqua_potabile?r.acqua_potabile/afL:null;
            const isExp=expC===r.id;
            const isCurrent = r.year_label === CURRENT_EXERCISE;
            const valChecks = [
              validaLetture(r.risc_lettura_iniziale,r.risc_lettura_finale,r.riscaldamento_consumo,'Riscaldamento'),
              validaLetture(r.acqua_calda_lettura_iniziale,r.acqua_calda_lettura_finale,r.acqua_calda_consumo,'Acqua calda'),
              validaLetture(r.acqua_fredda_lettura_iniziale,r.acqua_fredda_lettura_finale,r.acqua_potabile,'Acqua fredda'),
            ];
            const sortedC2 = [...consumi].sort((a,b)=>a.year_label.localeCompare(b.year_label));
            const rIdx = sortedC2.findIndex(x=>x.id===r.id);
            const nextC = rIdx < sortedC2.length-1 ? sortedC2[rIdx+1] : null;
            const prevC2 = rIdx > 0 ? sortedC2[rIdx-1] : null;
            const discChecksCard: ReturnType<typeof validaLetture>[] = [];
            if (nextC) { discChecksCard.push(validaContinuita(r.risc_lettura_finale, nextC.risc_lettura_iniziale, `Risc. →${nextC.year_label}`)); discChecksCard.push(validaContinuita(r.acqua_calda_lettura_finale, nextC.acqua_calda_lettura_iniziale, `ACS →${nextC.year_label}`)); discChecksCard.push(validaContinuita(r.acqua_fredda_lettura_finale, nextC.acqua_fredda_lettura_iniziale, `Acq.fr. →${nextC.year_label}`)); }
            if (prevC2) { discChecksCard.push(validaContinuita(prevC2.risc_lettura_finale, r.risc_lettura_iniziale, `Risc. ${prevC2.year_label}→`)); discChecksCard.push(validaContinuita(prevC2.acqua_calda_lettura_finale, r.acqua_calda_lettura_iniziale, `ACS ${prevC2.year_label}→`)); discChecksCard.push(validaContinuita(prevC2.acqua_fredda_lettura_finale, r.acqua_fredda_lettura_iniziale, `Acq.fr. ${prevC2.year_label}→`)); }
            const allChecks = [...valChecks, ...discChecksCard.filter(c=>!c.ok)];
            const hasErrors = allChecks.some(c=>c.severity==='error');
            const hasWarns  = allChecks.some(c=>!c.ok);
            const hasLetture = r.risc_lettura_iniziale!==null || r.acqua_calda_lettura_iniziale!==null;
            const statusBadge = !hasLetture ? null : hasErrors ? (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#dc2626', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:6, padding:'2px 7px' }}><AlertCircle size={11}/> Errore</span>
            ) : hasWarns ? (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#b45309', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:6, padding:'2px 7px' }}><AlertCircle size={11}/> Attenzione</span>
            ) : (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'var(--green)', background:'var(--green-bg)', border:'1px solid #a7f3d0', borderRadius:6, padding:'2px 7px' }}><Check size={11}/> Letture OK</span>
            );
            const cardBorder = isCurrent ? currentCardStyle : hasErrors ? { border:'2px solid #fca5a5' } : hasWarns ? { border:'2px solid #fde68a' } : undefined;
            return (
              <div key={r.id} className="card" style={cardBorder}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                      <span className="tag tag-blue">{r.year_label}</span>
                      {isCurrent && <CurrentBadge/>}
                      {statusBadge}
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <p style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-display)', lineHeight:1 }}>€{f0(tot)}</p>
                      {prvTot !== null && (
                        <button onClick={()=>openPct(`Consumi totali — ${prvReal.anno} → ${r.year_label}`, r.year_label, tot, prvReal.anno, prvTot)}
                          style={{ background:'transparent', border:'none', padding:0, cursor:'pointer' }}>
                          <Delta cur={tot} prev={prvTot} invert/>
                        </button>
                      )}
                    </div>
                    {(rKwh || aL || afL) && (
                      <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                        {rKwh && <span style={{ fontSize:10, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:5, padding:'2px 7px', color:'#991b1b' }}><strong>{fN(rKwh)} cal</strong>{rU?` · €${f2(rU)}/cal`:''}</span>}
                        {aL && <span style={{ fontSize:10, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:5, padding:'2px 7px', color:'#9a3412' }}><strong>{fN(aL)} L</strong>{aU?` · €${f2(aU)}/L`:''}</span>}
                        {afL && <span style={{ fontSize:10, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:5, padding:'2px 7px', color:'#1e40af' }}><strong>{fN(afL)} L</strong>{afU?` · €${f2(afU)}/L`:''}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:8 }}>
                    <button className="btn-icon" onClick={()=>setExpC(isExp?null:r.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditC({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('consumption_data',r.id,setConsumi)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {showBreakdownC && (
                  <>
                    <div className="divider"/>
                    <div className="grid3">
                      {([['App C63',r.totale_casa],['Box 13',r.totale_box],['Cantina',r.totale_cantina]] as [string,number][]).map(([l,v])=>(
                        <div key={l} style={{ textAlign:'center', padding:'7px 4px', background:'var(--bg3)', borderRadius:8 }}>
                          <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                          <p style={{ fontSize:13, fontWeight:800 }}>€{fa(v)}</p>
                        </div>
                      ))}
                    </div>
                  </>
                )}
                {isExp && <ConsumoDetail r={r} rKwh={rKwh} aL={aL} afL={afL} rU={rU} aU={aU} afU={afU} valChecks={valChecks} discChecksCard={discChecksCard}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ RATE ══ */}
      {tab==='Rate' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Rate pagate" sub={`${rates.length} pagamenti totali`} onAdd={()=>{setEditR({...emptyR});setIsNew(true);}}/>

          <div style={{ display:'flex', justifyContent:'flex-end' }}>
            <ToggleBreakdown show={showBreakdownR} onToggle={()=>setShowBreakdownR(v=>!v)}/>
          </div>

          {allYrsWithCurrent.some(yl=>rates.some(r=>r.year_label===yl)) && (
            <div className="card">
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Rate versate per anno</p>
              <ResponsiveContainer width="100%" height={130}>
                <BarChart data={riassunto.filter(r=>r.rateAnno>0)} margin={{ left:-10, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
                  <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={50}/>
                  <Tooltip content={<ChartTip/>}/>
                  <ReferenceLine x={CURRENT_EXERCISE} stroke="#f59e0b" strokeWidth={2} strokeDasharray="4 2"/>
                  <Bar dataKey="rateAnno" name="Rate versate" fill="#16a34a" radius={[5,5,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {editR && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo pagamento':'Modifica pagamento'}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div>
                  <label>Data pagamento</label>
                  <input type="date" value={editR.data_pagamento||''} onChange={e=>{
                    const d = e.target.value;
                    const m = new Date(d).getMonth()+1, yr = new Date(d).getFullYear();
                    const yl = m>=10 ? `${String(yr).slice(2)}/${String(yr+1).slice(2)}` : `${String(yr-1).slice(2)}/${String(yr).slice(2)}`;
                    setEditR((p:any)=>({...p,data_pagamento:d,year_label:yl}));
                  }}/>
                </div>
                <div>
                  <label>Importo totale (€) — ripartito automaticamente per millesimi</label>
                  <input type="number" step="0.01" placeholder="es. 413.50"
                    value={editR._importo_totale||''}
                    onChange={e=>{
                      const tot=parseFloat(e.target.value)||0;
                      const totM=3.394+0.576+0.059;
                      setEditR((p:any)=>({...p, _importo_totale:e.target.value, importo_casa:parseFloat((tot*3.394/totM).toFixed(2)), importo_box:parseFloat((tot*0.576/totM).toFixed(2)), importo_cantina:parseFloat((tot*0.059/totM).toFixed(2)) }));
                    }}/>
                </div>
                {(editR.importo_casa>0||editR.importo_box>0) && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {([['App C63',editR.importo_casa],['Box 13',editR.importo_box],['Cantina',editR.importo_cantina]] as [string,number][]).map(([l,v])=>(
                      <div key={l} style={{ textAlign:'center', background:'var(--accent-light)', borderRadius:8, padding:'7px 4px' }}>
                        <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                        <p style={{ fontSize:13, fontWeight:800, color:'var(--accent)' }}>€{fa(v)}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div><label>Note (opzionale)</label><input value={editR.descrizione||''} onChange={e=>strR('descrizione',e.target.value)} placeholder="Acconto, Conguaglio..."/></div>
                <FormActions onCancel={()=>setEditR(null)} onSave={async()=>{await save('rate_pagamenti',editR,setRates);setEditR(null);}}/>
              </div>
            </div>
          )}

          {/* Più recente in cima — esercizio in corso evidenziato */}
          {[...allYrsWithCurrent].sort((a,b)=>b.localeCompare(a)).map(yl => {
            const rAnno = rates.filter(r=>r.year_label===yl);
            const isCurrent = yl === CURRENT_EXERCISE;
            if (rAnno.length===0 && !isCurrent) return null;
            const totC  = rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0),0);
            const totB  = rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_box)||0),0);
            const totCa = rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_cantina)||0),0);
            const totAll = totC+totB+totCa;
            const yData = years.find(y=>y.year_label===yl);
            // Per l'esercizio in corso senza rendiconto usa il totale preventivo (spese fisse stimate)
            const PV_TOTAL = Object.values(PV).reduce((s,v)=>s+v,0);
            const atteso = yData
              ? yData.rates_paid_casa+yData.rates_paid_box+yData.rates_paid_cantina
              : (isCurrent ? PV_TOTAL : null);
            const atesoLabel = yData ? 'rendiconto SSA' : (isCurrent ? 'preventivo stimato' : '');
            const ok = atteso !== null && Math.abs(totAll-atteso)<1;
            const avgRata = rAnno.length > 0 ? totAll / rAnno.length : 0;
            return (
              <div key={yl} className="card" style={isCurrent ? currentCardStyle : undefined}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginBottom:4, flexWrap:'wrap' }}>
                      <span className="tag tag-blue">{yl}</span>
                      {isCurrent && <CurrentBadge/>}
                    </div>
                    <p style={{ fontWeight:800, fontSize:22, fontFamily:'var(--font-display)', lineHeight:1.1, marginTop:4 }}>
                      {totAll > 0 ? `€${fa(totAll)}` : <span style={{ color:'var(--text3)', fontSize:16 }}>Nessun pagamento registrato</span>}
                    </p>
                    {rAnno.length > 0 && <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{rAnno.length} {pluraleRate(rAnno.length)} · media €{fa(avgRata)} cad.</p>}
                  </div>
                  <div style={{ textAlign:'right' }}>
                    <p style={{ fontSize:11, color:'var(--text3)' }}>Totale (App+Box+Cant)</p>
                    {showBreakdownR && totAll > 0 && (
                      <div style={{ display:'flex', gap:8, marginTop:4, justifyContent:'flex-end', flexWrap:'wrap' }}>
                        {([['App',totC,'#16a34a'],['Box',totB,'#2563eb'],['Cant.',totCa,'#d97706']] as [string,number,string][]).map(([l,v,c])=>(
                          <span key={l} style={{ fontSize:11, fontWeight:700, color:c }}>{l}: €{fa(v)}</span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {atteso !== null && totAll > 0 && (
                  <div style={{ background:ok?'var(--green-bg)':'var(--amber-bg)', border:`1px solid ${ok?'#bbf7d0':'#fde68a'}`, borderRadius:8, padding:'6px 10px', fontSize:12, marginBottom:10, fontWeight:600, color:ok?'var(--green)':'var(--amber)', display:'flex', alignItems:'center', gap:6 }}>
                    {ok ? <Check size={13}/> : <AlertCircle size={13}/>}
                    {ok
                      ? `Totale corrisponde al ${atesoLabel}`
                      : `Atteso €${fa(atteso)} (${atesoLabel}) · versato €${fa(totAll)} · mancano €${fa(Math.max(0, atteso - totAll))}`}
                  </div>
                )}
                {rAnno.length === 0 && isCurrent && (
                  <div style={{ background:'#fffbeb', border:'1px solid #fde68a', borderRadius:8, padding:'8px 12px', fontSize:12, color:'#92400e' }}>
                    Registra il primo pagamento dell'esercizio {CURRENT_EXERCISE} dalla Home.
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {rAnno.map((r:any) => {
                    const tot=(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0);
                    return (
                      <div key={r.id} style={{ background:'var(--bg3)', borderRadius:8, overflow:'hidden' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', fontSize:12 }}>
                          <CreditCard size={13} color="var(--accent)"/>
                          <div style={{ flex:1 }}>
                            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                              <span style={{ fontWeight:700 }}>{r.numero_rata}</span>
                              <span style={{ color:'var(--text3)' }}>{fmtDate(r.data_pagamento)}</span>
                              {r.descrizione && <span style={{ color:'var(--text2)', fontSize:11 }}>{r.descrizione}</span>}
                            </div>
                            {showBreakdownR && (
                              <div style={{ display:'flex', gap:8, marginTop:2, fontSize:10, color:'var(--text3)' }}>
                                <span style={{ color:'#16a34a' }}>App €{fa(parseFloat(r.importo_casa)||0)}</span>
                                <span style={{ color:'#2563eb' }}>Box €{fa(parseFloat(r.importo_box)||0)}</span>
                                <span style={{ color:'#d97706' }}>Cant. €{fa(parseFloat(r.importo_cantina)||0)}</span>
                              </div>
                            )}
                          </div>
                          <div style={{ textAlign:'right' }}>
                            <p style={{ fontWeight:800, fontSize:15 }}>€{fa(tot)}</p>
                          </div>
                          <div style={{ display:'flex', gap:3 }}>
                            <button className="btn-icon" style={{ padding:5 }} onClick={()=>{setEditR({...r});setIsNew(false);}}><Pencil size={12}/></button>
                            <button className="btn-danger" style={{ padding:5 }} onClick={()=>del('rate_pagamenti',r.id,setRates)}><Trash2 size={12}/></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {atteso && totAll > 0 && (
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:4 }}>
                      <span>Versato vs atteso ({atesoLabel})</span>
                      <span>{Math.min(100, Math.round(totAll/atteso*100))}%</span>
                    </div>
                    <div style={{ background:'var(--bg3)', borderRadius:4, height:6, overflow:'hidden' }}>
                      <div style={{ width:`${Math.min(100, totAll/atteso*100)}%`, height:'100%', background: ok?'var(--green)':'var(--amber)', borderRadius:4, transition:'width 0.4s' }}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rates.length===0 && <p style={{ textAlign:'center', color:'var(--text3)', padding:24 }}>Nessuna rata registrata. Aggiungile dalla Home ogni volta che paghi.</p>}
        </div>
      )}

      {/* ══ CONFRONTO ══ */}
      {tab==='Confronto' && (
        <ConfriontoTab
          allYrs={allYrsWithCurrent}
          fixed={fixed}
          consumi={consumi}
          rates={rates}
          currentExercise={CURRENT_EXERCISE}
          PV={PV}
          P2526={P2526}
          openPct={openPct}
          fa={fa}
          f0={f0}
          f2={f2}
          pct={pct}
        />
      )}

      {/* ── Modal dettaglio % ── */}
      {pctModal && <PctModal {...pctModal} onClose={() => setPctModal(null)} />}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
// ConfriontoTab — Preventivo vs Consuntivo, tutti gli anni + in corso
// ══════════════════════════════════════════════════════════════
type PrevRow = { l: string; prev: number; diff: string; getCons: (f: any, c: any, rateAnno: number) => number | null };

const PREVENTIVI: Record<string, { rows: PrevRow[]; pvRate: number; note: string }> = {
  '25/26': {
    pvRate: Object.values(PV).reduce((s,v)=>s+v,0),
    note: 'Budget SSA ottobre 2025',
    rows: [
      { l:'Spese Proprietà',    prev: PV.prop,     diff:'52.129 × 3,394‰', getCons:(f:any)=>f?.prop_casa??null },
      { l:'Spese Generali',     prev: PV.gen,      diff:'149.737 × 3,394‰', getCons:(f:any)=>f?.gen_prop_casa??null },
      { l:'Manutenzioni',       prev: PV.man,      diff:'10.000 × 3,394‰', getCons:(f:any)=>f?.man_ord_casa??null },
      { l:'Scale + Asc. C',     prev: PV.scalac+PV.asc, diff:'(4.500+3.802) × 20,288‰', getCons:(f:any)=>f?(f.scale_prop_casa+f.scala_c_casa+f.asc_c_casa):null },
      { l:'Teleletture',        prev: PV.tele,     diff:'5.054 × 3,394‰', getCons:(f:any)=>f?.addebiti_unita_imm??null },
      { l:'Risc. involontario', prev: PV.risc_inv, diff:'35.349 × 3,394‰', getCons:(_f:any,c:any)=>c?.riscaldamento_involontario??null },
      { l:'ACS involontaria',   prev: PV.acs_inv,  diff:'31.638 × 3,394‰', getCons:(_f:any,c:any)=>c?.acqua_calda_involontaria??null },
      { l:'Risc. consumo',      prev: 0, diff:'da lettura contatore', getCons:(_f:any,c:any)=>c?.riscaldamento_consumo??null },
      { l:'ACS consumo',        prev: 0, diff:'da lettura contatore', getCons:(_f:any,c:any)=>c?.acqua_calda_consumo??null },
      { l:'Acqua potabile',     prev: 0, diff:'da lettura contatore', getCons:(_f:any,c:any)=>c?.acqua_potabile??null },
      { l:'Energia box',        prev: 70.45, diff:'stima da 24/25', getCons:(_f:any,c:any)=>c?.energia_elettrica_box??null },
      { l:'Mov. personali',     prev: 0, diff:'cert. + addebiti', getCons:(f:any)=>f?.spese_personali??null },
      { l:'Rate versate',       prev: Object.values(PV).reduce((s,v)=>s+v,0), diff:'totale preventivo', getCons:(_f:any,_c:any,r:number)=>r>0?r:null },
    ],
  },
  '24/25': {
    pvRate: 172.03+533.36+16.97+13.36+18.96+16.97+17.59,
    note: 'Budget SSA ottobre 2024',
    rows: [
      { l:'Spese Proprietà',  prev:172.03, diff:'50.687 × 3,394‰', getCons:(f:any)=>f?.prop_casa??null },
      { l:'Spese Generali',   prev:533.36, diff:'157.146 × 3,394‰', getCons:(f:any)=>f?.gen_prop_casa??null },
      { l:'Man. Ordinarie',   prev:16.97,  diff:'5.000 × 3,394‰', getCons:(f:any)=>f?.man_ord_casa??null },
      { l:'Scala C',          prev:13.36,  diff:'scale + gestione', getCons:(f:any)=>f?(f.scale_prop_casa+f.scala_c_casa):null },
      { l:'Ascensore C',      prev:18.96,  diff:'ascensore C', getCons:(f:any)=>f?.asc_c_casa??null },
      { l:'Prop. alloggi',    prev:16.97,  diff:'solo alloggi/negozi', getCons:(f:any)=>f?.prop_alloggi??null },
      { l:'Teleletture',      prev:17.59,  diff:'5.186 × 3,394‰', getCons:(f:any)=>f?.addebiti_unita_imm??null },
      { l:'Mov. personali',   prev:0,      diff:'cert. + addebiti', getCons:(f:any)=>f?.spese_personali??null },
      { l:'Rate versate',     prev:789.21, diff:'totale preventivo 24/25', getCons:(_f:any,_c:any,r:number)=>r>0?r:null },
    ],
  },
};

function ConfriontoTab({ allYrs, fixed, consumi, rates, currentExercise, openPct, fa, f0: _f0, f2: _f2, pct }: {
  allYrs: string[]; fixed: FixedExpenses[]; consumi: ConsumptionData[]; rates: any[];
  currentExercise: string;
  PV: typeof PV; P2526: typeof P2526;
  openPct: (title: string, curLabel: string, curVal: number, prevLabel: string, prevVal: number) => void;
  fa:(n:number)=>string; f0:(n:number)=>string; f2:(n:number)=>string; pct:(c:number,p:number)=>number;
}) {
  const anniConPreventivo = [...allYrs].filter(yl=>PREVENTIVI[yl]).sort((a,b)=>b.localeCompare(a));
  const [selectedAnno, setSelectedAnno] = useState<string>(
    currentExercise in PREVENTIVI ? currentExercise : (anniConPreventivo[0]||'')
  );

  if (anniConPreventivo.length===0) return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:800 }}>Confronto Preventivo / Consuntivo</h2>
      <p style={{ color:'var(--text3)', textAlign:'center', padding:24 }}>Nessun preventivo definito.</p>
    </div>
  );

  const fData = fixed.find(r=>r.year_label===selectedAnno);
  const cData = consumi.find(r=>r.year_label===selectedAnno);
  const rateAnno = rates
    .filter(r=>r.year_label===selectedAnno)
    .reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0),0);
  const pvDef = PREVENTIVI[selectedAnno];
  const isCurrent = selectedAnno === currentExercise;

  const rows = pvDef.rows.map(r=>({ ...r, cons: r.getCons(fData, cData, rateAnno) }));
  const tP = rows.reduce((s,r)=>s+r.prev,0);
  const tC_raw = rows.reduce((s,r)=>s+(r.cons??0),0);
  const hasSomeConsuntivo = rows.some(r=>r.cons!==null);

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:800 }}>Preventivo vs Consuntivo</h2>
      </div>

      {/* Selettore anno */}
      <div style={{ display:'flex', background:'var(--bg3)', borderRadius:12, padding:4, gap:2, overflowX:'auto', scrollbarWidth:'none' as const }}>
        {anniConPreventivo.map(yl=>(
          <button key={yl} onClick={()=>setSelectedAnno(yl)} style={{
            flex:'none', padding:'7px 14px', borderRadius:9, fontSize:13, fontWeight:700, whiteSpace:'nowrap',
            background: selectedAnno===yl?'#fff':'transparent',
            color: selectedAnno===yl?(yl===currentExercise?'#b45309':'var(--accent)'):'var(--text2)',
            boxShadow: selectedAnno===yl?'var(--shadow-xs)':'none',
            border: (selectedAnno===yl&&yl===currentExercise)?'1px solid #fde68a':'none',
          }}>
            {yl}{yl===currentExercise?' ★':''}
          </button>
        ))}
      </div>

      {/* Info anno */}
      <div style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:isCurrent?'#fffbeb':'var(--bg3)', border:`1px solid ${isCurrent?'#fde68a':'var(--border)'}`, borderRadius:10 }}>
        {isCurrent && <Star size={12} fill="#b45309" color="#b45309"/>}
        <span style={{ fontSize:12, fontWeight:700, color:isCurrent?'#b45309':'var(--text2)' }}>
          Esercizio <strong>{selectedAnno}</strong>{isCurrent?' — in corso':' — chiuso'}
        </span>
        <span style={{ fontSize:11, color:'var(--text3)', marginLeft:4 }}>{pvDef.note}</span>
      </div>

      {isCurrent && rateAnno>0 && (
        <div style={{ background:'var(--green-bg)', border:'1px solid #a7f3d0', borderRadius:10, padding:'8px 12px', fontSize:12, color:'var(--green)', display:'flex', justifyContent:'space-between' }}>
          <span>Rate versate finora ({selectedAnno})</span><strong>€{fa(rateAnno)}</strong>
        </div>
      )}

      {/* Tabella */}
      <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
        <div style={{ overflowX:'auto' }}>
          <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
            <thead>
              <tr style={{ background:'var(--bg3)' }}>
                {['Voce','Preventivo','Consuntivo','Δ €','Δ %'].map(h=>(
                  <th key={h} style={{ padding:'8px 10px', textAlign: h==='Voce'?'left':'right', fontWeight:700, color:'var(--text2)', fontSize:10, whiteSpace:'nowrap' as const }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r,i)=>{
                const hasC = r.cons!==null;
                const cons = r.cons??0;
                const diff = cons-r.prev;
                const dp = r.prev?pct(cons,r.prev):0;
                return (
                  <tr key={r.l} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'#fff':'var(--bg3)', opacity:!hasC?0.55:1 }}>
                    <td style={{ padding:'8px 10px' }}>
                      <p style={{ fontWeight:600 }}>{r.l}</p>
                      <p style={{ fontSize:9, color:'var(--text3)' }}>{r.diff}</p>
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right' }}>{r.prev>0?`€${fa(r.prev)}`:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>
                      {hasC?`€${fa(cons)}`:<span style={{ fontSize:10, color:'#b45309', fontStyle:'italic' }}>{isCurrent?'da inserire':'—'}</span>}
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:hasC?(diff>0?'var(--red)':'var(--green)'):'var(--text3)' }}>
                      {hasC?`${diff>=0?'+':'-'}€${fa(Math.abs(diff))}`:'—'}
                    </td>
                    <td style={{ padding:'8px 10px', textAlign:'right' }}>
                      {hasC&&r.prev>0?(
                        <button onClick={()=>openPct(`${r.l} — ${selectedAnno}`,`Consuntivo ${selectedAnno}`,cons,`Preventivo ${selectedAnno}`,r.prev)}
                          style={{ fontWeight:700, color:dp>0?'var(--red)':'var(--green)', background:dp>0?'var(--red-bg)':'var(--green-bg)', border:'none', borderRadius:5, padding:'2px 7px', fontSize:11, cursor:'pointer', textDecoration:'underline dotted' }}>
                          {dp>=0?'+':'-'}{Math.abs(dp).toFixed(1)}%
                        </button>
                      ):<span style={{ color:'var(--text3)' }}>—</span>}
                    </td>
                  </tr>
                );
              })}
              <tr style={{ background:'var(--accent-light)', fontWeight:800 }}>
                <td style={{ padding:'8px 10px', fontWeight:800 }}>
                  TOTALE{hasSomeConsuntivo&&isCurrent&&<span style={{ fontSize:9, fontWeight:400, color:'#b45309', marginLeft:4 }}>(parziale)</span>}
                </td>
                <td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(tP)}</td>
                <td style={{ padding:'8px 10px', textAlign:'right' }}>{hasSomeConsuntivo?`€${fa(tC_raw)}`:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                <td style={{ padding:'8px 10px', textAlign:'right', color:(tC_raw-tP)>0?'var(--red)':'var(--green)' }}>
                  {hasSomeConsuntivo?`${(tC_raw-tP)>=0?'+':'-'}€${fa(Math.abs(tC_raw-tP))}`:'—'}
                </td>
                <td style={{ padding:'8px 10px', textAlign:'right' }}>
                  {hasSomeConsuntivo&&tP>0?(
                    <button onClick={()=>openPct(`Totale — ${selectedAnno}`,`Consuntivo ${selectedAnno}`,tC_raw,`Preventivo ${selectedAnno}`,tP)}
                      style={{ fontWeight:800, color:pct(tC_raw,tP)>0?'var(--red)':'var(--green)', background:pct(tC_raw,tP)>0?'var(--red-bg)':'var(--green-bg)', border:'none', borderRadius:5, padding:'2px 7px', fontSize:12, cursor:'pointer', textDecoration:'underline dotted' }}>
                      {pct(tC_raw,tP)>=0?'+':'-'}{Math.abs(pct(tC_raw,tP)).toFixed(1)}%
                    </button>
                  ):'—'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Grafico */}
      {hasSomeConsuntivo && (
        <div className="card">
          <p style={{ fontWeight:700, fontSize:12, marginBottom:10 }}>Confronto grafico {selectedAnno}</p>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={rows.filter(r=>r.prev>0||r.cons!==null).map(r=>({ l:r.l, prev:r.prev, cons:r.cons??0 }))} margin={{ left:-10, right:8, top:4, bottom:36 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
              <XAxis dataKey="l" tick={{ fill:'#94a3b8', fontSize:9 }} axisLine={false} tickLine={false} angle={-35} textAnchor="end" interval={0}/>
              <YAxis tick={{ fill:'#94a3b8', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={(v:number)=>`€${v}`} width={48}/>
              <Tooltip content={<ChartTip/>}/>
              <Legend wrapperStyle={{ fontSize:11 }}/>
              <Bar dataKey="prev" name="Preventivo" fill="#94a3b8" radius={[3,3,0,0]}/>
              <Bar dataKey="cons" name="Consuntivo" fill={isCurrent?'#f59e0b':'#2563eb'} radius={[3,3,0,0]}/>
            </BarChart>
          </ResponsiveContainer>
          {isCurrent&&<p style={{ fontSize:10, color:'#b45309', textAlign:'center', marginTop:4 }}>★ Consuntivo parziale — si aggiorna man mano che inserisci dati</p>}
        </div>
      )}

      <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:12, padding:'12px 14px', fontSize:12, color:'var(--blue)' }}>
        <strong>Millesimi (riparto SSA 10/12/2025):</strong> App C63: 3,394‰ prop · 3,394‰ gen · 20,288‰ scala C — Box 13: 0,576‰ prop · 3,443‰ scala C — Cantina: 0,059‰
      </div>
    </div>
  );
}
