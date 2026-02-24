import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { AppProviders } from "@/components/app-providers";
import { AppNav } from "@/components/app-nav";

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'متتبع العملاء', // Updated App Name in Arabic
  description: 'تتبع العملاء والمشاريع والمدفوعات.', // Updated Description in Arabic
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl">{/* Set lang to ar and dir to rtl */}
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AppProviders>
          <AppNav />
          <main className="min-h-screen container py-6">{children}</main>
          <Toaster />
        </AppProviders> {/* Add Toaster component here */}
      </body>
    </html>
  );
}
