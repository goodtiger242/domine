export type CatalogEntry = { id: string; name: string; category: string; rarity: string; condition: string; map: string | null; price: number | null; slot: "wearable" | "toy" | null; core: boolean; storage: "server" | "device"; asset: string | null };
export const CATALOG: readonly CatalogEntry[] = [
  {"id": "001", "name": "마당의 둥근 돌", "category": "물건", "rarity": "일반", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "002", "name": "은행잎 한 장", "category": "자연", "rarity": "일반", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "003", "name": "화단 이름표", "category": "소품", "rarity": "일반", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "004", "name": "접이식 의자", "category": "소품", "rarity": "일반", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "005", "name": "마당 빗자루", "category": "소품", "rarity": "일반", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "006", "name": "작은 물뿌리개", "category": "소품", "rarity": "일반", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "007", "name": "청년회 이름표", "category": "공동체", "rarity": "특별", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "008", "name": "마당의 참새", "category": "만남·동물", "rarity": "특별", "condition": "새벽·낮 발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "009", "name": "청소 봉사 장갑", "category": "공동체", "rarity": "특별", "condition": "발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "010", "name": "성가 연습을 마친 친구", "category": "만남·사람", "rarity": "희귀", "condition": "저녁·밤 발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "011", "name": "꽃을 돌보는 봉사자", "category": "만남·사람", "rarity": "희귀", "condition": "새벽·낮 발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "012", "name": "노을에 물든 종탑 풍경", "category": "장소 풍경", "rarity": "아주 드묾", "condition": "저녁 발견", "map": "church", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "013", "name": "민들레", "category": "자연", "rarity": "일반", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "014", "name": "토끼풀", "category": "자연", "rarity": "일반", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "015", "name": "강아지풀", "category": "자연", "rarity": "일반", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "016", "name": "작은 솔방울", "category": "자연", "rarity": "일반", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "017", "name": "마른 나뭇가지", "category": "자연", "rarity": "일반", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "018", "name": "납작한 자갈", "category": "자연", "rarity": "일반", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "019", "name": "노랑나비", "category": "만남·동물", "rarity": "특별", "condition": "낮 발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "020", "name": "무당벌레", "category": "만남·동물", "rarity": "특별", "condition": "새벽·낮 발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "021", "name": "풀숲 귀뚜라미", "category": "만남·동물", "rarity": "특별", "condition": "저녁·밤 발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "022", "name": "들판의 토끼", "category": "만남·동물", "rarity": "희귀", "condition": "새벽·저녁 발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "023", "name": "네잎클로버", "category": "자연", "rarity": "희귀", "condition": "발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "024", "name": "반딧불이", "category": "만남·동물", "rarity": "아주 드묾", "condition": "밤 발견", "map": "field", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "025", "name": "골목의 가로등", "category": "장소 요소", "rarity": "일반", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "026", "name": "가게 앞 화분", "category": "소품", "rarity": "일반", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "027", "name": "작은 자전거 거치대", "category": "장소 요소", "rarity": "일반", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "028", "name": "횡단보도 표지", "category": "장소 요소", "rarity": "일반", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "029", "name": "가게 앞 우산꽂이", "category": "소품", "rarity": "일반", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "030", "name": "골목 벤치", "category": "장소 요소", "rarity": "일반", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "031", "name": "술이 좋아 앞의 저녁 풍경", "category": "장소 풍경", "rarity": "특별", "condition": "저녁·밤 발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "032", "name": "맥도날드 앞의 포장 봉투", "category": "장소 소품", "rarity": "특별", "condition": "발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "033", "name": "쁘니네 앞의 화분 풍경", "category": "장소 풍경", "rarity": "특별", "condition": "낮·저녁 발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "034", "name": "화락 앞의 저녁 불빛", "category": "장소 풍경", "rarity": "희귀", "condition": "저녁·밤 발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "035", "name": "산책 중인 이웃", "category": "만남·사람", "rarity": "희귀", "condition": "새벽·낮 발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "036", "name": "골목 끝 무지개", "category": "장소 풍경", "rarity": "아주 드묾", "condition": "낮 발견", "map": "street", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "037", "name": "도토리", "category": "자연", "rarity": "일반", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "038", "name": "참나무 잎", "category": "자연", "rarity": "일반", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "039", "name": "낙엽 두 장", "category": "자연", "rarity": "일반", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "040", "name": "이끼 낀 돌", "category": "자연", "rarity": "일반", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "041", "name": "산책로 안내판", "category": "장소 요소", "rarity": "일반", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "042", "name": "나무 벤치", "category": "장소 요소", "rarity": "일반", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "043", "name": "청설모", "category": "만남·동물", "rarity": "특별", "condition": "새벽·낮 발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "044", "name": "까치", "category": "만남·동물", "rarity": "특별", "condition": "낮·저녁 발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "045", "name": "달팽이", "category": "만남·동물", "rarity": "특별", "condition": "발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "046", "name": "딱따구리", "category": "만남·동물", "rarity": "희귀", "condition": "새벽·낮 발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "047", "name": "밤의 고슴도치", "category": "만남·동물", "rarity": "희귀", "condition": "저녁·밤 발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "048", "name": "나뭇잎 사이 햇살", "category": "장소 풍경", "rarity": "아주 드묾", "condition": "낮 발견", "map": "park", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "049", "name": "빈 밥그릇", "category": "생활 소품", "rarity": "일반", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "050", "name": "접힌 수건", "category": "생활 소품", "rarity": "일반", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "051", "name": "부드러운 빗", "category": "생활 소품", "rarity": "일반", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "052", "name": "현관 매트", "category": "생활 소품", "rarity": "일반", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "053", "name": "낮잠 쿠션", "category": "생활 소품", "rarity": "일반", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "054", "name": "작은 물통", "category": "생활 소품", "rarity": "일반", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "055", "name": "마당의 고양이", "category": "만남·동물", "rarity": "특별", "condition": "새벽·저녁 발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "056", "name": "빨래집게 바구니", "category": "생활 소품", "rarity": "특별", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "057", "name": "택배 상자", "category": "생활 소품", "rarity": "특별", "condition": "발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "058", "name": "함께 쉬는 이웃 강아지", "category": "만남·동물", "rarity": "희귀", "condition": "새벽·낮 발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "059", "name": "창가의 별빛", "category": "장소 풍경", "rarity": "희귀", "condition": "저녁·밤 발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "060", "name": "무지개 비눗방울", "category": "장면 소품", "rarity": "아주 드묾", "condition": "낮 발견", "map": "home", "price": null, "slot": null, "core": true, "storage": "server", "asset": null},
  {"id": "061", "name": "노랑 반다나", "category": "옷", "rarity": "일반", "condition": "상점 40코인", "map": null, "price": 40, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/061.webp"},
  {"id": "062", "name": "하늘 반다나", "category": "옷", "rarity": "일반", "condition": "상점 60코인", "map": null, "price": 60, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/062.webp"},
  {"id": "063", "name": "초록 체크 스카프", "category": "옷", "rarity": "일반", "condition": "상점 80코인", "map": null, "price": 80, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/063.webp"},
  {"id": "064", "name": "빨강 나비넥타이", "category": "옷", "rarity": "특별", "condition": "상점 100코인", "map": null, "price": 100, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/064.webp"},
  {"id": "065", "name": "보라 리본", "category": "옷", "rarity": "특별", "condition": "상점 120코인", "map": null, "price": 120, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/065.webp"},
  {"id": "066", "name": "이름 없는 산책 조끼", "category": "옷", "rarity": "특별", "condition": "상점 140코인", "map": null, "price": 140, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/066.webp"},
  {"id": "067", "name": "노랑 우비", "category": "옷", "rarity": "특별", "condition": "상점 180코인", "map": null, "price": 180, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/067.webp"},
  {"id": "068", "name": "줄무늬 티셔츠", "category": "옷", "rarity": "특별", "condition": "상점 200코인", "map": null, "price": 200, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/068.webp"},
  {"id": "069", "name": "겨울 목도리", "category": "옷", "rarity": "희귀", "condition": "상점 240코인", "map": null, "price": 240, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/069.webp"},
  {"id": "070", "name": "밀짚모자", "category": "옷", "rarity": "희귀", "condition": "상점 260코인", "map": null, "price": 260, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/070.webp"},
  {"id": "071", "name": "별무늬 망토", "category": "옷", "rarity": "희귀", "condition": "상점 320코인", "map": null, "price": 320, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/071.webp"},
  {"id": "072", "name": "도미네 산책 재킷", "category": "옷", "rarity": "아주 드묾", "condition": "상점 400코인", "map": null, "price": 400, "slot": "wearable", "core": true, "storage": "server", "asset": "/pet/catalog/072.webp"},
  {"id": "073", "name": "테니스공", "category": "장난감", "rarity": "일반", "condition": "상점 40코인", "map": null, "price": 40, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/073.webp"},
  {"id": "074", "name": "매듭 로프", "category": "장난감", "rarity": "일반", "condition": "상점 60코인", "map": null, "price": 60, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/074.webp"},
  {"id": "075", "name": "고무 뼈다귀", "category": "장난감", "rarity": "일반", "condition": "상점 80코인", "map": null, "price": 80, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/075.webp"},
  {"id": "076", "name": "천 원반", "category": "장난감", "rarity": "특별", "condition": "상점 120코인", "map": null, "price": 120, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/076.webp"},
  {"id": "077", "name": "오리 인형", "category": "장난감", "rarity": "특별", "condition": "상점 160코인", "map": null, "price": 160, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/077.webp"},
  {"id": "078", "name": "당근 인형", "category": "장난감", "rarity": "특별", "condition": "상점 180코인", "map": null, "price": 180, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/078.webp"},
  {"id": "079", "name": "줄무늬 공", "category": "장난감", "rarity": "희귀", "condition": "상점 240코인", "map": null, "price": 240, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/079.webp"},
  {"id": "080", "name": "별 쿠션 인형", "category": "장난감", "rarity": "아주 드묾", "condition": "상점 360코인", "map": null, "price": 360, "slot": "toy", "core": true, "storage": "server", "asset": "/pet/catalog/080.webp"},
  {"id": "081", "name": "대림환을 본 기록", "category": "전례 기록", "rarity": "기념", "condition": "대림 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "082", "name": "대림의 기다림 카드", "category": "전례 기록", "rarity": "기념", "condition": "대림 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "083", "name": "성탄 준비 봉사 풍경", "category": "공동체 기록", "rarity": "기념", "condition": "대림 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "084", "name": "구유를 본 기록", "category": "전례 기록", "rarity": "기념", "condition": "성탄 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "085", "name": "성탄 트리 풍경", "category": "전례 기록", "rarity": "기념", "condition": "성탄 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "086", "name": "성탄 인사 카드", "category": "공동체 기록", "rarity": "기념", "condition": "성탄 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "087", "name": "사순의 보라색 안내", "category": "전례 기록", "rarity": "기념", "condition": "사순 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "088", "name": "십자가의 길 안내를 읽은 기록", "category": "전례 기록", "rarity": "기념", "condition": "사순·성삼일 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "089", "name": "나눔 바구니 풍경", "category": "공동체 기록", "rarity": "기념", "condition": "사순 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "090", "name": "부활초를 본 기록", "category": "전례 기록", "rarity": "기념", "condition": "부활 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "091", "name": "부활 인사 카드", "category": "전례 기록", "rarity": "기념", "condition": "부활 중 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "092", "name": "성령 강림 안내를 읽은 기록", "category": "전례 기록", "rarity": "기념", "condition": "성령 강림 주일 설명 열기", "map": "church", "price": null, "slot": null, "core": false, "storage": "server", "asset": null},
  {"id": "093", "name": "실제 산책 200m 기념", "category": "기기 기록", "rarity": "기념", "condition": "기기에서 거리 달성", "map": null, "price": null, "slot": null, "core": false, "storage": "device", "asset": null},
  {"id": "094", "name": "실제 산책 1km 기념", "category": "기기 기록", "rarity": "기념", "condition": "기기에서 누적 거리 달성", "map": null, "price": null, "slot": null, "core": false, "storage": "device", "asset": null},
  {"id": "095", "name": "용호성당 근처 산책 기념", "category": "장소 기록", "rarity": "기념", "condition": "기기에서 근접·체류 판정", "map": null, "price": null, "slot": null, "core": false, "storage": "device", "asset": null},
  {"id": "096", "name": "아침 산책 기념", "category": "기기 기록", "rarity": "기념", "condition": "05~09시 실제 200m", "map": null, "price": null, "slot": null, "core": false, "storage": "device", "asset": null}
];
export const SHOP = CATALOG.filter((item) => item.price !== null);
export const ACHIEVEMENTS = [
  {
    "id": "A01",
    "name": "첫 인사",
    "condition": "행동 1회"
  },
  {
    "id": "A02",
    "name": "익숙한 손길",
    "condition": "행동 10회"
  },
  {
    "id": "A03",
    "name": "다정한 친구",
    "condition": "행동 50회"
  },
  {
    "id": "A04",
    "name": "오래가는 우정",
    "condition": "행동 200회"
  },
  {
    "id": "A05",
    "name": "도미의 친구",
    "condition": "도미에게 행동 10회"
  },
  {
    "id": "A06",
    "name": "미네의 친구",
    "condition": "미네에게 행동 10회"
  },
  {
    "id": "A07",
    "name": "둘 다 소중해",
    "condition": "두 강아지에게 각각 20회"
  },
  {
    "id": "A08",
    "name": "밥그릇 담당",
    "condition": "밥주기 10회"
  },
  {
    "id": "A09",
    "name": "작은 즐거움",
    "condition": "간식 10회"
  },
  {
    "id": "A10",
    "name": "따뜻한 손",
    "condition": "쓰다듬기 20회"
  },
  {
    "id": "A11",
    "name": "털 정리 전문가",
    "condition": "빗질 10회"
  },
  {
    "id": "A12",
    "name": "뽀송한 하루",
    "condition": "목욕 5회"
  },
  {
    "id": "A13",
    "name": "공놀이 친구",
    "condition": "공놀이 10회"
  },
  {
    "id": "A14",
    "name": "호흡 척척",
    "condition": "훈련 10회"
  },
  {
    "id": "A15",
    "name": "산책 단짝",
    "condition": "산책 행동 10회"
  },
  {
    "id": "A16",
    "name": "골고루 돌보기",
    "condition": "8개 행동을 각각 1회"
  },
  {
    "id": "A17",
    "name": "동네 한 바퀴",
    "condition": "5개 맵에서 탐색 완료"
  },
  {
    "id": "A18",
    "name": "호기심 한 걸음",
    "condition": "탐색 완료 10회"
  },
  {
    "id": "A19",
    "name": "동네 탐험가",
    "condition": "탐색 완료 50회"
  },
  {
    "id": "A20",
    "name": "마당의 친구",
    "condition": "성당 탐색 완료 10회"
  },
  {
    "id": "A21",
    "name": "골목 산책가",
    "condition": "당정동 탐색 완료 10회"
  },
  {
    "id": "A22",
    "name": "익숙한 산책길",
    "condition": "들판·공원·집 탐색 각각 5회"
  },
  {
    "id": "A23",
    "name": "밤 풍경 수첩",
    "condition": "밤 시간 탐색 완료 5회"
  },
  {
    "id": "A24",
    "name": "첫 번째 수첩",
    "condition": "상시 도감 10종"
  },
  {
    "id": "A25",
    "name": "발견의 재미",
    "condition": "상시 도감 30종"
  },
  {
    "id": "A26",
    "name": "풍성한 수첩",
    "condition": "상시 도감 60종"
  },
  {
    "id": "A27",
    "name": "나만의 준비물",
    "condition": "첫 상품 구매"
  },
  {
    "id": "A28",
    "name": "오늘의 차림",
    "condition": "서로 다른 옷 3종 착용"
  },
  {
    "id": "A29",
    "name": "장난감 바구니",
    "condition": "장난감 3종 소유"
  },
  {
    "id": "A30",
    "name": "오래 함께",
    "condition": "레벨 30"
  }
] as const;
