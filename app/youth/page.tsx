import Link from "next/link";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { getDefaultYouthProfiles } from "@/lib/constants/youth-profiles";
import { YouthMembersClient } from "./YouthMembersClient";
import { SITE_NAV_YOUTH } from "@/lib/nav/site-nav";

export const metadata = {
  title: "청년회 멤버 | 도미네",
  description: "청년회 멤버 생일·축일·세례명",
};

export default function YouthPage() {
  const profiles = getDefaultYouthProfiles();

  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <SiteHeader navLinks={SITE_NAV_YOUTH} />
      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-10 sm:px-10 sm:py-12">
        <YouthMembersClient initialProfiles={profiles} />
      </main>
      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-5 py-8 text-center text-sm text-[var(--lit-ink-muted)]">
        <Link
          href="/"
          className="font-medium text-[var(--lit-gold)] underline decoration-[var(--lit-gold)]/35 underline-offset-4 transition hover:text-[var(--lit-ink)]"
        >
          메인으로
        </Link>
      </footer>
    </div>
  );
}
