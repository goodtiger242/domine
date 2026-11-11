/** 장면과 말풍선의 실제 크기를 받아 HTML용 퍼센트 좌표를 반환한다. */
export function bubblePosition(
  headX: number, headY: number,
  sceneWidth: number, sceneHeight: number,
  bubbleWidth: number, bubbleHeight: number,
) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const x = headX / 160 * sceneWidth;
  const y = (headY - 6) / 90 * sceneHeight;
  const left = clamp(x - bubbleWidth / 2, sceneWidth * .14, sceneWidth * .86 - bubbleWidth);
  const top = clamp(y - bubbleHeight - 8, Math.max(48, sceneHeight * .22), sceneHeight - bubbleHeight - 46);
  return {
    left: left / sceneWidth * 100,
    top: top / sceneHeight * 100,
    tail: clamp(x - left, 10, bubbleWidth - 10) / bubbleWidth * 100,
  };
}

export type Speech = { text: string; speaker: "dog" | "priest"; arrival?: boolean };
export function queueSpeech(queue: Speech[], speech: Speech): Speech[] {
  if (speech.arrival) return [speech, ...queue.filter((item) => !item.arrival).slice(-1)];
  // 도착 안내 중에는 가장 최근 일반 대사 하나만 기다린다.
  return queue[0]?.arrival ? [queue[0], speech] : [speech];
}
