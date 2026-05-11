import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "SoulLoop",
  description:
    "SoulLoop is a personalized symbolic reading experience inspired by Eastern wisdom.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}