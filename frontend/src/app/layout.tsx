import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NVR Portal — Videovigilancia',
  description: 'Portal de administración de videovigilancia on-prem',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
