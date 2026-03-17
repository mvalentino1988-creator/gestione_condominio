import { LayoutDashboard, CalendarRange, Receipt, Droplets, BarChart3, StickyNote } from 'lucide-react';
import type { Page } from '../App';

const items = [
  { id: 'dashboard' as Page, label: 'Home', icon: LayoutDashboard },
  { id: 'esercizi' as Page, label: 'Esercizi', icon: CalendarRange },
  { id: 'spese-fisse' as Page, label: 'Spese', icon: Receipt },
  { id: 'consumi' as Page, label: 'Consumi', icon: Droplets },
  { id: 'grafici' as Page, label: 'Grafici', icon: BarChart3 },
  { id: 'note' as Page, label: 'Note', icon: StickyNote },
];

export default function BottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: '#fff',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      paddingBottom: 'var(--safe-bottom)',
      zIndex: 100,
      boxShadow: '0 -1px 0 var(--border)',
    }}>
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setPage(id)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, padding: '10px 4px 8px',
          background: 'transparent',
          color: page === id ? 'var(--accent)' : 'var(--text3)',
          borderRadius: 0, fontSize: 10, fontWeight: page === id ? 600 : 400,
          transition: 'color 0.15s',
          position: 'relative',
        }}>
          {page === id && (
            <div style={{
              position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)',
              width: 28, height: 3, background: 'var(--accent)', borderRadius: '0 0 3px 3px',
            }} />
          )}
          <Icon size={21} />
          <span style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
