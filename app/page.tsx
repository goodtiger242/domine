import { LandingPage } from "@/app/components/domine/LandingPage";
import { listLiturgicalInMonth } from "@/app/actions/liturgical";
import { getCurrentYearMonth } from "@/lib/date/month";
import { getTodayISO } from "@/lib/date/local";
import { pickNearestLiturgyDateKey } from "@/lib/liturgical/nearest";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { year, month } = getCurrentYearMonth();
  const schedules = await listLiturgicalInMonth(year, month);
  const today = getTodayISO();
  const highlightLiturgyDate =
    schedules.length > 0
      ? pickNearestLiturgyDateKey(schedules, today)
      : null;

  return (
    <LandingPage
      liturgicalYear={year}
      liturgicalMonth={month}
      liturgicalSchedules={schedules}
      highlightLiturgyDate={highlightLiturgyDate}
    />
  );
}
