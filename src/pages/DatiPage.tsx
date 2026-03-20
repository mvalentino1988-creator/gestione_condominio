import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData } from '../types';
import {
  Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, CreditCard, AlertCircle, Layers
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend
} from 'recharts';

// ── utils ─────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const f2  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fN  = (n: number | null, dec = 0) => n !== null ? Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: dec }) : '—';
const pct = (c: number, p: number) => p !== 0 ? ((c - p) / Math.abs(p) * 100) : 0;
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

const MILL = { prop: 3.394, gen: 3.394, scalac: 20.288, box_prop: 0.576, box_gen: 0.576, box_scalac: 3.443, cant_prop: 0.059, cant_gen: 0.059 };
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

const TABS = ['Riepilogo','Rendiconto','Spese','Consumi','Rate','Confronto','Preventivo'] as const;
type Tab = typeof TABS[number];

// ── Validazione ───────────────────────────────────────────────
// Alert continuità: appare SOLO sulla card con lettura finale non coincidente con l'anno successivo
function validaContinuita(finPrec: number|null, iniCurr: number|null, precLabel: string): { ok: boolean; msg: string; severity: 'ok'|'warn'|'error' } {
  if (finPrec === null || iniCurr === null) return { ok: true, msg: '', severity: 'ok' };
  if (finPrec !== iniCurr) return {
    ok: false,
    msg: `Inizio (${iniCurr.toLocaleString('it-IT')}) ≠ finale ${precLabel} (${finPrec.toLocaleString('it-IT')}). Δ ${Math.abs(finPrec - iniCurr).toLocaleString('it-IT')} mc.`,
    severity: 'warn',
  };
  return { ok: true, msg: '', severity: 'ok' };
}

function validaLetture(ini: number|null, fin: number|null, costo: number, label: string): { ok: boolean; msg: string; severity: 'ok'|'warn'|'error' } {
  if (ini === null || fin === null) return { ok: true, msg: '', severity: 'ok' };
  const delta = fin - ini;
  if (delta < 0) return { ok: false, msg: `${label}: lettura finale (${fin}) < iniziale (${ini}).`, severity: 'error' };
  if (delta === 0 && costo > 0) return { ok: false, msg: `${label}: consumo zero ma costo €${fa(costo)}.`, severity: 'warn' };
  if (costo <= 0 && delta > 0) return { ok: false, msg: `${label}: consumo ${delta} mc ma costo zero.`, severity: 'warn' };
  return { ok: true, msg: '', severity: 'ok' };
}

// ── UI helpers ────────────────────────────────────────────────
function Tabs({ active, onChange }: { active: Tab; onChange: (t: Tab) => void }) {
  return (
    <div style={{ display:'flex', background:'var(--bg3)', borderRadius:12, padding:4, gap:2, overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
      {TABS.map(t => (
        <button key={t} onClick={() => onChange(t)} style={{
          flex:'none', padding:'7px 10px', borderRadius:9, fontSize:13, fontWeight:600, whiteSpace:'nowrap',
          background: active===t ? '#fff' : 'transparent',
          color: active===t ? 'var(--accent)' : 'var(--text2)',
          boxShadow: active===t ? 'var(--shadow-xs)' : 'none',
        }}>{t}</button>
      ))}
    </div>
  );
}

function Delta({ cur, prev, invert = false }: { cur: number; prev: number | null; invert?: boolean }) {
  if (prev === null || prev === 0) return null;
  const d = pct(cur, prev), diff = cur - prev, up = diff > 0;
  const good = invert ? !up : up;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:700,
      color: good?'var(--red)':'var(--green)', background: good?'var(--red-bg)':'var(--green-bg)',
      borderRadius:5, padding:'1px 6px', marginLeft:6 }}>
      {up ? <TrendingUp size={10}/> : <TrendingDown size={10}/>}
      {up?'+':'-'}{Math.abs(d).toFixed(1)}%
    </span>
  );
}

function Chip({ v }: { v: number }) {
  return <span style={{ fontSize:11, fontWeight:700, color:v>=0?'var(--green)':'var(--red)', background:v>=0?'var(--green-bg)':'var(--red-bg)', borderRadius:6, padding:'2px 8px' }}>{v>=0?'▲ CREDITO':'▼ DEBITO'} €{fa(v)}</span>;
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

const ChartTipRaw = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:10, padding:'8px 12px', fontSize:12, boxShadow:'var(--shadow-md)' }}>
      <p style={{ fontWeight:700, marginBottom:4 }}>{label}</p>
      {payload.map((p: any) => <p key={p.name} style={{ color:p.color, marginTop:2 }}>{p.name}: {typeof p.value==='number'?`${p.value.toLocaleString('it-IT',{maximumFractionDigits:1})} mc`:p.value}</p>)}
    </div>
  );
};

function NF({ lbl, fld, st, fn, ph }: { lbl:string; fld:string; st:any; fn:(f:string,v:string)=>void; ph?:string }) {
  return (
    <div>
      <label>{lbl}</label>
      <input type="number" step="0.01" value={st?.[fld]??''} placeholder={ph||'0'} onChange={e => fn(fld, e.target.value)} />
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
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800 }}>{title}</h2>
        {sub && <p style={{ color:'var(--text3)', fontSize:12, marginTop:1 }}>{sub}</p>}
      </div>
      {onAdd && <button className="btn-primary" onClick={onAdd}><Plus size={14}/>Nuovo</button>}
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

// ── ConsumoDetail: scheda unica ────────────────────────────────
function ConsumoDetail({ r, rMc, aMc, afMc, rU, aU, afU, valChecks, contChecks }: {
  r: any;
  rMc: number|null; aMc: number|null; afMc: number|null;
  rU: number|null; aU: number|null; afU: number|null;
  valChecks: ReturnType<typeof validaLetture>[];
  contChecks: ReturnType<typeof validaContinuita>[];
}) {
  const allIssues = [...valChecks, ...contChecks].filter(c => !c.ok);

  const ContRow = ({ ini, fin, cons, costo, nome, col, chk }: {
    ini: number|null; fin: number|null; cons: number|null; costo: number;
    nome: string; col: string; chk: ReturnType<typeof validaLetture>;
  }) => {
    if (ini === null && fin === null) return null;
    const cu = cons && costo ? costo / cons : null;
    const err = !chk.ok;
    return (
      <div style={{
        background: err ? (chk.severity==='error' ? '#fee2e2' : '#fef3c7') : 'var(--bg3)',
        border: err ? `1.5px solid ${chk.severity==='error' ? '#fca5a5' : '#fde68a'}` : '1px solid transparent',
        borderRadius: 10, padding: '10px 12px', marginBottom: 8,
      }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
          <span style={{ fontWeight:700, fontSize:13, color: err ? (chk.severity==='error'?'#dc2626':'#b45309') : col }}>{nome}</span>
          {err && <AlertCircle size={13} color={chk.severity==='error'?'#dc2626':'#f59e0b'}/>}
        </div>
        <div style={{ display:'flex', gap:6, alignItems:'center', flexWrap:'wrap', marginBottom: (cu || costo > 0) ? 6 : 0 }}>
          <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, background:'var(--bg2)', borderRadius:6, padding:'2px 8px' }}>
            {ini !== null ? ini.toLocaleString('it-IT') : '—'}
          </span>
          <span style={{ color:'var(--text3)', fontSize:12 }}>→</span>
          <span style={{ fontFamily:'monospace', fontSize:13, fontWeight:700, background:'var(--bg2)', borderRadius:6, padding:'2px 8px' }}>
            {fin !== null ? fin.toLocaleString('it-IT') : '—'}
          </span>
          <span style={{ fontSize:11, color:'var(--text3)' }}>mc</span>
          {cons !== null && (
            <span style={{ fontSize:12, fontWeight:800, color:col, background:'rgba(0,0,0,0.05)', borderRadius:6, padding:'2px 8px' }}>
              Δ {fN(cons)} mc
            </span>
          )}
        </div>
        {(cu || costo > 0) && (
          <div style={{ display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
            {cu && <span style={{ fontSize:11, fontWeight:700, color:col }}>€{f2(cu)}/mc</span>}
            {costo > 0 && <span style={{ fontSize:11, color:'var(--text3)' }}>totale €{fa(costo)}</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ marginTop:12 }}>
      <div className="divider"/>

      {/* Alert anomalie */}
      {allIssues.length > 0 && (
        <div style={{ background:'#fffbeb', border:'1.5px solid #f59e0b', borderRadius:10, padding:'10px 12px', marginBottom:12 }}>
          <p style={{ fontWeight:700, fontSize:12, color:'#92400e', marginBottom:6, display:'flex', alignItems:'center', gap:5 }}>
            <AlertCircle size={13} color="#f59e0b"/> Anomalie rilevate
          </p>
          {allIssues.map((c,i) => (
            <p key={i} style={{ fontSize:11, color: c.severity==='error' ? '#dc2626' : '#92400e', fontWeight:600, marginTop:3 }}>• {c.msg}</p>
          ))}
        </div>
      )}

      {/* Letture contatori */}
      <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Letture contatori (mc)</p>
      <ContRow ini={r.risc_lettura_iniziale} fin={r.risc_lettura_finale} cons={rMc} costo={r.riscaldamento_consumo} nome="Riscaldamento" col="#ef4444" chk={valChecks[0]}/>
      <ContRow ini={r.acqua_calda_lettura_iniziale} fin={r.acqua_calda_lettura_finale} cons={aMc} costo={r.acqua_calda_consumo} nome="Acqua calda" col="#f97316" chk={valChecks[1]}/>
      <ContRow ini={r.acqua_fredda_lettura_iniziale} fin={r.acqua_fredda_lettura_finale} cons={afMc} costo={r.acqua_potabile} nome="Acqua fredda" col="#3b82f6" chk={valChecks[2]}/>

      {/* Altre voci */}
      {([
        ['Risc. involontario', r.riscaldamento_involontario],
        ['ACS involontaria',   r.acqua_calda_involontaria],
        ['Energia box',        r.energia_elettrica_box],
        ['Movimenti personali',r.movimenti_personali],
      ] as [string,number][]).some(([,v]) => v > 0) && (
        <>
          <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8, marginTop:4 }}>Altre voci</p>
          <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:12 }}>
            {([
              ['Risc. involontario', r.riscaldamento_involontario],
              ['ACS involontaria',   r.acqua_calda_involontaria],
              ['Energia box',        r.energia_elettrica_box],
              ['Movimenti personali',r.movimenti_personali],
            ] as [string,number][]).filter(([,v]) => v > 0).map(([l,v]) => (
              <div key={l} style={{ display:'flex', justifyContent:'space-between', padding:'6px 10px', background:'var(--bg3)', borderRadius:7, fontSize:12 }}>
                <span style={{ color:'var(--text2)' }}>{l}</span>
                <span style={{ fontWeight:700 }}>€{fa(v)}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Totali gestione */}
      <p style={{ fontSize:11, fontWeight:700, color:'var(--text3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:8 }}>Totali gestione</p>
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:8, marginBottom:8 }}>
        {([['App C63', r.totale_casa], ['Box 13', r.totale_box], ['Cantina', r.totale_cantina]] as [string,number][]).map(([l,v]) => (
          <div key={l} style={{ textAlign:'center', padding:'10px 4px', background:'var(--bg3)', borderRadius:8 }}>
            <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:3 }}>{l}</p>
            <p style={{ fontSize:14, fontWeight:800 }}>€{fa(v)}</p>
          </div>
        ))}
      </div>
      <div style={{ display:'flex', justifyContent:'space-between', padding:'8px 12px', background:'var(--accent-light)', borderRadius:8, fontSize:13 }}>
        <span style={{ fontWeight:700 }}>Totale</span>
        <span style={{ fontWeight:800, color:'var(--accent)' }}>€{fa(r.totale_casa + r.totale_box + r.totale_cantina)}</span>
      </div>
    </div>
  );
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

  const allYrs = [...new Set([...years.map(y=>y.year_label),...fixed.map(f=>f.year_label),...consumi.map(c=>c.year_label)])].sort();
  const sfTot = (f: FixedExpenses) => f.prop_casa+f.gen_prop_casa+f.man_ord_casa+f.scale_prop_casa+f.scala_c_casa+f.asc_c_casa+f.prop_alloggi+f.addebiti_unita+f.addebiti_unita_imm+f.spese_personali;
  const sfBox = (f: FixedExpenses) => f.prop_box+f.gen_prop_box+f.man_ord_box+f.scale_prop_box+f.scala_c_box+f.asc_c_box+f.prop_box_extra;
  const sfCant= (f: FixedExpenses) => f.prop_cantina+f.gen_prop_cantina+f.man_ord_cantina+f.scale_prop_cantina+f.scala_c_cantina+f.asc_c_cantina;

  const riassunto = allYrs.map(yl => {
    const y = years.find(r=>r.year_label===yl);
    const f = fixed.find(r=>r.year_label===yl) as FixedExpenses|undefined;
    const c = consumi.find(r=>r.year_label===yl);
    const sf  = f ? sfTot(f) : null;
    const con = c ? c.totale_casa : null;
    const sC  = y ? calcSaldo(y.balance_start_casa,    y.rates_paid_casa,    y.spese_totali_casa||0)    : null;
    const sB  = y ? calcSaldo(y.balance_start_box,     y.rates_paid_box,     y.spese_totali_box||0)     : null;
    const sCa = y ? calcSaldo(y.balance_start_cantina, y.rates_paid_cantina, y.spese_totali_cantina||0) : null;
    const rMc = c&&c.risc_lettura_finale!=null&&c.risc_lettura_iniziale!=null ? c.risc_lettura_finale-c.risc_lettura_iniziale : null;
    const aMc = c&&c.acqua_calda_lettura_finale!=null&&c.acqua_calda_lettura_iniziale!=null ? c.acqua_calda_lettura_finale-c.acqua_calda_lettura_iniziale : null;
    const afMc= c&&c.acqua_fredda_lettura_finale!=null&&c.acqua_fredda_lettura_iniziale!=null ? c.acqua_fredda_lettura_finale-c.acqua_fredda_lettura_iniziale : null;
    const rateAnno = rates.filter(r=>r.year_label===yl).reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0),0);
    const rateCount = rates.filter(r=>r.year_label===yl).length;
    return {
      anno:yl, sf, con, tot: sf!==null&&con!==null?sf+con:sf??con,
      sC, sB, sCa, sTot: sC!==null&&sB!==null&&sCa!==null?sC+sB+sCa:null,
      rMc, rCosto:c?.riscaldamento_consumo, rUnit:rMc&&c?.riscaldamento_consumo?c.riscaldamento_consumo/rMc:null,
      aMc, aCosto:c?.acqua_calda_consumo,   aUnit:aMc&&c?.acqua_calda_consumo?c.acqua_calda_consumo/aMc:null,
      afMc,afCosto:c?.acqua_potabile,        afUnit:afMc&&c?.acqua_potabile?c.acqua_potabile/afMc:null,
      rateAnno, rateCount,
    };
  });

  const cData = riassunto.map(r => ({ anno:r.anno, 'Spese fisse':r.sf||0, 'Consumi':r.con||0, 'Totale':r.tot||0, 'Risc.':r.rCosto||0, 'ACS':r.aCosto||0, 'Acq.fr.':r.afCosto||0 }));
  const consumiQtyData = riassunto.map(r => ({ anno:r.anno, 'Riscaldamento (mc)':r.rMc||0, 'Acqua calda (mc)':r.aMc||0, 'Acqua fredda (mc)':r.afMc||0 }));
  const vData = allYrs.slice(1).map((yl,i)=>{
    const cur=cData.find(r=>r.anno===yl)!, prv=cData.find(r=>r.anno===allYrs[i])!;
    const p=(c:number,v:number)=>v!==0?parseFloat(((c-v)/Math.abs(v)*100).toFixed(1)):0;
    return { anno:yl, 'Fisse%':p(cur['Spese fisse'],prv['Spese fisse']), 'Consumi%':p(cur['Consumi'],prv['Consumi']), 'Totale%':p(cur['Totale'],prv['Totale']) };
  });

  const last = riassunto[riassunto.length-1];
  // Lista ordinata cronologicamente per calcoli continuità
  const consumiSorted = [...consumi].sort((a,b) => a.year_label.localeCompare(b.year_label));

  const emptyY = { property_id:property.id, year_label:'', balance_start_casa:0, balance_start_box:0, balance_start_cantina:0, rates_paid_casa:0, rates_paid_box:0, rates_paid_cantina:0, spese_totali_casa:0, spese_totali_box:0, spese_totali_cantina:0 };
  const emptyF = { property_id:property.id, year_label:'', spese_personali:0, prop_casa:0,prop_box:0,prop_cantina:0, gen_prop_casa:0,gen_prop_box:0,gen_prop_cantina:0, prop_alloggi:0, man_ord_casa:0,man_ord_box:0,man_ord_cantina:0, scale_prop_casa:0,scale_prop_box:0,scale_prop_cantina:0, scala_c_casa:0,scala_c_box:0,scala_c_cantina:0, asc_c_casa:0,asc_c_box:0,asc_c_cantina:0, addebiti_unita:0,addebiti_unita_imm:0,prop_box_extra:0 };
  const emptyC = { property_id:property.id, year_label:'', acqua_potabile:0, riscaldamento_involontario:0, riscaldamento_consumo:0, acqua_calda_involontaria:0, acqua_calda_consumo:0, energia_elettrica_box:0, movimenti_personali:0, risc_lettura_iniziale:null, risc_lettura_finale:null, acqua_calda_lettura_iniziale:null, acqua_calda_lettura_finale:null, acqua_fredda_lettura_iniziale:null, acqua_fredda_lettura_finale:null, totale_casa:0, totale_box:0, totale_cantina:0 };
  const emptyR = { property_id:property.id, year_label:years[years.length-1]?.year_label||'', numero_rata:'', data_pagamento:new Date().toISOString().split('T')[0], importo_casa:0, importo_box:0, importo_cantina:0, descrizione:'' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Tabs active={tab} onChange={t=>{setTab(t);setEditY(null);setEditF(null);setEditC(null);setEditR(null);}}/>

      {/* ══ RIEPILOGO ══ */}
      {tab==='Riepilogo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>Riepilogo annuale</h2>
            <ToggleBreakdown show={showBreakdownR} onToggle={()=>setShowBreakdownR(v=>!v)}/>
          </div>
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
                  {riassunto.map((r,i)=>{
                    const prv = i>0?riassunto[i-1]:null;
                    const totSaldo = r.sC!==null&&r.sB!==null&&r.sCa!==null?r.sC+r.sB+r.sCa:null;
                    return (
                      <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'#fff':'var(--bg3)' }}>
                        <td style={{ padding:'8px 10px' }}><span className="tag tag-blue">{r.anno}</span></td>
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>{r.sf!=null?<><span style={{ fontWeight:700 }}>€{f0(r.sf)}</span>{prv?.sf!=null&&<div style={{ fontSize:9, fontWeight:700, color:(r.sf>prv.sf!)?'var(--red)':'var(--green)' }}>{(r.sf>prv.sf!)?'▲':'▼'}{Math.abs(pct(r.sf,prv.sf!)).toFixed(1)}%</div>}</>:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>{r.con!=null?<><span style={{ fontWeight:700 }}>€{f0(r.con)}</span>{prv?.con!=null&&<div style={{ fontSize:9, fontWeight:700, color:(r.con>prv.con!)?'var(--red)':'var(--green)' }}>{(r.con>prv.con!)?'▲':'▼'}{Math.abs(pct(r.con,prv.con!)).toFixed(1)}%</div>}</>:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right' }}>{r.tot!=null?<><span style={{ fontWeight:800 }}>€{f0(r.tot)}</span>{prv?.tot!=null&&<div style={{ fontSize:9, fontWeight:700, color:(r.tot>prv.tot!)?'var(--red)':'var(--green)' }}>{(r.tot>prv.tot!)?'▲':'▼'}{Math.abs(pct(r.tot,prv.tot!)).toFixed(1)}%</div>}</>:<span style={{ color:'var(--text3)' }}>—</span>}</td>
                        <td style={{ padding:'8px 10px', textAlign:'right' }}><span style={{ fontWeight:700, color:'var(--accent)' }}>{r.rateAnno>0?`€${f0(r.rateAnno)}`:'—'}</span>{r.rateCount>0&&<div style={{ fontSize:9, color:'var(--text3)' }}>{r.rateCount} rata{r.rateCount>1?'e':''}</div>}</td>
                        {!showBreakdownR&&<td style={{ padding:'8px 10px', textAlign:'right' }}>{totSaldo!=null?<span style={{ fontWeight:800, color:totSaldo>=0?'var(--green)':'var(--red)' }}>{totSaldo>=0?'+':'-'}€{f0(totSaldo)}</span>:<span style={{ color:'var(--text3)' }}>—</span>}</td>}
                        {showBreakdownR&&<>{[r.sC,r.sB,r.sCa].map((v,j)=>(<td key={j} style={{ padding:'8px 10px', textAlign:'right' }}>{v!=null?<span style={{ fontWeight:700, color:v>=0?'var(--green)':'var(--red)' }}>{v>=0?'+':'-'}€{f0(v)}</span>:<span style={{ color:'var(--text3)' }}>—</span>}</td>))}</>}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div className="card" style={{ padding:'16px' }}>
            <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Andamento spese totali</p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={cData} margin={{ left:-20, right:8, top:4, bottom:0 }}>
                <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={52}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="Spese fisse" stroke="#2563eb" fill="#eff6ff" strokeWidth={2} dot={{ fill:'#2563eb', r:3 }}/>
                <Area type="monotone" dataKey="Consumi" stroke="#7c3aed" fill="#f5f3ff" strokeWidth={2} dot={{ fill:'#7c3aed', r:3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>
          {vData.length > 0 && (
            <div className="card">
              <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Variazioni anno su anno</p>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {vData.map(r => (
                  <div key={r.anno} style={{ display:'flex', alignItems:'center', gap:8, padding:'8px 12px', background:'var(--bg2)', borderRadius:8, fontSize:12, flexWrap:'wrap' }}>
                    <span className="tag tag-blue" style={{ flexShrink:0 }}>{r.anno}</span>
                    {[['Fisse',r['Fisse%']],['Consumi',r['Consumi%']],['Totale',r['Totale%']]].map(([l,v])=>(
                      <span key={l as string} style={{ fontWeight:700, color:(v as number)>0?'var(--red)':'var(--green)', background:(v as number)>0?'var(--red-bg)':'var(--green-bg)', borderRadius:5, padding:'2px 8px', fontSize:11 }}>
                        {l}: {(v as number)>0?'+':''}{(v as number).toFixed(1)}%
                      </span>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          )}
          {riassunto.some(r=>r.rUnit) && (
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--border)', background:'var(--bg3)' }}>
                <p style={{ fontWeight:700, fontSize:12 }}>Costo unitario consumi per anno (€/mc)</p>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead><tr style={{ background:'var(--bg3)' }}>{['Anno','Risc. mc','€/mc Δ','ACS mc','€/mc Δ','Acq.fr. mc','€/mc Δ'].map(h=>(<th key={h} style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>{h}</th>))}</tr></thead>
                  <tbody>
                    {riassunto.filter(r=>r.rMc).map((r,i)=>{
                      const prv=riassunto.filter(x=>x.rMc)[i-1];
                      const cell=(val:number|null,prv:number|null,col:string)=>(<td style={{ padding:'6px 10px', textAlign:'right' }}>{val?<><span style={{ fontWeight:700, color:col }}>{f2(val)}</span>{prv&&<div style={{ fontSize:9, fontWeight:700, color:val>prv?'var(--red)':'var(--green)' }}>{val>prv?'▲':'▼'}{Math.abs(pct(val,prv)).toFixed(1)}%</div>}</>:<span style={{ color:'var(--text3)' }}>—</span>}</td>);
                      return (<tr key={r.anno} style={{ borderBottom:'1px solid var(--border)' }}><td style={{ padding:'6px 10px' }}><span className="tag tag-blue">{r.anno}</span></td><td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.rMc)}</td>{cell(r.rUnit||null,prv?.rUnit||null,'#ef4444')}<td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.aMc)}</td>{cell(r.aUnit||null,prv?.aUnit||null,'#f97316')}<td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fN(r.afMc)}</td>{cell(r.afUnit||null,prv?.afUnit||null,'#3b82f6')}</tr>);
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
            Inserisci i dati <strong>una volta l'anno</strong> quando ricevi il rendiconto SSA (ottobre/novembre).
          </div>
          {editY && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'+ Nuovo anno':`Modifica ${editY.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label>Anno esercizio</label><input value={editY.year_label||''} onChange={e=>setEditY((p:any)=>({...p,year_label:e.target.value}))} placeholder="es. 25/26"/></div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Saldo iniziale</p>
                  <div className="grid3"><NF lbl="App C63" fld="balance_start_casa" st={editY} fn={numY}/><NF lbl="Box 13" fld="balance_start_box" st={editY} fn={numY}/><NF lbl="Cantina" fld="balance_start_cantina" st={editY} fn={numY}/></div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Rate versate</p>
                  <div className="grid3"><NF lbl="App C63" fld="rates_paid_casa" st={editY} fn={numY}/><NF lbl="Box 13" fld="rates_paid_box" st={editY} fn={numY}/><NF lbl="Cantina" fld="rates_paid_cantina" st={editY} fn={numY}/></div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Spese totali</p>
                  <div className="grid3"><NF lbl="App C63" fld="spese_totali_casa" st={editY} fn={numY}/><NF lbl="Box 13" fld="spese_totali_box" st={editY} fn={numY}/><NF lbl="Cantina" fld="spese_totali_cantina" st={editY} fn={numY}/></div>
                </div>
                <FormActions onCancel={()=>setEditY(null)} onSave={async()=>{await save('exercise_years',editY,setYears);setEditY(null);}}/>
              </div>
            </div>
          )}
          {[...years].reverse().map((y) => {
            const sC=calcSaldo(y.balance_start_casa,y.rates_paid_casa,y.spese_totali_casa||0);
            const sB=calcSaldo(y.balance_start_box,y.rates_paid_box,y.spese_totali_box||0);
            const sCa=calcSaldo(y.balance_start_cantina,y.rates_paid_cantina,y.spese_totali_cantina||0);
            const tot=sC+sB+sCa; const isExp=expY===y.id;
            return (
              <div key={y.id} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}><span className="tag tag-blue">{y.year_label}</span><Chip v={tot}/></div>
                    <p style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-display)', color:tot>=0?'var(--green)':'var(--red)', lineHeight:1 }}>€{fa(tot)}</p>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn-icon" onClick={()=>setExpY(isExp?null:y.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditY({...y});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('exercise_years',y.id,setYears)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {isExp && (<><div className="divider"/><div className="grid3">{([['App C63',sC],['Box 13',sB],['Cantina',sCa]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center', padding:'8px 4px', background:v>=0?'var(--green-bg)':'var(--red-bg)', border:`1px solid ${v>=0?'#bbf7d0':'#fecaca'}`, borderRadius:8 }}><p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:3 }}>{l}</p><p style={{ fontSize:14, fontWeight:800, color:v>=0?'var(--green)':'var(--red)' }}>€{fa(v)}</p><p style={{ fontSize:9, fontWeight:700, color:v>=0?'var(--green)':'var(--red)', marginTop:1 }}>{v>=0?'credito':'debito'}</p></div>))}</div><div className="divider"/><div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:4, fontSize:11 }}>{[['Inizio casa',y.balance_start_casa],['Inizio box',y.balance_start_box],['Inizio cant.',y.balance_start_cantina],['Rate casa',y.rates_paid_casa],['Rate box',y.rates_paid_box],['Rate cant.',y.rates_paid_cantina],['Spese casa',y.spese_totali_casa||0],['Spese box',y.spese_totali_box||0],['Spese cant.',y.spese_totali_cantina||0]].map(([l,v])=>(<div key={l as string}><p style={{ color:'var(--text3)', fontSize:9, marginBottom:1 }}>{l}</p><p style={{ fontWeight:600 }}>€{fa(v as number)}</p></div>))}</div></>)}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ SPESE ══ */}
      {tab==='Spese' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Spese Fisse" sub="Dettaglio voci dal riparto SSA" onAdd={()=>{setEditF({...emptyF});setIsNew(true);}}/>
          <div style={{ display:'flex', justifyContent:'flex-end' }}><ToggleBreakdown show={showBreakdownS} onToggle={()=>setShowBreakdownS(v=>!v)}/></div>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--blue)' }}>Inserisci <strong>una volta l'anno</strong> copiando i valori dal "Riparto Consuntivo" SSA.</div>
          {editF && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo anno':`Modifica ${editF.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="grid2"><div><label>Anno</label><input value={editF.year_label||''} onChange={e=>setEditF((p:any)=>({...p,year_label:e.target.value}))} placeholder="25/26"/></div><NF lbl="Movimenti personali €" fld="spese_personali" st={editF} fn={numF} ph="cert. + addebiti"/></div>
                <TI lbl="Spese Proprietà" pfx="prop" st={editF} fn={numF}/>
                <TI lbl="Spese Generali" pfx="gen_prop" st={editF} fn={numF}/>
                <TI lbl="Manutenzioni Ordinarie" pfx="man_ord" st={editF} fn={numF}/>
                <TI lbl="Scale di Proprietà (Scala C)" pfx="scale_prop" st={editF} fn={numF}/>
                <TI lbl="Scala C Gestione" pfx="scala_c" st={editF} fn={numF}/>
                <TI lbl="Ascensore C" pfx="asc_c" st={editF} fn={numF}/>
                <div className="grid3"><NF lbl="Prop. alloggi €" fld="prop_alloggi" st={editF} fn={numF}/><NF lbl="Addebiti unità €" fld="addebiti_unita" st={editF} fn={numF}/><NF lbl="Add. unità imm. €" fld="addebiti_unita_imm" st={editF} fn={numF}/><NF lbl="En.el. box €" fld="prop_box_extra" st={editF} fn={numF}/></div>
                <FormActions onCancel={()=>setEditF(null)} onSave={async()=>{await save('fixed_expenses',editF,setFixed);setEditF(null);}}/>
              </div>
            </div>
          )}
          {[...fixed].reverse().map((r,i) => {
            const tC=sfTot(r),tB=sfBox(r),tCa=sfCant(r),tot=tC+tB+tCa;
            const prv=[...fixed].reverse()[i+1];
            const prvTot=prv?sfTot(prv)+sfBox(prv)+sfCant(prv):null;
            const isExp=expF===r.id;
            return (
              <div key={r.id} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <span className="tag tag-purple" style={{ marginBottom:6, display:'inline-flex' }}>{r.year_label}</span>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}><p style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-display)', lineHeight:1 }}>€{f0(tot)}</p><Delta cur={tot} prev={prvTot} invert/></div>
                    <p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>totale spese fisse</p>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn-icon" onClick={()=>setExpF(isExp?null:r.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditF({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('fixed_expenses',r.id,setFixed)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {showBreakdownS&&(<><div className="divider"/><div className="grid3">{([['App C63',tC],['Box 13',tB],['Cantina',tCa]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center', padding:'7px 4px', background:'var(--bg3)', borderRadius:8 }}><p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p><p style={{ fontSize:13, fontWeight:800 }}>€{fa(v)}</p></div>))}</div></>)}
                {isExp&&(<div style={{ marginTop:10 }}><div className="divider"/>{[['Proprietà',r.prop_casa,r.prop_box,r.prop_cantina],['Generali',r.gen_prop_casa,r.gen_prop_box,r.gen_prop_cantina],['Man. Ord.',r.man_ord_casa,r.man_ord_box,r.man_ord_cantina],['Scale C',r.scale_prop_casa,r.scale_prop_box,r.scale_prop_cantina],['Scala C g.',r.scala_c_casa,r.scala_c_box,r.scala_c_cantina],['Ascens. C',r.asc_c_casa,r.asc_c_box,r.asc_c_cantina]].map(([l,c,b,ca])=>(<div key={l as string} style={{ display:'grid', gridTemplateColumns:'1.2fr 1fr 1fr 1fr', gap:4, fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}><span style={{ color:'var(--text2)', fontWeight:600 }}>{l}</span><span style={{ textAlign:'right', fontWeight:600 }}>€{fa(c as number)}</span><span style={{ textAlign:'right', fontWeight:600 }}>€{fa(b as number)}</span><span style={{ textAlign:'right', fontWeight:600 }}>€{fa(ca as number)}</span></div>))}{[['Prop. alloggi',r.prop_alloggi],['Add. unità',r.addebiti_unita],['Add. u. imm.',r.addebiti_unita_imm],['Mov. pers.',r.spese_personali]].map(([l,v])=>(<div key={l as string} style={{ display:'flex', justifyContent:'space-between', fontSize:11, padding:'3px 0', borderBottom:'1px solid var(--border)' }}><span style={{ color:'var(--text2)' }}>{l}</span><span style={{ fontWeight:700 }}>€{fa(v as number)}</span></div>))}</div>)}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ CONSUMI ══ */}
      {tab==='Consumi' && (
        <div ref={consumiTopRef} style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Consumi" sub="Letture (mc) + costi dal riparto" onAdd={()=>{setEditC({...emptyC});setIsNew(true);}}/>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', alignItems:'center' }}>
            <div style={{ display:'flex', background:'var(--bg3)', borderRadius:20, padding:3, gap:2 }}>
              {(['euro','qty'] as const).map(v=>(
                <button key={v} onClick={()=>setConsumiView(v)} style={{ padding:'5px 12px', borderRadius:18, fontSize:12, fontWeight:600, background:consumiView===v?'#fff':'transparent', color:consumiView===v?'var(--accent)':'var(--text2)', boxShadow:consumiView===v?'var(--shadow-xs)':'none' }}>
                  {v==='euro'?'€ Costi':'Quantità (mc)'}
                </button>
              ))}
            </div>
            <ToggleBreakdown show={showBreakdownC} onToggle={()=>setShowBreakdownC(v=>!v)}/>
          </div>
          <div className="card">
            <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>{consumiView==='euro'?'Costi consumi nel tempo':'Quantità consumate (mc)'}</p>
            <ResponsiveContainer width="100%" height={180}>
              {consumiView==='euro' ? (
                <BarChart data={cData} margin={{ left:-10, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
                  <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={50}/>
                  <Tooltip content={<ChartTip/>}/><Legend wrapperStyle={{ fontSize:11 }}/>
                  <Bar dataKey="Risc." fill="#ef4444" stackId="a"/>
                  <Bar dataKey="ACS" fill="#f97316" stackId="a"/>
                  <Bar dataKey="Acq.fr." fill="#3b82f6" stackId="a" radius={[4,4,0,0]}/>
                </BarChart>
              ) : (
                <LineChart data={consumiQtyData} margin={{ left:-10, right:8, top:4, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
                  <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                  <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} width={50}/>
                  <Tooltip content={<ChartTipRaw/>}/><Legend wrapperStyle={{ fontSize:11 }}/>
                  <Line type="monotone" dataKey="Riscaldamento (mc)" stroke="#ef4444" strokeWidth={2} dot={{ fill:'#ef4444', r:3 }}/>
                  <Line type="monotone" dataKey="Acqua calda (mc)" stroke="#f97316" strokeWidth={2} dot={{ fill:'#f97316', r:3 }}/>
                  <Line type="monotone" dataKey="Acqua fredda (mc)" stroke="#3b82f6" strokeWidth={2} dot={{ fill:'#3b82f6', r:3 }}/>
                </LineChart>
              )}
            </ResponsiveContainer>
          </div>


          {editC && isNew && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>Nuovo anno</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label>Anno</label><input value={editC.year_label||''} onChange={e=>setEditC((p:any)=>({...p,year_label:e.target.value}))} placeholder="24/25"/></div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Letture contatori (mc)</p>
                  <div className="grid2">
                    <NF lbl="Risc. iniziale (mc)" fld="risc_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Risc. finale (mc)" fld="risc_lettura_finale" st={editC} fn={numC}/>
                    <NF lbl="ACS iniziale (mc)" fld="acqua_calda_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="ACS finale (mc)" fld="acqua_calda_lettura_finale" st={editC} fn={numC}/>
                    <NF lbl="Acq. fredda iniziale (mc)" fld="acqua_fredda_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Acq. fredda finale (mc)" fld="acqua_fredda_lettura_finale" st={editC} fn={numC}/>
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

          {[...consumi].reverse().map((r) => {
            const tot = r.totale_casa + r.totale_box + r.totale_cantina;
            const rIdxSorted = consumiSorted.findIndex(x => x.id === r.id);
            const prvC = rIdxSorted > 0 ? consumiSorted[rIdxSorted - 1] : null;
            const prvTot = prvC ? prvC.totale_casa + prvC.totale_box + prvC.totale_cantina : null;

            const rMc  = r.risc_lettura_finale != null && r.risc_lettura_iniziale != null ? r.risc_lettura_finale - r.risc_lettura_iniziale : null;
            const aMc  = r.acqua_calda_lettura_finale != null && r.acqua_calda_lettura_iniziale != null ? r.acqua_calda_lettura_finale - r.acqua_calda_lettura_iniziale : null;
            const afMc = r.acqua_fredda_lettura_finale != null && r.acqua_fredda_lettura_iniziale != null ? r.acqua_fredda_lettura_finale - r.acqua_fredda_lettura_iniziale : null;
            const rU  = rMc  && r.riscaldamento_consumo ? r.riscaldamento_consumo / rMc  : null;
            const aU  = aMc  && r.acqua_calda_consumo   ? r.acqua_calda_consumo   / aMc  : null;
            const afU = afMc && r.acqua_potabile         ? r.acqua_potabile        / afMc : null;
            const isExp = expC === r.id;

            // Validazione interna (errori dentro l'anno)
            const valChecks = [
              validaLetture(r.risc_lettura_iniziale, r.risc_lettura_finale, r.riscaldamento_consumo, 'Riscaldamento'),
              validaLetture(r.acqua_calda_lettura_iniziale, r.acqua_calda_lettura_finale, r.acqua_calda_consumo, 'Acqua calda'),
              validaLetture(r.acqua_fredda_lettura_iniziale, r.acqua_fredda_lettura_finale, r.acqua_potabile, 'Acqua fredda'),
            ];

            // Continuità: iniziale di QUESTO anno deve coincidere con finale dell'anno PRECEDENTE
            // => alert sulla card che ha la lettura iniziale sbagliata
            const prevC = rIdxSorted > 0 ? consumiSorted[rIdxSorted - 1] : null;
            const contChecks: ReturnType<typeof validaContinuita>[] = prevC ? [
              validaContinuita(prevC.risc_lettura_finale,         r.risc_lettura_iniziale,         prevC.year_label),
              validaContinuita(prevC.acqua_calda_lettura_finale,  r.acqua_calda_lettura_iniziale,  prevC.year_label),
              validaContinuita(prevC.acqua_fredda_lettura_finale, r.acqua_fredda_lettura_iniziale, prevC.year_label),
            ] : [];

            const allIssues = [...valChecks, ...contChecks].filter(c => !c.ok);
            const hasErrors = allIssues.some(c => c.severity === 'error');
            const hasWarns  = allIssues.length > 0;
            const hasLetture = r.risc_lettura_iniziale !== null || r.acqua_calda_lettura_iniziale !== null;

            const statusBadge = !hasLetture ? null : hasErrors ? (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#dc2626', background:'#fee2e2', border:'1px solid #fecaca', borderRadius:6, padding:'2px 7px' }}><AlertCircle size={11}/> Errore</span>
            ) : hasWarns ? (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:700, color:'#b45309', background:'#fef3c7', border:'1px solid #fde68a', borderRadius:6, padding:'2px 7px' }}><AlertCircle size={11}/> Attenzione</span>
            ) : (
              <span style={{ display:'inline-flex', alignItems:'center', gap:4, fontSize:11, fontWeight:600, color:'var(--green)', background:'var(--green-bg)', border:'1px solid #a7f3d0', borderRadius:6, padding:'2px 7px' }}><Check size={11}/> Letture OK</span>
            );

            const cardBorder = hasErrors ? { border:'2px solid #fca5a5' } : hasWarns ? { border:'2px solid #fde68a' } : undefined;

            // Se questa card è in modalità editing, mostra il form inline
            if (editC && editC.id === r.id) {
              return (
                <div key={r.id} className="card" style={{ border:'2px solid var(--accent)' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
                    <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16 }}>Modifica {r.year_label}</p>
                    <button className="btn-ghost" style={{ padding:'4px 10px', fontSize:12 }} onClick={()=>setEditC(null)}>✕ Annulla</button>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                    <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                      <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Letture contatori (mc)</p>
                      <div className="grid2">
                        <NF lbl="Risc. iniziale (mc)" fld="risc_lettura_iniziale" st={editC} fn={numC}/>
                        <NF lbl="Risc. finale (mc)" fld="risc_lettura_finale" st={editC} fn={numC}/>
                        <NF lbl="ACS iniziale (mc)" fld="acqua_calda_lettura_iniziale" st={editC} fn={numC}/>
                        <NF lbl="ACS finale (mc)" fld="acqua_calda_lettura_finale" st={editC} fn={numC}/>
                        <NF lbl="Acq. fredda iniziale (mc)" fld="acqua_fredda_lettura_iniziale" st={editC} fn={numC}/>
                        <NF lbl="Acq. fredda finale (mc)" fld="acqua_fredda_lettura_finale" st={editC} fn={numC}/>
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
              );
            }

            return (
              <div key={r.id} className="card" style={cardBorder}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', marginBottom:4 }}>
                      <span className="tag tag-blue">{r.year_label}</span>
                      {statusBadge}
                    </div>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <p style={{ fontSize:20, fontWeight:800, fontFamily:'var(--font-display)', lineHeight:1 }}>€{f0(tot)}</p>
                      <Delta cur={tot} prev={prvTot} invert/>
                    </div>
                    {(rMc || aMc || afMc) && (
                      <div style={{ display:'flex', gap:5, marginTop:6, flexWrap:'wrap' }}>
                        {rMc  && <span style={{ fontSize:10, background:'#fef2f2', border:'1px solid #fecaca', borderRadius:5, padding:'2px 7px', color:'#991b1b' }}><strong>{fN(rMc)} mc</strong>{rU ? ` · €${f2(rU)}/mc` : ''}</span>}
                        {aMc  && <span style={{ fontSize:10, background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:5, padding:'2px 7px', color:'#9a3412' }}><strong>{fN(aMc)} mc</strong>{aU ? ` · €${f2(aU)}/mc` : ''}</span>}
                        {afMc && <span style={{ fontSize:10, background:'#eff6ff', border:'1px solid #bfdbfe', borderRadius:5, padding:'2px 7px', color:'#1e40af' }}><strong>{fN(afMc)} mc</strong>{afU ? ` · €${f2(afU)}/mc` : ''}</span>}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:4, flexShrink:0, marginLeft:8 }}>
                    <button className="btn-icon" onClick={()=>setExpC(isExp ? null : r.id)}>{isExp ? <ChevronUp size={13}/> : <ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditC({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('consumption_data',r.id,setConsumi)}><Trash2 size={13}/></button>
                  </div>
                </div>

                {showBreakdownC && (
                  <><div className="divider"/>
                  <div className="grid3">
                    {([['App C63',r.totale_casa],['Box 13',r.totale_box],['Cantina',r.totale_cantina]] as [string,number][]).map(([l,v])=>(
                      <div key={l} style={{ textAlign:'center', padding:'7px 4px', background:'var(--bg3)', borderRadius:8 }}>
                        <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                        <p style={{ fontSize:13, fontWeight:800 }}>€{fa(v)}</p>
                      </div>
                    ))}
                  </div></>
                )}

                {isExp && (
                  <ConsumoDetail
                    r={r} rMc={rMc} aMc={aMc} afMc={afMc}
                    rU={rU} aU={aU} afU={afU}
                    valChecks={valChecks}
                    contChecks={contChecks}
                  />
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ RATE ══ */}
      {tab==='Rate' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Rate pagate" sub={`${rates.length} pagamenti totali`} onAdd={()=>{setEditR({...emptyR});setIsNew(true);}}/>
          <div style={{ display:'flex', justifyContent:'flex-end' }}><ToggleBreakdown show={showBreakdownR} onToggle={()=>setShowBreakdownR(v=>!v)}/></div>
          {allYrs.some(yl=>rates.some(r=>r.year_label===yl))&&(<div className="card"><p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Rate versate per anno</p><ResponsiveContainer width="100%" height={130}><BarChart data={riassunto.filter(r=>r.rateAnno>0)} margin={{ left:-10, right:8, top:4, bottom:0 }}><CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/><XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/><YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={50}/><Tooltip content={<ChartTip/>}/><Bar dataKey="rateAnno" name="Rate versate" fill="#16a34a" radius={[5,5,0,0]}/></BarChart></ResponsiveContainer></div>)}
          {editR&&(<div className="card" style={{ border:'2px solid var(--accent)' }}><p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo pagamento':'Modifica pagamento'}</p><div style={{ display:'flex', flexDirection:'column', gap:10 }}><div><label>Data pagamento</label><input type="date" value={editR.data_pagamento||''} onChange={e=>{const d=e.target.value;const m=new Date(d).getMonth()+1,yr=new Date(d).getFullYear();const yl=m>=10?`${String(yr).slice(2)}/${String(yr+1).slice(2)}`:`${String(yr-1).slice(2)}/${String(yr).slice(2)}`;setEditR((p:any)=>({...p,data_pagamento:d,year_label:yl}));}}/></div><div><label>Importo totale (€)</label><input type="number" step="0.01" placeholder="es. 413.50" value={editR._importo_totale||''} onChange={e=>{const tot=parseFloat(e.target.value)||0;const totM=3.394+0.576+0.059;setEditR((p:any)=>({...p,_importo_totale:e.target.value,importo_casa:parseFloat((tot*3.394/totM).toFixed(2)),importo_box:parseFloat((tot*0.576/totM).toFixed(2)),importo_cantina:parseFloat((tot*0.059/totM).toFixed(2))}));}}/></div>{(editR.importo_casa>0||editR.importo_box>0)&&(<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>{([['App C63',editR.importo_casa],['Box 13',editR.importo_box],['Cantina',editR.importo_cantina]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center', background:'var(--accent-light)', borderRadius:8, padding:'7px 4px' }}><p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p><p style={{ fontSize:13, fontWeight:800, color:'var(--accent)' }}>€{fa(v)}</p></div>))}</div>)}<div><label>Note (opzionale)</label><input value={editR.descrizione||''} onChange={e=>strR('descrizione',e.target.value)} placeholder="Acconto, Conguaglio..."/></div><FormActions onCancel={()=>setEditR(null)} onSave={async()=>{await save('rate_pagamenti',editR,setRates);setEditR(null);}}/></div></div>)}
          {allYrs.map(yl=>{
            const rAnno=rates.filter(r=>r.year_label===yl);if(rAnno.length===0)return null;
            const totC=rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0),0);
            const totB=rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_box)||0),0);
            const totCa=rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_cantina)||0),0);
            const totAll=totC+totB+totCa;
            const yData=years.find(y=>y.year_label===yl);
            const atteso=yData?yData.rates_paid_casa+yData.rates_paid_box+yData.rates_paid_cantina:null;
            const ok=atteso!==null&&Math.abs(totAll-atteso)<1;
            const avgRata=rAnno.length>0?totAll/rAnno.length:0;
            return(<div key={yl} className="card"><div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}><div><span className="tag tag-blue" style={{ marginRight:6 }}>{yl}</span><p style={{ fontWeight:800, fontSize:22, fontFamily:'var(--font-display)', lineHeight:1.1, marginTop:4 }}>€{fa(totAll)}</p><p style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>{rAnno.length} rata{rAnno.length>1?'e':''} · media €{fa(avgRata)} cad.</p></div>{showBreakdownR&&(<div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'flex-end' }}>{([['App',totC,'#16a34a'],['Box',totB,'#2563eb'],['Cant.',totCa,'#d97706']] as [string,number,string][]).map(([l,v,c])=>(<span key={l} style={{ fontSize:11, fontWeight:700, color:c }}>{l}: €{fa(v)}</span>))}</div>)}</div>{atteso!==null&&(<div style={{ background:ok?'var(--green-bg)':'var(--amber-bg)', border:`1px solid ${ok?'#bbf7d0':'#fde68a'}`, borderRadius:8, padding:'6px 10px', fontSize:12, marginBottom:10, fontWeight:600, color:ok?'var(--green)':'var(--amber)', display:'flex', alignItems:'center', gap:6 }}>{ok?<Check size={13}/>:<AlertCircle size={13}/>}{ok?'Totale corrisponde al rendiconto':`Atteso €${fa(atteso)} · differenza €${fa(Math.abs(totAll-atteso))}`}</div>)}<div style={{ display:'flex', flexDirection:'column', gap:5 }}>{rAnno.map((r:any)=>{const tot=(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0);if (editR && editR.id === r.id) {
                    return (
                      <div key={r.id} style={{ background:'var(--bg2)', border:'2px solid var(--accent)', borderRadius:10, padding:'12px' }}>
                        <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:14, marginBottom:10 }}>Modifica pagamento</p>
                        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                          <div><label>Data pagamento</label><input type="date" value={editR.data_pagamento||''} onChange={e=>{const d=e.target.value;const m=new Date(d).getMonth()+1,yr=new Date(d).getFullYear();const yl=m>=10?`${String(yr).slice(2)}/${String(yr+1).slice(2)}`:`${String(yr-1).slice(2)}/${String(yr).slice(2)}`;setEditR((p:any)=>({...p,data_pagamento:d,year_label:yl}));}}/></div>
                          <div><label>Importo totale (€)</label><input type="number" step="0.01" value={editR._importo_totale||''} onChange={e=>{const tot=parseFloat(e.target.value)||0;const totM=3.394+0.576+0.059;setEditR((p:any)=>({...p,_importo_totale:e.target.value,importo_casa:parseFloat((tot*3.394/totM).toFixed(2)),importo_box:parseFloat((tot*0.576/totM).toFixed(2)),importo_cantina:parseFloat((tot*0.059/totM).toFixed(2))}));}}/></div>
                          {(editR.importo_casa>0||editR.importo_box>0)&&(<div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>{([['App C63',editR.importo_casa],['Box 13',editR.importo_box],['Cantina',editR.importo_cantina]] as [string,number][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center', background:'var(--accent-light)', borderRadius:8, padding:'7px 4px' }}><p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p><p style={{ fontSize:13, fontWeight:800, color:'var(--accent)' }}>€{fa(v)}</p></div>))}</div>)}
                          <div><label>Note (opzionale)</label><input value={editR.descrizione||''} onChange={e=>strR('descrizione',e.target.value)} placeholder="Acconto, Conguaglio..."/></div>
                          <FormActions onCancel={()=>setEditR(null)} onSave={async()=>{await save('rate_pagamenti',editR,setRates);setEditR(null);}}/>
                        </div>
                      </div>
                    );
                  }
                    return(<div key={r.id} style={{ background:'var(--bg3)', borderRadius:8, overflow:'hidden' }}><div style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', fontSize:12 }}><CreditCard size={13} color="var(--accent)"/><div style={{ flex:1 }}><div style={{ display:'flex', alignItems:'center', gap:6 }}><span style={{ fontWeight:700 }}>{r.numero_rata}</span><span style={{ color:'var(--text3)' }}>{fmtDate(r.data_pagamento)}</span>{r.descrizione&&<span style={{ color:'var(--text2)', fontSize:11 }}>{r.descrizione}</span>}</div>{showBreakdownR&&(<div style={{ display:'flex', gap:8, marginTop:2, fontSize:10, color:'var(--text3)' }}><span style={{ color:'#16a34a' }}>App €{fa(parseFloat(r.importo_casa)||0)}</span><span style={{ color:'#2563eb' }}>Box €{fa(parseFloat(r.importo_box)||0)}</span><span style={{ color:'#d97706' }}>Cant. €{fa(parseFloat(r.importo_cantina)||0)}</span></div>)}</div><p style={{ fontWeight:800, fontSize:15 }}>€{fa(tot)}</p><div style={{ display:'flex', gap:3 }}><button className="btn-icon" style={{ padding:5 }} onClick={()=>{setEditR({...r});setIsNew(false);}}><Pencil size={12}/></button><button className="btn-danger" style={{ padding:5 }} onClick={()=>del('rate_pagamenti',r.id,setRates)}><Trash2 size={12}/></button></div></div></div>);})}</div>{atteso&&(<div style={{ marginTop:10 }}><div style={{ display:'flex', justifyContent:'space-between', fontSize:11, color:'var(--text3)', marginBottom:4 }}><span>Versato vs atteso</span><span>{Math.min(100,Math.round(totAll/atteso*100))}%</span></div><div style={{ background:'var(--bg3)', borderRadius:4, height:6, overflow:'hidden' }}><div style={{ width:`${Math.min(100,totAll/atteso*100)}%`, height:'100%', background:ok?'var(--green)':'var(--amber)', borderRadius:4, transition:'width 0.4s' }}/></div></div>)}</div>);
          })}
          {rates.length===0&&<p style={{ textAlign:'center', color:'var(--text3)', padding:24 }}>Nessuna rata registrata.</p>}
        </div>
      )}

      {/* ══ CONFRONTO ══ */}
      {tab==='Confronto' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>Preventivo vs Consuntivo</h2>
          {(()=>{
            const c=fixed.find(r=>r.year_label==='24/25');
            if(!c)return<p style={{ color:'var(--text3)', textAlign:'center', padding:20 }}>Inserisci i dati spese 24/25.</p>;
            const rows=[{l:'Spese Proprietà',prev:172.03,cons:c.prop_casa,diff:'50.687 × 3,394‰'},{l:'Spese Generali',prev:533.36,cons:c.gen_prop_casa,diff:'157.146 × 3,394‰'},{l:'Man. Ordinarie',prev:16.97,cons:c.man_ord_casa,diff:'5.000 × 3,394‰'},{l:'Scala C',prev:13.36,cons:c.scale_prop_casa+c.scala_c_casa,diff:'scale + gestione'},{l:'Ascensore C',prev:18.96,cons:c.asc_c_casa,diff:'ascensore C'},{l:'Prop. alloggi',prev:16.97,cons:c.prop_alloggi,diff:'solo alloggi/negozi'},{l:'Teleletture',prev:17.59,cons:c.addebiti_unita_imm,diff:'5.186 × 3,394‰'},{l:'Mov. personali',prev:0,cons:c.spese_personali,diff:'cert. + addebiti'}];
            const tP=rows.reduce((s,r)=>s+r.prev,0),tC=rows.reduce((s,r)=>s+r.cons,0);
            return(<div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}><div style={{ overflowX:'auto' }}><table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}><thead><tr style={{ background:'var(--bg3)' }}>{['Voce','Prev. 24/25','Cons. 24/25','Δ €','Δ %'].map(h=>(<th key={h} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10, whiteSpace:'nowrap' }}>{h}</th>))}</tr></thead><tbody>{rows.map((r,i)=>{const diff=r.cons-r.prev,dp=r.prev?pct(r.cons,r.prev):0;return(<tr key={r.l} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'#fff':'var(--bg3)' }}><td style={{ padding:'8px 10px' }}><p style={{ fontWeight:600 }}>{r.l}</p><p style={{ fontSize:9, color:'var(--text3)' }}>{r.diff}</p></td><td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(r.prev)}</td><td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>€{fa(r.cons)}</td><td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:diff>0?'var(--red)':'var(--green)' }}>{diff>=0?'+':'-'}€{fa(Math.abs(diff))}</td><td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:dp>0?'var(--red)':'var(--green)' }}>{r.prev?`${dp>=0?'+':'-'}${Math.abs(dp).toFixed(1)}%`:'—'}</td></tr>);})} <tr style={{ background:'var(--accent-light)', fontWeight:800 }}><td style={{ padding:'8px 10px' }}>TOTALE</td><td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(tP)}</td><td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(tC)}</td><td style={{ padding:'8px 10px', textAlign:'right', color:(tC-tP)>0?'var(--red)':'var(--green)' }}>{(tC-tP)>=0?'+':'-'}€{fa(Math.abs(tC-tP))}</td><td style={{ padding:'8px 10px', textAlign:'right', color:pct(tC,tP)>0?'var(--red)':'var(--green)' }}>{pct(tC,tP)>=0?'+':'-'}{Math.abs(pct(tC,tP)).toFixed(1)}%</td></tr></tbody></table></div></div>);
          })()}
        </div>
      )}

      {/* ══ PREVENTIVO 25/26 ══ */}
      {tab==='Preventivo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>Preventivo 25/26</h2>
          <div style={{ background:'var(--amber-bg)', border:'1px solid #fde68a', borderRadius:12, padding:'12px 14px', fontSize:12, color:'var(--amber)' }}><strong>Quote stimate</strong> calcolate sui tuoi millesimi (3,394‰ app · 0,576‰ box). I consumi vanno inseriti dopo ottobre 2026.</div>
          {last?.sTot!==null&&(<div style={{ background:'var(--green-bg)', border:'1px solid #bbf7d0', borderRadius:12, padding:'12px 14px' }}><p style={{ fontWeight:700, fontSize:13, color:'var(--green)', marginBottom:8 }}>Saldo di partenza 25/26</p><div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>{([['App C63',last?.sC],['Box 13',last?.sB],['Cantina',last?.sCa]] as [string,number|null][]).map(([l,v])=>(<div key={l} style={{ textAlign:'center' }}><p style={{ fontSize:10, color:'var(--green)', opacity:0.8 }}>{l}</p><p style={{ fontWeight:800, color:'var(--green)', fontFamily:'var(--font-display)', fontSize:16 }}>{v!==null?`${v>=0?'+':'-'}€${fa(v)}`:'—'}</p></div>))}</div></div>)}
          <div className="card">
            <p style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>App C63 — spese fisse stimate</p>
            {([['Spese Proprietà',PV.prop,'52.129 × 3,394‰'],['Spese Generali',PV.gen,'149.737 × 3,394‰'],['Manutenzioni',PV.man,'10.000 × 3,394‰'],['Scale C',PV.scalac,'4.500 × 20,288‰'],['Ascensore C',PV.asc,'3.802 × 20,288‰'],['Teleletture',PV.tele,'5.054 × 3,394‰'],['Risc. involontario',PV.risc_inv,'35.349 × 3,394‰'],['ACS involontaria',PV.acs_inv,'31.638 × 3,394‰']] as [string,number,string][]).map(([l,v,note])=>(<div key={l} className="row"><div><p style={{ fontWeight:500, fontSize:13 }}>{l}</p><p style={{ fontSize:10, color:'var(--text3)' }}>{note}</p></div><span style={{ fontWeight:800 }}>€{fa(v)}</span></div>))}
            <div style={{ marginTop:8, paddingTop:8, borderTop:'2px solid var(--border)', display:'flex', justifyContent:'space-between' }}><span style={{ fontWeight:800 }}>Subtotale fisse</span><span style={{ fontWeight:800, color:'var(--accent)', fontFamily:'var(--font-display)', fontSize:16 }}>€{fa(Object.values(PV).reduce((s,v)=>s+v,0))}</span></div>
          </div>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:12, padding:'12px 14px', fontSize:12, color:'var(--blue)' }}><strong>I tuoi millesimi:</strong><br/>App C63: 3,394‰ prop · 3,394‰ gen · 20,288‰ scala C<br/>Box 13: 0,576‰ prop · 0,576‰ gen · 3,443‰ scala C<br/>Cantina 10c: 0,059‰ prop · 0,059‰ gen</div>
        </div>
      )}
    </div>
  );
}