export type NameTone = "common" | "funny" | "human" | "grand" | "local";

type NameEntry = { name: string; tone: NameTone; for: "dog" | "cat" | "any" };

function entries(names: string, tone: NameTone, species: NameEntry["for"] = "any"): NameEntry[] {
  return names.trim().split(/\s+/).map((name) => ({ name, tone, for: species }));
}

export const NAME_POOL: readonly NameEntry[] = [
  ...entries(`
    뽀삐 몽실 복실 뭉치 해피 똘이 누렁 바둑 백구 황구
    장군 뽀미 쫑이 덕구 봉구 망고 탄이 깜돌 뭉순 똘순
    꼬미 땡칠 뽀송 뚱이 달봉 만두 순돌 아롱 다롱 방울
    깜순 쪼꼬 사랑 찡이 뽀또 콩순 밤톨 토순 포동 누리
  `, "common", "dog"),
  ...entries(`
    나비 치즈 냥이 야옹 삼색 고등 턱시 까망 까미 깜냥
    달냥 별냥 호야 노랑 소금 후추 참치 연어 꽁치 자두
    레오 루나 호두 샴이 설이 미묘 양이 냐옹 토리 토토
    미미 샤샤 나나 라라 로로 네로 루루 묘묘 은비 은별
  `, "common", "cat"),
  ...entries(`
    초코 보리 별이 콩이 두부 하양 코코 루이 마루 모모
    쿠키 구름 솜이 우유 크림 라떼 모카 푸딩 젤리 사탕
    솜사탕 딸기 앵두 살구 복숭 망치 감자 고구마 옥수수 메밀
    깨비 단비 봄이 여름 가을 겨울 햇살 달이 해님 달님
    하늘 바다 산이 들이 숲이 이슬 노을 새벽 초롱 반짝
    반달 보름 미소 기쁨 행복 행운 다솜 다온 다정 한별
    한결 한울 도담 아리 아라 로이 로미 로즈 베리 체리
    땅콩 아몬드 버터 밀크 요미 포포 피피 뿌꾸 뿌요 또또
  `, "common"),
  ...entries(`
    야식왕 월급루팡 삼겹살 존버 퇴근요정 반차 야근 라면 무한리필 출근싫어
    식빵 굴비 된장찌개 김치찌개 계란말이 순대국 떡볶이 어묵 튀김 군만두
    물만두 왕만두 찐빵 호빵 붕어빵 호떡 약과 인절미 가래떡 누룽지
    깍두기 단무지 도토리 묵사발 공깃밥 볶음밥 비빔밥 주먹밥 김밥 유부초밥
    배달왔어 냉장고 전기밥솥 리모컨 충전기 보조배터리 와이파이 비밀번호 자동문 엘리베이터
    분리수거 종이컵 고무장갑 수세미 빨래집게 양말한짝 휴지심 지우개 연필깎이 줄넘기
    회의중 점심시간 칼퇴근 연차신청 월요일 금요일 오분만 십분뒤 내일할게 잠깐만요
    눈치게임 밥도둑 간식도둑 낮잠장인 이불밖 식곤증 꾸벅꾸벅 느릿느릿 우당탕 삐뚤빼뚤
    대충살자 빈둥빈둥 어쩌라고 그럴수도 아무튼 글쎄요 얼렁뚱땅 우왕좌왕 두근두근 허둥지둥
    콧바람 발바닥 뱃살 볼따구 꼬리표 바나나껍질 뚜껑 분홍대야 소쿠리 대파한단
  `, "funny"),
  ...entries(`
    철수 영희 길동 순자 갑돌 민수 영자 말순 칠복 춘삼
    영수 영숙 정숙 경자 옥자 복자 봉자 춘자 덕자 금자
    만복 삼식 두식 춘식 덕식 동식 봉식 길수 종수 광수
    경수 준수 현수 진수 정수 수진 미영 지영 수영 혜진
    마이클 제임스 스티브 토마스 피터 조지 헨리 올리버 루카스 에밀리
    김부장 박과장 이사님 반장 최대리 정주임 오팀장 한실장 윤사원 강계장
  `, "human"),
  ...entries(`
    대왕마마 천하무적 전설용사 라면왕자 인간극장 칼바람 그림자 백작 공작 대공
    멍멍2세 야옹3세 제3대멍왕 고라니왕 멧돼지대장 숲의군주 달빛기사 별빛마법사 새벽파수꾼 황혼수호자
    천둥발톱 폭풍꼬리 번개수염 서리송곳니 불꽃갈기 바위주먹 강철발바닥 황금날개 은빛부리 수정뿔
    우주황제 은하사령관 별나라공주 달나라왕자 구름대장 하늘제독 바다총독 대지수호신 심해현자 산악대왕
    간식군주 낮잠황제 쿠션백작 방석공작 이불대공 밥그릇왕 물그릇신 소파기사 창가현자 마당장수
    멍제1세 냥제2세 깃털4세 도토리5세 왕중왕 무적장군 최강용사 고대예언자 최후의기사 영원의왕
  `, "grand"),
  ...entries(`
    당정이 수리 용호 군포왕 산본이 금당이 한세 당동이 대야미 송정이
    부곡이 수리산왕 산본대장 당정요정 용호장군 군포별 금당왕자 한세공주 초막골 밤바위
  `, "local"),
];

export function pickName(
  seed: number,
  opts: { species: "dog" | "cat" | "bird" | "wild" | "monster"; taken?: ReadonlySet<string> },
): { name: string; tone: NameTone } {
  const candidates = NAME_POOL.filter((entry) =>
    (entry.for === "any" || entry.for === opts.species) && !opts.taken?.has(entry.name),
  );
  if (candidates.length === 0) throw new RangeError("사용 가능한 동물 이름이 없습니다.");

  const weights: Record<NameTone, number> = opts.species === "dog" || opts.species === "cat"
    ? { common: 40, funny: 25, human: 15, grand: 15, local: 5 }
    : { common: 25, funny: 30, human: 10, grand: 30, local: 5 };
  const tones = (Object.keys(weights) as NameTone[]).filter((tone) => candidates.some((entry) => entry.tone === tone));
  let state = seed >>> 0;
  const random = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = Math.imul(state ^ (state >>> 15), state | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
  let roll = random() * tones.reduce((sum, tone) => sum + weights[tone], 0);
  let tone = tones[tones.length - 1];
  for (const candidate of tones) {
    roll -= weights[candidate];
    if (roll < 0) {
      tone = candidate;
      break;
    }
  }
  const names = candidates.filter((entry) => entry.tone === tone);
  const chosen = names[Math.floor(random() * names.length)];
  return { name: chosen.name, tone: chosen.tone };
}
