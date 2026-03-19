import { LayoutDashboard, Database, StickyNote } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { Page } from '../App';

const items: { id: Page; label: string; icon: LucideIcon }[] = [
  { id: 'dashboard', label: 'Home',  icon: LayoutDashboard },
  { id: 'dati',      label: 'Dati',  icon: Database        },
  { id: 'note',      label: 'Note',  icon: StickyNote      },
];

export default function BottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 'var(--max-w)',
      background: 'rgba(255,255,255,0.95)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(14px)',
      display: 'flex',
      paddingBottom: 'var(--safe-bottom)',
      zIndex: 100,
    }}>
      {items.map(({ id, label, icon: Icon }) => {
        const active = page === id;
        return (
          <button
            key={id}
            onClick={() => setPage(id)}
            style={{
              flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 3, padding: '10px 4px 8px',
              background: 'transparent', borderRadius: 0,
              color: active ? 'var(--accent)' : 'var(--text3)',
              fontSize: 10, fontWeight: active ? 800 : 500,
              letterSpacing: '0.04em', textTransform: 'uppercase',
              transition: 'color 0.13s', position: 'relative',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 24, height: 2.5, background: 'var(--accent)', borderRadius: '0 0 3px 3px',
              }} />
            )}
            <div style={{
              width: 36, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'var(--accent-light)' : 'transparent',
              borderRadius: 7, transition: 'background 0.13s',
            }}>
              <Icon size={17} strokeWidth={active ? 2.5 : 1.8} />
            </div>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
