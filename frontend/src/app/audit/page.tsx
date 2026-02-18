'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getAuditLog } from '@/lib/api';

export default function AuditPage() {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const data = await getAuditLog({ limit: '200' });
        setLogs(data);
      } catch (e) {
        console.error(e);
      }
      setLoading(false);
    }
    load();
  }, []);

  const actionColors: Record<string, string> = {
    login: 'text-green-300',
    logout: 'text-gray-300',
    evidence_export: 'text-yellow-300',
    evidence_download: 'text-yellow-400',
    events_sync: 'text-blue-300',
    user_create: 'text-purple-300',
    user_update: 'text-purple-300',
    mfa_enroll: 'text-cyan-300',
    mfa_verify_ok: 'text-green-400',
    mfa_verify_fail: 'text-red-400',
    camera_create: 'text-blue-400',
    password_reset: 'text-orange-300',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white">Auditoría</h1>
        <p className="text-dark-400 text-sm">Registro completo de acciones del sistema (solo SuperAdmin).</p>

        {loading ? (
          <div className="text-dark-400 text-center py-12">Cargando...</div>
        ) : logs.length === 0 ? (
          <div className="text-center text-dark-400 py-12">Sin registros de auditoría</div>
        ) : (
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-dark-900">
                  <tr>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium">Fecha</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium">Acción</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium">Recurso</th>
                    <th className="text-left px-4 py-3 text-dark-400 text-xs font-medium">IP</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-dark-700">
                  {logs.map((log: any) => (
                    <tr key={log.id} className="hover:bg-dark-700/50">
                      <td className="px-4 py-3 text-dark-300 text-xs whitespace-nowrap">
                        {new Date(log.created_at).toLocaleString('es-MX')}
                      </td>
                      <td className="px-4 py-3">
                        <span className={`text-xs font-medium ${actionColors[log.action] || 'text-white'}`}>
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-dark-400 text-xs">
                        {log.resource_type && `${log.resource_type}: ${log.resource_id?.substring(0, 8)}...`}
                      </td>
                      <td className="px-4 py-3 text-dark-500 text-xs">{log.ip || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
