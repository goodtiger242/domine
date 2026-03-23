import { SampleDbTest } from "@/app/components/SampleDbTest";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-1 flex-col gap-8 px-6 py-16 sm:px-10">
        <header className="flex flex-col gap-2">
          <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            우리끼리 쓰는 게시판
          </h1>
          <p className="text-sm text-zinc-600 dark:text-zinc-400">
            샘플: 입력한 텍스트를 DB에 저장하고, 다른 버튼으로 저장된 항목을 모두
            불러옵니다.
          </p>
        </header>
        <SampleDbTest />
      </main>
    </div>
  );
}
