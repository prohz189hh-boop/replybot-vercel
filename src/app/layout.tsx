import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ReplyPilot",
  description: "AI customer support trained on your business.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="font-sans antialiased">{children}</body>
    </html>
  );
}
