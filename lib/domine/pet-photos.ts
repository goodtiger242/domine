export const BACKGROUNDS = {
  dawn: "/pet/bg/dawn.webp",
  day: "/pet/bg/day.webp",
  dusk: "/pet/bg/dusk.webp",
  night: "/pet/bg/night.webp",
};

export function backgroundAt(hour: number): keyof typeof BACKGROUNDS {
  return hour >= 5 && hour < 7 ? "dawn"
    : hour >= 7 && hour < 17 ? "day"
    : hour >= 17 && hour < 21 ? "dusk" : "night";
}

// shortcut: 어린 도미는 성견 자세를 축소해 사용, 새끼 자세 사진이 생기면 분리한다.
export const POSES = {
  sit: { src: "/pet/pose/sit.webp", ratio: 515 / 640, width: 0.8 },
  lie: { src: "/pet/pose/lie.webp", ratio: 293 / 640, width: 1 },
  sleep: { src: "/pet/pose/sleep.webp", ratio: 288 / 640, width: 0.85 },
};

export function poseAt(motion: string | null, face: string): keyof typeof POSES | null {
  if (motion === "pet-sleep") return "sleep";
  if (motion === "pet-sit") return "sit";
  if (motion === "pet-lie") return "lie";
  return !motion && face === "sleepy" ? "sleep" : null;
}

export const PETS = {
  1: {
    name: "도미", standing: { baby: "/pet/puppy.webp", young: "/pet/puppy.webp", adult: "/pet/adult.webp" },
    ratio: 622 / 900, scale: 1, poses: POSES,
    collar: "M641 143 Q692 168 736 214",
  },
  2: {
    name: "미네", standing: { baby: "/pet/mine/stand.webp", young: "/pet/mine/stand.webp", adult: "/pet/mine/stand.webp" },
    ratio: 484 / 640, scale: 0.72,
    poses: {
      sit: { src: "/pet/mine/sit.webp", ratio: 640 / 627, width: 0.73 },
      lie: { src: "/pet/mine/lie.webp", ratio: 342 / 640, width: 1 },
      sleep: { src: "/pet/mine/sleep.webp", ratio: 271 / 640, width: 0.85 },
    },
    // shortcut: 미네는 털에 목줄이 가려짐, 목줄 포함 사진을 만들 때 전례색 위치를 지정한다.
    collar: null,
  },
} as const;
export type PetId = keyof typeof PETS;
export const PRIEST = "/pet/priest.webp";
export const DOGHOUSE = "/pet/doghouse.webp";

export function petText(text: string, petId: PetId) {
  return text.replaceAll("도미", PETS[petId].name);
}
