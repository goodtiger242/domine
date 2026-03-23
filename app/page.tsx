import { LandingPage } from "@/app/components/domine/LandingPage";
import { getScheduleForUpcomingSunday } from "@/app/actions/liturgical";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { week_sunday, schedule } = await getScheduleForUpcomingSunday();
  return (
    <LandingPage
      weekSunday={week_sunday}
      liturgicalSchedule={schedule}
    />
  );
}
