import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "sonner";
import { WebVitalsInit } from "@/components/web-vitals-init";
import { PerformanceDashboard } from "@/components/performance-dashboard";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Humane Job Application",
  description: "Generate humane, privacy-safe candidate rejections with contextual feedback",
  manifest: "/manifest.json",
  themeColor: "#6366f1",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Humane Job",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <ClerkProvider>
      <html lang="en">
        <head>
          {/* PWA Meta Tags */}
          <link rel="icon" href="/favicon.ico" />
          <link rel="apple-touch-icon" href="/icons/icon-192x192.png" />
          <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
        </head>
        <body className={inter.className}>
          {/* Web Vitals Tracking */}
          <WebVitalsInit />

          {/* Toast Notifications */}
          <Toaster position="top-right" richColors />

          {/* Performance Dashboard (Development Only) */}
          {isDev && <PerformanceDashboard />}

          {children}
        </body>
      </html>
    </ClerkProvider>
  );
}
