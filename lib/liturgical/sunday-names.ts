/**
 * 모든 연도의 주일 전례일 이름을 계산한다 (표기는 한국천주교주교회의 매일미사 missa.cbck.or.kr 기준).
 * color: 녹 연중 / 백 / 자 / 홍.
 * shortcut: 설날·추석처럼 음력으로 주일과 겹치는 경우는 반영하지 않고 연중 주일로 나옴.
 */
type Liturgy = { color: string; name: string };

const DAY = 86400000;
const ms = (iso: string) => Date.parse(`${iso}T00:00:00Z`);
const iso = (t: number) => new Date(t).toISOString().slice(0, 10);

function easterMs(y: number): number {
  const a = y % 19;
  const b = Math.floor(y / 100);
  const c = y % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return Date.UTC(y, month - 1, day);
}

/** 대림 제1주일: 12월 24일 이전(포함) 마지막 일요일의 3주 전 */
function advent1Ms(y: number): number {
  const dec24 = Date.UTC(y, 11, 24);
  const dow = new Date(dec24).getUTCDay();
  return dec24 - dow * DAY - 21 * DAY;
}

/** 연중 주일이 대축일·축일에 밀리는 날 (월-일) */
const FIXED_OVER_ORDINARY: Record<string, Liturgy> = {
  "02-02": { color: "백", name: "주님 봉헌 축일" },
  "06-24": { color: "백", name: "성 요한 세례자 탄생 대축일" },
  "06-29": { color: "홍", name: "성 베드로와 성 바오로 사도 대축일" },
  "07-05": { color: "홍", name: "한국 성직자들의 수호자 성 김대건 안드레아 사제 순교자" },
  "08-06": { color: "백", name: "주님의 거룩한 변모 축일" },
  "08-15": { color: "백", name: "성모 승천 대축일" },
  "09-20": { color: "홍", name: "성 김대건 안드레아 사제와 성 정하상 바오로와 동료 순교자들 대축일" },
  "09-14": { color: "홍", name: "성 십자가 현양 축일" },
  "11-01": { color: "백", name: "모든 성인 대축일" },
  "11-02": { color: "자", name: "죽은 모든 이를 기억하는 위령의 날" },
  "11-09": { color: "백", name: "라테라노 대성전 봉헌 축일" },
};

export function getSundayLiturgy(dateISO: string): Liturgy | null {
  const t = ms(dateISO);
  if (Number.isNaN(t) || new Date(t).getUTCDay() !== 0) {
    return null;
  }
  const y = new Date(t).getUTCFullYear();
  const md = dateISO.slice(5);
  const easter = easterMs(y);
  const weeks = (from: number) => Math.round((t - from) / (7 * DAY));

  if (md === "12-25") return { color: "백", name: "주님 성탄 대축일" };
  if (md === "01-01") return { color: "백", name: "천주의 성모 마리아 대축일" };

  const advent1 = advent1Ms(y);
  if (t >= advent1 && t < advent1 + 28 * DAY) {
    return { color: "자", name: `대림 제${weeks(advent1) + 1}주일` };
  }
  const mm = Number(md.slice(0, 2));
  const dd = Number(md.slice(3));
  if (mm === 12 && dd >= 26) {
    return { color: "백", name: "예수, 마리아, 요셉의 성가정 축일" };
  }
  if (mm === 1 && dd >= 2 && dd <= 8) {
    return { color: "백", name: "주님 공현 대축일" };
  }

  // 주님 세례 축일: 공현 다음 일요일 (공현이 7·8일이면 월요일이라 일요일이 아님)
  const jan = (d: number) => Date.UTC(y, 0, d);
  const epiphanyDay = [2, 3, 4, 5, 6, 7, 8].find(
    (d) => new Date(jan(d)).getUTCDay() === 0
  )!;
  const baptism = jan(epiphanyDay) + 7 * DAY;
  if (t === baptism && epiphanyDay <= 6) {
    return { color: "백", name: "주님 세례 축일" };
  }

  const ash = easter - 46 * DAY;
  const christKing = advent1 - 7 * DAY;
  if (t > baptism - 1 && t < ash) {
    // 공현이 7·8일이면 세례 축일이 월요일이라 그 다음 일요일이 연중 제2주일
    return ordinary(md, `연중 제${weeks(baptism) + 1 + (epiphanyDay > 6 ? 1 : 0)}주일`);
  }
  if (t > ash && t < easter - 7 * DAY) {
    return { color: "자", name: `사순 제${weeks(easter - 42 * DAY) + 1}주일` };
  }
  if (t === easter - 7 * DAY) return { color: "홍", name: "주님 수난 성지 주일" };
  if (t === easter) return { color: "백", name: "주님 부활 대축일 - 파스카 성야" };
  if (t === easter + 7 * DAY) {
    return { color: "백", name: "부활 제2주일 곧, 하느님의 자비 주일" };
  }
  if (t > easter && t < easter + 42 * DAY + 1) {
    return t === easter + 42 * DAY
      ? { color: "백", name: "주님 승천 대축일" }
      : { color: "백", name: `부활 제${weeks(easter) + 1}주일` };
  }
  if (t === easter + 49 * DAY) return { color: "홍", name: "성령 강림 대축일" };
  if (t === easter + 56 * DAY) {
    return { color: "백", name: "지극히 거룩하신 삼위일체 대축일" };
  }
  if (t === easter + 63 * DAY) {
    return { color: "백", name: "지극히 거룩하신 그리스도의 성체 성혈 대축일" };
  }
  if (t === christKing) {
    return { color: "백", name: "온 누리의 임금이신 우리 주 예수 그리스도 왕 대축일" };
  }
  return ordinary(md, `연중 제${34 - Math.round((christKing - t) / (7 * DAY))}주일`);
}

function ordinary(md: string, name: string): Liturgy {
  return FIXED_OVER_ORDINARY[md] ?? { color: "녹", name };
}

/** 확인용: 해당 연도의 모든 일요일 */
export function listSundayLiturgies(year: number) {
  const out: { date: string; color: string; name: string }[] = [];
  for (let t = Date.UTC(year, 0, 1); new Date(t).getUTCFullYear() === year; t += DAY) {
    const l = getSundayLiturgy(iso(t));
    if (l) out.push({ date: iso(t), ...l });
  }
  return out;
}
