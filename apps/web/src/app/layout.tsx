import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const appName = process.env.NEXT_PUBLIC_APP_NAME ?? "Affiliate Autopilot";

export const metadata: Metadata = {
  title: {
    default: `${appName} — AI Marketing OS for Affiliate Marketers`,
    template: `%s · ${appName}`,
  },
  description:
    "Research → content → video → publish → DM → optimize. Your affiliate marketing team, running 24/7 on autopilot.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
