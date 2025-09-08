import '@/app/global.css';
import { RootProvider } from 'fumadocs-ui/provider';
import { Mulish } from 'next/font/google';

const mulish = Mulish({
  subsets: ['latin'],
  variable: '--font-mulish',
});

export default function Layout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={mulish.variable} suppressHydrationWarning>
      <head>
        <title>Gryt - Modern WebRTC Voice Chat Platform</title>
        <meta name="description" content="Gryt is a cutting-edge WebRTC-based voice chat platform featuring real-time communication, advanced audio processing, and a beautiful modern interface." />
        <meta name="keywords" content="voice chat, WebRTC, real-time communication, audio processing, voice platform" />
        <meta property="og:title" content="Gryt - Modern WebRTC Voice Chat Platform" />
        <meta property="og:description" content="Cutting-edge WebRTC-based voice chat platform with enterprise-grade voice quality and reliability." />
        <meta property="og:type" content="website" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Gryt - Modern WebRTC Voice Chat Platform" />
        <meta name="twitter:description" content="Cutting-edge WebRTC-based voice chat platform with enterprise-grade voice quality and reliability." />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/favicon.svg" />
      </head>
      <body className="flex flex-col min-h-screen font-mulish">
        <RootProvider>{children}</RootProvider>
      </body>
    </html>
  );
}
