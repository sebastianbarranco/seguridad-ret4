'use client';

import { useEffect, useState, useMemo } from 'react';
import AppLayout from '@/components/AppLayout';
import SecurityPlayer from '@/components/SecurityPlayer';
import { getRecordings, simulateRecording, deleteRecording, getCameras, getRecordingPlayUrl } from '@/lib/api';

interface Recording {
  id: string;
  camera_id: string;
  recording_date: string;
  hour: number;
  filename: string;
  duration_seconds: number | null;
  size_bytes: number | null;
  status: string;
  created_at: string;
}

export default function RecordingsPage() {
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [simulating, setSimulating] = useState(false);
  const [filter, setFilter] = useState({ camera_id: '', from_date: '', to_date: '', hour_from: '', hour_to: '' });
  const [playerData, setPlayerData] = useState<{ recordings: Recording[]; cameraName: string; date: string } | null>(null);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const loadRecordings = async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { limit: '500' };
      if (filter.camera_id) params.camera_id = filter.camera_id;
      if (filter.from_date) params.from_date = filter.from_date;
      if (filter.to_date) params.to_date = filter.to_date;
      if (filter.hour_from) params.hour_from = filter.hour_from;
      if (filter.hour_to) params.hour_to = filter.hour_to;
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
    if (!confirm('¿Simular grabación de 24 horas? Esto creará 24 segmentos por hora para cada cámara habilitada (fecha de ayer).')) return;
    setSimulating(true);
    try {
      const result = await simulateRecording();
      alert(`✅ Simulación completa: ${result.count} segmentos creados`);
      await loadRecordings();
    } catch (e: any) {
      alert('Error al simular: ' + e.message);
    }
    setSimulating(false);
  };

  const getCameraName = (cameraId: string) => {
    const cam = cameras.find((c: any) => c.id === cameraId);
    return cam ? cam.name : cameraId?.slice(0, 8);
  };

  // Group recordings by camera+date
  const groups = useMemo(() => {
    const map = new Map<string, { camera_id: string; date: string; recordings: Recording[] }>();
    recordings.forEach(r => {
      const key = `${r.camera_id}__${r.recording_date}`;
      if (!map.has(key)) {
        map.set(key, { camera_id: r.camera_id, date: r.recording_date, recordings: [] });
      }
      map.get(key)!.recordings.push(r);
    });
    // Sort recordings within each group by hour
    map.forEach(g => g.recordings.sort((a, b) => a.hour - b.hour));
    return Array.from(map.values()).sort((a, b) => b.date.localeCompare(a.date));
  }, [recordings]);

  const formatBytes = (bytes: number | null) => {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const totalSize = (recs: Recording[]) => {
    const total = recs.reduce((sum, r) => sum + (r.size_bytes || 0), 0);
    return formatBytes(total);
  };

  const openPlayer = (group: { camera_id: string; date: string; recordings: Recording[] }) => {
    setPlayerData({
      recordings: group.recordings.filter(r => r.status === 'available'),
      cameraName: getCameraName(group.camera_id),
      date: group.date,
    });
  };

  const handleDeleteAll = async (group: { camera_id: string; date: string; recordings: Recording[] }) => {
    if (!confirm(`¿Eliminar las ${group.recordings.length} grabaciones de ${getCameraName(group.camera_id)} del ${group.date}?`)) return;
    try {
      for (const rec of group.recordings) {
        await deleteRecording(rec.id);
      }
      await loadRecordings();
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  const hourLabels = Array.from({ length: 24 }, (_, h) => h);

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Sistema de Grabaciones 24h</h1>
            <p className="text-dark-400 text-sm mt-1">
              {recordings.length} segmentos en {groups.length} grupo(s) de cámara/día
            </p>
          </div>
          <button
            onClick={handleSimulate}
            disabled={simulating}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-colors"
          >
            {simulating ? '⏳ Simulando 24h...' : '🎬 Simular Día Completo (24h)'}
          </button>
        </div>

        {/* Info banner */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4 text-sm">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🛡️</span>
            <div>
              <p className="text-white font-semibold">Sistema de Vigilancia - Grabación Continua</p>
              <p className="text-dark-400 mt-1">
                Las grabaciones se segmentan en bloques de 1 hora (24 segmentos por día por cámara).
                Haga clic en cualquier bloque horario para reproducir, o abra el reproductor de seguridad
                con controles de velocidad (×0.25 a ×8), zoom y ajustes de imagen.
              </p>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-dark-800 border border-dark-700 rounded-xl p-4">
          <div className="flex gap-4 flex-wrap items-end">
            <div>
              <label className="block text-dark-400 text-xs mb-1">Cámara</label>
              <select
                value={filter.camera_id}
                onChange={(e) => setFilter({ ...filter, camera_id: e.target.value })}
                className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm min-w-[180px]"
              >
                <option value="">Todas las cámaras</option>
                {cameras.map((cam: any) => (
                  <option key={cam.id} value={cam.id}>{cam.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-dark-400 text-xs mb-1">Fecha desde</label>
              <input
                type="date"
                value={filter.from_date}
                onChange={(e) => setFilter({ ...filter, from_date: e.target.value })}
                className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-dark-400 text-xs mb-1">Fecha hasta</label>
              <input
                type="date"
                value={filter.to_date}
                onChange={(e) => setFilter({ ...filter, to_date: e.target.value })}
                className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm"
              />
            </div>
            <div>
              <label className="block text-dark-400 text-xs mb-1">Hora desde</label>
              <select
                value={filter.hour_from}
                onChange={(e) => setFilter({ ...filter, hour_from: e.target.value })}
                className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm w-24"
              >
                <option value="">--</option>
                {hourLabels.map(h => (
                  <option key={h} value={h.toString()}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-dark-400 text-xs mb-1">Hora hasta</label>
              <select
                value={filter.hour_to}
                onChange={(e) => setFilter({ ...filter, hour_to: e.target.value })}
                className="px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white text-sm w-24"
              >
                <option value="">--</option>
                {hourLabels.map(h => (
                  <option key={h} value={h.toString()}>{h.toString().padStart(2, '0')}:00</option>
                ))}
              </select>
            </div>
            <button
              onClick={loadRecordings}
              className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
            >
              🔍 Buscar
            </button>
            <button
              onClick={() => { setFilter({ camera_id: '', from_date: '', to_date: '', hour_from: '', hour_to: '' }); }}
              className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg text-sm"
            >
              Limpiar
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="text-center text-dark-400 py-12">
            <div className="animate-spin text-4xl mb-3">⏳</div>
            <p>Cargando grabaciones...</p>
          </div>
        ) : groups.length === 0 ? (
          <div className="text-center text-dark-500 py-16">
            <p className="text-5xl mb-4">📷</p>
            <p className="text-xl mb-2 text-dark-400">No hay grabaciones</p>
            <p className="text-sm">
              Presiona &quot;Simular Día Completo&quot; para crear 24 segmentos horarios de prueba por cada cámara.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {groups.map(group => {
              const key = `${group.camera_id}__${group.date}`;
              const isExpanded = expandedGroup === key;
              const availableHours = new Set(group.recordings.filter(r => r.status === 'available').map(r => r.hour));
              const totalHours = group.recordings.length;

              return (
                <div key={key} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                  {/* Group header */}
                  <div className="p-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-dark-700 rounded-lg flex items-center justify-center text-2xl">📹</div>
                      <div>
                        <h3 className="text-white font-bold text-lg">{getCameraName(group.camera_id)}</h3>
                        <p className="text-dark-400 text-sm">
                          📅 {new Date(group.date + 'T00:00:00').toLocaleDateString('es-MX', {
                            weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right text-sm mr-4">
                        <p className="text-green-400 font-mono">{totalHours} / 24 horas</p>
                        <p className="text-dark-500">{totalSize(group.recordings)}</p>
                      </div>
                      <button
                        onClick={() => openPlayer(group)}
                        className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                      >
                        ▶ Reproductor
                      </button>
                      <button
                        onClick={() => setExpandedGroup(isExpanded ? null : key)}
                        className="px-3 py-2 bg-dark-700 hover:bg-dark-600 text-dark-300 rounded-lg text-sm"
                      >
                        {isExpanded ? '▲ Cerrar' : '▼ Detalle'}
                      </button>
                      <button
                        onClick={() => handleDeleteAll(group)}
                        className="px-3 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 rounded-lg text-sm"
                        title="Eliminar todas las grabaciones de este día"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>

                  {/* 24-hour timeline bar */}
                  <div className="px-4 pb-3">
                    <div className="flex gap-0.5">
                      {hourLabels.map(h => {
                        const hasRec = availableHours.has(h);
                        return (
                          <button
                            key={h}
                            onClick={() => { if (hasRec) openPlayer(group); }}
                            className={`flex-1 h-8 rounded-sm text-xs font-mono flex items-center justify-center transition-all ${
                              hasRec
                                ? 'bg-green-900/60 text-green-300 hover:bg-green-800/80 cursor-pointer'
                                : 'bg-dark-900 text-dark-700 cursor-default'
                            }`}
                            title={`${h.toString().padStart(2, '0')}:00 - ${(h + 1).toString().padStart(2, '0')}:00${hasRec ? ' ✓' : ' (vacío)'}`}
                          >
                            {h.toString().padStart(2, '0')}
                          </button>
                        );
                      })}
                    </div>
                    <div className="flex justify-between text-dark-600 text-xs mt-1 px-1">
                      <span>00:00</span>
                      <span>06:00</span>
                      <span>12:00</span>
                      <span>18:00</span>
                      <span>23:59</span>
                    </div>
                  </div>

                  {/* Expanded detail */}
                  {isExpanded && (
                    <div className="border-t border-dark-700 p-4">
                      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-12 gap-2">
                        {group.recordings.map(rec => (
                          <div
                            key={rec.id}
                            className={`rounded-lg p-2 text-center text-xs ${
                              rec.status === 'available'
                                ? 'bg-dark-700 hover:bg-dark-600 cursor-pointer'
                                : 'bg-dark-900 text-dark-600'
                            }`}
                            onClick={() => {
                              if (rec.status === 'available') openPlayer(group);
                            }}
                          >
                            <div className="font-mono text-white text-sm">{rec.hour.toString().padStart(2, '0')}:00</div>
                            <div className="text-dark-400 mt-0.5">{formatBytes(rec.size_bytes)}</div>
                            <div className={`mt-1 w-2 h-2 rounded-full mx-auto ${
                              rec.status === 'available' ? 'bg-green-500' : 'bg-red-500'
                            }`} />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Security Player (fullscreen overlay) */}
      {playerData && (
        <SecurityPlayer
          recordings={playerData.recordings}
          cameraName={playerData.cameraName}
          date={playerData.date}
          onClose={() => setPlayerData(null)}
        />
      )}
    </AppLayout>
  );
}
