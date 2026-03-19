import { useState } from 'react';
import { ChevronDown, Plus, Check, Home } from 'lucide-react';
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
        {/* Logo cliccabile */}
        <button
          onClick={onGoHome}
          style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'transparent', border: 'none', padding: '2px 0',
            cursor: onGoHome ? 'pointer' : 'default',
          }}
          title="Home"
        >
          <div style={{
            width: 30, height: 30, borderRadius: 8,
            background: 'var(--accent)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}>
            <Home size={14} color="#fff" strokeWidth={2.5} />
          </div>
          <span style={{
            fontFamily: 'var(--font-display)',
            fontSize: 17,
            fontWeight: 700,
            color: 'var(--ink)',
            letterSpacing: '-0.01em',
          }}>
            CasaMGR
          </span>
        </button>

        {/* Property switcher */}
        {property && (
          <button
            onClick={() => setOpen(true)}
            style={{
              background: 'var(--bg3)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 20,
              padding: '6px 12px 6px 10px',
              display: 'flex', alignItems: 'center', gap: 5,
              fontSize: 12, fontWeight: 700, maxWidth: 190,
            }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {property.name}
            </span>
            <ChevronDown size={12} color="var(--text3)" strokeWidth={2.5} />
          </button>
        )}
      </header>

      {open && (
        <div
          style={{ position: 'fixed', inset: 0, background: 'rgba(26,24,20,0.38)', zIndex: 200, backdropFilter: 'blur(3px)' }}
          onClick={() => setOpen(false)}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              position: 'absolute', top: 'calc(var(--safe-top) + 58px)', right: 'var(--pad)',
              background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 14,
              minWidth: 220, overflow: 'hidden', boxShadow: 'var(--shadow-lg)',
              animation: 'fadeUp 0.16s ease both',
            }}
          >
            <div style={{ padding: '10px 14px 7px', borderBottom: '1px solid var(--border)' }}>
              <p style={{ fontSize: 10, fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--text3)' }}>
                Le tue case
              </p>
            </div>
            {properties.map(p => (
              <button
                key={p.id}
                onClick={() => { onSelectProperty(p); setOpen(false); }}
                style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  width: '100%', padding: '11px 14px',
                  background: p.id === property?.id ? 'var(--accent-light)' : 'transparent',
                  color: p.id === property?.id ? 'var(--accent)' : 'var(--text)',
                  borderRadius: 0, fontSize: 13, fontWeight: p.id === property?.id ? 700 : 500,
                  borderBottom: '1px solid var(--border)',
                }}
              >
                <span>{p.name}</span>
                {p.id === property?.id && <Check size={13} strokeWidth={2.5} />}
              </button>
            ))}
            <button
              onClick={() => { onAddProperty(); setOpen(false); }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                width: '100%', padding: '10px 14px',
                background: 'transparent', color: 'var(--text3)', fontSize: 12, fontWeight: 600,
              }}
            >
              <Plus size={13} strokeWidth={2} /> Aggiungi casa
            </button>
          </div>
        </div>
      )}
    </>
  );
}
