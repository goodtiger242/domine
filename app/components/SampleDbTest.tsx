"use client";

import { useState } from "react";
import {
  listSampleNotes,
  saveSampleNote,
  type SampleNoteRow,
} from "@/app/actions/sample";

export function SampleDbTest() {
  const [text, setText] = useState("");
  const [rows, setRows] = useState<SampleNoteRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState<"save" | "load" | null>(null);

  async function handleSave() {
    setMessage(null);
    setLoading("save");
    try {
      const result = await saveSampleNote(text);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      setMessage("저장했습니다.");
      setText("");
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "저장 요청이 실패했습니다. 네트워크를 확인하세요."
      );
    } finally {
      setLoading(null);
    }
  }

  async function handleLoadAll() {
    setMessage(null);
    setLoading("load");
    try {
      const result = await listSampleNotes();
      if (!result.ok) {
        setMessage(result.error);
        setRows([]);
        return;
      }
      setRows(result.rows);
      setMessage(`${result.rows.length}개 항목을 불러왔습니다.`);
    } catch (e) {
      setMessage(
        e instanceof Error ? e.message : "불러오기 요청이 실패했습니다."
      );
      setRows([]);
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-6">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="sample-text"
          className="text-sm font-medium text-zinc-700 dark:text-zinc-300"
        >
          텍스트 입력
        </label>
        <input
          id="sample-text"
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="h-11 w-full rounded-lg border border-zinc-300 bg-white px-3 text-zinc-900 shadow-sm outline-none ring-zinc-400 focus:ring-2 dark:border-zinc-600 dark:bg-zinc-950 dark:text-zinc-50"
          placeholder="저장할 텍스트"
          autoComplete="off"
        />
        <button
          type="button"
          onClick={handleSave}
          disabled={loading !== null}
          className="h-10 rounded-lg bg-zinc-900 px-4 text-sm font-medium text-white transition hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
        >
          {loading === "save" ? "저장 중…" : "확인"}
        </button>
      </div>

      <div className="flex flex-col gap-2">
        <button
          type="button"
          onClick={handleLoadAll}
          disabled={loading !== null}
          className="h-10 rounded-lg border border-zinc-300 bg-white px-4 text-sm font-medium text-zinc-900 transition hover:bg-zinc-50 disabled:opacity-50 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-50 dark:hover:bg-zinc-800"
        >
          {loading === "load" ? "불러오는 중…" : "DB에 저장된 항목 모두 보기"}
        </button>
      </div>

      {message ? (
        <p className="text-sm text-zinc-600 dark:text-zinc-400">{message}</p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="flex max-h-64 flex-col gap-2 overflow-y-auto rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-900/50">
          {rows.map((row) => (
            <li
              key={row.id}
              className="rounded-md border border-zinc-200 bg-white p-2 dark:border-zinc-600 dark:bg-zinc-950"
            >
              <p className="break-all text-zinc-900 dark:text-zinc-100">
                {row.content}
              </p>
              <p className="mt-1 text-xs text-zinc-500">
                {new Date(row.created_at).toLocaleString("ko-KR")} ·{" "}
                <span className="font-mono">{row.id.slice(0, 8)}…</span>
              </p>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
