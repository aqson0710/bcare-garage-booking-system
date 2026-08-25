import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}

