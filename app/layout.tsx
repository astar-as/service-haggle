import type { Metadata } from "next";
import { Host_Grotesk } from "next/font/google";
import "./globals.css";

const host = Host_Grotesk({
  variable: "--font-host",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Lowball",
  description: "A personal agent that keeps your insurance fair.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className={host.variable}>{children}</body>
    </html>
  );
}
