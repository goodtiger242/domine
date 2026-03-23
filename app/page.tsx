import { LandingPage } from "@/app/components/domine/LandingPage";
import { getScheduleForMainDisplay } from "@/app/actions/liturgical";

export const dynamic = "force-dynamic";

export default async function Home() {
  const { liturgy_date, schedule } = await getScheduleForMainDisplay();
  return (
    <LandingPage liturgyDate={liturgy_date} liturgicalSchedule={schedule} />
  );
}
