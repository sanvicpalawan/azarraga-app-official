import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Azarraga Glass & Aluminum Quotations",
  description: "Configure glass and aluminum products and create professional quotations.",
  other: {
    "codex-preview": "azarraga-quotations",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
