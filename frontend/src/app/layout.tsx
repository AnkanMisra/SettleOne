import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Providers } from "@/components/Providers";
import { Toaster } from "react-hot-toast";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "SettleOne - Review payments, settle one Arc batch",
  description: "Prepare contractor payments with wallet sign-in, exact preview, human approval, and Arc Testnet USDC settlement.",
  keywords: ["USDC", "ENS", "Arc", "payments", "Ethereum"],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#060611] text-white min-h-screen noise`}
      >
        <Providers>
          {children}
          <Toaster
            position="bottom-right"
            toastOptions={{
              style: {
                background: 'rgba(15, 15, 26, 0.9)',
                color: '#e8e8f0',
                border: '1px solid rgba(99, 102, 241, 0.15)',
                borderRadius: '12px',
                backdropFilter: 'blur(16px)',
                fontSize: '14px',
              },
              success: {
                iconTheme: {
                  primary: '#6366f1',
                  secondary: '#e8e8f0',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#e8e8f0',
                },
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
