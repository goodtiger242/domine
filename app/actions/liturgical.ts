"use server";

import { createAnonServerClient } from "@/lib/supabase/anon-server";
import { getTargetSundayISO, normalizeToSundayISO } from "@/lib/date/sunday";

export type LiturgicalSchedule = {
  week_sunday: string;
  title: string;
  announcement_detail: string;
  role_commentator: string;
  role_reader_1: string;
  role_reader_2: string;
  role_gospel_acclamation: string;
  thurifer_main: string;
  thurifer_sub: string;
  conductor: string;
  organist: string;
  updated_at: string;
};

export async function getScheduleForWeek(weekSundayISO: string): Promise<LiturgicalSchedule | null> {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("liturgical_weekly_schedule")
      .select("*")
      .eq("week_sunday", weekSundayISO)
      .maybeSingle();

    if (error) {
      console.error("getScheduleForWeek", error);
      return null;
    }
    return data as LiturgicalSchedule | null;
  } catch {
    return null;
  }
}

/** 메인: 다가오는 주일(포함) 기준 한 행 */
export async function getScheduleForUpcomingSunday(): Promise<{
  week_sunday: string;
  schedule: LiturgicalSchedule | null;
}> {
  const week = getTargetSundayISO();
  const schedule = await getScheduleForWeek(week);
  return { week_sunday: week, schedule };
}

export async function listWeeksFromDb(limit = 24): Promise<string[]> {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("liturgical_weekly_schedule")
      .select("week_sunday")
      .order("week_sunday", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data.map((r) => r.week_sunday as string);
  } catch {
    return [];
  }
}

export type UpsertLiturgicalInput = {
  week_sunday: string;
  title: string;
  announcement_detail: string;
  role_commentator: string;
  role_reader_1: string;
  role_reader_2: string;
  role_gospel_acclamation: string;
  thurifer_main: string;
  thurifer_sub: string;
  conductor: string;
  organist: string;
};

export async function upsertLiturgicalSchedule(
  input: UpsertLiturgicalInput
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const weekSunday = normalizeToSundayISO(input.week_sunday);
    const supabase = createAnonServerClient();
    const row = {
      week_sunday: weekSunday,
      title: input.title,
      announcement_detail: input.announcement_detail,
      role_commentator: input.role_commentator,
      role_reader_1: input.role_reader_1,
      role_reader_2: input.role_reader_2,
      role_gospel_acclamation: input.role_gospel_acclamation,
      thurifer_main: input.thurifer_main,
      thurifer_sub: input.thurifer_sub,
      conductor: input.conductor,
      organist: input.organist,
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase
      .from("liturgical_weekly_schedule")
      .upsert(row, { onConflict: "week_sunday" });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, error: msg };
  }
}
