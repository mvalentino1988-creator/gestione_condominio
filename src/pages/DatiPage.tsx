import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData } from '../types';
import {
  Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, CreditCard, AlertCircle, ArrowUpDown, Eye, EyeOff
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
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
const sign = (n: number) => n >= 0 ? '+' : '−';

const getAnnoEsercizio = (date: Date = new Date()): string => {
  const m = date.getMonth() + 1;
  const y = date.getFullYear();
  return m >= 10
    ? `${String(y).slice(2)}/${String(y + 1).slice(2)}`
    : `${String(y - 1).slice(2)}/${String(y).slice(2)}`;
};

const MILL = { prop: 3.394, gen: 3.394, scalac: 20.288, box_prop: 0.576, box_gen: 0.576, box_scalac: 3.443, cant_prop: 0.059, cant_gen: 0.059 };
const P2526 = { prop: 52129.06, gen: 149737.47, man: 10000.00, scalac: 4500.00, asc_c: 3802.22, tele: 5054.50, risc_inv: 35349.04, acs_inv: 31638.80 };
const PV = {
  prop:     P2526.prop     * MILL.prop    / 1000,
  gen:      P2526.gen      * MILL.gen     / 1000,
  man:      P2526.man      * MILL.prop    / 1000,
  scalac:   P2526.scalac   * MILL.scalac  / 1000,
  asc:      P2526.asc_c    * MILL.scalac  / 1000,
  tele:     P2526.tele     * MILL.prop    / 1000,
  risc_inv: P2526.risc_inv * MILL.prop    / 1000,
  acs_inv:  P2526.acs_inv  * MILL.prop    / 1000,
};

const TABS = ['Riepilogo','Rendiconto','Spese','Consumi','Rate','Confronto','Preventivo'] as const;
type Tab = typeof TABS[number];

// ── Toolbar compatta: sort + breakdown in un'unica riga ───────
function Toolbar({
  sortAsc, onSort,
  showBreakdown, onBreakdown,
  showSort = true, showBreakdownToggle = true,
  extraLeft,
}: {
  sortAsc: boolean;
  onSort: () => void;
  showBreakdown: boolean;
  onBreakdown: () => void;
  showSort?: boolean;
  showBreakdownToggle?: boolean;
  extraLeft?: React.ReactNode;
}) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:2 }}>
      {extraLeft}
      <div style={{ marginLeft:'auto', display:'flex', gap:6, alignItems:'center' }}>
        {showBreakdownToggle && (
          <button onClick={onBreakdown} style={{
            display:'inline-flex', alignItems:'center', gap:4,
            background: showBreakdown ? 'var(--accent-light)' : 'var(--bg3)',
            border: `1px solid ${showBreakdown ? 'var(--accent-mid)' : 'var(--border)'}`,
            borderRadius:20, padding:'4px 10px', fontSize:10, fontWeight:700,
            color: showBreakdown ? 'var(--accent)' : 'var(--text3)', cursor:'pointer',
            whiteSpace:'nowrap',
          }}>
            {showBreakdown ? <EyeOff size={9}/> : <Eye size={9}/>}
            {showBreakdown ? 'Nascondi' : 'Per unità'}
          </button>
        )}
        {showSort && (
          <button onClick={onSort} style={{
            display:'inline-flex', alignItems:'center', gap:4,
            background:'var(--bg3)', border:'1px solid var(--border)',
            borderRadius:20, padding:'4px 10px', fontSize:10, fontWeight:700,
            color:'var(--text3)', cursor:'pointer', whiteSpace:'nowrap',
          }}>
            <ArrowUpDown size={9}/>
            {sortAsc ? 'Vecchi prima' : 'Recenti prima'}
          </button>
        )}
      </div>
    </div>
  );
}

// ── Tabs: scrollabile su mobile, select su schermi piccoli ───
function Tabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <>
      {/* Select per mobile (< 420px circa) */}
      <div className="hide-desktop" style={{ width:'100%' }}>
        <select
          value={active}
          onChange={e => onChange(e.target.value as Tab)}
          style={{ fontWeight:700, background:'var(--bg3)', border:'1.5px solid var(--border2)' }}
        >
          {TABS.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      {/* Scroll tabs per schermi più grandi */}
      <div className="hide-mobile" style={{
        display:'flex', background:'var(--bg3)', borderRadius:12,
        padding:3, gap:2, overflowX:'auto', WebkitOverflowScrolling:'touch',
        scrollbarWidth:'none' as const, msOverflowStyle:'none',
      }}>
        {TABS.map(t => (
          <button key={t} onClick={() => onChange(t)} style={{
            flex:'none', padding:'7px 11px', borderRadius:9, fontSize:12, fontWeight:700,
            whiteSpace:'nowrap', border:'none',
            background: active===t ? '#fff' : 'transparent',
            color: active===t ? 'var(--accent)' : 'var(--text2)',
            boxShadow: active===t ? 'var(--shadow-xs)' : 'none',
          }}>{t}</button>
        ))}
      </div>
    </>
  );
}

// ── PctModal ──────────────────────────────────────────────────
type PctModalData = { title: string; curLabel: string; curVal: number; prevLabel: string; prevVal: number; pct: number };

function PctModal({ title, curLabel, curVal, prevLabel, prevVal, pct: pctVal, onClose }: PctModalData & { onClose: () => void }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,24,20,0.5)', zIndex:500, display:'flex', alignItems:'center', justifyContent:'center', padding:16, backdropFilter:'blur(4px)' }} onClick={onClose}>
      <div className="card fade-up" style={{ width:'100%', maxWidth:320, padding:20, boxShadow:'var(--shadow-lg)' }} onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, flex:1, marginRight:8 }}>{title}</p>
          <button onClick={onClose} style={{ background:'transparent', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:20, lineHeight:1, padding:0, flexShrink:0 }}>×</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
            {[{l:prevLabel,v:prevVal},{l:curLabel,v:curVal}].map(({l,v})=>(
              <div key={l} style={{ background:'var(--bg3)', borderRadius:10, padding:'10px', textAlign:'center' }}>
                <p style={{ fontSize:10, color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', marginBottom:4 }}>{l}</p>
                <p style={{ fontWeight:700, fontSize:17, fontFamily:'var(--font-display)' }}>€{f0(v)}</p>
              </div>
            ))}
          </div>
          <div style={{ background:'var(--bg3)', borderRadius:10, padding:'10px 12px' }}>
            <p style={{ fontSize:11, color:'var(--text2)', marginBottom:4 }}>Formula</p>
            <p style={{ fontSize:11, fontFamily:'monospace', color:'var(--text)', lineHeight:1.6 }}>({f0(curVal)} − {f0(prevVal)}) ÷ |{f0(prevVal)}| × 100</p>
            <p style={{ fontSize:15, fontWeight:700, color:pctVal>0?'var(--red)':'var(--green)', marginTop:6 }}>= {pctVal>0?'+':''}{pctVal.toFixed(1)}%</p>
          </div>
          <p style={{ fontSize:11, color:'var(--text3)', textAlign:'center' }}>{pctVal>0?'▲ Aumentato':'▼ Diminuito'} di €{f0(Math.abs(curVal-prevVal))}</p>
        </div>
      </div>
    </div>
  );
}

// ── Validazione ───────────────────────────────────────────────
function validaContinuita(finPrec: number|null, iniCurr: number|null, label: string) {
  if (finPrec===null||iniCurr===null) return {ok:true,msg:'',severity:'ok' as const};
  if (finPrec!==iniCurr) return {ok:false,msg:`${label}: fine prec. (${finPrec.toLocaleString('it-IT')}) ≠ inizio corr. (${iniCurr.toLocaleString('it-IT')})`,severity:'warn' as const};
  return {ok:true,msg:'',severity:'ok' as const};
}
function validaLetture(ini: number|null, fin: number|null, costo: number, label: string) {
  if (ini===null||fin===null) return {ok:true,msg:'',severity:'ok' as const};
  const delta=fin-ini;
  if (delta<0) return {ok:false,msg:`${label}: finale (${fin}) < iniziale (${ini})`,severity:'error' as const};
  if (delta===0&&costo>0) return {ok:false,msg:`${label}: consumo zero ma costo €${fa(costo)}`,severity:'warn' as const};
  if (costo<=0&&delta>0) return {ok:false,msg:`${label}: consumo ${delta} ma costo zero`,severity:'warn' as const};
  const u=costo/delta;
  if (label.includes('Risc')&&(u<0.05||u>2)) return {ok:false,msg:`${label}: €${f2(u)}/cal anomalo`,severity:'warn' as const};
  if (label.includes('calda')&&(u<0.05||u>2)) return {ok:false,msg:`${label}: €${f2(u)}/L anomalo`,severity:'warn' as const};
  if (label.includes('fredda')&&(u<0.005||u>0.5)) return {ok:false,msg:`${label}: €${f2(u)}/L anomalo`,severity:'warn' as const};
  return {ok:true,msg:'',severity:'ok' as const};
}

// ── Micro-components ──────────────────────────────────────────
function Chip({ v }: { v: number }) {
  return (
    <span style={{ fontSize:11, fontWeight:700, color:v>=0?'var(--green)':'var(--red)', background:v>=0?'var(--green-bg)':'var(--red-bg)', borderRadius:20, padding:'2px 8px', border:`1px solid ${v>=0?'var(--accent-mid)':'#f0b8b4'}`, whiteSpace:'nowrap', flexShrink:0 }}>
      {v>=0?'▲':'▼'} €{fa(Math.abs(v))}
    </span>
  );
}

function InProgressBadge() {
  return <span style={{ fontSize:10, fontWeight:700, color:'var(--amber)', background:'var(--amber-bg)', borderRadius:20, padding:'2px 7px', border:'1px solid #f0d880', whiteSpace:'nowrap', flexShrink:0 }}>In corso</span>;
}

function Delta({ cur, prev, invert=false, onClick }: { cur:number; prev:number|null; invert?:boolean; onClick?:()=>void }) {
  if (prev===null||prev===0) return null;
  const d=pct(cur,prev), diff=cur-prev, up=diff>0;
  const good=invert?!up:up;
  const el=(
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:700,
      color:good?'var(--red)':'var(--green)', background:good?'var(--red-bg)':'var(--green-bg)',
      borderRadius:20, padding:'1px 6px', flexShrink:0 }}>
      {up?<TrendingUp size={9}/>:<TrendingDown size={9}/>}
      {up?'+':'−'}{Math.abs(d).toFixed(1)}%
    </span>
  );
  if (onClick) return <button onClick={onClick} style={{ background:'transparent', border:'none', padding:0, cursor:'pointer', flexShrink:0 }}>{el}</button>;
  return el;
}

const ChartTip = ({ active, payload, label }: any) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:8, padding:'8px 10px', fontSize:11, boxShadow:'var(--shadow-md)' }}>
      <p style={{ fontWeight:700, marginBottom:3 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color:p.color, marginTop:2 }}>{p.name}: {typeof p.value==='number'?`€${p.value.toLocaleString('it-IT',{maximumFractionDigits:0})}`:p.value}</p>)}
    </div>
  );
};

function NF({ lbl, fld, st, fn, ph }: { lbl:string; fld:string; st:any; fn:(f:string,v:string)=>void; ph?:string }) {
  return (
    <div>
      <label>{lbl}</label>
      <input type="number" step="0.01" value={st?.[fld]??''} placeholder={ph||'0'} onChange={e=>fn(fld,e.target.value)}/>
    </div>
  );
}

function TI({ lbl, pfx, st, fn }: { lbl:string; pfx:string; st:any; fn:(f:string,v:string)=>void }) {
  return (
    <div>
      <p style={{ fontSize:11, fontWeight:700, color:'var(--accent)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:5 }}>{lbl}</p>
      <div className="grid3">
        {(['casa','box','cantina'] as const).map(t=>(
          <div key={t}>
            <label>{t==='casa'?'C63':t==='box'?'Box':'Cant.'}</label>
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
    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
      <div style={{ minWidth:0 }}>
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:700 }}>{title}</h2>
        {sub&&<p style={{ color:'var(--text3)', fontSize:11, marginTop:1 }}>{sub}</p>}
      </div>
      {onAdd&&<button className="btn-primary" onClick={onAdd} style={{ flexShrink:0 }}><Plus size={13}/>Nuovo</button>}
    </div>
  );
}

// Card riga con saldo: layout compatto
function YearCard({ label, badge, isCur, total, color, children, onEdit, onDelete, onExpand, isExpanded }: {
  label:string; badge?:React.ReactNode; isCur?:boolean; total:string; color:string;
  children?:React.ReactNode; onEdit:()=>void; onDelete:()=>void; onExpand:()=>void; isExpanded:boolean;
}) {
  return (
    <div className="card" style={{ borderLeft: isCur ? '3px solid var(--accent)' : undefined }}>
      <div style={{ display:'flex', alignItems:'center', gap:8, minWidth:0 }}>
        {/* Anno + badge */}
        <div style={{ display:'flex', alignItems:'center', gap:5, flexShrink:0 }}>
          <span className="tag tag-blue">{label}</span>
          {badge}
        </div>
        {/* Totale */}
        <p style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:700, color, marginLeft:4, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
          {total}
        </p>
        {/* Azioni */}
        <div style={{ display:'flex', gap:4, flexShrink:0 }}>
          <button className="btn-icon" style={{ padding:6 }} onClick={onExpand}>{isExpanded?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
          <button className="btn-icon" style={{ padding:6 }} onClick={onEdit}><Pencil size={13}/></button>
          <button className="btn-danger" style={{ padding:6 }} onClick={onDelete}><Trash2 size={13}/></button>
        </div>
      </div>
      {children}
    </div>
  );
}

// ConsumoDetail — sub-tabs letture/costi/totali
function ConsumoDetail({ r, rKwh, aL, afL, rU, aU, afU, valChecks, discChecksCard }: {
  r:any; rKwh:number|null; aL:number|null; afL:number|null;
  rU:number|null; aU:number|null; afU:number|null;
  valChecks: ReturnType<typeof validaLetture>[];
  discChecksCard: ReturnType<typeof validaLetture>[];
}) {
  const [dt,setDt]=useState<'letture'|'costi'|'totali'>('letture');
  const allIssues=[...valChecks,...discChecksCard].filter(c=>!c.ok);
  const tabBtn=(id:typeof dt)=>({
    flex:1, padding:'6px 0', borderRadius:7, fontSize:11, fontWeight:700, border:'none' as const,
    background:dt===id?'#fff':'transparent',
    color:dt===id?'var(--accent)':'var(--text2)',
    boxShadow:dt===id?'var(--shadow-xs)':undefined,
  });
  return (
    <div style={{ marginTop:10 }}>
      <div className="divider"/>
      <div style={{ display:'flex', background:'var(--bg3)', borderRadius:10, padding:3, gap:2, marginBottom:10 }}>
        <button style={tabBtn('letture')} onClick={()=>setDt('letture')}>
          Letture{allIssues.length>0&&<span style={{ display:'inline-block', width:6, height:6, background:'#f59e0b', borderRadius:'50%', marginLeft:3, verticalAlign:'middle' }}/>}
        </button>
        <button style={tabBtn('costi')} onClick={()=>setDt('costi')}>Costi</button>
        <button style={tabBtn('totali')} onClick={()=>setDt('totali')}>Totali</button>
      </div>
      {dt==='letture'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          {allIssues.length>0&&(
            <div style={{ background:'var(--amber-bg)', border:'1.5px solid #f0d880', borderRadius:9, padding:'8px 10px' }}>
              {allIssues.map((c,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:5, fontSize:11, color:c.severity==='error'?'var(--red)':'var(--amber)', fontWeight:600, marginTop:i>0?4:0 }}>
                  <AlertCircle size={11} style={{ flexShrink:0, marginTop:1 }}/>{c.msg}
                </div>
              ))}
            </div>
          )}
          {([
            [r.risc_lettura_iniziale,r.risc_lettura_finale,rKwh,r.riscaldamento_consumo,'Riscaldamento','cal','#ef4444',valChecks[0]],
            [r.acqua_calda_lettura_iniziale,r.acqua_calda_lettura_finale,aL,r.acqua_calda_consumo,'Acqua calda','L','#f97316',valChecks[1]],
            [r.acqua_fredda_lettura_iniziale,r.acqua_fredda_lettura_finale,afL,r.acqua_potabile,'Acqua fredda','L','#3b82f6',valChecks[2]],
          ] as [number|null,number|null,number|null,number,string,string,string,ReturnType<typeof validaLetture>][]).map(([ini,fin,cons,costo,nome,unit,col,chk])=>{
            if(ini===null&&fin===null) return null;
            const rowErr=chk&&!chk.ok;
            const cu=cons&&costo?costo/cons:null;
            return (
              <div key={nome} style={{ background:rowErr?(chk.severity==='error'?'var(--red-bg)':'var(--amber-bg)'):'var(--bg3)', border:rowErr?`1px solid ${chk.severity==='error'?'#f0b8b4':'#f0d880'}`:'1px solid transparent', borderRadius:8, padding:'8px 10px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:4 }}>
                  <span style={{ fontWeight:700, fontSize:12, color:col }}>{nome}</span>
                  {rowErr&&<AlertCircle size={11} color={chk.severity==='error'?'var(--red)':'#f59e0b'}/>}
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center', fontSize:11 }}>
                  <span style={{ color:'var(--text2)' }}>{ini!==null?ini.toLocaleString('it-IT'):'—'} → {fin!==null?fin.toLocaleString('it-IT'):'—'} {unit}</span>
                  {cons!==null&&<span style={{ fontWeight:700 }}>Δ {fN(cons)} {unit}</span>}
                  {cu&&<span style={{ fontWeight:700, color:col }}>€{f2(cu)}/{unit}</span>}
                </div>
              </div>
            );
          })}
        </div>
      )}
      {dt==='costi'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
          {([
            ['Risc. consumo',r.riscaldamento_consumo],
            ['Risc. involont.',r.riscaldamento_involontario],
            ['ACS consumo',r.acqua_calda_consumo],
            ['ACS involontaria',r.acqua_calda_involontaria],
            ['Acqua potabile',r.acqua_potabile],
            ['Energia box',r.energia_elettrica_box],
            ['Mov. personali',r.movimenti_personali],
          ] as [string,number][]).map(([l,v])=>(
            <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', padding:'6px 10px', background:'var(--bg3)', borderRadius:7, fontSize:12 }}>
              <span style={{ color:'var(--text2)' }}>{l}</span>
              <span style={{ fontWeight:700 }}>€{fa(v)}</span>
            </div>
          ))}
        </div>
      )}
      {dt==='totali'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div className="grid3">
            {([['C63',r.totale_casa],['Box',r.totale_box],['Cant.',r.totale_cantina]] as [string,number][]).map(([l,v])=>(
              <div key={l} style={{ textAlign:'center', padding:'9px 4px', background:'var(--bg3)', borderRadius:8 }}>
                <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                <p style={{ fontSize:13, fontWeight:700 }}>€{fa(v)}</p>
              </div>
            ))}
          </div>
          <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 10px', background:'var(--accent-light)', borderRadius:8, fontSize:13 }}>
            <span style={{ fontWeight:700 }}>Totale</span>
            <span style={{ fontWeight:700, color:'var(--accent)' }}>€{fa(r.totale_casa+r.totale_box+r.totale_cantina)}</span>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════
export default function DatiPage({ property }: { property: Property }) {
  const [tab,      setTab]     = useState<Tab>('Riepilogo');
  const [years,    setYears]   = useState<any[]>([]);
  const [fixed,    setFixed]   = useState<FixedExpenses[]>([]);
  const [consumi,  setConsumi] = useState<ConsumptionData[]>([]);
  const [rates,    setRates]   = useState<any[]>([]);
  const [loading,  setLoading] = useState(true);
  const [editY,    setEditY]   = useState<any>(null);
  const [editF,    setEditF]   = useState<any>(null);
  const [editC,    setEditC]   = useState<any>(null);
  const [editR,    setEditR]   = useState<any>(null);
  const [isNew,    setIsNew]   = useState(false);
  const [expY,     setExpY]    = useState<string|null>(null);
  const [expF,     setExpF]    = useState<string|null>(null);
  const [expC,     setExpC]    = useState<string|null>(null);
  const [pctModal, setPctModal] = useState<PctModalData|null>(null);

  // Breakdown toggles
  const [bdRiep, setBdRiep] = useState(false);
  const [bdSpese, setBdSpese] = useState(false);
  const [bdConsumi, setBdConsumi] = useState(false);
  const [bdRate, setBdRate] = useState(false);

  // Sort (false = più recente prima)
  const [sortYears,   setSortYears]   = useState(false);
  const [sortFixed,   setSortFixed]   = useState(false);
  const [sortConsumi, setSortConsumi] = useState(false);
  const [sortRates,   setSortRates]   = useState(false);

  // Vista consumi
  const [consumiView, setConsumiView] = useState<'euro'|'qty'>('euro');

  const annoCorrente = getAnnoEsercizio();

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

  useEffect(()=>{load();},[load]);

  if (loading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:'60px 0' }}>
      <div style={{ width:18, height:18, borderRadius:'50%', border:'2px solid var(--border2)', borderTopColor:'var(--accent)', animation:'spin 0.6s linear infinite' }}/>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  // ── CRUD ──────────────────────────────────────────────────
  const save = async (table:string, obj:any, setFn:(fn:(p:any[])=>any[])=>void) => {
    const {data}=obj.id
      ?await supabase.from(table).update(obj).eq('id',obj.id).select().single()
      :await supabase.from(table).insert(obj).select().single();
    if(data) setFn(p=>isNew?[...p,data]:p.map((r:any)=>r.id===data.id?data:r));
  };
  const del = async (table:string, id:string, setFn:(fn:(p:any[])=>any[])=>void) => {
    if(!confirm('Eliminare?')) return;
    await supabase.from(table).delete().eq('id',id);
    setFn(p=>p.filter((r:any)=>r.id!==id));
  };

  const numY=(f:string,v:string)=>setEditY((p:any)=>({...p,[f]:parseFloat(v)||0}));
  const numF=(f:string,v:string)=>setEditF((p:any)=>({...p,[f]:parseFloat(v)||0}));
  const numC=(f:string,v:string)=>setEditC((p:any)=>({...p,[f]:v===''?null:parseFloat(v)||0}));
  const strR=(f:string,v:string)=>setEditR((p:any)=>({...p,[f]:v}));

  // ── Derived data ─────────────────────────────────────────
  const allYrsSet = new Set([
    ...years.map(y=>y.year_label),
    ...fixed.map(f=>f.year_label),
    ...consumi.map(c=>c.year_label),
    annoCorrente,
  ]);
  const allYrs=[...allYrsSet].sort();

  const sfTot=(f:FixedExpenses)=>f.prop_casa+f.gen_prop_casa+f.man_ord_casa+f.scale_prop_casa+f.scala_c_casa+f.asc_c_casa+f.prop_alloggi+f.addebiti_unita+f.addebiti_unita_imm+f.spese_personali;
  const sfBox=(f:FixedExpenses)=>f.prop_box+f.gen_prop_box+f.man_ord_box+f.scale_prop_box+f.scala_c_box+f.asc_c_box+f.prop_box_extra;
  const sfCant=(f:FixedExpenses)=>f.prop_cantina+f.gen_prop_cantina+f.man_ord_cantina+f.scale_prop_cantina+f.scala_c_cantina+f.asc_c_cantina;

  const riassunto=allYrs.map(yl=>{
    const y=years.find(r=>r.year_label===yl);
    const f=fixed.find(r=>r.year_label===yl) as FixedExpenses|undefined;
    const c=consumi.find(r=>r.year_label===yl);
    const sf=f?sfTot(f):null;
    const con=c?c.totale_casa:null;
    const sC=y?calcSaldo(y.balance_start_casa,y.rates_paid_casa,y.spese_totali_casa||0):null;
    const sB=y?calcSaldo(y.balance_start_box,y.rates_paid_box,y.spese_totali_box||0):null;
    const sCa=y?calcSaldo(y.balance_start_cantina,y.rates_paid_cantina,y.spese_totali_cantina||0):null;
    const rKwh=c&&c.risc_lettura_finale&&c.risc_lettura_iniziale?c.risc_lettura_finale-c.risc_lettura_iniziale:null;
    const aL=c&&c.acqua_calda_lettura_finale&&c.acqua_calda_lettura_iniziale?c.acqua_calda_lettura_finale-c.acqua_calda_lettura_iniziale:null;
    const afL=c&&c.acqua_fredda_lettura_finale&&c.acqua_fredda_lettura_iniziale?c.acqua_fredda_lettura_finale-c.acqua_fredda_lettura_iniziale:null;
    const rateAnno=rates.filter(r=>r.year_label===yl).reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0),0);
    const rateCount=rates.filter(r=>r.year_label===yl).length;
    return {
      anno:yl, sf, con, tot:sf!==null&&con!==null?sf+con:sf??con,
      sC, sB, sCa, sTot:sC!==null&&sB!==null&&sCa!==null?sC+sB+sCa:null,
      rKwh, rCosto:c?.riscaldamento_consumo, rUnit:rKwh&&c?.riscaldamento_consumo?c.riscaldamento_consumo/rKwh:null,
      aL, aCosto:c?.acqua_calda_consumo, aUnit:aL&&c?.acqua_calda_consumo?c.acqua_calda_consumo/aL:null,
      afL, afCosto:c?.acqua_potabile, afUnit:afL&&c?.acqua_potabile?c.acqua_potabile/afL:null,
      rateAnno, rateCount,
      isCurrentYear:yl===annoCorrente,
    };
  });

  const cData=riassunto.map(r=>({anno:r.anno,'Spese fisse':r.sf||0,'Consumi':r.con||0,'Risc.':r.rCosto||0,'ACS':r.aCosto||0,'Acq.fr.':r.afCosto||0}));
  const consumiQtyData=riassunto.map(r=>({anno:r.anno,'Risc. (cal)':r.rKwh||0,'ACS (L)':r.aL||0,'Fredda (L)':r.afL||0}));
  const last=riassunto[riassunto.length-1];

  const emptyY={property_id:property.id,year_label:annoCorrente,balance_start_casa:0,balance_start_box:0,balance_start_cantina:0,rates_paid_casa:0,rates_paid_box:0,rates_paid_cantina:0,spese_totali_casa:0,spese_totali_box:0,spese_totali_cantina:0};
  const emptyF={property_id:property.id,year_label:annoCorrente,spese_personali:0,prop_casa:0,prop_box:0,prop_cantina:0,gen_prop_casa:0,gen_prop_box:0,gen_prop_cantina:0,prop_alloggi:0,man_ord_casa:0,man_ord_box:0,man_ord_cantina:0,scale_prop_casa:0,scale_prop_box:0,scale_prop_cantina:0,scala_c_casa:0,scala_c_box:0,scala_c_cantina:0,asc_c_casa:0,asc_c_box:0,asc_c_cantina:0,addebiti_unita:0,addebiti_unita_imm:0,prop_box_extra:0};
  const emptyC={property_id:property.id,year_label:annoCorrente,acqua_potabile:0,riscaldamento_involontario:0,riscaldamento_consumo:0,acqua_calda_involontaria:0,acqua_calda_consumo:0,energia_elettrica_box:0,movimenti_personali:0,risc_lettura_iniziale:null,risc_lettura_finale:null,acqua_calda_lettura_iniziale:null,acqua_calda_lettura_finale:null,acqua_fredda_lettura_iniziale:null,acqua_fredda_lettura_finale:null,totale_casa:0,totale_box:0,totale_cantina:0};
  const emptyR={property_id:property.id,year_label:annoCorrente,numero_rata:'',data_pagamento:new Date().toISOString().split('T')[0],importo_casa:0,importo_box:0,importo_cantina:0,descrizione:''};

  const openPct=(title:string,curLabel:string,curVal:number,prevLabel:string,prevVal:number)=>{
    const pctVal=prevVal!==0?(curVal-prevVal)/Math.abs(prevVal)*100:0;
    setPctModal({title,curLabel,curVal,prevLabel,prevVal,pct:pctVal});
  };

  const sortYearsL  =[...years].sort((a,b)=>sortYears?a.year_label.localeCompare(b.year_label):b.year_label.localeCompare(a.year_label));
  const sortFixedL  =[...fixed].sort((a,b)=>sortFixed?a.year_label.localeCompare(b.year_label):b.year_label.localeCompare(a.year_label));
  const sortConsumiL=[...consumi].sort((a,b)=>sortConsumi?a.year_label.localeCompare(b.year_label):b.year_label.localeCompare(a.year_label));
  const sortAllYrs  =[...allYrs].sort((a,b)=>sortRates?a.localeCompare(b):b.localeCompare(a));

  const hasYearCur   =years.some(y=>y.year_label===annoCorrente);
  const hasFixedCur  =fixed.some(f=>f.year_label===annoCorrente);
  const hasConsumiCur=consumi.some(c=>c.year_label===annoCorrente);

  // Form comune per inserimento anno mancante
  const BannerNuovo=({label, onNew}:{label:string; onNew:()=>void})=>(
    <div style={{ background:'var(--accent-light)', border:'1px solid var(--accent-mid)', borderRadius:12, padding:'12px 14px', display:'flex', justifyContent:'space-between', alignItems:'center', gap:10, flexWrap:'wrap' }}>
      <p style={{ fontSize:13, fontWeight:700, color:'var(--accent)', flex:1, minWidth:0 }}>Esercizio {annoCorrente} non ancora inserito</p>
      <button className="btn-primary" onClick={onNew} style={{ flexShrink:0 }}><Plus size={12}/> Inserisci</button>
    </div>
  );

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
      <Tabs active={tab} onChange={t=>{setTab(t);setEditY(null);setEditF(null);setEditC(null);setEditR(null);}}/>

      {/* ══ RIEPILOGO ══ */}
      {tab==='Riepilogo'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', gap:8 }}>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:700 }}>Riepilogo</h2>
            <button onClick={()=>setBdRiep(v=>!v)} style={{ display:'inline-flex', alignItems:'center', gap:4, background:bdRiep?'var(--accent-light)':'var(--bg3)', border:`1px solid ${bdRiep?'var(--accent-mid)':'var(--border)'}`, borderRadius:20, padding:'4px 10px', fontSize:10, fontWeight:700, color:bdRiep?'var(--accent)':'var(--text3)', cursor:'pointer', whiteSpace:'nowrap' }}>
              {bdRiep?<EyeOff size={9}/>:<Eye size={9}/>}{bdRiep?'Nascondi':'Per unità'}
            </button>
          </div>

          {!hasYearCur&&(
            <div style={{ background:'var(--amber-bg)', border:'1px solid #f0d880', borderRadius:10, padding:'10px 12px', display:'flex', gap:8, alignItems:'flex-start', fontSize:12 }}>
              <AlertCircle size={14} color="var(--amber)" style={{ flexShrink:0, marginTop:1 }}/>
              <p style={{ color:'var(--amber)' }}>L'esercizio <strong>{annoCorrente}</strong> è in corso. Inserisci i dati per completare il riepilogo.</p>
            </div>
          )}

          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
            <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
              <table style={{ minWidth:320 }}>
                <thead>
                  <tr style={{ background:'var(--bg3)' }}>
                    <th style={{ padding:'8px 10px', textAlign:'left' }}>Anno</th>
                    <th style={{ padding:'8px 10px', textAlign:'right' }}>Fisse</th>
                    <th style={{ padding:'8px 10px', textAlign:'right' }}>Consumi</th>
                    <th style={{ padding:'8px 10px', textAlign:'right' }}>Rate</th>
                    {!bdRiep&&<th style={{ padding:'8px 10px', textAlign:'right' }}>Saldo</th>}
                    {bdRiep&&<><th style={{ padding:'8px 10px', textAlign:'right', color:'var(--green)', fontSize:9 }}>App</th><th style={{ padding:'8px 10px', textAlign:'right', color:'var(--blue)', fontSize:9 }}>Box</th><th style={{ padding:'8px 10px', textAlign:'right', color:'var(--amber)', fontSize:9 }}>Cant.</th></>}
                  </tr>
                </thead>
                <tbody>
                  {[...riassunto].reverse().map((r,i)=>{
                    const prv=riassunto.find(x=>x.anno===allYrs[allYrs.indexOf(r.anno)-1]);
                    const totSaldo=r.sC!==null&&r.sB!==null&&r.sCa!==null?r.sC+r.sB+r.sCa:null;
                    return (
                      <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)', background:r.isCurrentYear?'rgba(45,106,79,0.03)':(i%2===0?'#fff':'var(--bg3)') }}>
                        <td style={{ padding:'8px 10px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:4, flexWrap:'nowrap' }}>
                            <span className="tag tag-blue">{r.anno}</span>
                            {r.isCurrentYear&&<InProgressBadge/>}
                          </div>
                        </td>
                        <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>{r.sf!=null?`€${f0(r.sf)}`:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>{r.con!=null?`€${f0(r.con)}`:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', color:'var(--accent)', fontWeight:700 }}>{r.rateAnno>0?`€${f0(r.rateAnno)}`:'—'}</td>
                        {!bdRiep&&<td style={{ padding:'8px 10px', textAlign:'right' }}>{totSaldo!=null?<span style={{ fontWeight:700, color:totSaldo>=0?'var(--green)':'var(--red)' }}>{sign(totSaldo)}€{f0(Math.abs(totSaldo))}</span>:<span style={{ color:'var(--text3)' }}>—</span>}</td>}
                        {bdRiep&&<>{[r.sC,r.sB,r.sCa].map((v,j)=>(<td key={j} style={{ padding:'8px 10px', textAlign:'right' }}>{v!=null?<span style={{ fontWeight:700, color:v>=0?'var(--green)':'var(--red)' }}>{sign(v)}€{f0(Math.abs(v))}</span>:<span style={{ color:'var(--text3)' }}>—</span>}</td>))}</>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{ padding:'14px' }}>
            <p style={{ fontWeight:700, fontSize:13, marginBottom:10 }}>Andamento spese</p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={cData} margin={{ left:-20, right:6, top:4, bottom:0 }}>
                <XAxis dataKey="anno" tick={{ fill:'#9c9788', fontSize:10 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#9c9788', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={50}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="Spese fisse" stroke="#1e3f6e" fill="#eaf0fb" strokeWidth={2} dot={{fill:'#1e3f6e',r:2}}/>
                <Area type="monotone" dataKey="Consumi" stroke="#2d6a4f" fill="#e8f4ee" strokeWidth={2} dot={{fill:'#2d6a4f',r:2}}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ══ RENDICONTO ══ */}
      {tab==='Rendiconto'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Rendiconto" sub="Saldo = Inizio − Rate + Spese" onAdd={()=>{setEditY({...emptyY});setIsNew(true);}}/>
          <Toolbar sortAsc={sortYears} onSort={()=>setSortYears(v=>!v)} showBreakdown={false} onBreakdown={()=>{}} showBreakdownToggle={false}/>

          {!hasYearCur&&!editY&&<BannerNuovo label={annoCorrente} onNew={()=>{setEditY({...emptyY});setIsNew(true);}}/>}

          <div style={{ background:'var(--blue-bg)', border:'1px solid #b8cef0', borderRadius:10, padding:'9px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci <strong>una volta l'anno</strong> quando ricevi il rendiconto SSA.
          </div>

          {editY&&(
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, marginBottom:12 }}>{isNew?`Inserisci ${editY.year_label}`:`Modifica ${editY.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div><label>Anno esercizio</label><input value={editY.year_label||''} onChange={e=>setEditY((p:any)=>({...p,year_label:e.target.value}))} placeholder="25/26"/></div>
                {[['Saldo iniziale',['balance_start_casa','balance_start_box','balance_start_cantina']],['Rate versate',['rates_paid_casa','rates_paid_box','rates_paid_cantina']],['Spese totali dal riparto',['spese_totali_casa','spese_totali_box','spese_totali_cantina']]].map(([lbl,fields])=>(
                  <div key={lbl as string} style={{ background:'var(--bg3)', borderRadius:10, padding:10 }}>
                    <p style={{ fontSize:10, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:7 }}>{lbl}</p>
                    <div className="grid3">
                      {(fields as string[]).map((f,i)=>(<div key={f}><label>{['C63','Box','Cant.'][i]}</label><input type="number" step="0.01" value={editY[f]??0} onChange={e=>numY(f,e.target.value)}/></div>))}
                    </div>
                  </div>
                ))}
                <FormActions onCancel={()=>setEditY(null)} onSave={async()=>{await save('exercise_years',editY,setYears);setEditY(null);}}/>
              </div>
            </div>
          )}

          {sortYearsL.map(y=>{
            const sC=calcSaldo(y.balance_start_casa,y.rates_paid_casa,y.spese_totali_casa||0);
            const sB=calcSaldo(y.balance_start_box,y.rates_paid_box,y.spese_totali_box||0);
            const sCa=calcSaldo(y.balance_start_cantina,y.rates_paid_cantina,y.spese_totali_cantina||0);
            const tot=sC+sB+sCa;
            const isCur=y.year_label===annoCorrente;
            return (
              <YearCard key={y.id} label={y.year_label} badge={isCur?<InProgressBadge/>:undefined} isCur={isCur}
                total={`${sign(tot)}€${fa(Math.abs(tot))}`} color={tot>=0?'var(--green)':'var(--red)'}
                onEdit={()=>{setEditY({...y});setIsNew(false);}} onDelete={()=>del('exercise_years',y.id,setYears)}
                onExpand={()=>setExpY(expY===y.id?null:y.id)} isExpanded={expY===y.id}>
                {expY===y.id&&(
                  <>
                    <div className="divider"/>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:8 }}>
                      <Chip v={tot}/>
                    </div>
                    <div className="grid3">
                      {([['C63',sC],['Box',sB],['Cant.',sCa]] as [string,number][]).map(([l,v])=>(
                        <div key={l} style={{ textAlign:'center', padding:'8px 4px', background:v>=0?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${v>=0?'var(--accent-mid)':'#f0b8b4'}`, borderRadius:8 }}>
                          <p style={{ fontSize:9, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                          <p style={{ fontSize:13, fontWeight:700, color:v>=0?'var(--green)':'var(--red)' }}>{sign(v)}€{fa(Math.abs(v))}</p>
                        </div>
                      ))}
                    </div>
                    <div className="divider"/>
                    <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, fontSize:10 }}>
                      {[['In. C63',y.balance_start_casa],['In. Box',y.balance_start_box],['In. Cant.',y.balance_start_cantina],
                        ['Rate C63',y.rates_paid_casa],['Rate Box',y.rates_paid_box],['Rate Cant.',y.rates_paid_cantina],
                        ['Sp. C63',y.spese_totali_casa||0],['Sp. Box',y.spese_totali_box||0],['Sp. Cant.',y.spese_totali_cantina||0],
                      ].map(([l,v])=>(<div key={l as string}><p style={{ color:'var(--text3)', fontSize:9 }}>{l}</p><p style={{ fontWeight:600 }}>€{fa(v as number)}</p></div>))}
                    </div>
                  </>
                )}
              </YearCard>
            );
          })}
        </div>
      )}

      {/* ══ SPESE ══ */}
      {tab==='Spese'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Spese Fisse" sub="Voci dal riparto SSA" onAdd={()=>{setEditF({...emptyF});setIsNew(true);}}/>
          <Toolbar sortAsc={sortFixed} onSort={()=>setSortFixed(v=>!v)} showBreakdown={bdSpese} onBreakdown={()=>setBdSpese(v=>!v)}/>

          {!hasFixedCur&&!editF&&<BannerNuovo label={annoCorrente} onNew={()=>{setEditF({...emptyF});setIsNew(true);}}/>}

          <div style={{ background:'var(--blue-bg)', border:'1px solid #b8cef0', borderRadius:10, padding:'9px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci <strong>una volta l'anno</strong> dal "Riparto Consuntivo" SSA.
          </div>

          {editF&&(
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo anno':`Modifica ${editF.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div className="grid2">
                  <div><label>Anno</label><input value={editF.year_label||''} onChange={e=>setEditF((p:any)=>({...p,year_label:e.target.value}))} placeholder="25/26"/></div>
                  <NF lbl="Movimenti pers. €" fld="spese_personali" st={editF} fn={numF}/>
                </div>
                <TI lbl="Spese Proprietà" pfx="prop" st={editF} fn={numF}/>
                <TI lbl="Spese Generali" pfx="gen_prop" st={editF} fn={numF}/>
                <TI lbl="Manutenzioni" pfx="man_ord" st={editF} fn={numF}/>
                <TI lbl="Scale Proprietà" pfx="scale_prop" st={editF} fn={numF}/>
                <TI lbl="Scala C Gestione" pfx="scala_c" st={editF} fn={numF}/>
                <TI lbl="Ascensore C" pfx="asc_c" st={editF} fn={numF}/>
                <div className="grid3">
                  <NF lbl="Prop. alloggi €" fld="prop_alloggi" st={editF} fn={numF}/>
                  <NF lbl="Addebiti unità €" fld="addebiti_unita" st={editF} fn={numF}/>
                  <NF lbl="Add. imm. €" fld="addebiti_unita_imm" st={editF} fn={numF}/>
                  <NF lbl="En.el. box €" fld="prop_box_extra" st={editF} fn={numF}/>
                </div>
                <FormActions onCancel={()=>setEditF(null)} onSave={async()=>{await save('fixed_expenses',editF,setFixed);setEditF(null);}}/>
              </div>
            </div>
          )}

          {sortFixedL.map(r=>{
            const tC=sfTot(r),tB=sfBox(r),tCa=sfCant(r),tot=tC+tB+tCa;
            const idx=fixed.findIndex(x=>x.id===r.id);
            const prv=idx>0?fixed[idx-1]:null;
            const prvTot=prv?sfTot(prv)+sfBox(prv)+sfCant(prv):null;
            const isCur=r.year_label===annoCorrente;
            return (
              <YearCard key={r.id} label={r.year_label} badge={isCur?<InProgressBadge/>:undefined} isCur={isCur}
                total={`€${f0(tot)}`} color="var(--ink)"
                onEdit={()=>{setEditF({...r});setIsNew(false);}} onDelete={()=>del('fixed_expenses',r.id,setFixed)}
                onExpand={()=>setExpF(expF===r.id?null:r.id)} isExpanded={expF===r.id}>
                <>
                  {bdSpese&&(<><div className="divider"/><div className="grid3">{([['C63',tC],['Box',tB],['Cant.',tCa]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center', padding:'6px 4px', background:'var(--bg3)', borderRadius:8 }}><p style={{ fontSize:9, color:'var(--text2)', fontWeight:600, marginBottom:1 }}>{l}</p><p style={{ fontSize:12, fontWeight:700 }}>€{fa(v)}</p></div>))}</div></>)}
                  {prvTot!==null&&<div style={{ marginTop:6 }}><Delta cur={tot} prev={prvTot} invert onClick={()=>openPct('Spese fisse',r.year_label,tot,prv!.year_label,prvTot)}/></div>}
                  {expF===r.id&&(
                    <div style={{ marginTop:10 }}>
                      <div className="divider"/>
                      {[['Proprietà',r.prop_casa,r.prop_box,r.prop_cantina],['Generali',r.gen_prop_casa,r.gen_prop_box,r.gen_prop_cantina],['Man. Ord.',r.man_ord_casa,r.man_ord_box,r.man_ord_cantina],['Scale C',r.scale_prop_casa,r.scale_prop_box,r.scale_prop_cantina],['Scala C g.',r.scala_c_casa,r.scala_c_box,r.scala_c_cantina],['Ascens. C',r.asc_c_casa,r.asc_c_box,r.asc_c_cantina]].map(([l,c,b,ca])=>(
                        <div key={l as string} style={{ display:'grid', gridTemplateColumns:'1.3fr 1fr 1fr 1fr', gap:4, fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}>
                          <span style={{ color:'var(--text2)' }}>{l}</span>
                          <span style={{ textAlign:'right', fontWeight:600 }}>€{fa(c as number)}</span>
                          <span style={{ textAlign:'right', fontWeight:600 }}>€{fa(b as number)}</span>
                          <span style={{ textAlign:'right', fontWeight:600 }}>€{fa(ca as number)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              </YearCard>
            );
          })}
        </div>
      )}

      {/* ══ CONSUMI ══ */}
      {tab==='Consumi'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Consumi" sub="Letture + costi dal riparto" onAdd={()=>{setEditC({...emptyC});setIsNew(true);}}/>
          <div style={{ display:'flex', gap:6, flexWrap:'wrap', alignItems:'center' }}>
            {/* Vista euro/quantità come select */}
            <select value={consumiView} onChange={e=>setConsumiView(e.target.value as any)} style={{ width:'auto', padding:'5px 30px 5px 10px', fontSize:12, fontWeight:700, background:'var(--bg3)', border:'1px solid var(--border)' }}>
              <option value="euro">€ Costi</option>
              <option value="qty">Quantità</option>
            </select>
            <Toolbar sortAsc={sortConsumi} onSort={()=>setSortConsumi(v=>!v)} showBreakdown={bdConsumi} onBreakdown={()=>setBdConsumi(v=>!v)}/>
          </div>

          {!hasConsumiCur&&!editC&&<BannerNuovo label={annoCorrente} onNew={()=>{setEditC({...emptyC});setIsNew(true);}}/>}

          <div className="card" style={{ padding:'14px' }}>
            <ResponsiveContainer width="100%" height={160}>
              {consumiView==='euro'?(
                <BarChart data={cData} margin={{ left:-10, right:6, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="anno" tick={{ fill:'#9c9788', fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#9c9788', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={48}/>
                  <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{ fontSize:10 }}/>
                  <Bar dataKey="Risc." fill="#ef4444" stackId="a"/><Bar dataKey="ACS" fill="#f97316" stackId="a"/><Bar dataKey="Acq.fr." fill="#3b82f6" stackId="a" radius={[3,3,0,0]}/>
                </BarChart>
              ):(
                <LineChart data={consumiQtyData} margin={{ left:-10, right:6, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="anno" tick={{ fill:'#9c9788', fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#9c9788', fontSize:9 }} axisLine={false} tickLine={false} width={48}/>
                  <Tooltip/><Legend wrapperStyle={{ fontSize:10 }}/>
                  <Line type="monotone" dataKey="Risc. (cal)" stroke="#ef4444" strokeWidth={2} dot={{fill:'#ef4444',r:2}}/>
                  <Line type="monotone" dataKey="ACS (L)" stroke="#f97316" strokeWidth={2} dot={{fill:'#f97316',r:2}}/>
                  <Line type="monotone" dataKey="Fredda (L)" stroke="#3b82f6" strokeWidth={2} dot={{fill:'#3b82f6',r:2}}/>
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>

          {editC&&(
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo anno':`Modifica ${editC.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div><label>Anno</label><input value={editC.year_label||''} onChange={e=>setEditC((p:any)=>({...p,year_label:e.target.value}))} placeholder="24/25"/></div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:10 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:7 }}>Letture contatori</p>
                  <div className="grid2"><NF lbl="Risc. inizio" fld="risc_lettura_iniziale" st={editC} fn={numC}/><NF lbl="Risc. fine" fld="risc_lettura_finale" st={editC} fn={numC}/><NF lbl="ACS inizio" fld="acqua_calda_lettura_iniziale" st={editC} fn={numC}/><NF lbl="ACS fine" fld="acqua_calda_lettura_finale" st={editC} fn={numC}/><NF lbl="Fredda inizio" fld="acqua_fredda_lettura_iniziale" st={editC} fn={numC}/><NF lbl="Fredda fine" fld="acqua_fredda_lettura_finale" st={editC} fn={numC}/></div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:10 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:7 }}>Costi dal Riparto (€)</p>
                  <div className="grid2"><NF lbl="Risc. consumo" fld="riscaldamento_consumo" st={editC} fn={numC}/><NF lbl="Risc. involont." fld="riscaldamento_involontario" st={editC} fn={numC}/><NF lbl="ACS consumo" fld="acqua_calda_consumo" st={editC} fn={numC}/><NF lbl="ACS involontaria" fld="acqua_calda_involontaria" st={editC} fn={numC}/><NF lbl="Acqua potabile" fld="acqua_potabile" st={editC} fn={numC}/><NF lbl="Energia box" fld="energia_elettrica_box" st={editC} fn={numC}/><NF lbl="Mov. personali" fld="movimenti_personali" st={editC} fn={numC}/></div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:10 }}>
                  <p style={{ fontSize:10, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:7 }}>Totali gestione</p>
                  <div className="grid3"><NF lbl="App C63" fld="totale_casa" st={editC} fn={numC}/><NF lbl="Box 13" fld="totale_box" st={editC} fn={numC}/><NF lbl="Cantina" fld="totale_cantina" st={editC} fn={numC}/></div>
                </div>
                <FormActions onCancel={()=>setEditC(null)} onSave={async()=>{await save('consumption_data',editC,setConsumi);setEditC(null);}}/>
              </div>
            </div>
          )}

          {sortConsumiL.map(r=>{
            const tot=r.totale_casa+r.totale_box+r.totale_cantina;
            const idx=consumi.findIndex(x=>x.id===r.id);
            const prv=idx>0?consumi[idx-1]:null;
            const prvTot=prv?prv.totale_casa+prv.totale_box+prv.totale_cantina:null;
            const rKwh=r.risc_lettura_finale&&r.risc_lettura_iniziale?r.risc_lettura_finale-r.risc_lettura_iniziale:null;
            const aL=r.acqua_calda_lettura_finale&&r.acqua_calda_lettura_iniziale?r.acqua_calda_lettura_finale-r.acqua_calda_lettura_iniziale:null;
            const afL=r.acqua_fredda_lettura_finale&&r.acqua_fredda_lettura_iniziale?r.acqua_fredda_lettura_finale-r.acqua_fredda_lettura_iniziale:null;
            const rU=rKwh&&r.riscaldamento_consumo?r.riscaldamento_consumo/rKwh:null;
            const aU=aL&&r.acqua_calda_consumo?r.acqua_calda_consumo/aL:null;
            const afU=afL&&r.acqua_potabile?r.acqua_potabile/afL:null;
            const valChecks=[
              validaLetture(r.risc_lettura_iniziale,r.risc_lettura_finale,r.riscaldamento_consumo,'Riscaldamento'),
              validaLetture(r.acqua_calda_lettura_iniziale,r.acqua_calda_lettura_finale,r.acqua_calda_consumo,'Acqua calda'),
              validaLetture(r.acqua_fredda_lettura_iniziale,r.acqua_fredda_lettura_finale,r.acqua_potabile,'Acqua fredda'),
            ];
            const sortedC2=[...consumi].sort((a,b)=>a.year_label.localeCompare(b.year_label));
            const rIdx=sortedC2.findIndex(x=>x.id===r.id);
            const nextC=rIdx<sortedC2.length-1?sortedC2[rIdx+1]:null;
            const prevC2=rIdx>0?sortedC2[rIdx-1]:null;
            const discChecksCard:ReturnType<typeof validaLetture>[]=[];
            if(nextC){discChecksCard.push(validaContinuita(r.risc_lettura_finale,nextC.risc_lettura_iniziale,`Risc.→${nextC.year_label}`));discChecksCard.push(validaContinuita(r.acqua_calda_lettura_finale,nextC.acqua_calda_lettura_iniziale,`ACS→${nextC.year_label}`));discChecksCard.push(validaContinuita(r.acqua_fredda_lettura_finale,nextC.acqua_fredda_lettura_iniziale,`Fr.→${nextC.year_label}`));}
            if(prevC2){discChecksCard.push(validaContinuita(prevC2.risc_lettura_finale,r.risc_lettura_iniziale,`Risc.${prevC2.year_label}→`));discChecksCard.push(validaContinuita(prevC2.acqua_calda_lettura_finale,r.acqua_calda_lettura_iniziale,`ACS${prevC2.year_label}→`));discChecksCard.push(validaContinuita(prevC2.acqua_fredda_lettura_finale,r.acqua_fredda_lettura_iniziale,`Fr.${prevC2.year_label}→`));}
            const allChecks=[...valChecks,...discChecksCard.filter(c=>!c.ok)];
            const hasErrors=allChecks.some(c=>c.severity==='error');
            const hasWarns=allChecks.some(c=>!c.ok);
            const hasLetture=r.risc_lettura_iniziale!==null||r.acqua_calda_lettura_iniziale!==null;
            const statusBadge=!hasLetture?null:hasErrors?(
              <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,color:'var(--red)',background:'var(--red-bg)',border:'1px solid #f0b8b4',borderRadius:20,padding:'2px 6px',whiteSpace:'nowrap' as const,flexShrink:0 }}><AlertCircle size={10}/> Errore</span>
            ):hasWarns?(
              <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:700,color:'var(--amber)',background:'var(--amber-bg)',border:'1px solid #f0d880',borderRadius:20,padding:'2px 6px',whiteSpace:'nowrap' as const,flexShrink:0 }}><AlertCircle size={10}/> Attenzione</span>
            ):(
              <span style={{ display:'inline-flex',alignItems:'center',gap:3,fontSize:10,fontWeight:600,color:'var(--green)',background:'var(--green-bg)',border:'1px solid var(--accent-mid)',borderRadius:20,padding:'2px 6px',whiteSpace:'nowrap' as const,flexShrink:0 }}><Check size={10}/> OK</span>
            );
            const isCur=r.year_label===annoCorrente;
            const cardBorder=hasErrors?{borderLeft:'3px solid var(--red)'}:hasWarns?{borderLeft:'3px solid #f0d880'}:isCur?{borderLeft:'3px solid var(--accent)'}:undefined;
            return (
              <div key={r.id} className="card" style={cardBorder}>
                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, flexShrink:0 }}>
                    <span className="tag tag-blue">{r.year_label}</span>
                    {isCur&&<InProgressBadge/>}
                    {statusBadge}
                  </div>
                  <p style={{ fontFamily:'var(--font-display)', fontSize:18, fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>€{f0(tot)}</p>
                  <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                    <button className="btn-icon" style={{ padding:6 }} onClick={()=>setExpC(expC===r.id?null:r.id)}>{expC===r.id?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" style={{ padding:6 }} onClick={()=>{setEditC({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" style={{ padding:6 }} onClick={()=>del('consumption_data',r.id,setConsumi)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {prvTot!==null&&<div style={{ marginTop:4 }}><Delta cur={tot} prev={prvTot} invert onClick={()=>openPct(`Consumi`,r.year_label,tot,prv!.year_label,prvTot)}/></div>}
                {bdConsumi&&(<><div className="divider"/><div className="grid3">{([['C63',r.totale_casa],['Box',r.totale_box],['Cant.',r.totale_cantina]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center',padding:'6px 4px',background:'var(--bg3)',borderRadius:8 }}><p style={{ fontSize:9,color:'var(--text2)',fontWeight:600,marginBottom:1 }}>{l}</p><p style={{ fontSize:12,fontWeight:700 }}>€{fa(v)}</p></div>))}</div></>)}
                {(rKwh||aL||afL)&&(
                  <div style={{ display:'flex', gap:4, marginTop:6, flexWrap:'wrap' }}>
                    {rKwh&&<span style={{ fontSize:10,background:'var(--red-bg)',border:'1px solid #f0b8b4',borderRadius:20,padding:'2px 6px',color:'var(--red)',whiteSpace:'nowrap' }}>{fN(rKwh)} cal{rU?` · €${f2(rU)}/cal`:''}</span>}
                    {aL&&<span style={{ fontSize:10,background:'var(--amber-bg)',border:'1px solid #f0d880',borderRadius:20,padding:'2px 6px',color:'var(--amber)',whiteSpace:'nowrap' }}>{fN(aL)} L{aU?` · €${f2(aU)}/L`:''}</span>}
                    {afL&&<span style={{ fontSize:10,background:'var(--blue-bg)',border:'1px solid #b8cef0',borderRadius:20,padding:'2px 6px',color:'var(--blue)',whiteSpace:'nowrap' }}>{fN(afL)} L{afU?` · €${f2(afU)}/L`:''}</span>}
                  </div>
                )}
                {expC===r.id&&<ConsumoDetail r={r} rKwh={rKwh} aL={aL} afL={afL} rU={rU} aU={aU} afU={afU} valChecks={valChecks} discChecksCard={discChecksCard}/>}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ RATE ══ */}
      {tab==='Rate'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Rate pagate" sub={`${rates.length} pagamenti totali`} onAdd={()=>{setEditR({...emptyR});setIsNew(true);}}/>
          <Toolbar sortAsc={sortRates} onSort={()=>setSortRates(v=>!v)} showBreakdown={bdRate} onBreakdown={()=>setBdRate(v=>!v)}/>

          {allYrs.some(yl=>rates.some(r=>r.year_label===yl))&&(
            <div className="card" style={{ padding:'14px' }}>
              <ResponsiveContainer width="100%" height={120}>
                <BarChart data={riassunto.filter(r=>r.rateAnno>0)} margin={{ left:-10, right:6, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)"/>
                  <XAxis dataKey="anno" tick={{ fill:'#9c9788', fontSize:10 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#9c9788', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={48}/>
                  <Tooltip content={<ChartTip/>}/>
                  <Bar dataKey="rateAnno" name="Rate versate" fill="var(--accent)" radius={[4,4,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {editR&&(
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:700, fontSize:16, marginBottom:12 }}>Nuovo pagamento</p>
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <div><label>Data</label><input type="date" value={editR.data_pagamento||''} onChange={e=>{const d=e.target.value;const m=new Date(d).getMonth()+1,yr=new Date(d).getFullYear();const yl=m>=10?`${String(yr).slice(2)}/${String(yr+1).slice(2)}`:`${String(yr-1).slice(2)}/${String(yr).slice(2)}`;setEditR((p:any)=>({...p,data_pagamento:d,year_label:yl}));}}/></div>
                <div><label>Importo totale (€) — ripartito per millesimi</label><input type="number" step="0.01" placeholder="es. 413,50" value={editR._importo_totale||''} onChange={e=>{const tot=parseFloat(e.target.value)||0;const m=3.394+0.576+0.059;setEditR((p:any)=>({...p,_importo_totale:e.target.value,importo_casa:parseFloat((tot*3.394/m).toFixed(2)),importo_box:parseFloat((tot*0.576/m).toFixed(2)),importo_cantina:parseFloat((tot*0.059/m).toFixed(2))}));}}/></div>
                {(editR.importo_casa>0||editR.importo_box>0)&&(<div className="grid3">{([['C63',editR.importo_casa],['Box',editR.importo_box],['Cant.',editR.importo_cantina]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center',background:'var(--accent-light)',borderRadius:8,padding:'7px 4px' }}><p style={{ fontSize:9,color:'var(--text2)',fontWeight:600,marginBottom:1 }}>{l}</p><p style={{ fontSize:12,fontWeight:700,color:'var(--accent)' }}>€{fa(v)}</p></div>))}</div>)}
                <div><label>Note</label><input value={editR.descrizione||''} onChange={e=>strR('descrizione',e.target.value)} placeholder="Acconto, Conguaglio…"/></div>
                <FormActions onCancel={()=>setEditR(null)} onSave={async()=>{await save('rate_pagamenti',editR,setRates);setEditR(null);}}/>
              </div>
            </div>
          )}

          {sortAllYrs.map(yl=>{
            const rAnno=rates.filter(r=>r.year_label===yl);
            const isCur=yl===annoCorrente;
            if(rAnno.length===0&&!isCur) return null;
            const totC=rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0),0);
            const totB=rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_box)||0),0);
            const totCa=rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_cantina)||0),0);
            const totAll=totC+totB+totCa;
            const yData=years.find(y=>y.year_label===yl);
            const atteso=yData?yData.rates_paid_casa+yData.rates_paid_box+yData.rates_paid_cantina:null;
            const ok=atteso!==null&&Math.abs(totAll-atteso)<1;
            return (
              <div key={yl} className="card" style={{ borderLeft:isCur?'3px solid var(--accent)':undefined }}>
                <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0, marginBottom:rAnno.length>0?10:0 }}>
                  <span className="tag tag-blue" style={{ flexShrink:0 }}>{yl}</span>
                  {isCur&&<InProgressBadge/>}
                  {rAnno.length>0?(
                    <p style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:700, flex:1, minWidth:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>€{fa(totAll)}</p>
                  ):(
                    <p style={{ fontSize:13, color:'var(--text3)', flex:1 }}>Nessun pagamento</p>
                  )}
                  {isCur&&rAnno.length===0&&(
                    <button className="btn-primary" style={{ flexShrink:0, padding:'6px 10px', fontSize:12 }} onClick={()=>{setEditR({...emptyR});setIsNew(true);}}><Plus size={11}/>Prima rata</button>
                  )}
                </div>
                {rAnno.length>0&&<p style={{ fontSize:11, color:'var(--text3)', marginBottom:atteso?8:0 }}>{rAnno.length} {pluraleRate(rAnno.length)}</p>}
                {atteso!==null&&rAnno.length>0&&(
                  <div style={{ background:ok?'var(--green-bg)':'var(--amber-bg)', border:`1px solid ${ok?'var(--accent-mid)':'#f0d880'}`, borderRadius:8, padding:'6px 10px', fontSize:11, marginBottom:8, fontWeight:600, color:ok?'var(--green)':'var(--amber)', display:'flex', alignItems:'center', gap:5 }}>
                    {ok?<Check size={12}/>:<AlertCircle size={12}/>}
                    {ok?'Corrisponde al rendiconto':`Atteso €${fa(atteso)} · diff. €${fa(Math.abs(totAll-atteso))}`}
                  </div>
                )}
                {bdRate&&rAnno.length>0&&(
                  <div style={{ display:'flex', gap:10, marginBottom:8, flexWrap:'wrap' }}>
                    {([['C63',totC,'var(--green)'],['Box',totB,'var(--blue)'],['Cant.',totCa,'var(--amber)']] as [string,number,string][]).map(([l,v,c])=>(
                      <span key={l} style={{ fontSize:11, fontWeight:700, color:c }}>{l}: €{fa(v)}</span>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {rAnno.map((r:any)=>{
                    const tot=(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0);
                    return (
                      <div key={r.id} style={{ background:'var(--bg3)', borderRadius:8, display:'flex', alignItems:'center', gap:8, padding:'8px 10px' }}>
                        <CreditCard size={13} color="var(--accent)" style={{ flexShrink:0 }}/>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ display:'flex', alignItems:'center', gap:6, minWidth:0 }}>
                            <span style={{ fontWeight:700, fontSize:12, whiteSpace:'nowrap' }}>{r.numero_rata}</span>
                            <span style={{ color:'var(--text3)', fontSize:11, whiteSpace:'nowrap' }}>{fmtDate(r.data_pagamento)}</span>
                            {r.descrizione&&<span style={{ color:'var(--text2)', fontSize:11, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{r.descrizione}</span>}
                          </div>
                          {bdRate&&(
                            <div style={{ display:'flex', gap:6, marginTop:2, fontSize:10, color:'var(--text3)' }}>
                              <span style={{ color:'var(--green)' }}>C63 €{fa(parseFloat(r.importo_casa)||0)}</span>
                              <span style={{ color:'var(--blue)' }}>Box €{fa(parseFloat(r.importo_box)||0)}</span>
                              <span style={{ color:'var(--amber)' }}>Cant. €{fa(parseFloat(r.importo_cantina)||0)}</span>
                            </div>
                          )}
                        </div>
                        <p style={{ fontWeight:700, fontSize:13, flexShrink:0 }}>€{fa(tot)}</p>
                        <div style={{ display:'flex', gap:3, flexShrink:0 }}>
                          <button className="btn-icon" style={{ padding:5 }} onClick={()=>{setEditR({...r});setIsNew(false);}}><Pencil size={11}/></button>
                          <button className="btn-danger" style={{ padding:5 }} onClick={()=>del('rate_pagamenti',r.id,setRates)}><Trash2 size={11}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
                {atteso&&rAnno.length>0&&(
                  <div style={{ marginTop:10 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, color:'var(--text3)', marginBottom:3 }}>
                      <span>Versato</span><span>{Math.min(100,Math.round(totAll/atteso*100))}%</span>
                    </div>
                    <div style={{ background:'var(--bg3)', borderRadius:3, height:4, overflow:'hidden' }}>
                      <div style={{ width:`${Math.min(100,totAll/atteso*100)}%`, height:'100%', background:ok?'var(--green)':'var(--amber)', borderRadius:3, transition:'width 0.4s' }}/>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {rates.length===0&&<p style={{ textAlign:'center', color:'var(--text3)', padding:20, fontSize:13 }}>Nessuna rata registrata. Aggiungile dalla Home ogni volta che paghi.</p>}
        </div>
      )}

      {/* ══ CONFRONTO ══ */}
      {tab==='Confronto'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:700 }}>Preventivo vs Consuntivo 24/25</h2>
          {(()=>{
            const c=fixed.find(r=>r.year_label==='24/25');
            if(!c) return <p style={{ color:'var(--text3)', textAlign:'center', padding:20, fontSize:13 }}>Inserisci i dati spese 24/25 per vedere il confronto.</p>;
            const rows=[
              {l:'Spese Proprietà',prev:172.03,cons:c.prop_casa},
              {l:'Spese Generali',prev:533.36,cons:c.gen_prop_casa},
              {l:'Man. Ordinarie',prev:16.97,cons:c.man_ord_casa},
              {l:'Scala C',prev:13.36,cons:c.scale_prop_casa+c.scala_c_casa},
              {l:'Ascensore C',prev:18.96,cons:c.asc_c_casa},
              {l:'Prop. alloggi',prev:16.97,cons:c.prop_alloggi},
              {l:'Teleletture',prev:17.59,cons:c.addebiti_unita_imm},
              {l:'Mov. personali',prev:0,cons:c.spese_personali},
            ];
            const tP=rows.reduce((s,r)=>s+r.prev,0),tC=rows.reduce((s,r)=>s+r.cons,0);
            return (
              <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:12, overflow:'hidden' }}>
                <div style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                  <table style={{ minWidth:300 }}>
                    <thead><tr style={{ background:'var(--bg3)' }}><th style={{ padding:'8px 10px', textAlign:'left' }}>Voce</th><th style={{ padding:'8px 10px', textAlign:'right' }}>Prev.</th><th style={{ padding:'8px 10px', textAlign:'right' }}>Cons.</th><th style={{ padding:'8px 10px', textAlign:'right' }}>Δ%</th></tr></thead>
                    <tbody>
                      {rows.map((r,i)=>{
                        const dp=r.prev?pct(r.cons,r.prev):0;
                        return (
                          <tr key={r.l} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'#fff':'var(--bg3)' }}>
                            <td style={{ padding:'8px 10px', fontSize:12, fontWeight:600 }}>{r.l}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12 }}>€{fa(r.prev)}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12, fontWeight:700 }}>€{fa(r.cons)}</td>
                            <td style={{ padding:'8px 10px', textAlign:'right' }}>{r.prev?(<button onClick={()=>openPct(r.l,'Consuntivo 24/25',r.cons,'Preventivo 24/25',r.prev)} style={{ fontWeight:700, color:dp>0?'var(--red)':'var(--green)', background:dp>0?'var(--red-bg)':'var(--green-bg)', border:'none', borderRadius:20, padding:'2px 7px', fontSize:11, cursor:'pointer' }}>{dp>=0?'+':'−'}{Math.abs(dp).toFixed(1)}%</button>):'—'}</td>
                          </tr>
                        );
                      })}
                      <tr style={{ background:'var(--accent-light)', fontWeight:700 }}>
                        <td style={{ padding:'8px 10px', fontSize:12 }}>TOTALE</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12 }}>€{fa(tP)}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right', fontSize:12 }}>€{fa(tC)}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right' }}><button onClick={()=>openPct('Totale','Consuntivo 24/25',tC,'Preventivo 24/25',tP)} style={{ fontWeight:700, color:pct(tC,tP)>0?'var(--red)':'var(--green)', background:pct(tC,tP)>0?'var(--red-bg)':'var(--green-bg)', border:'none', borderRadius:20, padding:'2px 7px', fontSize:11, cursor:'pointer' }}>{pct(tC,tP)>=0?'+':'−'}{Math.abs(pct(tC,tP)).toFixed(1)}%</button></td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })()}
        </div>
      )}

      {/* ══ PREVENTIVO ══ */}
      {tab==='Preventivo'&&(
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:19, fontWeight:700 }}>Preventivo 25/26</h2>
          <div style={{ background:'var(--amber-bg)', border:'1px solid #f0d880', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--amber)' }}>
            Quote stimate sui tuoi millesimi. I consumi saranno disponibili dopo ottobre 2026.
          </div>
          {last?.sTot!==null&&(
            <div style={{ background:'var(--green-bg)', border:'1px solid var(--accent-mid)', borderRadius:10, padding:'10px 12px' }}>
              <p style={{ fontWeight:700, fontSize:12, color:'var(--green)', marginBottom:7 }}>Saldo di partenza 25/26</p>
              <div className="grid3">
                {([['C63',last?.sC],['Box',last?.sB],['Cant.',last?.sCa]] as [string,number|null][]).map(([l,v])=>(
                  <div key={l} style={{ textAlign:'center' }}>
                    <p style={{ fontSize:9, color:'var(--green)', opacity:0.8 }}>{l}</p>
                    <p style={{ fontWeight:700, color:'var(--green)', fontFamily:'var(--font-display)', fontSize:14 }}>{v!==null?`${v>=0?'+':'−'}€${fa(Math.abs(v))}`:'—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="card">
            <p style={{ fontWeight:700, fontSize:13, marginBottom:12 }}>App C63 — spese fisse stimate</p>
            {([
              ['Spese Proprietà',PV.prop,'52.129 × 3,394‰'],
              ['Spese Generali',PV.gen,'149.737 × 3,394‰'],
              ['Manutenzioni',PV.man,'10.000 × 3,394‰'],
              ['Scale C',PV.scalac,'4.500 × 20,288‰'],
              ['Ascensore C',PV.asc,'3.802 × 20,288‰'],
              ['Teleletture',PV.tele,'5.054 × 3,394‰'],
              ['Risc. involontario',PV.risc_inv,'35.349 × 3,394‰'],
              ['ACS involontaria',PV.acs_inv,'31.638 × 3,394‰'],
            ] as [string,number,string][]).map(([l,v,note])=>(
              <div key={l} className="row">
                <div style={{ minWidth:0 }}><p style={{ fontWeight:500, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{l}</p><p style={{ fontSize:9, color:'var(--text3)' }}>{note}</p></div>
                <span style={{ fontWeight:700, fontSize:13, flexShrink:0 }}>€{fa(v)}</span>
              </div>
            ))}
            <div style={{ marginTop:10, paddingTop:10, borderTop:'2px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <span style={{ fontWeight:700, fontSize:13 }}>Subtotale fisse</span>
              <span style={{ fontWeight:700, color:'var(--accent)', fontFamily:'var(--font-display)', fontSize:16 }}>€{fa(Object.values(PV).reduce((s,v)=>s+v,0))}</span>
            </div>
          </div>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #b8cef0', borderRadius:10, padding:'10px 12px', fontSize:11, color:'var(--blue)', lineHeight:1.6 }}>
            <strong>Millesimi (riparto SSA 10/12/2025):</strong><br/>
            App C63: prop. 3,394‰ · gen. 3,394‰ · scala C 20,288‰<br/>
            Box 13: prop. 0,576‰ · gen. 0,576‰ · scala C 3,443‰<br/>
            Cantina 10c: prop. 0,059‰ · gen. 0,059‰
          </div>
        </div>
      )}

      {pctModal&&<PctModal {...pctModal} onClose={()=>setPctModal(null)}/>}
    </div>
  );
}
