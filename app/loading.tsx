/** 메인이 서버에서 데이터를 가져오는 동안 보여 주는 뼈대 화면 */
export default function Loading() {
  const bone = "rounded-md bg-[var(--lit-border)] motion-safe:animate-pulse";
  return (
    <div
      className="min-h-full bg-[var(--lit-bg)] px-4 pt-20 md:px-6"
      role="status"
      aria-label="불러오는 중"
    >
      <div className="mx-auto max-w-3xl space-y-8">
        <div className="rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-4">
          <div className="grid grid-cols-2 gap-4">
            {[0, 1].map((i) => (
              <div key={i} className="flex flex-col items-center gap-3">
                <div className={`${bone} aspect-[10/9] w-full max-w-[7.75rem]`} />
                <div className={`${bone} h-4 w-16`} />
                <div className={`${bone} h-6 w-28`} />
              </div>
            ))}
          </div>
        </div>
        <div className="space-y-5">
          <div className={`${bone} h-8 w-32`} />
          <div className="space-y-4 rounded-xl border border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] p-5">
            <div className={`${bone} h-6 w-3/4`} />
            <div className={`${bone} h-4 w-full`} />
            <div className={`${bone} h-4 w-5/6`} />
            <div className={`${bone} mt-2 h-40 w-full`} />
          </div>
          <div className="flex gap-3">
            <div className={`${bone} h-12 flex-1`} />
            <div className={`${bone} h-12 flex-1`} />
          </div>
        </div>
      </div>
    </div>
  );
}
