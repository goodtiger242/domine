import type { LiturgicalSchedule } from "@/app/actions/liturgical";
import { parseAnnouncementDetail } from "@/lib/liturgical/announcement-parse";

export function formatLiturgyDateLong(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("ko-KR", {
    year: "numeric",
    month: "long",
    day: "numeric",
    weekday: "long",
  });
}

export type TodaySummaryPayload = {
  dateLabel: string;
  massTitle: string;
  highlights: string[];
  noticeSnippet: string | null;
  defaultDateISO: string;
};

const NOTICE_MAX = 110;

export function buildTodaySummaryPayload(
  defaultDateISO: string,
  schedule: LiturgicalSchedule | null,
  isSynthetic: boolean
): TodaySummaryPayload {
  const dateLabel = formatLiturgyDateLong(defaultDateISO);
  const { timeline, notice } = schedule
    ? parseAnnouncementDetail(schedule.announcement_detail)
    : { timeline: [], notice: "" };

  let massTitle = schedule?.title?.trim() ?? "";
  if (!massTitle) {
    massTitle = isSynthetic
      ? "다가오는 미사 (일정 등록 전)"
      : "미사";
  }

  let highlights: string[] = [];
  if (timeline.length > 0) {
    highlights = timeline
      .slice(0, 2)
      .map((t) =>
        t.label ? `${t.time} · ${t.label}` : t.time
      );
  } else if (schedule?.announcement_detail?.trim()) {
    const lines = schedule.announcement_detail
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);
    highlights = lines.slice(0, 2);
  }

  let noticeSnippet: string | null = null;
  if (notice.length > 0) {
    noticeSnippet =
      notice.length > NOTICE_MAX
        ? `${notice.slice(0, NOTICE_MAX).trim()}…`
        : notice;
  }

  return {
    dateLabel,
    massTitle,
    highlights,
    noticeSnippet,
    defaultDateISO,
  };
}
