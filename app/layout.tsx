import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Goborr Match Dashboard",
  description: "Run the EPL prediction model and review gameweek outcomes in a dashboard."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
