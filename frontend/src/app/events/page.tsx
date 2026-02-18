'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getEvents, syncEvents, getSnapshotUrl, exportEvidence } from '@/lib/api';

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [filter, setFilter] = useState({ label: '', has_clip: '' });
  const [selectedEvent, setSelectedEvent] = useState<any>(null);

  const loadEvents = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filter.label) params.label = filter.label;
      if (filter.has_clip) params.has_clip = filter.has_clip;
      const data = await getEvents(params);
      setEvents(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadEvents();
  }, []);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const result = await syncEvents();
      alert(`Sincronizados: ${result.synced} eventos nuevos`);
      await loadEvents();
    } catch (e: any) {
      alert('Error al sincronizar: ' + e.message);
    }
    setSyncing(false);
  };

  const handleExport = async (eventId: string) => {
    const reason = prompt('Razón de exportación (cadena de custodia):');
    if (reason === null) return;
    try {
      const result = await exportEvidence(eventId, reason);
      alert(`Evidencia exportada. SHA-256: ${result.sha256}`);
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Eventos</h1>
          <button
            onClick={handleSync}
            disabled={syncing}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {syncing ? '⏳ Sincronizando...' : '🔄 Sincronizar con Frigate'}
          </button>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap">
          <select
            value={filter.label}
            onChange={(e) => setFilter({ ...filter, label: e.target.value })}
            className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="">Todos los objetos</option>
            <option value="person">Persona</option>
            <option value="car">Auto</option>
            <option value="dog">Perro</option>
            <option value="cat">Gato</option>
          </select>
          <select
            value={filter.has_clip}
            onChange={(e) => setFilter({ ...filter, has_clip: e.target.value })}
            className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm"
          >
            <option value="">Todos</option>
            <option value="true">Con clip</option>
            <option value="false">Sin clip</option>
          </select>
          <button
            onClick={loadEvents}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm"
          >
            Filtrar
          </button>
        </div>

        {/* Events list */}
        {loading ? (
          <div className="text-center text-dark-400 py-12">Cargando eventos...</div>
        ) : events.length === 0 ? (
          <div className="text-center text-dark-400 py-12">
            <p className="text-xl mb-2">No hay eventos</p>
            <p className="text-sm">Sincroniza con Frigate para comenzar a ver eventos detectados.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {events.map((ev: any) => (
              <div
                key={ev.id}
                className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-dark-500 transition-colors cursor-pointer"
                onClick={() => setSelectedEvent(ev)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">
                      {ev.label === 'person' ? '🚶' : ev.label === 'car' ? '🚗' : ev.label === 'dog' ? '🐕' : ev.label === 'cat' ? '🐈' : '🎯'}
                    </span>
                    <div>
                      <p className="text-white font-semibold capitalize">{ev.label}</p>
                      <p className="text-dark-400 text-sm">
                        {new Date(ev.start_time).toLocaleString('es-MX')}
                        {ev.end_time && ` — ${new Date(ev.end_time).toLocaleString('es-MX')}`}
                      </p>
                      {ev.top_score && (
                        <p className="text-dark-500 text-xs">Confianza: {(ev.top_score * 100).toFixed(1)}%</p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    {ev.has_snapshot && (
                      <span className="px-2 py-1 bg-blue-900/40 text-blue-300 rounded text-xs">📷</span>
                    )}
                    {ev.has_clip && (
                      <span className="px-2 py-1 bg-green-900/40 text-green-300 rounded text-xs">🎬</span>
                    )}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleExport(ev.id);
                      }}
                      className="px-3 py-1 bg-yellow-900/40 text-yellow-300 rounded text-xs hover:bg-yellow-800/60"
                    >
                      📥 Exportar
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Event modal */}
        {selectedEvent && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-2xl border border-dark-600 max-w-2xl w-full max-h-[90vh] overflow-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-xl font-bold text-white capitalize">{selectedEvent.label}</h2>
                <button
                  onClick={() => setSelectedEvent(null)}
                  className="text-dark-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>
              <div className="space-y-4">
                {selectedEvent.has_snapshot && (
                  <div className="rounded-lg overflow-hidden bg-dark-900">
                    <img
                      src={getSnapshotUrl(selectedEvent.id)}
                      alt="Snapshot"
                      className="w-full"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '';
                        (e.target as HTMLImageElement).alt = 'Snapshot no disponible';
                      }}
                    />
                  </div>
                )}
                {selectedEvent.has_clip && (
                  <div className="rounded-lg overflow-hidden bg-dark-900">
                    <video controls className="w-full" preload="metadata">
                      <source src={`/api/events/${selectedEvent.id}/clip`} type="video/mp4" />
                    </video>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div><span className="text-dark-400">ID Frigate:</span> <span className="text-white">{selectedEvent.frigate_event_id}</span></div>
                  <div><span className="text-dark-400">Inicio:</span> <span className="text-white">{new Date(selectedEvent.start_time).toLocaleString('es-MX')}</span></div>
                  <div><span className="text-dark-400">Fin:</span> <span className="text-white">{selectedEvent.end_time ? new Date(selectedEvent.end_time).toLocaleString('es-MX') : 'N/A'}</span></div>
                  <div><span className="text-dark-400">Score:</span> <span className="text-white">{selectedEvent.top_score ? (selectedEvent.top_score * 100).toFixed(1) + '%' : 'N/A'}</span></div>
                </div>
                <button
                  onClick={() => handleExport(selectedEvent.id)}
                  className="w-full py-3 bg-yellow-600 hover:bg-yellow-700 text-white rounded-lg font-medium"
                >
                  📥 Exportar como Evidencia
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
