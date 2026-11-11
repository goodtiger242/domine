"use client";
import { useEffect, useLayoutEffect, useId, useRef, type ReactNode } from "react";

export default function PetSheet({ title, onClose, onBack, children, toolbar, panel, footer, fullHeight = false }: {
  title: string; onClose: () => void; onBack?: () => boolean; children: ReactNode;
  toolbar?: ReactNode; panel?: ReactNode; footer?: ReactNode; fullHeight?: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null), heading = useId();
  const content = useRef<HTMLDivElement>(null), panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; y: number } | null>(null);
  const backdrop = useRef(false);
  const hasPanel = !!panel;
  const latest = useRef({ onClose, onBack });
  useLayoutEffect(() => { latest.current = { onClose, onBack }; }, [onClose, onBack]);
  useEffect(() => {
    if (!hasPanel) return;
    const opener = document.activeElement as HTMLElement | null;
    panelRef.current?.focus({ preventScroll: true });
    return () => { if (opener?.isConnected) opener.focus({ preventScroll: true }); };
  }, [hasPanel]);
  useEffect(() => {
    const dialog = ref.current, opener = document.activeElement as HTMLElement | null;
    const body = document.body, scrollY = window.scrollY;
    const saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
    let popped = false;
    Object.assign(body.style, { overflow: "hidden", position: "fixed", top: `-${scrollY}px`, width: "100%" });
    dialog?.showModal();
    if (!opener?.matches?.(":focus-visible")) dialog?.focus({ preventScroll: true });
    const viewport = window.visualViewport;
    const resize = () => {
      dialog?.style.setProperty("--pet-viewport-height", `${viewport?.height ?? window.innerHeight}px`);
      dialog?.style.setProperty("--pet-keyboard-bottom", `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`);
    };
    resize(); viewport?.addEventListener("resize", resize); viewport?.addEventListener("scroll", resize);
    history.pushState({ ...history.state, petSheet: heading }, "");
    const back = () => {
      if (latest.current.onBack?.()) { history.pushState({ ...history.state, petSheet: heading }, ""); return; }
      popped = true; latest.current.onClose();
    };
    window.addEventListener("popstate", back);
    return () => {
      window.removeEventListener("popstate", back);
      if (!popped && history.state?.petSheet === heading) history.back();
      viewport?.removeEventListener("resize", resize); viewport?.removeEventListener("scroll", resize);
      dialog?.close(); Object.assign(body.style, saved); window.scrollTo({ top: scrollY, behavior: "instant" }); opener?.focus({ preventScroll: true });
    };
  }, [heading]);
  return <dialog ref={ref} className="pet-sheet" data-full-height={fullHeight} aria-labelledby={heading} tabIndex={-1}
    onPointerDown={(event) => { backdrop.current = event.target === event.currentTarget; }}
    onClick={(event) => { if (backdrop.current && event.target === event.currentTarget) onClose(); backdrop.current = false; }}
    onCancel={(event) => { event.preventDefault(); if (!onBack?.()) onClose(); }}>
    <div className="pet-sheet-handle" aria-hidden="true"
      onPointerDown={(event) => {
        const scroll = hasPanel ? panelRef.current : content.current;
        if (!event.isPrimary || event.button !== 0 || (scroll?.scrollTop ?? 0) > 0) return;
        drag.current = { id: event.pointerId, y: event.clientY }; event.currentTarget.setPointerCapture(event.pointerId);
      }}
      onPointerUp={(event) => {
        const start = drag.current; drag.current = null;
        if (start?.id === event.pointerId && event.clientY - start.y >= 80) onClose();
      }}
      onPointerCancel={() => { drag.current = null; }} onLostPointerCapture={() => { drag.current = null; }}><span /></div>
    <header><h2 id={heading}>{title}</h2><button type="button" onClick={onClose} aria-label="시트 닫기">×</button></header>
    {toolbar && <div className="pet-sheet-toolbar" inert={hasPanel}>{toolbar}</div>}
    <div className="pet-sheet-body" data-panel={hasPanel}>
      <div ref={content} className="pet-sheet-content" inert={hasPanel}>{children}</div>
      {hasPanel && <div ref={panelRef} className="pet-sheet-panel pet-sheet-content" tabIndex={-1} role="region" aria-label="상세 정보">{panel}</div>}
    </div>
    {footer && <footer className="pet-sheet-footer">{footer}</footer>}
  </dialog>;
}
