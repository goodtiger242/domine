type Owner = { token: string; back: () => boolean; close: () => void; active: boolean; pushed: boolean };
const managers = new WeakMap<Window, ReturnType<typeof createManager>>();
let sequence = 0;

function createManager(win: Window, nav: History) {
  const owners: Owner[] = [];
  let pending = false, listening = false;
  let restore: (() => void) | undefined;
  const push = (owner: Owner) => {
    nav.pushState({ ...nav.state, petSheetOwner: owner.token }, "");
    owner.pushed = true;
  };
  const drain = () => {
    if (pending) return;
    const current = owners.find(owner => owner.token === nav.state?.petSheetOwner);
    if (current && !current.active && current.pushed) {
      pending = true;
      nav.back();
      return;
    }
    for (const owner of owners) if (owner.active && !owner.pushed) push(owner);
    if (!owners.some(owner => owner.active)) {
      win.removeEventListener("popstate", pop);
      listening = false;
      owners.length = 0;
    }
  };
  const pop = () => {
    // A programmatic Back owns its eventual pop, even if a new dialog mounted meanwhile.
    if (pending) { pending = false; drain(); return; }
    const owner = owners.findLast(entry => entry.active && entry.pushed);
    if (!owner || nav.state?.petSheetOwner === owner.token) return;
    if (owner.back()) push(owner);
    else { owner.pushed = false; owner.close(); }
  };
  return (back: () => boolean, close: () => void) => {
    if (!owners.some(owner => owner.active)) {
      const body = document.body, scrollY = win.scrollY;
      const saved = { overflow: body.style.overflow, position: body.style.position, top: body.style.top, width: body.style.width };
      Object.assign(body.style, { overflow: "hidden", position: "fixed", top: `-${scrollY}px`, width: "100%" });
      restore = () => { Object.assign(body.style, saved); win.scrollTo({ top: scrollY, behavior: "instant" }); };
    }
    const owner: Owner = { token: `pet-${++sequence}`, back, close, active: true, pushed: false };
    owners.push(owner);
    if (!listening) { win.addEventListener("popstate", pop); listening = true; }
    drain();
    return () => {
      if (!owner.active) return;
      owner.active = false;
      if (!owners.some(entry => entry.active)) { restore?.(); restore = undefined; }
      drain();
    };
  };
}

export function ownPetSheet(back: () => boolean, close: () => void) {
  let manager = managers.get(window);
  if (!manager) { manager = createManager(window, history); managers.set(window, manager); }
  return manager(back, close);
}
