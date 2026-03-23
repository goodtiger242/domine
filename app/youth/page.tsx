import Link from "next/link";
import { getDefaultYouthProfiles } from "@/lib/constants/youth-profiles";
import { outfitDisplay } from "@/lib/fonts/display";
import { YouthMembersClient } from "./YouthMembersClient";

export const metadata = {
  title: "청년회 멤버 | 도미네",
  description: "청년회 멤버 생일·축일·세례명",
};

export default function YouthPage() {
  const profiles = getDefaultYouthProfiles();

  return (
    <div className="flex min-h-full flex-col bg-gradient-to-b from-[#eef2ff] via-[#f8fafc] to-[#fff7ed] text-slate-900 dark:from-slate-950 dark:via-slate-950 dark:to-slate-900 dark:text-slate-100">
      <header className="border-b border-slate-200/80 bg-[#f4f6fb]/95 backdrop-blur dark:border-slate-800 dark:bg-slate-950/95">
        <div className="mx-auto flex h-[3.75rem] max-w-6xl items-center justify-between px-5 sm:px-10">
          <Link
            href="/"
            className={`${outfitDisplay.className} text-lg text-indigo-950 dark:text-amber-100`}
          >
            ← 도미네
          </Link>
          <nav className="flex flex-wrap items-center gap-2 text-[15px] font-medium sm:gap-4">
            <Link
              href="/liturgical"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              전례 안내
            </Link>
            <Link
              href="/liturgical/edit"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              전례 편집
            </Link>
            <Link
              href="/calendar"
              className="rounded-full px-3 py-2 text-slate-600 transition hover:bg-white/80 hover:text-indigo-950 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              캘린더
            </Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl flex-1 px-5 py-12 sm:px-10">
        <YouthMembersClient initialProfiles={profiles} />
      </main>
    </div>
  );
}
