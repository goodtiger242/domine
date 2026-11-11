/** 장면과 말풍선의 실제 크기를 받아 HTML용 퍼센트 좌표를 반환한다. */
export function bubblePosition(
  headX: number, headY: number,
  sceneWidth: number, sceneHeight: number,
  bubbleWidth: number, bubbleHeight: number,
) {
  const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));
  const x = headX / 160 * sceneWidth;
  const y = (headY - 6) / 90 * sceneHeight;
  const left = clamp(x - bubbleWidth / 2, 6, sceneWidth - bubbleWidth - 6);
  const top = clamp(y - bubbleHeight - 8, 6, sceneHeight - bubbleHeight - 16);
  return {
    left: left / sceneWidth * 100,
    top: top / sceneHeight * 100,
    tail: clamp(x - left, 10, bubbleWidth - 10) / bubbleWidth * 100,
  };
}
