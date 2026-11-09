import { DeployStamp } from "@/app/components/layout/DeployStamp";
import { SiteHeader } from "@/app/components/layout/SiteHeader";
import { SITE_NAV_GAMES } from "@/lib/nav/site-nav";
import { PetGame } from "./PetGame";

export const metadata = {
  title: "우리 강아지 도미 | 도미네",
  description: "도미네 친구들이 함께 키우는 강아지 도미를 돌봐 주세요.",
};

export default function GamesPage() {
  return (
    <div className="flex min-h-full flex-col bg-[var(--lit-bg)] text-[var(--lit-ink)]">
      <SiteHeader navLinks={SITE_NAV_GAMES} />
      <main className="flex-1 px-4 pb-16 pt-8 md:px-6 md:pt-12">
        <div className="mx-auto max-w-xl">
          <h1 className="t-title">우리 강아지 도미</h1>
          <p className="t-body mt-3 text-[var(--lit-ink-muted)]">
            함께 키우는 강아지예요. 들를 때마다 밥도 주고, 쓰다듬고, 산책도 시켜 주세요.
            안 와도 괜찮아요. 도미는 잠깐 시무룩해질 뿐이에요.
          </p>
          <div className="mt-6">
            <PetGame />
          </div>
        </div>
      </main>
      <footer className="border-t border-[var(--lit-border)] bg-[var(--lit-bg-elevated)] px-6 py-6">
        <DeployStamp className="!mt-0" />
      </footer>
    </div>
  );
}
