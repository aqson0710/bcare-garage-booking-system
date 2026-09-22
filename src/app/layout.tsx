import type { Metadata } from "next";
import { Prompt } from "next/font/google";
import "./globals.css";

// Prompt: a rounded, geometric Thai/Latin Google Font - matches the bold,
// friendly heading style the shop asked to match, and reads cleanly at both
// the small body-text sizes and the large font-black headings already used
// across the site.
const prompt = Prompt({
  display: "swap",
  subsets: ["thai", "latin"],
  variable: "--font-prompt",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "BCare | BigO-RepairCar",
  description: "Garage booking system for BigO-RepairCar",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html className={prompt.variable} lang="th">
      <body>{children}</body>
    </html>
  );
}

