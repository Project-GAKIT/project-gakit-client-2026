import type { Metadata } from 'next';
import 'maplibre-gl/dist/maplibre-gl.css';
import 'react-toastify/dist/ReactToastify.css';
import './globals.css';
import 'cal-sans';
import { appearanceBootstrap } from '@/lib/theme/appearance';
import { ClientProviders } from './providers';

export const metadata: Metadata = {
  title: 'GAKIT - Geohazard Assessment & Knowledge Integration Tool',
  description: 'Geohazard assessment & knowledge integration tool for geohazard risk management and decision support.',
  icons: {
    icon: [
      { url: '/favicon.png', type: 'image/png', sizes: '128x128' },
      { url: '/favicon.ico', sizes: '32x32' },
    ],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: appearanceBootstrap }} />
        {/* Warm up connections for the basemap and terrain so the map paints faster on first load */}
        <link rel="preconnect" href="https://tiles.openfreemap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tiles.openfreemap.org" />
        <link rel="preconnect" href="https://tile.openstreetmap.org" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://tile.openstreetmap.org" />
        <link rel="preconnect" href="https://s3.amazonaws.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://s3.amazonaws.com" />
        <link rel="preconnect" href="https://gakit-server.onrender.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://gakit-server.onrender.com" />
        <link rel="dns-prefetch" href="https://nominatim.openstreetmap.org" />
      </head>
      <body className="font-sans">
        <ClientProviders>
          {children}
        </ClientProviders>
      </body>
    </html>
  );
}
