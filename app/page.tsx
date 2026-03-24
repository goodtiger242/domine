import { LandingPage } from "@/app/components/domine/LandingPage";
import { listLiturgicalFromDate } from "@/app/actions/liturgical";
import { getCurrentYearMonth } from "@/lib/date/month";
import { getTodayISO } from "@/lib/date/local";
import {
  addDaysISO,
  buildMassEventKeys,
  pickDefaultMassDate,
} from "@/lib/liturgical/mass-timeline";
import { buildTodaySummaryPayload } from "@/lib/home/today-summary";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { year, month } = getCurrentYearMonth();
  const today = getTodayISO();
  const horizonEnd = addDaysISO(today, 180);
  const upcomingRows = await listLiturgicalFromDate(today);
  const dbDates = upcomingRows.map((r) => r.liturgy_date);
  const schedulesByDate = Object.fromEntries(
    upcomingRows.map((r) => [r.liturgy_date, r])
  );
  const eventKeys = buildMassEventKeys(today, dbDates, horizonEnd);
  const defaultDate = pickDefaultMassDate(today, dbDates);
  let initialIndex = eventKeys.indexOf(defaultDate);
  if (initialIndex < 0) {
    initialIndex = 0;
  }

  const scheduleForDefault = schedulesByDate[defaultDate] ?? null;
  const todaySummary = buildTodaySummaryPayload(
    defaultDate,
    scheduleForDefault,
    scheduleForDefault === null
  );

  return (
    <LandingPage
      liturgicalYear={year}
      liturgicalMonth={month}
      homeSpotlight={{
        eventKeys,
        schedulesByDate,
        initialIndex,
      }}
      todaySummary={todaySummary}
    />
  );
}
