"use server";

import { createAnonServerClient } from "@/lib/supabase/anon-server";
import { getMonthRangeISO } from "@/lib/date/month";

export type DomineCalendarEvent = {
  id: string;
  event_date: string;
  title: string;
  body: string;
  updated_at: string;
};

export async function listCalendarEventsInMonth(
  year: number,
  month: number
): Promise<DomineCalendarEvent[]> {
  try {
    const { start, end } = getMonthRangeISO(year, month);
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("domine_calendar_events")
      .select("*")
      .gte("event_date", start)
      .lte("event_date", end)
      .order("event_date", { ascending: true });

    if (error || !data) {
      return [];
    }
    return data as DomineCalendarEvent[];
  } catch {
    return [];
  }
}

export async function insertCalendarEvent(input: {
  event_date: string;
  title: string;
  body: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createAnonServerClient();
    const { error } = await supabase.from("domine_calendar_events").insert({
      event_date: input.event_date,
      title: input.title.trim(),
      body: input.body,
      updated_at: new Date().toISOString(),
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장에 실패했습니다.";
    return { ok: false, error: msg };
  }
}

export async function deleteCalendarEvent(
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const supabase = createAnonServerClient();
    const { error } = await supabase
      .from("domine_calendar_events")
      .delete()
      .eq("id", id);

    if (error) {
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "삭제에 실패했습니다.";
    return { ok: false, error: msg };
  }
}
