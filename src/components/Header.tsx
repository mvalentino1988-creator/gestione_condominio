import { useState } from 'react';
import { ChevronDown, Plus, Check } from 'lucide-react';
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
        padding: 'calc(var(--safe-top) + 12px) var(--pad) 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        maxWidth: 'var(--max-w)',
        margin: '0 auto',
        width: '100%',
      }}>
        <button
          onClick={onGoHome}
          style={{
            display: 'flex', alignItems: 'baseline', gap: 2,
            background: 'transparent', border: 'none', padding: '2px 0',
            cursor: onGoHome ? 'pointer' : 'default',
          }}
          title="Home"
        >
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 400, color: 'var(--ink)', letterSpacing: '-0.02em' }}>Casa</span>
          <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 700, color: 'var(--accent)', letterSpacing: '0.1em', textTransform: 'uppercase', marginLeft: 5 }}>MGR</span>
        </button>

        {property && (
          <button
            onClick={() => setOpen(true)}
            style={{
              background: 'transparent', border: '1px solid var(--border)', color: 'var(--text)',
              borderRadius: 6, padding: '5px 10px 5px 12px',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 500, maxWidth: 200,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{property.name}</span>
            <ChevronDown size={12} color="var(--text3)" strokeWidth={2} />
          </button>
        )}
      </header>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(17,16,16,0.35)', zIndex: 200, backdropFilter: 'blur(2px)' }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: 'calc(var(--safe-top) + 54px)', right: 'var(--pad)',
            background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 10,
            minWidth: 220, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
            animation: 'fadeUp 0.16s ease both',
          }}>
            <div style={{ padding: '10px 14px 7px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text3)' }}>Immobili</p>
            </div>
            {properties.map(p => (
              <button key={p.id} onClick={() => { onSelectProperty(p); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '11px 14px',
                background: 'transparent',
                color: p.id === property?.id ? 'var(--accent)' : 'var(--text)',
                borderRadius: 0, fontSize: 13, fontWeight: p.id === property?.id ? 600 : 400,
                borderBottom: '1px solid var(--border)',
              }}>
                <span>{p.name}</span>
                {p.id === property?.id && <Check size={13} strokeWidth={2.5} />}
              </button>
            ))}
            <button onClick={() => { onAddProperty(); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 6,
              width: '100%', padding: '10px 14px',
              background: 'transparent', color: 'var(--text3)', fontSize: 12, fontWeight: 500,
            }}>
              <Plus size={13} strokeWidth={2} /> Aggiungi immobile
            </button>
          </div>
        </div>
      )}
    </>
  );
}
