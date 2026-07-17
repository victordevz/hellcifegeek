import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hellcife Geek",
  description: "Loja geek com importados originais diretamente do Japao, Coreia e China.",
  icons: {
    icon: [
      { url: "/icons/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/icons/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/icon-70x70.png", sizes: "70x70", type: "image/png" },
      { url: "/icons/favicon-96x96.png", sizes: "96x96", type: "image/png" }
    ],
    apple: [
      { url: "/icons/apple-touch-icon-57x57.png", sizes: "57x57", type: "image/png" },
      { url: "/icons/apple-touch-icon-60x60.png", sizes: "60x60", type: "image/png" },
      { url: "/icons/apple-touch-icon-72x72.png", sizes: "72x72", type: "image/png" },
      { url: "/icons/apple-touch-icon-76x76.png", sizes: "76x76", type: "image/png" }
    ]
  },
  openGraph: {
    title: "Hellcife Geek",
    description: "Loja geek com importados originais diretamente do Japao, Coreia e China.",
    url: "https://www.hellcifegeek.com",
    siteName: "Hellcife Geek",
    type: "website"
  },
  twitter: {
    card: "summary",
    title: "Hellcife Geek",
    description: "Loja geek com importados originais diretamente do Japao, Coreia e China."
  }
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Archivo+Black&family=Inter:wght@400;500;700;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
