import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import type { Property, ExerciseYear, FixedExpenses, ConsumptionData } from '../types';
import {
  Plus, Pencil, Trash2, X, Check, TrendingUp, TrendingDown,
  ChevronDown, ChevronUp, CreditCard, AlertCircle
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend, ReferenceLine
} from 'recharts';

// ── utils ─────────────────────────────────────────────────────
const fa  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0  = (n: number) => Math.abs(n).toLocaleString('it-IT', { maximumFractionDigits: 0 });
const f2  = (n: number) => Math.abs(n).toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const pct = (c: number, p: number) => p !== 0 ? ((c - p) / Math.abs(p) * 100) : 0;
const fmtN = (n: number | null) => n !== null ? Math.abs(n).toLocaleString('it-IT') : '—';
const fmtDate = (s: string) => s ? new Date(s).toLocaleDateString('it-IT') : '—';
const calcSaldo = (start: number, rate: number, spese: number) => start - rate + spese;

// Millesimi Valentino
const MILL = { prop: 3.394, gen: 3.394, scalac: 20.288, box_prop: 0.576, box_gen: 0.576, box_scalac: 3.443, cant_prop: 0.059, cant_gen: 0.059 };
// Preventivo 25/26 totali condominio
const P2526 = { prop: 52129.06, gen: 149737.47, man: 10000.00, scalac: 4500.00, asc_c: 3802.22, tele: 5054.50, risc_inv: 35349.04, acs_inv: 31638.80 };
const PV = { // quote Valentino 25/26 stimate
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

// ── micro-components ──────────────────────────────────────────

// ── Validazione letture contatori ─────────────────────────────
function validaContinuita(finPrec: number|null, iniCurr: number|null, label: string): { ok: boolean; msg: string; severity: 'ok'|'warn'|'error' } {
  if (finPrec === null || iniCurr === null) return { ok: true, msg: '', severity: 'ok' };
  if (finPrec !== iniCurr) return {
    ok: false,
    msg: `${label}: lettura finale anno prec. (${finPrec.toLocaleString('it-IT')}) ≠ lettura iniziale anno corr. (${iniCurr.toLocaleString('it-IT')}). Differenza: ${Math.abs(finPrec - iniCurr).toLocaleString('it-IT')}.`,
    severity: 'warn',
  };
  return { ok: true, msg: '', severity: 'ok' };
}

function validaLetture(ini: number|null, fin: number|null, costo: number, label: string): { ok: boolean; msg: string; severity: 'ok'|'warn'|'error' } {
  if (ini === null || fin === null) return { ok: true, msg: '', severity: 'ok' };
  const delta = fin - ini;
  if (delta < 0)  return { ok: false, msg: `${label}: lettura finale (${fin}) < iniziale (${ini}). Verificare i dati.`, severity: 'error' };
  if (delta === 0 && costo > 0) return { ok: false, msg: `${label}: consumo zero ma costo €${fa(costo)}. Controllare.`, severity: 'warn' };
  if (costo <= 0 && delta > 0)  return { ok: false, msg: `${label}: consumo ${delta} ma costo zero. Manca il costo?`, severity: 'warn' };
  // Costo unitario anomalo (fuori range ragionevole)
  const unitario = costo / delta;
  if (label.includes('Risc') && (unitario < 0.05 || unitario > 2))   return { ok: false, msg: `${label}: costo unitario €${f2(unitario)}/cal sembra anomalo.`, severity: 'warn' };
  if (label.includes('calda') && (unitario < 0.05 || unitario > 2))  return { ok: false, msg: `${label}: costo unitario €${f2(unitario)}/L sembra anomalo.`, severity: 'warn' };
  if (label.includes('fredda') && (unitario < 0.005 || unitario > 0.5)) return { ok: false, msg: `${label}: costo unitario €${f2(unitario)}/L sembra anomalo.`, severity: 'warn' };
  return { ok: true, msg: '', severity: 'ok' };
}

function AlertBox({ checks, onClickIssue }: { checks: ReturnType<typeof validaLetture>[]; onClickIssue?: () => void }) {
  const errors = checks.filter(c => c.severity === 'error');
  const warns  = checks.filter(c => c.severity === 'warn');
  if (errors.length === 0 && warns.length === 0) return (
    <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--green-bg)', border:'1px solid #a7f3d0', borderRadius:10, fontSize:13, color:'var(--green)', fontWeight:600 }}>
      <Check size={15}/> Letture contatori coerenti
    </div>
  );
  const Item = ({ msg, bg, border, color }: { msg:string; bg:string; border:string; color:string }) => (
    <div onClick={onClickIssue} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 14px', background:bg, border:`1px solid ${border}`, borderRadius:10, fontSize:13, color, fontWeight:600, cursor: onClickIssue ? 'pointer' : 'default', transition:'opacity 0.15s' }}
      onMouseEnter={e => onClickIssue && ((e.currentTarget as HTMLElement).style.opacity='0.8')}
      onMouseLeave={e => onClickIssue && ((e.currentTarget as HTMLElement).style.opacity='1')}>
      <AlertCircle size={15} style={{ flexShrink:0, marginTop:1 }}/>
      <span style={{ flex:1 }}>{msg}</span>
      {onClickIssue && <span style={{ fontSize:11, opacity:0.7, whiteSpace:'nowrap' }}>→ vai al dato</span>}
    </div>
  );
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {errors.map((e,i) => <Item key={i} msg={e.msg} bg='var(--red-bg)' border='#fecaca' color='var(--red)'/>)}
      {warns.map((w,i)  => <Item key={i} msg={w.msg} bg='var(--amber-bg)' border='#fde68a' color='var(--amber)'/>)}
    </div>
  );
}
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

function Delta({ cur, prev }: { cur: number; prev: number | null }) {
  if (prev === null || prev === 0) return null;
  const d = pct(cur, prev), diff = cur - prev, up = diff > 0;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:2, fontSize:11, fontWeight:700,
      color:up?'var(--red)':'var(--green)', background:up?'var(--red-bg)':'var(--green-bg)',
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
        <h2 style={{ fontFamily:'var(--font-display)', fontSize:20, fontWeight:800 }}>{title}</h2>
        {sub && <p style={{ color:'var(--text3)', fontSize:12, marginTop:1 }}>{sub}</p>}
      </div>
      {onAdd && <button className="btn-primary" onClick={onAdd}><Plus size={14}/>Nuovo</button>}
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
  const [cMode,   setCMode]   = useState<'spese'|'saldo'|'consumi'|'var'>('spese');
  const [highlightYears, setHighlightYears] = useState<string[]>([]);
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
  const numR = (f:string,v:string) => setEditR((p:any)=>({...p,[f]:parseFloat(v)||0}));

  // ── Derived data ─────────────────────────────────────────
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
    const rKwh= c&&c.risc_lettura_finale&&c.risc_lettura_iniziale ? c.risc_lettura_finale-c.risc_lettura_iniziale : null;
    const aL  = c&&c.acqua_calda_lettura_finale&&c.acqua_calda_lettura_iniziale ? c.acqua_calda_lettura_finale-c.acqua_calda_lettura_iniziale : null;
    const afL = c&&c.acqua_fredda_lettura_finale&&c.acqua_fredda_lettura_iniziale ? c.acqua_fredda_lettura_finale-c.acqua_fredda_lettura_iniziale : null;
    const rateAnno = rates.filter(r=>r.year_label===yl).reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0),0);
    return {
      anno:yl, sf, con, tot: sf!==null&&con!==null?sf+con:sf??con,
      sC, sB, sCa, sTot: sC!==null&&sB!==null&&sCa!==null?sC+sB+sCa:null,
      rKwh, rCosto:c?.riscaldamento_consumo, rUnit:rKwh&&c?.riscaldamento_consumo?c.riscaldamento_consumo/rKwh:null,
      aL,   aCosto:c?.acqua_calda_consumo,   aUnit:aL&&c?.acqua_calda_consumo?c.acqua_calda_consumo/aL:null,
      afL,  afCosto:c?.acqua_potabile,        afUnit:afL&&c?.acqua_potabile?c.acqua_potabile/afL:null,
      rateAnno,
    };
  });

  const cData = riassunto.map(r => ({ anno:r.anno, 'Spese fisse':r.sf||0, 'Consumi':r.con||0, 'Totale':r.tot||0, 'Saldo C63':r.sC||0, 'Risc.':r.rCosto||0, 'ACS':r.aCosto||0, 'Acq.fr.':r.afCosto||0 }));
  const vData = allYrs.slice(1).map((yl,i)=>{
    const cur=cData.find(r=>r.anno===yl)!, prv=cData.find(r=>r.anno===allYrs[i])!;
    const p=(c:number,v:number)=>v!==0?parseFloat(((c-v)/Math.abs(v)*100).toFixed(1)):0;
    return { anno:yl, 'Fisse%':p(cur['Spese fisse'],prv['Spese fisse']), 'Consumi%':p(cur['Consumi'],prv['Consumi']), 'Totale%':p(cur['Totale'],prv['Totale']) };
  });

  const last = riassunto[riassunto.length-1];

  // empties
  const emptyY = { property_id:property.id, year_label:'', balance_start_casa:0, balance_start_box:0, balance_start_cantina:0, rates_paid_casa:0, rates_paid_box:0, rates_paid_cantina:0, spese_totali_casa:0, spese_totali_box:0, spese_totali_cantina:0 };
  const emptyF = { property_id:property.id, year_label:'', spese_personali:0, prop_casa:0,prop_box:0,prop_cantina:0, gen_prop_casa:0,gen_prop_box:0,gen_prop_cantina:0, prop_alloggi:0, man_ord_casa:0,man_ord_box:0,man_ord_cantina:0, scale_prop_casa:0,scale_prop_box:0,scale_prop_cantina:0, scala_c_casa:0,scala_c_box:0,scala_c_cantina:0, asc_c_casa:0,asc_c_box:0,asc_c_cantina:0, addebiti_unita:0,addebiti_unita_imm:0,prop_box_extra:0 };
  const emptyC = { property_id:property.id, year_label:'', acqua_potabile:0, riscaldamento_involontario:0, riscaldamento_consumo:0, acqua_calda_involontaria:0, acqua_calda_consumo:0, energia_elettrica_box:0, movimenti_personali:0, risc_lettura_iniziale:null, risc_lettura_finale:null, acqua_calda_lettura_iniziale:null, acqua_calda_lettura_finale:null, acqua_fredda_lettura_iniziale:null, acqua_fredda_lettura_finale:null, totale_casa:0, totale_box:0, totale_cantina:0 };
  const emptyR = { property_id:property.id, year_label:years[years.length-1]?.year_label||'', numero_rata:'', data_pagamento:new Date().toISOString().split('T')[0], importo_casa:0, importo_box:0, importo_cantina:0, descrizione:'' };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Tabs active={tab} onChange={t=>{setTab(t);setEditY(null);setEditF(null);setEditC(null);setEditR(null);}}/>

      {/* ══ RIEPILOGO ══ */}
      {tab==='Riepilogo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>Riepilogo annuale</h2>

          {/* Tabella */}
          <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
            <div style={{ overflowX:'auto' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                <thead>
                  <tr style={{ background:'var(--bg3)' }}>
                    {['Anno','Spese fisse','Consumi','Tot. spese','Saldo C63','Saldo Box','Saldo Cant.'].map(h=>(
                      <th key={h} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', whiteSpace:'nowrap', fontSize:10 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {riassunto.map((r,i)=>{
                    const prv = i>0?riassunto[i-1]:null;
                    return (
                      <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'#fff':'var(--bg3)' }}>
                        <td style={{ padding:'8px 10px' }}><span className="tag tag-blue">{r.anno}</span></td>
                        {[
                          [r.sf,   prv?.sf,   false],
                          [r.con,  prv?.con,  false],
                          [r.tot,  prv?.tot,  false],
                          [r.sC,   null,      true],
                          [r.sB,   null,      true],
                          [r.sCa,  null,      true],
                        ].map(([v,pv,colored],j)=>(
                          <td key={j} style={{ padding:'8px 10px', textAlign:'right' }}>
                            {v!==null ? (
                              <>
                                <span style={{ fontWeight:700, color:colored?(v as number)>=0?'var(--green)':'var(--red)':'var(--text)' }}>€{f0(v as number)}</span>
                                {pv!==null&&v!==null&&<div style={{ fontSize:9, fontWeight:700, color:(v as number)>(pv as number)?'var(--red)':'var(--green)' }}>{(v as number)>(pv as number)?'▲':'▼'}{Math.abs(pct(v as number,pv as number)).toFixed(1)}%</div>}
                              </>
                            ) : <span style={{ color:'var(--text3)' }}>—</span>}
                          </td>
                        ))}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Grafico spese */}
          <div className="card" style={{ padding:'16px' }}>
            <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Andamento spese totali</p>
            <ResponsiveContainer width="100%" height={130}>
              <AreaChart data={cData} margin={{ left:-20, right:8, top:4, bottom:0 }}>
                <XAxis dataKey="anno" tick={{ fill:'#94a3b8', fontSize:11 }} axisLine={false} tickLine={false}/>
                <YAxis tick={{ fill:'#94a3b8', fontSize:10 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={52}/>
                <Tooltip content={<ChartTip/>}/>
                <Area type="monotone" dataKey="Totale" name="Totale spese" stroke="#2563eb" fill="#eff6ff" strokeWidth={2.5} dot={{ fill:'#2563eb', r:3 }}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* Controllo continuità letture tra anni consecutivi */}
          {(() => {
            const checks: ReturnType<typeof validaLetture>[] = [];
            for (let i = 1; i < riassunto.length; i++) {
              const prv = riassunto[i-1], cur = riassunto[i];
              const pC = consumi.find(r=>r.year_label===prv.anno);
              const cC = consumi.find(r=>r.year_label===cur.anno);
              if (!pC || !cC) continue;
              checks.push(validaContinuita(pC.risc_lettura_finale, cC.risc_lettura_iniziale, `Risc. ${prv.anno}→${cur.anno}`));
              checks.push(validaContinuita(pC.acqua_calda_lettura_finale, cC.acqua_calda_lettura_iniziale, `ACS ${prv.anno}→${cur.anno}`));
              checks.push(validaContinuita(pC.acqua_fredda_lettura_finale, cC.acqua_fredda_lettura_iniziale, `Acq.fr. ${prv.anno}→${cur.anno}`));
            }
            const issues = checks.filter(ch => !ch.ok);
            // Collect the affected year pairs from issue messages
            const affectedYears = issues.flatMap(ch => {
              const m = ch.msg.match(/(\d{2}\/\d{2})/g);
              return m || [];
            });
            if (checks.length === 0) return null;
            return (
              <div>
                <p className="section-label">Continuità letture tra anni</p>
                {issues.length === 0 ? (
                  <div style={{ display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'var(--green-bg)', border:'1px solid #a7f3d0', borderRadius:10, fontSize:13, color:'var(--green)', fontWeight:600 }}>
                    <Check size={15}/> Tutte le letture sono continue tra gli anni
                  </div>
                ) : (
                  <AlertBox checks={issues} onClickIssue={() => {
                    setHighlightYears(affectedYears);
                    setTab('Consumi');
                    setTimeout(() => {
                      consumiTopRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      setTimeout(() => setHighlightYears([]), 3500);
                    }, 100);
                  }}/>
                )}
              </div>
            );
          })()}

          {/* Costi unitari */}
          {riassunto.some(r=>r.rUnit) && (
            <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
              <div style={{ padding:'10px 14px 8px', borderBottom:'1px solid var(--border)', background:'var(--bg3)' }}>
                <p style={{ fontWeight:700, fontSize:12 }}>Costo unitario consumi per anno</p>
              </div>
              <div style={{ overflowX:'auto' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontSize:11 }}>
                  <thead>
                    <tr style={{ background:'var(--bg3)' }}>
                      {['Anno','Risc. (cal)','€/cal','ACS (L)','€/L','Acq.fr. (L)','€/L'].map(h=>(
                        <th key={h} style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {riassunto.filter(r=>r.rKwh).map(r=>(
                      <tr key={r.anno} style={{ borderBottom:'1px solid var(--border)' }}>
                        <td style={{ padding:'6px 10px' }}><span className="tag tag-blue">{r.anno}</span></td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fmtN(r.rKwh)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#ef4444' }}>{r.rUnit?f2(r.rUnit):'—'}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fmtN(r.aL)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#f97316' }}>{r.aUnit?f2(r.aUnit):'—'}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:600 }}>{fmtN(r.afL)}</td>
                        <td style={{ padding:'6px 10px', textAlign:'right', fontWeight:700, color:'#3b82f6' }}>{r.afUnit?f2(r.afUnit):'—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ══ RENDICONTO (ex Esercizi) ══ */}
      {tab==='Rendiconto' && (
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <SectionHeader title="Rendiconto annuale" sub="Saldo = Inizio + Rate − Spese" onAdd={()=>{setEditY({...emptyY});setIsNew(true);}}/>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci i dati <strong>una volta l'anno</strong> quando ricevi il rendiconto SSA (ottobre/novembre). I campi "Spese totali" sono il totale gestione da pagina 3 del riparto.
          </div>
          {editY && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'+ Nuovo anno':`Modifica ${editY.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label>Anno esercizio</label><input value={editY.year_label||''} onChange={e=>setEditY((p:any)=>({...p,year_label:e.target.value}))} placeholder="es. 25/26"/></div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Saldo iniziale (dalla riga "Saldo finale" del rendiconto precedente)</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="balance_start_casa" st={editY} fn={numY}/>
                    <NF lbl="Box 13"  fld="balance_start_box"  st={editY} fn={numY}/>
                    <NF lbl="Cantina" fld="balance_start_cantina" st={editY} fn={numY}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Rate versate (colonna "Rate versate" del riparto)</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="rates_paid_casa"      st={editY} fn={numY}/>
                    <NF lbl="Box 13"  fld="rates_paid_box"       st={editY} fn={numY}/>
                    <NF lbl="Cantina" fld="rates_paid_cantina"   st={editY} fn={numY}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Spese totali (colonna "Totale gestione" del riparto)</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="spese_totali_casa"    st={editY} fn={numY}/>
                    <NF lbl="Box 13"  fld="spese_totali_box"     st={editY} fn={numY}/>
                    <NF lbl="Cantina" fld="spese_totali_cantina" st={editY} fn={numY}/>
                  </div>
                </div>
                <FormActions onCancel={()=>setEditY(null)} onSave={async()=>{await save('exercise_years',editY,setYears);setEditY(null);}}/>
              </div>
            </div>
          )}
          {[...years].reverse().map((y,i) => {
            const sC=calcSaldo(y.balance_start_casa,y.rates_paid_casa,y.spese_totali_casa||0);
            const sB=calcSaldo(y.balance_start_box,y.rates_paid_box,y.spese_totali_box||0);
            const sCa=calcSaldo(y.balance_start_cantina,y.rates_paid_cantina,y.spese_totali_cantina||0);
            const tot=sC+sB+sCa;
            const isExp=expY===y.id;
            return (
              <div key={y.id} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6, flexWrap:'wrap' }}>
                      <span className="tag tag-blue">{y.year_label}</span>
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
          <SectionHeader title="Spese Fisse" sub="Dettaglio voci dal riparto SSA" onAdd={()=>{setEditF({...emptyF});setIsNew(true);}}/>
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci <strong>una volta l'anno</strong> copiando i valori dal documento "Riparto Consuntivo" SSA.
          </div>
          {editF && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo anno':`Modifica ${editF.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div className="grid2">
                  <div><label>Anno</label><input value={editF.year_label||''} onChange={e=>setEditF((p:any)=>({...p,year_label:e.target.value}))} placeholder="25/26"/></div>
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
          {[...fixed].reverse().map((r,i) => {
            const tC=sfTot(r), tB=sfBox(r), tCa=sfCant(r), tot=tC+tB+tCa;
            const prv=[...fixed].reverse()[i+1];
            const prvTot=prv?sfTot(prv)+sfBox(prv)+sfCant(prv):null;
            const isExp=expF===r.id;
            return (
              <div key={r.id} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <span className="tag tag-purple" style={{ marginBottom:6, display:'inline-flex' }}>{r.year_label}</span>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <p style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-display)', lineHeight:1 }}>€{f0(tot)}</p>
                      <Delta cur={tot} prev={prvTot}/>
                    </div>
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn-icon" onClick={()=>setExpF(isExp?null:r.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditF({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('fixed_expenses',r.id,setFixed)}><Trash2 size={13}/></button>
                  </div>
                </div>
                <div className="divider"/>
                <div className="grid3">
                  {([['App C63',tC],['Box 13',tB],['Cantina',tCa]] as [string,number][]).map(([l,v])=>(
                    <div key={l} style={{ textAlign:'center', padding:'7px 4px', background:'var(--bg3)', borderRadius:8 }}>
                      <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                      <p style={{ fontSize:13, fontWeight:800 }}>€{fa(v)}</p>
                    </div>
                  ))}
                </div>
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
          <SectionHeader title="Dati Consumi" sub="Letture contatori e costi" onAdd={()=>{setEditC({...emptyC});setIsNew(true);}}/>
          {/* Banner discontinuità tra anni */}
          {(() => {
            const sortedC = [...consumi].sort((a,b)=>a.year_label.localeCompare(b.year_label));
            const discChecks: { msg: string; anni: string[] }[] = [];
            for (let i = 1; i < sortedC.length; i++) {
              const prv = sortedC[i-1], cur = sortedC[i];
              [['risc_lettura_finale','risc_lettura_iniziale','Risc.'],['acqua_calda_lettura_finale','acqua_calda_lettura_iniziale','ACS'],['acqua_fredda_lettura_finale','acqua_fredda_lettura_iniziale','Acq.fr.']].forEach(([kF,kI,nome])=>{
                const vF = (prv as any)[kF], vI = (cur as any)[kI];
                if (vF!==null && vI!==null && vF!==vI) {
                  discChecks.push({ msg: `${nome}: finale ${prv.year_label} (${(vF as number).toLocaleString('it-IT')}) ≠ iniziale ${cur.year_label} (${(vI as number).toLocaleString('it-IT')}) — diff. ${Math.abs(vF-vI).toLocaleString('it-IT')}`, anni: [prv.year_label, cur.year_label] });
                }
              });
            }
            if (discChecks.length === 0) return null;
            return (
              <div style={{ background:'#fffbeb', border:'2px solid #f59e0b', borderRadius:12, padding:'12px 14px', display:'flex', flexDirection:'column', gap:6 }}>
                <p style={{ fontWeight:800, fontSize:13, color:'#b45309', marginBottom:2, display:'flex', alignItems:'center', gap:6 }}><AlertCircle size={15}/> Discontinuità tra anni — correggere le letture evidenziate</p>
                {discChecks.map((d,i)=>(
                  <div key={i} style={{ fontSize:12, color:'#92400e', background:'#fef3c7', borderRadius:8, padding:'6px 10px', fontWeight:600 }}>• {d.msg}</div>
                ))}
              </div>
            );
          })()}
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:10, padding:'10px 12px', fontSize:12, color:'var(--blue)' }}>
            Inserisci <strong>una volta l'anno</strong> dalla "Tabella Consumi" e dal "Riparto Consuntivo" SSA.
          </div>
          {editC && (
            <div className="card" style={{ border:'2px solid var(--accent)' }}>
              <p style={{ fontFamily:'var(--font-display)', fontWeight:800, fontSize:16, marginBottom:12 }}>{isNew?'Nuovo anno':`Modifica ${editC.year_label}`}</p>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <div><label>Anno</label><input value={editC.year_label||''} onChange={e=>setEditC((p:any)=>({...p,year_label:e.target.value}))} placeholder="25/26"/></div>
                <div style={{ background:'#fff7ed', border:'1px solid #fed7aa', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'#c2410c', textTransform:'uppercase', marginBottom:8 }}>Letture contatori (dalla Tabella Consumi)</p>
                  {/* Mostra letture finali anno precedente come riferimento */}
                  {(() => {
                    const sortedC = [...consumi].sort((a,b)=>a.year_label.localeCompare(b.year_label));
                    const prevC = editC.year_label ? sortedC.filter(r=>r.year_label < editC.year_label).pop() : null;
                    if (!prevC || (!prevC.risc_lettura_finale && !prevC.acqua_calda_lettura_finale)) return null;
                    return (
                      <div style={{ marginBottom:10, padding:'8px 12px', background:'#fff', border:'1px solid #fed7aa', borderRadius:8, fontSize:12 }}>
                        <p style={{ fontWeight:700, color:'#c2410c', marginBottom:6 }}>Letture finali {prevC.year_label} (devono coincidere con le iniziali)</p>
                        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8 }}>
                          {[['Risc.',prevC.risc_lettura_finale],['ACS',prevC.acqua_calda_lettura_finale],['Acq.fr.',prevC.acqua_fredda_lettura_finale]].map(([l,v])=>(
                            <div key={l as string} style={{ textAlign:'center' }}>
                              <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600 }}>{l}</p>
                              <p style={{ fontWeight:800, fontSize:14, color:'#c2410c' }}>{v!==null?v.toLocaleString('it-IT'):'—'}</p>
                            </div>
                          ))}
                        </div>
                        {/* Avvisi se le iniziali già inserite non coincidono */}
                        {(editC.risc_lettura_iniziale||editC.acqua_calda_lettura_iniziale||editC.acqua_fredda_lettura_iniziale) && (
                          <div style={{ marginTop:8 }}>
                            <AlertBox checks={[
                              validaContinuita(prevC.risc_lettura_finale, editC.risc_lettura_iniziale, 'Riscaldamento'),
                              validaContinuita(prevC.acqua_calda_lettura_finale, editC.acqua_calda_lettura_iniziale, 'Acqua calda'),
                              validaContinuita(prevC.acqua_fredda_lettura_finale, editC.acqua_fredda_lettura_iniziale, 'Acqua fredda'),
                            ]}/>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  <div className="grid2">
                    <NF lbl="Riscaldamento iniziale (cal)" fld="risc_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Riscaldamento finale (cal)"   fld="risc_lettura_finale"   st={editC} fn={numC}/>
                    <NF lbl="Acqua calda iniziale (L)"     fld="acqua_calda_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Acqua calda finale (L)"       fld="acqua_calda_lettura_finale"   st={editC} fn={numC}/>
                    <NF lbl="Acqua fredda iniziale (L)"    fld="acqua_fredda_lettura_iniziale" st={editC} fn={numC}/>
                    <NF lbl="Acqua fredda finale (L)"      fld="acqua_fredda_lettura_finale"   st={editC} fn={numC}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  {/* Preview validazione in tempo reale */}
                  {(editC.risc_lettura_iniziale||editC.risc_lettura_finale) && (
                    <AlertBox checks={[
                      validaLetture(editC.risc_lettura_iniziale,editC.risc_lettura_finale,editC.riscaldamento_consumo||0,'Riscaldamento'),
                      validaLetture(editC.acqua_calda_lettura_iniziale,editC.acqua_calda_lettura_finale,editC.acqua_calda_consumo||0,'Acqua calda'),
                      validaLetture(editC.acqua_fredda_lettura_iniziale,editC.acqua_fredda_lettura_finale,editC.acqua_potabile||0,'Acqua fredda'),
                    ]}/>
                  )}
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Costi dal Riparto (€)</p>
                  <div className="grid2">
                    <NF lbl="Riscaldamento consumo"  fld="riscaldamento_consumo"     st={editC} fn={numC}/>
                    <NF lbl="Riscaldamento involont." fld="riscaldamento_involontario" st={editC} fn={numC}/>
                    <NF lbl="ACS consumo"            fld="acqua_calda_consumo"        st={editC} fn={numC}/>
                    <NF lbl="ACS involontaria"       fld="acqua_calda_involontaria"   st={editC} fn={numC}/>
                    <NF lbl="Acqua potabile"         fld="acqua_potabile"             st={editC} fn={numC}/>
                    <NF lbl="Energia el. box"        fld="energia_elettrica_box"      st={editC} fn={numC}/>
                    <NF lbl="Movimenti personali"    fld="movimenti_personali"        st={editC} fn={numC}/>
                  </div>
                </div>
                <div style={{ background:'var(--bg3)', borderRadius:10, padding:12 }}>
                  <p style={{ fontSize:11, fontWeight:700, color:'var(--text2)', textTransform:'uppercase', marginBottom:8 }}>Totali gestione — da ultima pagina Riparto (€)</p>
                  <div className="grid3">
                    <NF lbl="App C63" fld="totale_casa"     st={editC} fn={numC}/>
                    <NF lbl="Box 13"  fld="totale_box"      st={editC} fn={numC}/>
                    <NF lbl="Cantina" fld="totale_cantina"  st={editC} fn={numC}/>
                  </div>
                </div>
                <FormActions onCancel={()=>setEditC(null)} onSave={async()=>{await save('consumption_data',editC,setConsumi);setEditC(null);}}/>
              </div>
            </div>
          )}
          {[...consumi].reverse().map((r,i) => {
            const tot=r.totale_casa+r.totale_box+r.totale_cantina;
            const prv=[...consumi].reverse()[i+1];
            const prvTot=prv?prv.totale_casa+prv.totale_box+prv.totale_cantina:null;
            const rKwh=r.risc_lettura_finale&&r.risc_lettura_iniziale?r.risc_lettura_finale-r.risc_lettura_iniziale:null;
            const aL  =r.acqua_calda_lettura_finale&&r.acqua_calda_lettura_iniziale?r.acqua_calda_lettura_finale-r.acqua_calda_lettura_iniziale:null;
            const afL =r.acqua_fredda_lettura_finale&&r.acqua_fredda_lettura_iniziale?r.acqua_fredda_lettura_finale-r.acqua_fredda_lettura_iniziale:null;
            const rU  =rKwh&&r.riscaldamento_consumo?r.riscaldamento_consumo/rKwh:null;
            const aU  =aL&&r.acqua_calda_consumo?r.acqua_calda_consumo/aL:null;
            const afU =afL&&r.acqua_potabile?r.acqua_potabile/afL:null;
            const isExp=expC===r.id;
            const isHighlighted = highlightYears.includes(r.year_label);
            return (
              <div key={r.id} className="card" style={isHighlighted ? { border:'2.5px solid #f59e0b', boxShadow:'0 0 0 4px #fef3c7', transition:'box-shadow 0.3s' } : undefined}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                  <div>
                    <span className="tag tag-blue" style={{ marginBottom:6, display:'inline-flex' }}>{r.year_label}</span>
                    <div style={{ display:'flex', alignItems:'baseline', gap:4 }}>
                      <p style={{ fontSize:22, fontWeight:800, fontFamily:'var(--font-display)', lineHeight:1 }}>€{f0(tot)}</p>
                      <Delta cur={tot} prev={prvTot}/>
                    </div>
                    {rU && (
                      <div style={{ display:'flex', gap:6, marginTop:6, flexWrap:'wrap' }}>
                        {([[rKwh,'cal',rU,'#ef4444'],[aL,'L ACS',aU,'#f97316'],[afL,'L fred.',afU,'#3b82f6']] as [number|null,string,number|null,string][]).map(([qty,unit,cu,col])=>qty?(
                          <span key={unit} style={{ fontSize:11, background:'var(--bg3)', borderRadius:6, padding:'2px 7px', color:'var(--text2)' }}>
                            {fmtN(qty)} {unit} · <span style={{ fontWeight:700, color:col }}>€{f2(cu!)}/{unit.split(' ')[0]}</span>
                          </span>
                        ):null)}
                      </div>
                    )}
                  </div>
                  <div style={{ display:'flex', gap:5 }}>
                    <button className="btn-icon" onClick={()=>setExpC(isExp?null:r.id)}>{isExp?<ChevronUp size={13}/>:<ChevronDown size={13}/>}</button>
                    <button className="btn-icon" onClick={()=>{setEditC({...r});setIsNew(false);}}><Pencil size={13}/></button>
                    <button className="btn-danger" onClick={()=>del('consumption_data',r.id,setConsumi)}><Trash2 size={13}/></button>
                  </div>
                </div>
                {/* Validazione letture — visibile sempre */}
                {(r.risc_lettura_iniziale!==null||r.acqua_calda_lettura_iniziale!==null) && (() => {
                  const checks = [
                    validaLetture(r.risc_lettura_iniziale,r.risc_lettura_finale,r.riscaldamento_consumo,'Riscaldamento'),
                    validaLetture(r.acqua_calda_lettura_iniziale,r.acqua_calda_lettura_finale,r.acqua_calda_consumo,'Acqua calda'),
                    validaLetture(r.acqua_fredda_lettura_iniziale,r.acqua_fredda_lettura_finale,r.acqua_potabile,'Acqua fredda'),
                  ];
                  const hasIssue = checks.some(ch=>!ch.ok);
                  return hasIssue ? <div style={{ marginTop:10, cursor:'pointer' }} onClick={()=>setExpC(r.id)}><AlertBox checks={checks} onClickIssue={()=>setExpC(r.id)}/></div> : (
                    <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, fontSize:12, color:'var(--green)', fontWeight:600 }}>
                      <Check size={13}/> Letture coerenti
                    </div>
                  );
                })()}
                {isExp && (
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
                    {rKwh && (
                      <>
                        <div className="divider"/>
                        {([[r.risc_lettura_iniziale,r.risc_lettura_finale,rKwh,r.riscaldamento_consumo,rU,'Riscaldamento','cal','#ef4444'],[r.acqua_calda_lettura_iniziale,r.acqua_calda_lettura_finale,aL,r.acqua_calda_consumo,aU,'Acqua calda','L','#f97316'],[r.acqua_fredda_lettura_iniziale,r.acqua_fredda_lettura_finale,afL,r.acqua_potabile,afU,'Acqua fredda','L','#3b82f6']] as [number|null,number|null,number|null,number,number|null,string,string,string][]).map(([ini,fin,cons,costo,cu,nome,unit,col])=>(
                          <div key={nome} style={{ background:'var(--bg3)', borderRadius:8, padding:'8px 10px', marginBottom:6 }}>
                            <div style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                              <span style={{ fontWeight:700, color:col }}>{nome}</span>
                              <span style={{ fontWeight:800 }}>€{fa(costo)}</span>
                            </div>
                            <div style={{ display:'flex', gap:8, fontSize:11, color:'var(--text2)', marginTop:3, flexWrap:'wrap' }}>
                              <span>{fmtN(ini)} → {fmtN(fin)} {unit}</span>
                              <span style={{ fontWeight:700 }}>Δ {fmtN(cons)} {unit}</span>
                              {cu && <span style={{ color:col, fontWeight:700 }}>€{f2(cu)}/{unit}</span>}
                            </div>
                          </div>
                        ))}
                      </>
                    )}
                    <div className="grid2" style={{ gap:6, marginTop:4 }}>
                      {[['Risc. invo.',r.riscaldamento_involontario],['ACS invo.',r.acqua_calda_involontaria],['En. box',r.energia_elettrica_box],['Mov. pers.',r.movimenti_personali]].map(([l,v])=>(
                        <div key={l as string} style={{ display:'flex', justifyContent:'space-between', padding:'4px 8px', background:'var(--bg3)', borderRadius:7, fontSize:12 }}>
                          <span style={{ color:'var(--text2)' }}>{l}</span><span style={{ fontWeight:700 }}>€{fa(v as number)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ══ RATE ══ */}
      {tab==='Rate' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <SectionHeader title="Rate pagate" sub={`${rates.length} pagamenti`} onAdd={()=>{setEditR({...emptyR});setIsNew(true);}}/>

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
                      setEditR((p:any)=>({...p,
                        _importo_totale:e.target.value,
                        importo_casa:parseFloat((tot*3.394/totM).toFixed(2)),
                        importo_box:parseFloat((tot*0.576/totM).toFixed(2)),
                        importo_cantina:parseFloat((tot*0.059/totM).toFixed(2)),
                      }));
                    }}/>
                </div>
                {(editR.importo_casa>0||editR.importo_box>0) && (
                  <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:6 }}>
                    {([['App C63',editR.importo_casa],['Box 13',editR.importo_box],['Cantina',editR.importo_cantina]] as [string,number][]).map(([l,v])=>(
                      <div key={l} style={{ textAlign:'center', background:'var(--accent-light)', borderRadius:8, padding:'7px 4px' }}>
                        <p style={{ fontSize:10, color:'var(--text2)', fontWeight:600, marginBottom:2 }}>{l}</p>
                        <p style={{ fontSize:13, fontWeight:800, color:'var(--accent)' }}>€{Math.abs(v).toLocaleString('it-IT',{minimumFractionDigits:2,maximumFractionDigits:2})}</p>
                      </div>
                    ))}
                  </div>
                )}
                <div><label>Note (opzionale)</label><input value={editR.descrizione||''} onChange={e=>strR('descrizione',e.target.value)} placeholder="Acconto, Conguaglio..."/></div>
                <FormActions onCancel={()=>setEditR(null)} onSave={async()=>{await save('rate_pagamenti',editR,setRates);setEditR(null);}}/>
              </div>
            </div>
          )}

          {allYrs.map(yl => {
            const rAnno = rates.filter(r=>r.year_label===yl);
            if (rAnno.length===0) return null;
            const totC  = rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_casa)||0),0);
            const totB  = rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_box)||0),0);
            const totCa = rAnno.reduce((s:number,r:any)=>s+(parseFloat(r.importo_cantina)||0),0);
            const totAll = totC+totB+totCa;
            const yData = years.find(y=>y.year_label===yl);
            const atteso = yData ? yData.rates_paid_casa+yData.rates_paid_box+yData.rates_paid_cantina : null;
            const ok = atteso !== null && Math.abs(totAll-atteso)<1;
            return (
              <div key={yl} className="card">
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
                  <div>
                    <span className="tag tag-blue" style={{ marginRight:6 }}>{yl}</span>
                    <span style={{ fontWeight:800, fontSize:15, fontFamily:'var(--font-display)' }}>€{fa(totAll)}</span>
                  </div>
                  <span style={{ fontSize:11, fontWeight:600, color:'var(--text3)' }}>{rAnno.length} rate</span>
                </div>
                {atteso !== null && (
                  <div style={{ background:ok?'var(--green-bg)':'var(--amber-bg)', border:`1px solid ${ok?'#bbf7d0':'#fde68a'}`, borderRadius:8, padding:'6px 10px', fontSize:12, marginBottom:10, fontWeight:600, color:ok?'var(--green)':'var(--amber)', display:'flex', alignItems:'center', gap:6 }}>
                    {ok ? <Check size={13}/> : <AlertCircle size={13}/>}
                    {ok ? 'Totale corrisponde al rendiconto' : `Atteso €${fa(atteso)} · differenza €${fa(Math.abs(totAll-atteso))}`}
                  </div>
                )}
                <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                  {rAnno.map((r:any) => {
                    const tot=(parseFloat(r.importo_casa)||0)+(parseFloat(r.importo_box)||0)+(parseFloat(r.importo_cantina)||0);
                    return (
                      <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 10px', background:'var(--bg3)', borderRadius:8, fontSize:12 }}>
                        <CreditCard size={13} color="var(--accent)"/>
                        <div style={{ flex:1 }}>
                          <span style={{ fontWeight:700 }}>{r.numero_rata}</span>
                          <span style={{ color:'var(--text3)', marginLeft:6 }}>{fmtDate(r.data_pagamento)}</span>
                          {r.descrizione && <span style={{ color:'var(--text2)', marginLeft:6 }}>{r.descrizione}</span>}
                        </div>
                        <div style={{ textAlign:'right' }}>
                          <p style={{ fontWeight:800, fontSize:14 }}>€{fa(tot)}</p>
                          <p style={{ fontSize:10, color:'var(--text3)' }}>C:{fa(r.importo_casa||0)} B:{fa(r.importo_box||0)}</p>
                        </div>
                        <div style={{ display:'flex', gap:3 }}>
                          <button className="btn-icon" style={{ padding:5 }} onClick={()=>{setEditR({...r});setIsNew(false);}}><Pencil size={12}/></button>
                          <button className="btn-danger" style={{ padding:5 }} onClick={()=>del('rate_pagamenti',r.id,setRates)}><Trash2 size={12}/></button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
          {rates.length===0 && <p style={{ textAlign:'center', color:'var(--text3)', padding:24 }}>Nessuna rata registrata. Aggiungile dalla Home ogni volta che paghi.</p>}
        </div>
      )}

      {/* ══ CONFRONTO ══ */}
      {tab==='Confronto' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>Preventivo 25/26 vs Consuntivo</h2>
          {(() => {
            const c = fixed.find(r=>r.year_label==='24/25');
            if (!c) return <p style={{ color:'var(--text3)', textAlign:'center', padding:20 }}>Inserisci i dati spese 24/25.</p>;
            const rows = [
              { l:'Spese Proprietà',  prev:172.03, cons:c.prop_casa,               diff:'prev. 50.687 × 3,394‰' },
              { l:'Spese Generali',   prev:533.36, cons:c.gen_prop_casa,            diff:'prev. 157.146 × 3,394‰' },
              { l:'Man. Ordinarie',   prev:16.97,  cons:c.man_ord_casa,             diff:'prev. 5.000 × 3,394‰' },
              { l:'Scala C',          prev:13.36,  cons:c.scale_prop_casa+c.scala_c_casa, diff:'scale + gestione' },
              { l:'Ascensore C',      prev:18.96,  cons:c.asc_c_casa,              diff:'prev. ascensore C' },
              { l:'Prop. alloggi',    prev:16.97,  cons:c.prop_alloggi,             diff:'solo alloggi/negozi' },
              { l:'Teleletture',      prev:17.59,  cons:c.addebiti_unita_imm,       diff:'5.186 × 3,394‰ prev.' },
              { l:'Mov. personali',   prev:0,      cons:c.spese_personali,          diff:'cert. + addebiti ind.' },
            ];
            const tP=rows.reduce((s,r)=>s+r.prev,0), tC=rows.reduce((s,r)=>s+r.cons,0);
            return (
              <>
                <span className="tag tag-blue" style={{ alignSelf:'flex-start' }}>Esercizio 24/25</span>
                <div style={{ background:'#fff', border:'1px solid var(--border)', borderRadius:14, overflow:'hidden' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ width:'100%', borderCollapse:'collapse', fontSize:12 }}>
                      <thead>
                        <tr style={{ background:'var(--bg3)' }}>
                          {['Voce','Preventivo','Consuntivo','Diff. €','%'].map(h=>(
                            <th key={h} style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:'var(--text2)', fontSize:10 }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.map((r,i)=>{
                          const diff=r.cons-r.prev, dp=r.prev?pct(r.cons,r.prev):0;
                          return (
                            <tr key={i} style={{ borderBottom:'1px solid var(--border)', background:i%2===0?'#fff':'var(--bg3)' }}>
                              <td style={{ padding:'8px 10px' }}>
                                <p style={{ fontWeight:600 }}>{r.l}</p>
                                <p style={{ fontSize:9, color:'var(--text3)' }}>{r.diff}</p>
                              </td>
                              <td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(r.prev)}</td>
                              <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700 }}>€{fa(r.cons)}</td>
                              <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:diff>0?'var(--red)':'var(--green)' }}>{diff>=0?'+':'-'}€{fa(Math.abs(diff))}</td>
                              <td style={{ padding:'8px 10px', textAlign:'right', fontWeight:700, color:dp>0?'var(--red)':'var(--green)' }}>{r.prev?`${dp>=0?'+':'-'}${Math.abs(dp).toFixed(1)}%`:'—'}</td>
                            </tr>
                          );
                        })}
                        <tr style={{ background:'var(--accent-light)', fontWeight:800 }}>
                          <td style={{ padding:'8px 10px', fontWeight:800 }}>TOTALE</td>
                          <td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(tP)}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right' }}>€{fa(tC)}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right', color:(tC-tP)>0?'var(--red)':'var(--green)' }}>{(tC-tP)>=0?'+':'-'}€{fa(Math.abs(tC-tP))}</td>
                          <td style={{ padding:'8px 10px', textAlign:'right', color:pct(tC,tP)>0?'var(--red)':'var(--green)' }}>{pct(tC,tP)>=0?'+':'-'}{Math.abs(pct(tC,tP)).toFixed(1)}%</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>
                {/* Grafico confronto */}
                <div className="card">
                  <p style={{ fontWeight:700, fontSize:12, marginBottom:10 }}>Confronto grafico</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart data={rows.filter(r=>r.prev>0||r.cons>0)} margin={{ left:-10, right:8, top:4, bottom:30 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f0f2f5"/>
                      <XAxis dataKey="l" tick={{ fill:'#94a3b8', fontSize:9 }} axisLine={false} tickLine={false} angle={-30} textAnchor="end"/>
                      <YAxis tick={{ fill:'#94a3b8', fontSize:9 }} axisLine={false} tickLine={false} tickFormatter={v=>`€${v}`} width={45}/>
                      <Tooltip content={<ChartTip/>}/>
                      <Legend wrapperStyle={{ fontSize:11 }}/>
                      <Bar dataKey="prev" name="Preventivo" fill="#94a3b8" radius={[3,3,0,0]}/>
                      <Bar dataKey="cons" name="Consuntivo" fill="#2563eb" radius={[3,3,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </>
            );
          })()}
        </div>
      )}

      {/* ══ PREVENTIVO 25/26 ══ */}
      {tab==='Preventivo' && (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <h2 style={{ fontFamily:'var(--font-display)', fontSize:22, fontWeight:800 }}>Preventivo 25/26</h2>
          <div style={{ background:'var(--amber-bg)', border:'1px solid #fde68a', borderRadius:12, padding:'12px 14px', fontSize:12, color:'var(--amber)' }}>
            <strong>Quote stimate</strong> calcolate sui tuoi millesimi (3,394‰ app · 0,576‰ box). I consumi vanno inseriti dopo ottobre 2026.
          </div>
          {/* Saldo partenza */}
          {last?.sTot !== null && (
            <div style={{ background:'var(--green-bg)', border:'1px solid #bbf7d0', borderRadius:12, padding:'12px 14px' }}>
              <p style={{ fontWeight:700, fontSize:13, color:'var(--green)', marginBottom:8 }}>Saldo di partenza 25/26</p>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:12 }}>
                {([['App C63',last?.sC],['Box 13',last?.sB],['Cantina',last?.sCa]] as [string,number|null][]).map(([l,v])=>(
                  <div key={l} style={{ textAlign:'center' }}>
                    <p style={{ fontSize:10, color:'var(--green)', opacity:0.8 }}>{l}</p>
                    <p style={{ fontWeight:800, color:'var(--green)', fontFamily:'var(--font-display)', fontSize:16 }}>{v!==null?`${v>=0?'+':'-'}€${fa(v)}`:'—'}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
          {/* Spese fisse stimate app */}
          <div className="card">
            <p style={{ fontWeight:700, fontSize:14, marginBottom:12 }}>App C63 — spese fisse stimate</p>
            {([
              ['Spese Proprietà',    PV.prop,    '52.129 × 3,394‰'],
              ['Spese Generali',     PV.gen,     '149.737 × 3,394‰'],
              ['Manutenzioni',       PV.man,     '10.000 × 3,394‰'],
              ['Scale C',            PV.scalac,  '4.500 × 20,288‰'],
              ['Ascensore C',        PV.asc,     '3.802 × 20,288‰'],
              ['Teleletture',        PV.tele,    '5.054 × 3,394‰'],
              ['Risc. involontario', PV.risc_inv,'35.349 × 3,394‰'],
              ['ACS involontaria',   PV.acs_inv, '31.638 × 3,394‰'],
            ] as [string,number,string][]).map(([l,v,note])=>(
              <div key={l} className="row">
                <div><p style={{ fontWeight:500, fontSize:13 }}>{l}</p><p style={{ fontSize:10, color:'var(--text3)' }}>{note}</p></div>
                <span style={{ fontWeight:800 }}>€{fa(v)}</span>
              </div>
            ))}
            <div style={{ marginTop:8, paddingTop:8, borderTop:'2px solid var(--border)', display:'flex', justifyContent:'space-between' }}>
              <span style={{ fontWeight:800 }}>Subtotale fisse</span>
              <span style={{ fontWeight:800, color:'var(--accent)', fontFamily:'var(--font-display)', fontSize:16 }}>€{fa(Object.values(PV).reduce((s,v)=>s+v,0))}</span>
            </div>
          </div>
          {/* Da inserire */}
          <div style={{ background:'var(--amber-bg)', border:'1px solid #fde68a', borderRadius:12, padding:'12px 14px' }}>
            <p style={{ fontWeight:700, fontSize:13, color:'var(--amber)', marginBottom:8 }}>Da inserire dopo ottobre 2026</p>
            {[['Acqua potabile','lettura contatore acqua fredda'],['Riscaldamento consumo','lettura contatore calorie'],['ACS consumo','lettura contatore ACS'],['Energia el. box','consumo box 13'],['Movimenti personali','cert. fiscali + addebiti SSA']].map(([l,n])=>(
              <div key={l} className="row">
                <div><p style={{ fontWeight:500, fontSize:13 }}>{l}</p><p style={{ fontSize:10, color:'var(--amber)', opacity:0.8 }}>{n}</p></div>
                <span style={{ fontWeight:700, color:'var(--amber)' }}>— da inserire</span>
              </div>
            ))}
          </div>
          {/* Box */}
          <div className="card">
            <p style={{ fontWeight:700, fontSize:14, marginBottom:10 }}>Box 13 — quote fisse stimate</p>
            {([
              ['Prop. + Generali',   PV.prop*(0.576/3.394)+PV.gen*(0.576/3.394), ''],
              ['Manutenzioni',       PV.man*(0.576/3.394), ''],
              ['Scale + Asc. C',    (P2526.scalac+P2526.asc_c)*3.443/1000, ''],
              ['Energia box',        70.45, 'stima da consumo reale 24/25'],
            ] as [string,number,string][]).map(([l,v,n])=>(
              <div key={l} className="row">
                <div><p style={{ fontWeight:500, fontSize:13 }}>{l}</p>{n&&<p style={{ fontSize:10, color:'var(--text3)' }}>{n}</p>}</div>
                <span style={{ fontWeight:800 }}>€{fa(v)}</span>
              </div>
            ))}
          </div>
          {/* Millesimi info */}
          <div style={{ background:'var(--blue-bg)', border:'1px solid #bfdbfe', borderRadius:12, padding:'12px 14px', fontSize:12, color:'var(--blue)' }}>
            <strong>I tuoi millesimi (da riparto SSA 10/12/2025):</strong><br/>
            App C63: proprietà 3,394‰ · generali 3,394‰ · scala C 20,288‰<br/>
            Box 13: proprietà 0,576‰ · generali 0,576‰ · scala C 3,443‰<br/>
            Cantina 10c: proprietà 0,059‰ · generali 0,059‰
          </div>
        </div>
      )}

    </div>
  );
}

