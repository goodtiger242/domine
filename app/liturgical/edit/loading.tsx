/** 편집 화면에서 날짜를 바꿀 때 보여 주는 뼈대 화면 */
export default function Loading() {
  const bone = "rounded-md bg-[var(--lit-border)] motion-safe:animate-pulse";
  return (
    <div
      className="min-h-full bg-[var(--lit-bg)] px-6 py-20 md:px-8"
      role="status"
      aria-label="불러오는 중"
    >
      <div className="mx-auto max-w-5xl space-y-8">
        <div className="space-y-4 border-b border-[var(--lit-border)] pb-10">
          <div className={`${bone} h-3 w-10`} />
          <div className={`${bone} h-9 w-56`} />
          <div className={`${bone} h-4 w-72 max-w-full`} />
        </div>
        <div className="grid gap-8 lg:grid-cols-[minmax(0,26rem)_1fr]">
          <div className={`${bone} h-80`} />
          <div className={`${bone} h-64`} />
        </div>
        <div className={`${bone} h-48`} />
      </div>
    </div>
  );
}
