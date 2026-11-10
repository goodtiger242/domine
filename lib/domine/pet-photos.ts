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
  if (motion === "pet-sit") return "sit";
  if (motion === "pet-lie") return "lie";
  return !motion && face === "sleepy" ? "sleep" : null;
}
