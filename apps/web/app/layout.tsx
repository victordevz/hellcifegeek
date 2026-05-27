import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Hellcife Geek",
  description: "Loja geek com importados originais diretamente do Japao, Coreia e China.",
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
