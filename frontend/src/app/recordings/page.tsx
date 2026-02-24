'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getRecordings, getRecordingPlayUrl, simulateRecording, deleteRecording, getCameras } from '@/lib/api';

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<any[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [selectedRecording, setSelectedRecording] = useState<any>(null);
  const [filter, setFilter] = useState({ camera_id: '', from_date: '', to_date: '' });

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '100' };
      if (filter.camera_id) params.camera_id = filter.camera_id;
      if (filter.from_date) params.from_date = filter.from_date;
      if (filter.to_date) params.to_date = filter.to_date;
      const data = await getRecordings(params);
      setRecordings(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  const loadCameras = async () => {
    try {
      const data = await getCameras();
      setCameras(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    loadCameras();
    loadRecordings();
  }, []);

  const handleSimulate = async () => {
    if (!confirm('¿Simular un corte diario? Esto creará grabaciones de prueba con fecha de ayer para cada cámara habilitada.')) return;
    setSimulating(true);
    try {
      const result = await simulateRecording();
      alert(`✅ Simulación completa: ${result.count} grabación(es) creada(s)`);
      await loadRecordings();
    } catch (e: any) {
      alert('Error al simular: ' + e.message);
    }
    setSimulating(false);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta grabación permanentemente?')) return;
    try {
      await deleteRecording(id);
      setSelectedRecording(null);
      await loadRecordings();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDuration = (secs: number) => {
    if (!secs) return '—';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return m > 0 ? `${m}m ${s}s` : `${s}s`;
  };

  const getCameraName = (cameraId: string) => {
    const cam = cameras.find((c: any) => c.id === cameraId);
    return cam ? cam.name : cameraId?.slice(0, 8);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Grabaciones</h1>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {simulating ? '⏳ Simulando...' : '🎬 Simular Corte Diario'}
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-blue-900/30 border border-blue-700/50 rounded-xl p-4 text-sm text-blue-200">
          <p><strong>📹 Sistema de Grabaciones</strong></p>
          <p className="mt-1 text-blue-300/80">
            Las grabaciones se almacenan por día y cámara. Use &quot;Simular Corte Diario&quot; para
            crear grabaciones de prueba con fecha de ayer. En producción, este corte se realiza
            automáticamente al final de cada día.
          </p>
        </div>

        {/* Filters */}
        <div className="flex gap-4 flex-wrap items-end">
          <div>
            <label className="block text-dark-400 text-xs mb-1">Cámara</label>
            <select
              value={filter.camera_id}
              onChange={(e) => setFilter({ ...filter, camera_id: e.target.value })}
              className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm min-w-[180px]"
            >
              <option value="">Todas las cámaras</option>
              {cameras.map((cam: any) => (
                <option key={cam.id} value={cam.id}>{cam.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-dark-400 text-xs mb-1">Desde</label>
            <input
              type="date"
              value={filter.from_date}
              onChange={(e) => setFilter({ ...filter, from_date: e.target.value })}
              className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm"
            />
          </div>
          <div>
            <label className="block text-dark-400 text-xs mb-1">Hasta</label>
            <input
              type="date"
              value={filter.to_date}
              onChange={(e) => setFilter({ ...filter, to_date: e.target.value })}
              className="px-3 py-2 bg-dark-800 border border-dark-600 rounded-lg text-white text-sm"
            />
          </div>
          <button
            onClick={loadRecordings}
            className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm"
          >
            Filtrar
          </button>
        </div>

        {/* Recordings list */}
        {loading ? (
          <div className="text-center text-dark-400 py-12">Cargando grabaciones...</div>
        ) : recordings.length === 0 ? (
          <div className="text-center text-dark-400 py-12">
            <p className="text-4xl mb-3">🎥</p>
            <p className="text-xl mb-2">No hay grabaciones</p>
            <p className="text-sm">Presiona &quot;Simular Corte Diario&quot; para crear grabaciones de prueba.</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {recordings.map((rec: any) => (
              <div
                key={rec.id}
                className="bg-dark-800 border border-dark-700 rounded-xl p-4 hover:border-dark-500 transition-colors cursor-pointer"
                onClick={() => setSelectedRecording(rec)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">📹</span>
                    <div>
                      <p className="text-white font-semibold">{getCameraName(rec.camera_id)}</p>
                      <p className="text-dark-400 text-sm">
                        📅 {new Date(rec.recording_date + 'T00:00:00').toLocaleDateString('es-MX', {
                          weekday: 'long',
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        })}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-3 items-center text-sm">
                    <span className="text-dark-400">⏱ {formatDuration(rec.duration_seconds)}</span>
                    <span className="text-dark-400">💾 {formatBytes(rec.size_bytes)}</span>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      rec.status === 'available'
                        ? 'bg-green-900/40 text-green-300'
                        : rec.status === 'processing'
                        ? 'bg-yellow-900/40 text-yellow-300'
                        : 'bg-red-900/40 text-red-300'
                    }`}>
                      {rec.status === 'available' ? '✅ Disponible' : rec.status === 'processing' ? '⏳ Procesando' : '❌ Error'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Recording detail / player modal */}
        {selectedRecording && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-2xl border border-dark-600 max-w-3xl w-full max-h-[90vh] overflow-auto p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h2 className="text-xl font-bold text-white">{getCameraName(selectedRecording.camera_id)}</h2>
                  <p className="text-dark-400 text-sm mt-1">
                    {new Date(selectedRecording.recording_date + 'T00:00:00').toLocaleDateString('es-MX', {
                      weekday: 'long',
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedRecording(null)}
                  className="text-dark-400 hover:text-white text-xl"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4">
                {/* Video player */}
                {selectedRecording.status === 'available' && (
                  <div className="rounded-lg overflow-hidden bg-dark-900">
                    <video
                      controls
                      autoPlay
                      className="w-full"
                      preload="metadata"
                      key={selectedRecording.id}
                    >
                      <source src={getRecordingPlayUrl(selectedRecording.id)} type="video/mp4" />
                      Tu navegador no soporta la reproducción de video.
                    </video>
                  </div>
                )}

                {selectedRecording.status !== 'available' && (
                  <div className="rounded-lg bg-dark-900 p-8 text-center text-dark-400">
                    <p className="text-2xl mb-2">⚠️</p>
                    <p>Esta grabación no está disponible para reproducción.</p>
                    <p className="text-sm mt-1">Estado: {selectedRecording.status}</p>
                  </div>
                )}

                {/* Metadata grid */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-dark-400">Duración:</span>{' '}
                    <span className="text-white">{formatDuration(selectedRecording.duration_seconds)}</span>
                  </div>
                  <div>
                    <span className="text-dark-400">Tamaño:</span>{' '}
                    <span className="text-white">{formatBytes(selectedRecording.size_bytes)}</span>
                  </div>
                  <div>
                    <span className="text-dark-400">Archivo:</span>{' '}
                    <span className="text-white font-mono text-xs">{selectedRecording.filename}</span>
                  </div>
                  <div>
                    <span className="text-dark-400">Creado:</span>{' '}
                    <span className="text-white">{new Date(selectedRecording.created_at).toLocaleString('es-MX')}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3">
                  {selectedRecording.status === 'available' && (
                    <a
                      href={getRecordingPlayUrl(selectedRecording.id)}
                      download
                      className="flex-1 py-3 bg-primary-600 hover:bg-primary-700 text-white rounded-lg font-medium text-center"
                    >
                      ⬇️ Descargar
                    </a>
                  )}
                  <button
                    onClick={() => handleDelete(selectedRecording.id)}
                    className="flex-1 py-3 bg-red-600/30 hover:bg-red-600/50 text-red-300 rounded-lg font-medium"
                  >
                    🗑️ Eliminar
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
