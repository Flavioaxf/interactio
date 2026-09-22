import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "interactio", 
  description: "Participe da apresentação interativa em tempo real.",
  icons: {
    icon: "/logo.png?v=2",
    apple: "/logo.png?v=2",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body className="font-sans antialiased">
        {children}
      </body>
    </html>
  );
}