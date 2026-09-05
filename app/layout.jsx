import './globals.css';

export const metadata = {
  title: 'AI Second Brain · Next Level by HMT',
  description: 'Your own AI that knows your business and writes in your voice.'
};

export const viewport = {
  themeColor: '#0B2450',
  width: 'device-width',
  initialScale: 1
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="icon" href="/mark.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Sora:wght@400;600;700&family=Manrope:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&family=Noto+Sans+Myanmar:wght@400;500;700;800&family=Padauk:wght@400;700&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
