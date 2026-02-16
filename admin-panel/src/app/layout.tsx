import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'FlyAndEarn Admin',
  description: 'Admin panel for FlyAndEarn marketplace',
  robots: 'noindex, nofollow', // Prevent search engine indexing
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
      </head>
      <body className="min-h-screen bg-dark-900 antialiased">
        {children}
      </body>
    </html>
  );
}
