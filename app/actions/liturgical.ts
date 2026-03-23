"use server";

import { createAnonServerClient } from "@/lib/supabase/anon-server";
import { getMonthRangeISO } from "@/lib/date/month";
import { hasLiturgicalContent } from "@/lib/liturgical/content";

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

/** 해당 월에 DB에 있고, 내용이 하나라도 있는 미사만 (날짜 오름차순) */
export async function listLiturgicalInMonth(
  year: number,
  month: number
): Promise<LiturgicalSchedule[]> {
  try {
    const { start, end } = getMonthRangeISO(year, month);
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("liturgical_weekly_schedule")
      .select("*")
      .gte("liturgy_date", start)
      .lte("liturgy_date", end)
      .order("liturgy_date", { ascending: true });

    if (error || !data) {
      return [];
    }
    return (data as LiturgicalSchedule[]).filter(hasLiturgicalContent);
  } catch {
    return [];
  }
}

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
