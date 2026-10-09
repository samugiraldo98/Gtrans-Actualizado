import type { Metadata } from "next";
import "./globals.css";
import "./gtrans.css";

export const metadata: Metadata = {
  title: "Gtrans · Gestión de transportes",
  description: "Clientes, despachos, transportadores y documentos en un solo lugar.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="antialiased">{children}</body>
    </html>
  );
}
