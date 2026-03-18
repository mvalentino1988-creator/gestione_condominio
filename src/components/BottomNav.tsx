import { LayoutDashboard, Database, StickyNote } from 'lucide-react';
import type { Page } from '../App';

const items = [
  { id: 'dashboard' as Page, label: 'Home',  icon: LayoutDashboard },
  { id: 'dati'      as Page, label: 'Dati',  icon: Database        },
  { id: 'note'      as Page, label: 'Note',  icon: StickyNote      },
];

export default function BottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: '50%', transform: 'translateX(-50%)',
      width: '100%', maxWidth: 'var(--max-w)',
      background: 'rgba(255,255,255,0.97)',
      borderTop: '1px solid var(--border)',
      backdropFilter: 'blur(12px)',
      display: 'flex',
      paddingBottom: 'var(--safe-bottom)',
      zIndex: 100,
    }}>
      {items.map(({ id, label, icon: Icon }) => {
        const active = page === id;
        return (
          <button key={id} onClick={() => setPage(id)} style={{
            flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            gap: 3, padding: '10px 4px 8px',
            background: 'transparent', borderRadius: 0,
            color: active ? 'var(--accent)' : 'var(--text3)',
            fontSize: 11, fontWeight: active ? 700 : 500,
            transition: 'color 0.15s', position: 'relative',
          }}>
            {active && (
              <div style={{
                position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
                width: 28, height: 3, background: 'var(--accent)', borderRadius: '0 0 4px 4px',
              }} />
            )}
            <div style={{
              width: 38, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: active ? 'var(--accent-light)' : 'transparent',
              borderRadius: 8, transition: 'background 0.15s',
            }}>
              <Icon size={19} strokeWidth={active ? 2.5 : 1.8} />
            </div>
            <span>{label}</span>
          </button>
        );
      })}
    </nav>
  );
}
