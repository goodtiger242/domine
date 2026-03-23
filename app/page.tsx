import { LandingPage } from "@/app/components/domine/LandingPage";
import { listLiturgicalInMonth } from "@/app/actions/liturgical";
import { getCurrentYearMonth } from "@/lib/date/month";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { year, month } = getCurrentYearMonth();
  const schedules = await listLiturgicalInMonth(year, month);

  return (
    <LandingPage
      liturgicalYear={year}
      liturgicalMonth={month}
      liturgicalSchedules={schedules}
    />
  );
}
