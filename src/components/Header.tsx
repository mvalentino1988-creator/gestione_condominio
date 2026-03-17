import { useState } from 'react';
import { ChevronDown, Plus, Building2 } from 'lucide-react';
import type { Property } from '../types';

interface Props {
  property: Property | null;
  properties: Property[];
  onSelectProperty: (p: Property) => void;
  onAddProperty: () => void;
}

export default function Header({ property, properties, onSelectProperty, onAddProperty }: Props) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <header style={{
        background: 'var(--bg2)',
        borderBottom: '1px solid var(--border)',
        padding: 'calc(var(--safe-top) + 12px) 20px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Building2 size={20} color="var(--accent)" />
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 18, letterSpacing: '-0.3px' }}>Condo Manager</span>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {property && (
            <button onClick={() => setOpen(true)} style={{
              background: 'var(--card)',
              border: '1px solid var(--border)',
              color: 'var(--text)',
              borderRadius: 20,
              padding: '6px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontFamily: 'var(--font-body)',
              cursor: 'pointer',
            }}>
              <span>{property.name}</span>
              <ChevronDown size={14} />
            </button>
          )}
        </div>
      </header>
      {open && (
        <div style={{ position: 'fixed', inset: 0, background: '#0008', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'flex-end', padding: 'calc(var(--safe-top) + 56px) 20px 0' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: 'var(--card2)', border: '1px solid var(--border)', borderRadius: 14, minWidth: 220, overflow: 'hidden' }}>
            {properties.map(p => (
              <button key={p.id} onClick={() => { onSelectProperty(p); setOpen(false); }} style={{
                display: 'block', width: '100%', textAlign: 'left', padding: '12px 16px',
                background: p.id === property?.id ? 'var(--accent)22' : 'transparent',
                color: p.id === property?.id ? 'var(--accent)' : 'var(--text)',
                borderRadius: 0, fontFamily: 'var(--font-body)', fontSize: 14,
                borderBottom: '1px solid var(--border)',
              }}>{p.name}</button>
            ))}
            <button onClick={() => { onAddProperty(); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '12px 16px',
              background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--font-body)', fontSize: 14,
            }}>
              <Plus size={14} /> Aggiungi casa
            </button>
          </div>
          <div style={{ position: 'fixed', inset: 0, zIndex: -1 }} onClick={() => setOpen(false)} />
        </div>
      )}
    </>
  );
}
