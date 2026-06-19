import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Kuhula Finance | Planeador Financeiro MZ & IA",
  description: "Planeamento financeiro inteligente para Moçambique com assessoria de IA integrada.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="pt-MZ"
      className="h-full antialiased dark"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
