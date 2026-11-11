import type { Metadata, Viewport } from "next";
import { Fraunces, Inter } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

const fraunces = Fraunces({
  variable: "--font-display",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "SCPB Commercial",
    template: "%s · SCPB Commercial",
  },
  description: "Prospection commerciale B2B de la filière cacao : ciblage, rédaction assistée et suivi des campagnes.",
  applicationName: "SCPB Commercial",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#F8F3EA" },
    { media: "(prefers-color-scheme: dark)", color: "#1F2510" },
  ],
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className={`${inter.variable} ${fraunces.variable} h-full antialiased`} suppressHydrationWarning>
      <body className="flex min-h-full flex-col">
        <ThemeProvider>
          {children}
          <Toaster richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
