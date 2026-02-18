'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getEvents, getCameras, getBackupRuns, healthCheck } from '@/lib/api';

export default function DashboardPage() {
  const [stats, setStats] = useState({
    totalEvents: 0,
    totalCameras: 0,
    lastBackup: 'N/A',
    systemStatus: 'checking...',
  });

  const [recentEvents, setRecentEvents] = useState<any[]>([]);

  useEffect(() => {
    async function loadData() {
      try {
        const [events, cameras, backups, health] = await Promise.allSettled([
          getEvents({ limit: '10' }),
          getCameras(),
          getBackupRuns(),
          healthCheck(),
        ]);

        const evts = events.status === 'fulfilled' ? events.value : [];
        const cams = cameras.status === 'fulfilled' ? cameras.value : [];
        const bkps = backups.status === 'fulfilled' ? backups.value : [];
        const hlth = health.status === 'fulfilled' ? health.value : null;

        setRecentEvents(evts.slice(0, 5));
        setStats({
          totalEvents: evts.length,
          totalCameras: cams.length,
          lastBackup: bkps.length > 0 ? bkps[0].utc_day : 'Ninguno',
          systemStatus: hlth ? 'En línea' : 'Error',
        });
      } catch (e) {
        console.error(e);
      }
    }
    loadData();
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>

        {/* Stats cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard title="Eventos recientes" value={stats.totalEvents.toString()} icon="🎯" color="blue" />
          <StatCard title="Cámaras activas" value={stats.totalCameras.toString()} icon="📹" color="green" />
          <StatCard title="Último respaldo" value={stats.lastBackup} icon="☁️" color="purple" />
          <StatCard title="Estado del sistema" value={stats.systemStatus} icon="💚" color="emerald" />
        </div>

        {/* Recent events */}
        <div className="bg-dark-800 rounded-xl border border-dark-700 p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Eventos recientes</h2>
          {recentEvents.length === 0 ? (
            <p className="text-dark-400">No hay eventos aún. Esperando sincronización con Frigate...</p>
          ) : (
            <div className="space-y-3">
              {recentEvents.map((ev: any) => (
                <div key={ev.id} className="flex items-center justify-between bg-dark-900 rounded-lg p-4">
                  <div className="flex items-center gap-4">
                    <span className="text-2xl">
                      {ev.label === 'person' ? '🚶' : ev.label === 'car' ? '🚗' : '🎯'}
                    </span>
                    <div>
                      <p className="text-white font-medium capitalize">{ev.label}</p>
                      <p className="text-dark-400 text-sm">
                        {new Date(ev.start_time).toLocaleString('es-MX')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    {ev.has_snapshot && (
                      <span className="px-2 py-1 bg-blue-900/50 text-blue-300 rounded text-xs">📷 Snapshot</span>
                    )}
                    {ev.has_clip && (
                      <span className="px-2 py-1 bg-green-900/50 text-green-300 rounded text-xs">🎬 Clip</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  );
}

function StatCard({ title, value, icon, color }: { title: string; value: string; icon: string; color: string }) {
  const colorClasses: Record<string, string> = {
    blue: 'bg-blue-900/30 border-blue-800',
    green: 'bg-green-900/30 border-green-800',
    purple: 'bg-purple-900/30 border-purple-800',
    emerald: 'bg-emerald-900/30 border-emerald-800',
  };

  return (
    <div className={`rounded-xl border p-6 ${colorClasses[color] || colorClasses.blue}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xl">{icon}</span>
      </div>
      <p className="text-2xl font-bold text-white">{value}</p>
      <p className="text-dark-400 text-sm mt-1">{title}</p>
    </div>
  );
}
