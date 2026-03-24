import Link from "next/link";
import { listYouthProfilesMerged } from "@/app/actions/youth";
import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { YouthMembersClient } from "./YouthMembersClient";
import { SITE_NAV_YOUTH } from "@/lib/nav/site-nav";

export const metadata = {
  title: "청년회 멤버 | 도미네",
  description: "청년회 멤버 생일·축일·세례명",
};

export const dynamic = "force-dynamic";

export default async function YouthPage() {
  const profiles = await listYouthProfilesMerged();

  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <SiteHeader navLinks={SITE_NAV_YOUTH} />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-16 md:px-8 md:py-20">
        <YouthMembersClient initialProfiles={profiles} />
      </main>
      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-6 py-10 text-center text-sm text-[var(--lit-ink-muted)]">
        <Link
          href="/"
          className="font-medium underline decoration-[var(--lit-border-strong)] underline-offset-4 transition hover:text-[var(--lit-ink)]"
        >
          메인으로
        </Link>
        <DeployStamp />
      </footer>
    </div>
  );
}
