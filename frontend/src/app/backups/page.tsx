'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getBackupRuns } from '@/lib/api';

export default function BackupsPage() {
  const [runs, setRuns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getBackupRuns();
        setRuns(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Respaldos</h1>
        <p className="text-dark-400 text-sm">
          Historial de respaldos nocturnos a Google Drive (rclone). El job se ejecuta a las 02:10 AM diariamente.
        </p>

        {loading ? (
          <div className="text-dark-400 text-center py-12">Cargando...</div>
        ) : runs.length === 0 ? (
          <div className="text-center text-dark-400 py-12">
            <p className="text-xl mb-2">☁️ Sin respaldos registrados</p>
            <p className="text-sm">Los respaldos se registran automáticamente cuando el job nocturno se ejecuta.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {runs.map((run: any) => (
              <div key={run.id} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">
                      {run.status === 'ok' ? '✅' : run.status === 'running' ? '⏳' : '❌'}
                    </span>
                    <div>
                      <p className="text-white font-medium">Día UTC: {run.utc_day}</p>
                      <p className="text-dark-400 text-sm">
                        Inicio: {new Date(run.started_at).toLocaleString('es-MX')}
                        {run.finished_at && ` — Fin: ${new Date(run.finished_at).toLocaleString('es-MX')}`}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        run.status === 'ok'
                          ? 'bg-green-900/40 text-green-300'
                          : run.status === 'running'
                          ? 'bg-yellow-900/40 text-yellow-300'
                          : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      {run.status}
                    </span>
                    <p className="text-dark-500 text-xs mt-2">
                      {run.files_sent} archivos | {(run.bytes_sent / (1024 * 1024)).toFixed(1)} MB
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
