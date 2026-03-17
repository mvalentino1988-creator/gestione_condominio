import { LayoutDashboard, CalendarRange, Receipt, Droplets, BarChart3, StickyNote } from 'lucide-react';
import type { Page } from '../App';

const items: { id: Page; label: string; icon: React.FC<{ size: number }> }[] = [
  { id: 'dashboard', label: 'Home', icon: LayoutDashboard },
  { id: 'esercizi', label: 'Esercizi', icon: CalendarRange },
  { id: 'spese-fisse', label: 'Spese', icon: Receipt },
  { id: 'consumi', label: 'Consumi', icon: Droplets },
  { id: 'grafici', label: 'Grafici', icon: BarChart3 },
  { id: 'note', label: 'Note', icon: StickyNote },
];

export default function BottomNav({ page, setPage }: { page: Page; setPage: (p: Page) => void }) {
  return (
    <nav style={{
      position: 'fixed', bottom: 0, left: 0, right: 0,
      background: 'var(--bg2)',
      borderTop: '1px solid var(--border)',
      display: 'flex',
      paddingBottom: 'var(--safe-bottom)',
      zIndex: 100,
    }}>
      {items.map(({ id, label, icon: Icon }) => (
        <button key={id} onClick={() => setPage(id)} style={{
          flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center',
          gap: 3, padding: '10px 4px', background: 'transparent',
          color: page === id ? 'var(--accent)' : 'var(--text3)',
          borderRadius: 0, fontSize: 10, fontWeight: 500,
          transition: 'color 0.2s',
        }}>
          <Icon size={20} />
          <span style={{ fontFamily: 'var(--font-body)' }}>{label}</span>
        </button>
      ))}
    </nav>
  );
}
