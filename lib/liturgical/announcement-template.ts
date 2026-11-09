import { FIXED_CONDUCTOR_NAME } from "@/lib/constants/liturgical";
import { formatYouthMemberDisplay } from "@/lib/constants/youth-members";
import { getSundayLiturgy } from "@/lib/liturgical/sunday-names";

type Roles = {
  liturgy_date: string;
  role_commentator: string;
  role_reader_1: string;
  role_reader_2: string;
  role_gospel_acclamation: string;
  thurifer_main: string;
  thurifer_sub: string;
  organist: string;
};

/**
 * 카드 제목 (날짜·미사 이름이 한 번만 나오도록): 📌11월 15일 연중 제33주일 미사 📌
 * 저장된 제목이 있으면 쓰되 날짜가 없으면 앞에 붙이고, 앞뒤 📌는 항상 맞춘다.
 */
export function buildAnnouncementTitle(dateISO: string, stored = ""): string {
  const [, m, d] = dateISO.split("-").map(Number);
  const dateStr = `${m}월 ${d}일`;
  const custom = stored.replace(/📌/g, "").trim();
  let bare: string;
  if (custom) {
    const hasDate = new RegExp(`(?<!\\d)${m}월\\s*${d}일`).test(custom);
    bare = hasDate ? custom : `${dateStr} ${custom}`;
  } else {
    const name = getSundayLiturgy(dateISO)?.name;
    bare = `${name ? `${dateStr} ${name}` : dateStr} 미사`;
  }
  return `📌${bare} 📌`;
}

/** 추가 안내를 비워 두면 담당자로 만드는 기본 안내문 (📌 제목 / 🙏 구역 / 📍 담당) */
export function defaultAnnouncementDetail(r: Roles): string {
  const line = (label: string, v: string, colon = true) => {
    const t = v.trim();
    return t ? `📍${colon ? `${label} : ` : ""}${formatYouthMemberDisplay(t)}` : null;
  };
  const block = (title: string, lines: (string | null)[]) => {
    const body = lines.filter((l): l is string => l !== null);
    return body.length ? [`🙏${title}🙏`, ...body].join("\n") : null;
  };
  return [
    block("전례", [
      line("해설", r.role_commentator),
      line("1독", r.role_reader_1),
      line("2독", r.role_reader_2),
    ]),
    block("복사", [
      line("", r.thurifer_main, false),
      line("", r.thurifer_sub, false),
    ]),
    block("지휘/반주/복음환호송", [
      `📍${FIXED_CONDUCTOR_NAME}`,
      line("", r.organist, false),
      line("", r.role_gospel_acclamation, false),
    ]),
  ]
    .filter((b): b is string => b !== null)
    .join("\n\n");
}
