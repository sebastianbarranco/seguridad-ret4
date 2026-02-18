'use client';

import { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import { getUsers, createUser } from '@/lib/api';

export default function UsersPage() {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', password: '', role: 'readonly' });

  const loadUsers = async () => {
    try {
      const data = await getUsers();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await createUser(newUser);
      setShowCreate(false);
      setNewUser({ email: '', password: '', role: 'readonly' });
      await loadUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const roleColors: Record<string, string> = {
    superadmin: 'bg-red-900/40 text-red-300',
    admin: 'bg-blue-900/40 text-blue-300',
    readonly: 'bg-gray-700/40 text-gray-300',
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Usuarios</h1>
          <button
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg text-sm font-medium"
          >
            + Nuevo usuario
          </button>
        </div>

        {loading ? (
          <div className="text-dark-400 text-center py-12">Cargando...</div>
        ) : (
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
            <table className="w-full">
              <thead className="bg-dark-900">
                <tr>
                  <th className="text-left px-6 py-3 text-dark-400 text-sm font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-dark-400 text-sm font-medium">Rol</th>
                  <th className="text-left px-6 py-3 text-dark-400 text-sm font-medium">Estado</th>
                  <th className="text-left px-6 py-3 text-dark-400 text-sm font-medium">MFA</th>
                  <th className="text-left px-6 py-3 text-dark-400 text-sm font-medium">Último acceso</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {users.map((u: any) => (
                  <tr key={u.id} className="hover:bg-dark-700/50">
                    <td className="px-6 py-4 text-white">{u.email}</td>
                    <td className="px-6 py-4">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${roleColors[u.role] || ''}`}>
                        {u.role}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs ${u.is_active ? 'text-green-400' : 'text-red-400'}`}>
                        {u.is_active ? '● Activo' : '○ Inactivo'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-xs ${u.mfa_enabled ? 'text-green-400' : 'text-dark-500'}`}>
                        {u.mfa_enabled ? '🔐 Habilitado' : 'No'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-dark-400 text-sm">
                      {u.last_login_at ? new Date(u.last_login_at).toLocaleString('es-MX') : 'Nunca'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Create user modal */}
        {showCreate && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
            <div className="bg-dark-800 rounded-2xl border border-dark-600 max-w-md w-full p-6">
              <h2 className="text-lg font-bold text-white mb-4">Crear Usuario</h2>
              <form onSubmit={handleCreate} className="space-y-4">
                <div>
                  <label className="block text-sm text-dark-300 mb-1">Email</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-300 mb-1">Contraseña</label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                    required
                  />
                </div>
                <div>
                  <label className="block text-sm text-dark-300 mb-1">Rol</label>
                  <select
                    value={newUser.role}
                    onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
                    className="w-full px-3 py-2 bg-dark-900 border border-dark-600 rounded-lg text-white"
                  >
                    <option value="readonly">ReadOnly</option>
                    <option value="admin">Admin</option>
                    <option value="superadmin">SuperAdmin</option>
                  </select>
                </div>
                <div className="flex gap-3">
                  <button type="submit" className="flex-1 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg">Crear</button>
                  <button type="button" onClick={() => setShowCreate(false)} className="flex-1 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg">Cancelar</button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
