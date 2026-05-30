import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "MANAJER.PK // Enterprise Infrastructure Intake Hub",
  description: "Secure, high-fidelity lead ingestion and infrastructure qualification protocol for next-generation retail systems.",
  metadataBase: new URL("https://manajer.pk"),
  openGraph: {
    title: "MANAJER.PK // Onboarding & Intake",
    description: "Submit operational telemetry and schedule your enterprise integration handshake.",
    images: ["/logo.webp"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} h-full antialiased scroll-smooth`}
    >
      <body className={`${inter.variable} min-h-full flex flex-col text-gray-100 font-sans selection:bg-blue-500/30 selection:text-blue-200`}>
        {children}
      </body>
    </html>
  );
}
