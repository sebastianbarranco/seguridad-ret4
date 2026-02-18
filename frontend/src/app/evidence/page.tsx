'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getEvidenceList, getEvidenceManifest } from '@/lib/api';

export default function EvidencePage() {
  const [evidence, setEvidence] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedManifest, setSelectedManifest] = useState<any>(null);

  useEffect(() => {
    async function load() {
      try {
        const data = await getEvidenceList();
        setEvidence(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  const viewManifest = async (id: string) => {
    try {
      const manifest = await getEvidenceManifest(id);
      setSelectedManifest(manifest);
    } catch (e: any) {
      alert('Error: ' + e.message);
    }
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Evidencias</h1>
        <p className="text-dark-400 text-sm">
          Exportaciones con cadena de custodia (SHA-256). Cada evidencia incluye un manifest JSON verificable.
        </p>

        {loading ? (
          <div className="text-dark-400 text-center py-12">Cargando evidencias...</div>
        ) : evidence.length === 0 ? (
          <div className="text-center text-dark-400 py-12">
            <p className="text-xl mb-2">Sin evidencias exportadas</p>
            <p className="text-sm">Exporta evidencias desde la página de Eventos.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {evidence.map((ev: any) => (
              <div key={ev.id} className="bg-dark-800 border border-dark-700 rounded-xl p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-white font-medium">Evidencia {ev.id.substring(0, 8)}...</p>
                    <p className="text-dark-400 text-sm">SHA-256: <code className="text-yellow-300">{ev.sha256}</code></p>
                    <p className="text-dark-500 text-xs mt-1">
                      {(ev.size_bytes / (1024 * 1024)).toFixed(2)} MB | {ev.content_type} | Descargas: {ev.download_count}
                    </p>
                    <p className="text-dark-500 text-xs">
                      Exportada: {new Date(ev.requested_at).toLocaleString('es-MX')}
                    </p>
                    {ev.reason && <p className="text-dark-400 text-xs mt-1">Razón: {ev.reason}</p>}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => viewManifest(ev.id)}
                      className="px-3 py-2 bg-blue-900/40 text-blue-300 rounded-lg text-xs hover:bg-blue-800/60"
                    >
                      📋 Manifest
                    </button>
                    <a
                      href={`/api/evidence/${ev.id}/download`}
                      className="px-3 py-2 bg-green-900/40 text-green-300 rounded-lg text-xs hover:bg-green-800/60"
                    >
                      📥 Descargar
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Manifest modal */}
        {selectedManifest && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-2xl border border-dark-600 max-w-lg w-full p-6">
              <div className="flex justify-between items-start mb-4">
                <h2 className="text-lg font-bold text-white">Manifest de Evidencia</h2>
                <button onClick={() => setSelectedManifest(null)} className="text-dark-400 hover:text-white">✕</button>
              </div>
              <pre className="bg-dark-900 p-4 rounded-lg text-sm text-green-300 overflow-auto max-h-96 whitespace-pre-wrap">
                {JSON.stringify(selectedManifest, null, 2)}
              </pre>
              <p className="text-dark-500 text-xs mt-3">
                Este manifest contiene la cadena de custodia digital. El hash SHA-256 permite verificar la integridad del archivo exportado.
              </p>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
