import { useState } from 'react';
import { ChevronDown, Plus, Building2, Check } from 'lucide-react';
import type { Property } from '../types';

interface Props {
  property: Property | null;
  properties: Property[];
  onSelectProperty: (p: Property) => void;
  onAddProperty: () => void;
  onGoHome?: () => void;
}

export default function Header({ property, properties, onSelectProperty, onAddProperty, onGoHome }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        padding: 'calc(var(--safe-top) + 13px) var(--pad) 13px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 0 var(--border)',
        maxWidth: 'var(--max-w)',
        margin: '0 auto',
        width: '100%',
      }}>
        {/* Logo cliccabile → torna alla home */}
        <button
          onClick={onGoHome}
          style={{
            display: 'flex', alignItems: 'center', gap: 9,
            background: 'transparent', border: 'none', padding: 0,
            cursor: onGoHome ? 'pointer' : 'default',
            borderRadius: 8,
          }}
          title="Torna alla home"
        >
          <div style={{
            background: 'var(--accent)', borderRadius: 9, width: 34, height: 34,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 1px 4px rgba(22,128,60,0.35)',
            transition: 'transform 0.15s',
          }}>
            <Building2 size={17} color="#fff" strokeWidth={2.5} />
          </div>
          <div>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.3px' }}>Condo</span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 500, color: 'var(--accent)', letterSpacing: '-0.3px' }}>Manager</span>
          </div>
        </button>

        {property && (
          <button onClick={() => setOpen(true)} style={{
            background: 'var(--bg3)',
            border: '1.5px solid var(--border2)',
            color: 'var(--text)',
            borderRadius: 20,
            padding: '6px 12px 6px 10px',
            display: 'flex', alignItems: 'center', gap: 5,
            fontSize: 13, fontWeight: 600, maxWidth: 180,
          }}>
            <Building2 size={13} color="var(--accent)" strokeWidth={2.5} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{property.name}</span>
            <ChevronDown size={13} color="var(--text3)" strokeWidth={2.5} />
          </button>
        )}
      </header>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.4)', zIndex: 200, backdropFilter: 'blur(3px)' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: 'calc(var(--safe-top) + 60px)', right: 16,
            background: '#fff', border: '1px solid var(--border)', borderRadius: 16,
            minWidth: 230, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
            animation: 'fadeUp 0.18s ease both',
          }}>
            <div style={{ padding: '10px 16px 6px' }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>Le tue case</p>
            </div>
            {properties.map(p => (
              <button key={p.id} onClick={() => { onSelectProperty(p); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '11px 16px',
                background: p.id === property?.id ? 'var(--accent-light)' : 'transparent',
                color: p.id === property?.id ? 'var(--accent)' : 'var(--text)',
                borderRadius: 0, fontSize: 14, fontWeight: p.id === property?.id ? 700 : 500,
                borderBottom: '1px solid var(--border)',
              }}>
                <span>{p.name}</span>
                {p.id === property?.id && <Check size={14} strokeWidth={2.5} />}
              </button>
            ))}
            <button onClick={() => { onAddProperty(); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              width: '100%', padding: '11px 16px',
              background: 'transparent', color: 'var(--accent)', fontSize: 13, fontWeight: 600,
            }}>
              <Plus size={14} strokeWidth={2.5} /> Aggiungi casa
            </button>
          </div>
        </div>
      )}
    </>
  );
}
