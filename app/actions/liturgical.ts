"use server";

import { createAnonServerClient } from "@/lib/supabase/anon-server";
import { getTodayISO } from "@/lib/date/local";

export type LiturgicalSchedule = {
  liturgy_date: string;
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

export async function getScheduleForDate(
  liturgyDateISO: string
): Promise<LiturgicalSchedule | null> {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("liturgical_weekly_schedule")
      .select("*")
      .eq("liturgy_date", liturgyDateISO)
      .maybeSingle();

    if (error) {
      console.error("getScheduleForDate", error);
      return null;
    }
    return data as LiturgicalSchedule | null;
  } catch {
    return null;
  }
}

/** 메인: 오늘 이후 가장 가까운 미사 → 없으면 가장 최근 과거 */
export async function getScheduleForMainDisplay(): Promise<{
  liturgy_date: string;
  schedule: LiturgicalSchedule | null;
}> {
  try {
    const supabase = createAnonServerClient();
    const today = getTodayISO();

    const { data: future } = await supabase
      .from("liturgical_weekly_schedule")
      .select("*")
      .gte("liturgy_date", today)
      .order("liturgy_date", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (future) {
      return {
        liturgy_date: future.liturgy_date,
        schedule: future as LiturgicalSchedule,
      };
    }

    const { data: past } = await supabase
      .from("liturgical_weekly_schedule")
      .select("*")
      .order("liturgy_date", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (past) {
      return {
        liturgy_date: past.liturgy_date,
        schedule: past as LiturgicalSchedule,
      };
    }

    return { liturgy_date: today, schedule: null };
  } catch {
    return { liturgy_date: getTodayISO(), schedule: null };
  }
}

export async function listLiturgyDatesFromDb(limit = 32): Promise<string[]> {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("liturgical_weekly_schedule")
      .select("liturgy_date")
      .order("liturgy_date", { ascending: false })
      .limit(limit);

    if (error || !data) {
      return [];
    }
    return data.map((r) => r.liturgy_date as string);
  } catch {
    return [];
  }
}

export type UpsertLiturgicalInput = {
  liturgy_date: string;
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
    const supabase = createAnonServerClient();
    const row = {
      liturgy_date: input.liturgy_date,
      title: input.title.trim(),
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
      .upsert(row, { onConflict: "liturgy_date" });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, error: msg };
  }
}
