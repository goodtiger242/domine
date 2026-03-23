import Link from "next/link";
import { LiturgicalEditForm } from "./LiturgicalEditForm";
import { getScheduleForDate } from "@/app/actions/liturgical";
import { getTodayISO } from "@/lib/date/local";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "전례 봉사 편집 | 도미네",
  description: "미사 날짜별 전례 봉사 배정을 입력·수정합니다.",
};

export default async function LiturgicalEditPage({
  searchParams,
}: {
  searchParams: Promise<{ date?: string }>;
}) {
  const sp = await searchParams;
  const liturgyDate = sp.date ?? getTodayISO();
  const schedule = await getScheduleForDate(liturgyDate);

  return (
    <div className="min-h-full bg-gradient-to-b from-[#faf8f5] to-[#f0ebe3] px-4 py-10 text-stone-900 dark:from-stone-950 dark:to-stone-900 dark:text-stone-100">
      <div className="mx-auto max-w-4xl">
        <Link
          href="/"
          className="inline-flex text-sm font-medium text-[#1a2f4a] underline underline-offset-2 dark:text-amber-200"
        >
          ← 메인으로
        </Link>
        <h1 className="mt-6 text-2xl font-semibold tracking-tight text-[#1a2f4a] dark:text-amber-50">
          전례 봉사 편집
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          달력에서 미사 날짜를 고른 뒤 내용을 입력하고 저장하세요. 로그인 없이
          누구나 수정할 수 있습니다.
        </p>
        <LiturgicalEditForm
          key={`${liturgyDate}-${schedule?.updated_at ?? "none"}`}
          liturgyDate={liturgyDate}
          initial={schedule}
        />
      </div>
    </div>
  );
}
