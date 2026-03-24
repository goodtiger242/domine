/** 공지/안내 본문에서 시간 줄과 나머지 문장을 분리 */

export type TimelineEntry = {
  time: string;
  label: string;
};

export function parseAnnouncementDetail(text: string): {
  timeline: TimelineEntry[];
  notice: string;
} {
  const raw = text.trim();
  if (!raw) {
    return { timeline: [], notice: "" };
  }
  const lines = raw
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);
  const timeline: TimelineEntry[] = [];
  const other: string[] = [];
  const timeRe = /^(\d{1,2}:\d{2})\s*(.*)$/;

  for (const line of lines) {
    const m = line.match(timeRe);
    if (m) {
      timeline.push({
        time: m[1],
        label: (m[2] ?? "").trim() || "일정",
      });
    } else {
      other.push(line);
    }
  }

  return { timeline, notice: other.join(" ").trim() };
}
