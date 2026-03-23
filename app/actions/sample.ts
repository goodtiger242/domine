"use server";

import { createAnonServerClient } from "@/lib/supabase/anon-server";

export type SampleNoteRow = {
  id: string;
  content: string;
  created_at: string;
};

export async function saveSampleNote(content: string) {
  try {
    const trimmed = content.trim();
    if (!trimmed) {
      return { ok: false as const, error: "내용을 입력하세요." };
    }

    const supabase = createAnonServerClient();
    const { error } = await supabase
      .from("sample_notes")
      .insert({ content: trimmed });

    if (error) {
      return { ok: false as const, error: error.message };
    }
    return { ok: true as const };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장 중 오류가 났습니다.";
    return { ok: false as const, error: msg };
  }
}

export async function listSampleNotes() {
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase
      .from("sample_notes")
      .select("id, content, created_at")
      .order("created_at", { ascending: false });

    if (error) {
      return { ok: false as const, error: error.message, rows: [] as SampleNoteRow[] };
    }
    return { ok: true as const, rows: (data ?? []) as SampleNoteRow[] };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "불러오기 중 오류가 났습니다.";
    return { ok: false as const, error: msg, rows: [] as SampleNoteRow[] };
  }
}
