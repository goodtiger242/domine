import Link from "next/link";
import { LiturgicalEditForm } from "./LiturgicalEditForm";
import {
  getScheduleForWeek,
  listWeeksFromDb,
} from "@/app/actions/liturgical";
import { generateNextSundays, getTargetSundayISO } from "@/lib/date/sunday";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "전례 봉사 편집 | 도미네",
  description: "주간 전례 봉사 배정을 입력·수정합니다.",
};

export default async function LiturgicalEditPage({
  searchParams,
}: {
  searchParams: Promise<{ week?: string }>;
}) {
  const sp = await searchParams;
  const week = sp.week ?? getTargetSundayISO();
  const schedule = await getScheduleForWeek(week);
  const dbWeeks = await listWeeksFromDb(32);
  const generated = generateNextSundays(14);
  const weekOptions = [
    ...new Set([...generated, ...dbWeeks, week]),
  ].sort();

  return (
    <div className="min-h-full bg-[#faf8f5] px-4 py-10 text-stone-900 dark:bg-stone-950 dark:text-stone-100">
      <div className="mx-auto max-w-2xl">
        <Link
          href="/"
          className="text-sm font-medium text-[#1a2f4a] underline underline-offset-2 dark:text-amber-200"
        >
          ← 메인으로
        </Link>
        <h1 className="mt-6 text-2xl font-semibold text-[#1a2f4a] dark:text-amber-50">
          전례 봉사 편집
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-stone-600 dark:text-stone-400">
          로그인 없이 누구나 수정할 수 있습니다. 주일을 고른 뒤 내용을 입력하고
          저장하면 메인 화면에 반영됩니다.
        </p>
        <LiturgicalEditForm
          key={`${week}-${schedule?.updated_at ?? "none"}`}
          weekSunday={week}
          initial={schedule}
          weekOptions={weekOptions}
        />
      </div>
    </div>
  );
}
