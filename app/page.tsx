import { LandingPage } from "@/app/components/domine/LandingPage";
import {
  listLiturgicalFromDate,
  listLiturgicalInMonth,
} from "@/app/actions/liturgical";
import { getCurrentYearMonth } from "@/lib/date/month";
import { getTodayISO } from "@/lib/date/local";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { year, month } = getCurrentYearMonth();
  const today = getTodayISO();
  const initialSchedules = await listLiturgicalInMonth(year, month);
  const upcomingFirst = await listLiturgicalFromDate(today, { limit: 1 });
  const nextUpcomingLiturgyDate = upcomingFirst[0]?.liturgy_date ?? null;

  return (
    <LandingPage
      liturgicalYear={year}
      liturgicalMonth={month}
      homeLiturgical={{
        initialSchedules,
        nextUpcomingLiturgyDate,
      }}
    />
  );
}
