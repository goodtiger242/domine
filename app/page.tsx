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
  const currentMonthRows = await listLiturgicalInMonth(year, month);
  const hasRemainingThisMonth = currentMonthRows.some(
    (r) => r.liturgy_date >= today
  );
  const upcomingFirst = await listLiturgicalFromDate(today, { limit: 1 });
  const nextUpcomingLiturgyDate = upcomingFirst[0]?.liturgy_date ?? null;

  let displayYear = year;
  let displayMonth = month;
  let initialSchedules = currentMonthRows;

  if (!hasRemainingThisMonth) {
    const nextDate = nextUpcomingLiturgyDate;
    if (nextDate) {
      const [yStr, mStr] = nextDate.split("-");
      displayYear = Number.parseInt(yStr!, 10);
      displayMonth = Number.parseInt(mStr!, 10);
      initialSchedules = await listLiturgicalInMonth(displayYear, displayMonth);
    } else {
      initialSchedules = [];
    }
  }

  return (
    <LandingPage
      liturgicalYear={displayYear}
      liturgicalMonth={displayMonth}
      homeLiturgical={{
        initialSchedules,
        nextUpcomingLiturgyDate,
      }}
    />
  );
}
