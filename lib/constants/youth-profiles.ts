import { YOUTH_MEMBERS } from "@/lib/constants/youth-members";

/** 청년회 멤버 프로필 (생일·축일·특기·장기·사진 경로) */
export type YouthProfile = {
  legalName: string;
  baptismalNameKo: string;
  /** 예: "3월 15일" 또는 "03-15" */
  birthday: string;
  /** 세례명자 축일 등 */
  feastDay: string;
  /** 특기·잡담 */
  notes: string;
  /** 장기·취미 */
  talents: string;
  /** public 기준 경로. 없으면 플레이스홀더 */
  imageSrc: string | null;
};

/** 샘플(재미용) — 실제 값으로 바꿔 쓰면 됩니다 */
const SAMPLE: Record<
  string,
  Omit<YouthProfile, "legalName" | "baptismalNameKo">
> = {
  김경석: {
    birthday: "1월 4일",
    feastDay: "성 바실리오 대축일 (1/2)",
    notes: "새벽 기상은 내일부터",
    talents: "장기: 커피 향 맡기",
    imageSrc: null,
  },
  김보영: {
    birthday: "7월 22일",
    feastDay: "성 마리아 막달레나",
    notes: "특기: 회의록 정리 속도 1위",
    talents: "장기: 노래방 점수 안 봄",
    imageSrc: null,
  },
  김슬기: {
    birthday: "11월 3일",
    feastDay: "묵주 기도의 성모",
    notes: "특기: 분위기 메이커",
    talents: "장기: 사진 찍히는 척하기",
    imageSrc: null,
  },
  김윤서: {
    birthday: "4월 18일",
    feastDay: "성 안셀모",
    notes: "특기: 지각 0회(목표)",
    talents: "장기: 지도 앱 믿기",
    imageSrc: null,
  },
  김지우: {
    birthday: "6월 13일",
    feastDay: "성 안토니오 드 파두아",
    notes: "특기: 이름표 두 개 달고 다닌 적 있음",
    talents: "장기: 피자 엣지 남기기",
    imageSrc: null,
  },
  김혜수: {
    birthday: "9월 9일",
    feastDay: "성 베드로 클라베르",
    notes: "특기: 웃음 소리가 길다",
    talents: "장기: 강의실 맨 앞줄",
    imageSrc: null,
  },
  도화정: {
    birthday: "2월 28일",
    feastDay: "성 로마노",
    notes: "특기: 달력 윤년 체크 담당",
    talents: "장기: 따뜻한 차 권하기",
    imageSrc: null,
  },
  성현: {
    birthday: "7월 3일",
    feastDay: "성 토마스 사도",
    notes: "특기: “잠깐만”의 달인",
    talents: "장기: 멀티태스킹(하는 척)",
    imageSrc: null,
  },
  안제오: {
    birthday: "10월 18일",
    feastDay: "성 루카 복음사가",
    notes: "특기: 지휘봉 대신 연필",
    talents: "장기: 악보 넘기기 타이밍",
    imageSrc: null,
  },
  유이진: {
    birthday: "12월 25일",
    feastDay: "성탄 대축일(본인 인정)",
    notes: "특기: 케이크 촛불 불기 담당",
    talents: "장기: 캐롤 한 소절",
    imageSrc: null,
  },
  유태원: {
    birthday: "5월 5일",
    feastDay: "어린이날(?) + 성 십자가",
    notes: "특기: 어깨 으쓱",
    talents: "장기: 단체 사진 맨 뒤",
    imageSrc: null,
  },
  이승원: {
    birthday: "8월 8일",
    feastDay: "성 도미니코",
    notes: "특기: 빈첸시오 느낌 살리기",
    talents: "장기: 박수 박자 맞추기",
    imageSrc: null,
  },
  이정우: {
    birthday: "11월 30일",
    feastDay: "성 안드레아 사도",
    notes: "특기: “형/누나” 호칭 정착",
    talents: "장기: 피크닉 돗자리",
    imageSrc: null,
  },
  이제창: {
    birthday: "3월 7일",
    feastDay: "성 토마스 아퀴나스(기념)",
    notes: "특기: 토마스 동명이인 2명 중 한 명",
    talents: "장기: 질문 세 번까지",
    imageSrc: null,
  },
  이학준: {
    birthday: "4월 1일",
    feastDay: "만우절 아님 / 라파엘 대천사 축일 근처",
    notes: "특기: 진행률 바에 등장함",
    talents: "장기: 군가 한 소절(금지 구역)",
    imageSrc: null,
  },
  이현아: {
    birthday: "6월 1일",
    feastDay: "성 유스토키오",
    notes: "특기: 도미니카 느낌의 여백",
    talents: "장기: 미사 전 체크리스트",
    imageSrc: null,
  },
  임효진: {
    birthday: "8월 15일",
    feastDay: "성모 승천 대축일",
    notes: "특기: 수산나 이름표 자랑",
    talents: "장기: 성당 주차 안내",
    imageSrc: null,
  },
  최비호: {
    birthday: "6월 28일",
    feastDay: "성 이레네오",
    notes: "특기: 비오라고 부르지 말기(혼동 주의)",
    talents: "장기: 우산 챙기기 알림",
    imageSrc: null,
  },
  최선호: {
    birthday: "10월 4일",
    feastDay: "성 프란치스코 아시시",
    notes: "특기: 프란치스코답게 웃기",
    talents: "장기: 새 찾기(도시)",
    imageSrc: null,
  },
  최지수: {
    birthday: "5월 12일",
    feastDay: "성 판크라시오",
    notes: "특기: 별자리는 비밀",
    talents: "장기: 별 보기(맑은 날)",
    imageSrc: null,
  },
};

export function getDefaultYouthProfiles(): YouthProfile[] {
  const list: YouthProfile[] = YOUTH_MEMBERS.map((m) => {
    const s = SAMPLE[m.legalName];
    if (!s) {
      return {
        legalName: m.legalName,
        baptismalNameKo: m.baptismalNameKo,
        birthday: "",
        feastDay: "",
        notes: "",
        talents: "",
        imageSrc: null,
      };
    }
    return {
      legalName: m.legalName,
      baptismalNameKo: m.baptismalNameKo,
      ...s,
    };
  });
  return list.sort((a, b) => a.legalName.localeCompare(b.legalName, "ko"));
}
