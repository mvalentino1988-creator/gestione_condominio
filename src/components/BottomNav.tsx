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
      background: 'rgba(255,255,255,0.96)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(16px)',
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
              gap: 4, padding: '10px 4px 8px',
              background: 'transparent', borderRadius: 0,
              color: active ? 'var(--ink)' : 'var(--text3)',
              fontSize: 10, fontWeight: active ? 700 : 400,
              letterSpacing: '0.05em', textTransform: 'uppercase',
              transition: 'color 0.13s', position: 'relative',
            }}
          >
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 20, height: 2, background: 'var(--ink)', borderRadius: '0 0 2px 2px',
              }} />
            )}
            <Icon size={18} strokeWidth={active ? 2 : 1.5} />
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
