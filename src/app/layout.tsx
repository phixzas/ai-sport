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

export const metadata: Metadata = {
  title: "SportSense AI | Sports Predictions",
  description: "Premium NBA and football match predictions.",
  metadataBase: new URL(
    process.env.RENDER_EXTERNAL_URL ?? "https://ai-sport-oml2.onrender.com",
  ),
  icons: {
    icon: [{ url: "/sportsense-ai-mark.svg", type: "image/svg+xml" }],
    apple: "/sportsense-ai-mark.svg",
  },
  openGraph: {
    type: "website",
    title: "SportSense AI | Sports Predictions",
    description: "Premium NBA and football match predictions.",
    images: [
      {
        url: "/sportsense-ai-logo.png",
        width: 1140,
        height: 200,
        alt: "SportSense AI",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SportSense AI | Sports Predictions",
    description: "Premium NBA and football match predictions.",
    images: [{ url: "/sportsense-ai-logo.png", alt: "SportSense AI" }],
  },
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
