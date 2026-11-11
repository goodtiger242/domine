"use client";
import { useEffect, useLayoutEffect, useId, useRef, type ReactNode } from "react";

export default function PetSheet({ title, onClose, onBack, children }: { title: string; onClose: () => void; onBack?: () => boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  const latest = useRef({ onClose, onBack });
  useLayoutEffect(() => { latest.current = { onClose, onBack }; }, [onClose, onBack]);
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    let popped = false;
    document.body.style.overflow = "hidden";
    dialog?.showModal();
    history.pushState({ ...history.state, petSheet: heading }, "");
    const back = () => {
      if (latest.current.onBack?.()) { history.pushState({ ...history.state, petSheet: heading }, ""); return; }
      popped = true; latest.current.onClose();
    };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      if (!popped && history.state?.petSheet === heading) history.back();
      dialog?.close(); document.body.style.overflow = overflow; opener?.focus();
    };
  }, [heading]);
  return <dialog ref={ref} className="pet-sheet" aria-labelledby={heading}
    onCancel={(event) => { event.preventDefault(); if (!onBack?.()) onClose(); }}>
    <header><h2 id={heading}>{title}</h2><button type="button" onClick={onClose} aria-label="시트 닫기">닫기 ×</button></header>
    <div className="pet-sheet-content">{children}</div>
  </dialog>;
}
