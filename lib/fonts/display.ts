import { Noto_Serif_KR } from "next/font/google";

/**
 * 제목·로고용 — 클래식 리터지컬 톤(양피지·미사 책 연상)
 */
export const litDisplay = Noto_Serif_KR({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-lit-display",
});
