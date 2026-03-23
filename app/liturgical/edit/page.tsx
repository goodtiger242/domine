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
    <div className="min-h-full bg-gradient-to-b from-[#eef2ff] via-[#f8fafc] to-[#fff7ed] px-5 py-12 text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/"
          className="inline-flex text-sm font-semibold text-indigo-950 underline underline-offset-4 dark:text-amber-200"
        >
          ← 메인으로
        </Link>
        <h1 className="mt-8 text-3xl font-bold tracking-tight text-indigo-950 dark:text-amber-50">
          전례 봉사 편집
        </h1>
        <LiturgicalEditForm
          key={`${liturgyDate}-${schedule?.updated_at ?? "none"}`}
          liturgyDate={liturgyDate}
          initial={schedule}
        />
      </div>
    </div>
  );
}
