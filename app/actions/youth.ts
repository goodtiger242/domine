"use server";

import { revalidatePath } from "next/cache";
import { createAnonServerClient } from "@/lib/supabase/anon-server";
import {
  feastDayDateOnly,
  getDefaultYouthProfiles,
  type YouthProfile,
} from "@/lib/constants/youth-profiles";
import { normalizeYouthNotes, normalizeYouthTalents } from "@/lib/domine/youth-fields";
import { YOUTH_MEMBERS } from "@/lib/constants/youth-members";

type YouthRow = {
  legal_name: string;
  birthday: string;
  feast_day: string;
  notes: string;
  talents: string;
  image_src: string | null;
};

const TABLE = "domine_youth_profiles";

const allowedLegal = new Set(YOUTH_MEMBERS.map((m) => m.legalName));

/** DB + 코드 기본값 병합 — 모두에게 동일한 목록 */
export async function listYouthProfilesMerged(): Promise<YouthProfile[]> {
  const defaults = getDefaultYouthProfiles();
  try {
    const supabase = createAnonServerClient();
    const { data, error } = await supabase.from(TABLE).select("*");

    if (error || !data?.length) {
      return defaults;
    }

    const byName = new Map<string, YouthRow>(
      (data as YouthRow[]).map((r) => [r.legal_name, r])
    );

    return defaults.map((d) => {
      const row = byName.get(d.legalName);
      if (!row) {
        return d;
      }
      return {
        ...d,
        birthday: row.birthday?.trim() || d.birthday,
        feastDay: feastDayDateOnly(row.feast_day || d.feastDay),
        notes: normalizeYouthNotes(row.notes ?? d.notes),
        talents: normalizeYouthTalents(row.talents ?? d.talents),
        imageSrc:
          row.image_src !== undefined && row.image_src !== null
            ? row.image_src.trim() || null
            : d.imageSrc,
      };
    });
  } catch {
    return defaults;
  }
}

export async function saveYouthProfiles(
  profiles: YouthProfile[]
): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    for (const p of profiles) {
      if (!allowedLegal.has(p.legalName)) {
        return { ok: false, error: "허용되지 않은 성명이 있습니다." };
      }
    }

    const rows = profiles.map((p) => ({
      legal_name: p.legalName,
      birthday: p.birthday.trim(),
      feast_day: feastDayDateOnly(p.feastDay),
      notes: normalizeYouthNotes(p.notes),
      talents: normalizeYouthTalents(p.talents),
      image_src: p.imageSrc?.trim() ? p.imageSrc.trim() : null,
      updated_at: new Date().toISOString(),
    }));

    const supabase = createAnonServerClient();
    const { error } = await supabase.from(TABLE).upsert(rows, {
      onConflict: "legal_name",
    });

    if (error) {
      console.error("saveYouthProfiles", error);
      return { ok: false, error: error.message };
    }

    revalidatePath("/youth");
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "저장 중 오류가 났습니다.";
    return { ok: false, error: msg };
  }
}
