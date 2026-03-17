import { useState, useEffect } from 'react';
import { getProperties, createProperty } from './lib/db';
import type { Property } from './types';
import PropertySelector from './components/PropertySelector';
import Dashboard from './pages/Dashboard';
import ExerciseYearsPage from './pages/ExerciseYearsPage';
import FixedExpensesPage from './pages/FixedExpensesPage';
import ConsumptionPage from './pages/ConsumptionPage';
import NotesPage from './pages/NotesPage';
import ChartsPage from './pages/ChartsPage';
import BottomNav from './components/BottomNav';
import Header from './components/Header';

export type Page = 'dashboard' | 'esercizi' | 'spese-fisse' | 'consumi' | 'grafici' | 'note';

export default function App() {
  const [properties, setProperties] = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [page, setPage] = useState<Page>('dashboard');
  const [loading, setLoading] = useState(true);
  const [showPropertyModal, setShowPropertyModal] = useState(false);

  useEffect(() => {
    loadProperties();
  }, []);

  const loadProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0 && !selectedProperty) setSelectedProperty(data[0]);
      else if (data.length === 0) setShowPropertyModal(true);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProperty = async (name: string, address: string) => {
    const prop = await createProperty(name, address);
    const updated = [...properties, prop];
    setProperties(updated);
    setSelectedProperty(prop);
    setShowPropertyModal(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
      <div style={{ width: 40, height: 40, borderRadius: '50%', border: '3px solid #2d2d50', borderTopColor: '#e8b86d', animation: 'spin 0.8s linear infinite' }} />
      <p style={{ color: 'var(--text2)', fontFamily: 'var(--font-body)' }}>Caricamento...</p>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', paddingBottom: `calc(64px + var(--safe-bottom))` }}>
      <Header
        property={selectedProperty}
        properties={properties}
        onSelectProperty={setSelectedProperty}
        onAddProperty={() => setShowPropertyModal(true)}
      />
      
      <main style={{ flex: 1, padding: '0 0 8px 0' }}>
        {!selectedProperty ? (
          <div style={{ padding: '40px 20px', textAlign: 'center' }}>
            <p style={{ color: 'var(--text2)', marginBottom: 16 }}>Nessuna casa configurata.</p>
            <button className="btn-primary" onClick={() => setShowPropertyModal(true)}>+ Aggiungi casa</button>
          </div>
        ) : (
          <>
            {page === 'dashboard' && <Dashboard property={selectedProperty} setPage={setPage} />}
            {page === 'esercizi' && <ExerciseYearsPage property={selectedProperty} />}
            {page === 'spese-fisse' && <FixedExpensesPage property={selectedProperty} />}
            {page === 'consumi' && <ConsumptionPage property={selectedProperty} />}
            {page === 'grafici' && <ChartsPage property={selectedProperty} />}
            {page === 'note' && <NotesPage property={selectedProperty} />}
          </>
        )}
      </main>

      <BottomNav page={page} setPage={setPage} />

      {showPropertyModal && (
        <PropertyModal
          onSave={handleAddProperty}
          onClose={() => properties.length > 0 && setShowPropertyModal(false)}
          canClose={properties.length > 0}
        />
      )}
    </div>
  );
}

function PropertyModal({ onSave, onClose, canClose }: { onSave: (n: string, a: string) => void; onClose: () => void; canClose: boolean }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: '#0009', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20 }}>
      <div className="card" style={{ width: '100%', maxWidth: 400 }}>
        <h2 style={{ fontFamily: 'var(--font-display)', marginBottom: 20 }}>Nuova Casa</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <input placeholder="Nome (es. Casa Milano)" value={name} onChange={e => setName(e.target.value)} />
          <input placeholder="Indirizzo" value={address} onChange={e => setAddress(e.target.value)} />
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 8 }}>
            {canClose && <button className="btn-ghost" onClick={onClose}>Annulla</button>}
            <button className="btn-primary" onClick={() => name && onSave(name, address)}>Salva</button>
          </div>
        </div>
      </div>
    </div>
  );
}
