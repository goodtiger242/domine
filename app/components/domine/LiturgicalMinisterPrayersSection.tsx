import { MinisterPrayersAccordion } from "@/app/components/domine/MinisterPrayersAccordion";

export function LiturgicalMinisterPrayersSection() {
  return (
    <section
      id="home-prayers"
      className="scroll-mt-28 border-t border-[var(--lit-border)]/80 bg-[var(--lit-bg)] px-5 py-24 md:px-10 md:py-32 lg:px-12 lg:scroll-mt-24"
      aria-labelledby="liturgical-prayers-heading"
    >
      <div className="mx-auto max-w-5xl">
        <p className="text-center text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--lit-ink-muted)]">
          Prayers
        </p>
        <h2
          id="liturgical-prayers-heading"
          className="mt-3 text-center text-[clamp(1.5rem,4.2vw,2.25rem)] font-semibold tracking-[-0.03em] text-[var(--lit-ink)] text-pretty md:mt-4"
        >
          전례 봉사자 기도
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-[15px] leading-relaxed text-[var(--lit-ink-muted)]">
          펼쳐서 전문을 읽을 수 있습니다.
        </p>
        <MinisterPrayersAccordion />
      </div>
    </section>
  );
}
