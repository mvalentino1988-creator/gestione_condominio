import { ArrowUpDown } from 'lucide-react';

interface SortToggleProps {
  sortAsc: boolean;
  onToggle: () => void;
  labelAsc?: string;
  labelDesc?: string;
}

export default function SortToggle({
  sortAsc,
  onToggle,
  labelAsc = 'Dal più vecchio',
  labelDesc = 'Dal più recente',
}: SortToggleProps) {
  return (
    <button
      onClick={onToggle}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        background: 'var(--bg3)', border: '1px solid var(--border)',
        borderRadius: 20, padding: '5px 11px', fontSize: 11, fontWeight: 600,
        color: 'var(--text2)', cursor: 'pointer',
        transition: 'border-color 0.15s, color 0.15s',
      }}
    >
      <ArrowUpDown size={11} />
      {sortAsc ? labelAsc : labelDesc}
    </button>
  );
}
