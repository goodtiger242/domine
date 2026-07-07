import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_KR } from "next/font/google";
import { litDisplay } from "@/lib/fonts/display";
import "./globals.css";

const notoSansKr = Noto_Sans_KR({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL
  ? `https://${process.env.NEXT_PUBLIC_SITE_URL.replace(/^https?:\/\//, "")}`
  : "https://domine-eight.vercel.app";

const socialImage = "/image/domine_logo.jpg";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "도미네 | 용호성당 청년회",
  description:
    "용호성당 청년회 도미네(Domine) — 천주교 신앙 안에서 함께 걷는 청년 공동체입니다.",
  openGraph: {
    title: "도미네 | 용호성당 청년회",
    description:
      "용호성당 청년회 도미네(Domine) — 천주교 신앙 안에서 함께 걷는 청년 공동체입니다.",
    images: [
      {
        url: socialImage,
        width: 960,
        height: 716,
        type: "image/jpeg",
        alt: "도미네 로고",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "도미네 | 용호성당 청년회",
    description:
      "용호성당 청년회 도미네(Domine) — 천주교 신앙 안에서 함께 걷는 청년 공동체입니다.",
    images: [socialImage],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ko"
      className={`${notoSansKr.variable} ${geistMono.variable} ${litDisplay.variable} h-full antialiased`}
    >
      <body className="flex min-h-dvh min-h-full flex-col font-sans [padding-left:env(safe-area-inset-left)] [padding-right:env(safe-area-inset-right)]">
        {children}
      </body>
    </html>
  );
}
