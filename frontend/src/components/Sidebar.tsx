'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';

const navItems = [
  { href: '/dashboard', label: 'Dashboard', icon: '📊' },
  { href: '/recordings', label: 'Grabaciones', icon: '🎥' },
  { href: '/events', label: 'Eventos', icon: '🎯' },
  { href: '/cameras', label: 'Cámaras', icon: '📹' },
  { href: '/evidence', label: 'Evidencias', icon: '🔒' },
  { href: '/users', label: 'Usuarios', icon: '👥' },
  { href: '/audit', label: 'Auditoría', icon: '📋' },
  { href: '/backups', label: 'Respaldos', icon: '☁️' },
];

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('refresh_token');
    router.push('/login');
  };

  return (
    <aside className="w-64 bg-dark-900 border-r border-dark-700 flex flex-col min-h-screen">
      {/* Logo */}
      <div className="p-6 border-b border-dark-700">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
            <span className="text-lg">📹</span>
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">NVR Portal</h1>
            <p className="text-xs text-dark-400">Videovigilancia</p>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-4 space-y-1">
        {navItems.map((item) => {
          const active = pathname === item.href || pathname?.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-primary-600/20 text-primary-400 border-l-2 border-primary-500'
                  : 'text-dark-400 hover:bg-dark-800 hover:text-white'
              }`}
            >
              <span className="text-lg">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Logout */}
      <div className="p-4 border-t border-dark-700">
        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-red-400 hover:bg-red-900/20 w-full transition-colors"
        >
          <span className="text-lg">🚪</span>
          Cerrar sesión
        </button>
      </div>
    </aside>
  );
}
