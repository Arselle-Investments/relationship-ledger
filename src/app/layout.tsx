import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Arselle Relationship Ledger",
  description: "Contacts, outreach, tasks, and events for the Arselle team.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
