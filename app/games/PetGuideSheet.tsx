"use client";
import PetSheet from "./PetSheet";

const SECTIONS: { title: string; lines: [string, string][] }[] = [
  { title: "돌보기", lines: [
    ["🐶", "위에서 도미·미네를 골라요. 이름마다 내 강아지예요."],
    ["🍖", "먹이·돌봄·놀이로 돌봐요. 배부름·기분·깨끗함이 낮으면 겨룰 때 힘이 빠져요."],
    ["🗺️", "지도로 동네 다른 곳에 가요."],
  ] },
  { title: "겨루기", lines: [
    ["⚔️", "칼 버튼이나 동물을 누르면 겨뤄요. 이기면 경험치와 코인을 받아요."],
    ["⚡", "기술은 기력을 써요. 모자라면 숨 고르기로 채워요."],
    ["▲", "▲유리 ▼불리는 상성이에요. 레벨이 많이 높으면 상성보다 강해요."],
    ["🔥", "기세가 꽉 차면 결정기를 쓸 수 있어요."],
    ["🐾", "동물은 모두가 같이 봐요. 먼저 이긴 사람만 잡아요."],
  ] },
  { title: "성장", lines: [
    ["ⓘ", "레벨 옆 ⓘ에서 능력치와 직업을 봐요. Lv.10에 E1 칸 봉돌을 이기면 직업을 골라요."],
  ] },
];

/** 처음 한 번 저절로 열리고, 아래 메뉴의 사용법으로 다시 본다. */
export default function PetGuideSheet({ onClose }: { onClose: () => void }) {
  return <PetSheet title="사용법" onClose={onClose} footer={<button type="button" className="pet-guide-close" onClick={onClose}>알겠어요</button>}>
    <div className="pet-guide">
      {SECTIONS.map(section => <section key={section.title} aria-label={section.title}>
        <h3>{section.title}</h3>
        <ul>{section.lines.map(([icon, text]) => <li key={text}><span aria-hidden="true">{icon}</span>{text}</li>)}</ul>
      </section>)}
    </div>
  </PetSheet>;
}
