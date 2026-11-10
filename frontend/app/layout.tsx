import type { Metadata } from "next";
import "./globals.css";
import { BrandHeader } from "@/components/brand-header";
import { AppFooter } from "@/components/app-footer";

export const metadata: Metadata = {
  title: "SPCS Bandar Lampung — Sistem Pengaduan Masyarakat Cerdas",
  description:
    "Portal Layanan Pengaduan Publik Kota Bandar Lampung berbasis cerdas dan transparan.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <body className="flex min-h-screen flex-col bg-[#f9f9ff] text-[#111c2c]">
        <BrandHeader />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6">
          {children}
        </main>
        <AppFooter />
      </body>
    </html>
  );
}

