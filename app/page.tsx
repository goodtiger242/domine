import { LandingPage } from "@/app/components/domine/LandingPage";
import { listLiturgicalFromDate } from "@/app/actions/liturgical";
import { getCurrentYearMonth } from "@/lib/date/month";
import { getTodayISO } from "@/lib/date/local";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { year, month } = getCurrentYearMonth();
  const today = getTodayISO();
  const all = await listLiturgicalFromDate("1970-01-01");
  const nextUpcomingLiturgyDate =
    all.find((r) => r.liturgy_date >= today)?.liturgy_date ?? null;

  return (
    <LandingPage
      liturgicalYear={year}
      liturgicalMonth={month}
      homeLiturgical={{ initialSchedules: all, nextUpcomingLiturgyDate }}
    />
  );
}
