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
        background: '#fff',
        borderBottom: '1px solid var(--border)',
        padding: 'calc(var(--safe-top) + 14px) 20px 14px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        position: 'sticky',
        top: 0,
        zIndex: 100,
        boxShadow: '0 1px 0 var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ background: 'var(--accent)', borderRadius: 8, padding: 6, display: 'flex' }}>
            <Building2 size={16} color="#fff" />
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 19, color: 'var(--text)' }}>Condo Manager</span>
        </div>
        {property && (
          <button onClick={() => setOpen(true)} style={{
            background: 'var(--bg2)',
            border: '1.5px solid var(--border2)',
            color: 'var(--text)',
            borderRadius: 10,
            padding: '7px 12px',
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 13,
            fontFamily: 'var(--font-body)',
            fontWeight: 500,
            cursor: 'pointer',
            maxWidth: 180,
          }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{property.name}</span>
            <ChevronDown size={14} color="var(--text2)" />
          </button>
        )}
      </header>

      {open && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.25)', zIndex: 200 }} onClick={() => setOpen(false)}>
          <div onClick={e => e.stopPropagation()} style={{
            position: 'absolute', top: 'calc(var(--safe-top) + 60px)', right: 20,
            background: '#fff', border: '1px solid var(--border)', borderRadius: 14,
            minWidth: 230, overflow: 'hidden', boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
          }}>
            <p style={{ padding: '10px 16px 6px', fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text3)' }}>Le tue case</p>
            {properties.map(p => (
              <button key={p.id} onClick={() => { onSelectProperty(p); setOpen(false); }} style={{
                display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left',
                padding: '11px 16px', background: p.id === property?.id ? 'var(--accent-light)' : 'transparent',
                color: p.id === property?.id ? 'var(--accent)' : 'var(--text)',
                borderRadius: 0, fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: p.id === property?.id ? 600 : 400,
                borderBottom: '1px solid var(--border)',
              }}>
                <Building2 size={14} />
                {p.name}
              </button>
            ))}
            <button onClick={() => { onAddProperty(); setOpen(false); }} style={{
              display: 'flex', alignItems: 'center', gap: 8, width: '100%', padding: '11px 16px',
              background: 'transparent', color: 'var(--accent)', fontFamily: 'var(--font-body)', fontSize: 14, fontWeight: 500,
            }}>
              <Plus size={14} /> Aggiungi casa
            </button>
          </div>
        </div>
      )}
    </>
  );
}
