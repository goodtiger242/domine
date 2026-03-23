"use server";

import { createClient } from "@/lib/supabase/server";

export type SampleNoteRow = {
  id: string;
  content: string;
  created_at: string;
};

export async function saveSampleNote(content: string) {
  const trimmed = content.trim();
  if (!trimmed) {
    return { ok: false as const, error: "내용을 입력하세요." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("sample_notes")
    .insert({ content: trimmed });

  if (error) {
    return { ok: false as const, error: error.message };
  }
  return { ok: true as const };
}

export async function listSampleNotes() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("sample_notes")
    .select("id, content, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    return { ok: false as const, error: error.message, rows: [] as SampleNoteRow[] };
  }
  return { ok: true as const, rows: (data ?? []) as SampleNoteRow[] };
}
