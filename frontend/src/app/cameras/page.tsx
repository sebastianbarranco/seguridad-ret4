'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getCameras } from '@/lib/api';

export default function CamerasPage() {
  const [cameras, setCameras] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getCameras();
        setCameras(data);
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
        <h1 className="text-2xl font-bold text-white">Cámaras</h1>

        {loading ? (
          <div className="text-dark-400 text-center py-12">Cargando cámaras...</div>
        ) : cameras.length === 0 ? (
          <div className="text-center text-dark-400 py-12">
            <p className="text-xl mb-2">No hay cámaras registradas</p>
            <p className="text-sm">Las cámaras se configuran en Frigate y se registran en la base de datos.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {cameras.map((cam: any) => (
              <div key={cam.id} className="bg-dark-800 border border-dark-700 rounded-xl overflow-hidden">
                {/* Camera preview placeholder */}
                <div className="aspect-video bg-dark-900 flex items-center justify-center">
                  <div className="text-center">
                    <span className="text-5xl">📹</span>
                    <p className="text-dark-500 text-sm mt-2">{cam.frigate_name}</p>
                  </div>
                </div>
                <div className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-white font-semibold">{cam.name}</h3>
                      <p className="text-dark-400 text-sm">{cam.frigate_name}</p>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-medium ${
                        cam.enabled
                          ? 'bg-green-900/40 text-green-300'
                          : 'bg-red-900/40 text-red-300'
                      }`}
                    >
                      {cam.enabled ? '● Activa' : '○ Inactiva'}
                    </span>
                  </div>
                  <p className="text-dark-500 text-xs mt-2">RTSP: {cam.rtsp_url_redacted}</p>
                  <p className="text-dark-600 text-xs mt-1">Registrada: {new Date(cam.created_at).toLocaleDateString('es-MX')}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
