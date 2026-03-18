import { useState, useEffect } from 'react';
import { getProperties, createProperty } from './lib/db';
import type { Property } from './types';
import Dashboard from './pages/Dashboard';
import DatiPage from './pages/DatiPage';
import NotesPage from './pages/NotesPage';
import BottomNav from './components/BottomNav';
import Header from './components/Header';

export type Page = 'dashboard' | 'dati' | 'note';

const NAV_H = 'calc(62px + var(--safe-bottom))';

export default function App() {
  const [properties,       setProperties]       = useState<Property[]>([]);
  const [selectedProperty, setSelectedProperty] = useState<Property | null>(null);
  const [page,             setPage]             = useState<Page>('dashboard');
  const [loading,          setLoading]          = useState(true);
  const [showModal,        setShowModal]        = useState(false);

  useEffect(() => { loadProperties(); }, []);

  const loadProperties = async () => {
    try {
      const data = await getProperties();
      setProperties(data);
      if (data.length > 0) setSelectedProperty(data[0]);
      else setShowModal(true);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  };

  const handleAdd = async (name: string, address: string) => {
    const prop = await createProperty(name, address);
    setProperties(p => [...p, prop]);
    setSelectedProperty(prop);
    setShowModal(false);
  };

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: 'var(--bg)' }}>
      <div style={{ width: 34, height: 34, borderRadius: '50%', border: '3px solid var(--border2)', borderTopColor: 'var(--accent)', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );

  return (
    <>
      {/* Fixed header — max-width handled inside Header */}
      <div style={{ position: 'sticky', top: 0, zIndex: 100, background: 'var(--bg2)', borderBottom: '1px solid var(--border)' }}>
        <Header property={selectedProperty} properties={properties} onSelectProperty={setSelectedProperty} onAddProperty={() => setShowModal(true)} />
      </div>

      <main style={{ paddingBottom: NAV_H, minHeight: '100vh', background: 'var(--bg)' }}>
        <div style={{ maxWidth: 'var(--max-w)', margin: '0 auto', padding: 'var(--pad)' }}>
          {!selectedProperty ? (
            <div style={{ textAlign: 'center', paddingTop: 60 }}>
              <button className="btn-primary" onClick={() => setShowModal(true)}>+ Aggiungi casa</button>
            </div>
          ) : (
            <div className="fade-up" key={page}>
              {page === 'dashboard' && <Dashboard property={selectedProperty} setPage={setPage} />}
              {page === 'dati'      && <DatiPage   property={selectedProperty} />}
              {page === 'note'      && <NotesPage  property={selectedProperty} />}
            </div>
          )}
        </div>
      </main>

      <BottomNav page={page} setPage={setPage} />

      {showModal && <PropertyModal onSave={handleAdd} onClose={() => properties.length > 0 && setShowModal(false)} canClose={properties.length > 0} />}
    </>
  );
}

function PropertyModal({ onSave, onClose, canClose }: { onSave:(n:string,a:string)=>void; onClose:()=>void; canClose:boolean }) {
  const [name, setName] = useState('');
  const [address, setAddress] = useState('');
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,31,46,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: 20, backdropFilter: 'blur(4px)' }}>
      <div className="card fade-up" style={{ width: '100%', maxWidth: 400, padding: 28, boxShadow: 'var(--shadow-lg)' }}>
        <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Nuova Casa</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label>Nome</label><input placeholder="es. Casa Milano" value={name} onChange={e => setName(e.target.value)} autoFocus /></div>
          <div><label>Indirizzo (opzionale)</label><input placeholder="Via..." value={address} onChange={e => setAddress(e.target.value)} /></div>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end', marginTop: 4 }}>
            {canClose && <button className="btn-ghost" onClick={onClose}>Annulla</button>}
            <button className="btn-primary" onClick={() => name && onSave(name, address)}>Salva</button>
          </div>
        </div>
      </div>
    </div>
  );
}
