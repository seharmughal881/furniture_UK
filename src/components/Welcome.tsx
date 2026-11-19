"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { SofaBuddy } from "./SofaBuddy";

const AUTO_MS = 6500;

// Emoji that float up behind the greeting (fixed positions so server and client markup match).
const FLOATERS = [
  { e: "🛋️", x: 8, d: 0 },
  { e: "✨", x: 18, d: 1.2 },
  { e: "💛", x: 30, d: 2.4 },
  { e: "🪑", x: 44, d: 0.6 },
  { e: "🌙", x: 58, d: 1.8 },
  { e: "✨", x: 70, d: 3 },
  { e: "🛏️", x: 82, d: 0.9 },
  { e: "😊", x: 92, d: 2.1 },
];

/**
 * Welcome screen shown every time the home page is opened (including a refresh). It is rendered
 * in the server HTML so it covers the page from the very first paint; an inline script in <head>
 * hides it at once on every other page (see layout.tsx).
 */
export function Welcome() {
  const [phase, setPhase] = useState<"show" | "leave" | "gone">("show");

  const rootRef = useRef<HTMLDivElement>(null);

  const leave = useCallback(() => {
    setPhase((p) => (p === "show" ? "leave" : p));
    setTimeout(() => setPhase("gone"), 900);
  }, []);

  useEffect(() => {
    // not the home page: the head script set data-welcomed and CSS keeps it hidden
    if (document.documentElement.dataset.welcomed) return;
    const t = setTimeout(leave, AUTO_MS);
    const onKey = (e: KeyboardEvent) => (e.key === "Escape" || e.key === "Enter") && leave();
    window.addEventListener("keydown", onKey);

    /**
     * Dismiss from the document, not only from the two buttons.
     *
     * Opening the home page runs view transitions while the tree hydrates, and for as
     * long as one is running the browser paints snapshots instead of the live DOM. Those
     * snapshots are not hit-testable, so a press on "Start shopping" or "Skip" lands on
     * <html> and the buttons' own onClick never fires -- the screen simply ignored you.
     * Measured: every press while a transition was in flight was swallowed; every press
     * outside one worked.
     *
     * The event still reaches the document, so listening here catches those presses. It
     * handles only the swallowed ones: when the press did reach a control inside the
     * screen, that control's own handler runs and this bows out, so nothing fires twice.
     */
    const onPress = (e: MouseEvent) => {
      if (e.target instanceof Node && rootRef.current?.contains(e.target)) return;
      leave();
    };
    document.addEventListener("click", onPress, true);

    document.documentElement.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("click", onPress, true);
      document.documentElement.style.overflow = "";
    };
  }, [leave]);

  useEffect(() => {
    if (phase === "gone") {
      document.documentElement.style.overflow = "";
      document.documentElement.dataset.welcomed = "1";
    }
  }, [phase]);

  if (phase === "gone") return null;
  const title = "Muscat Furniture";

  return (
    <div
      ref={rootRef}
      className={`welcome ${phase === "leave" ? "leaving" : ""}`}
      role="dialog"
      aria-label="Welcome to Muscat Furniture"
    >
      <div className="welcome-blobs" aria-hidden>
        <i />
        <i />
        <i />
      </div>
      <div className="welcome-floaters" aria-hidden>
        {FLOATERS.map((f, i) => (
          <span key={i} style={{ left: `${f.x}%`, animationDelay: `${f.d}s` }}>
            {f.e}
          </span>
        ))}
      </div>

      <div className="welcome-inner">
        <div className="welcome-buddy">
          <span className="welcome-bubble">
            Hello! <bdi lang="ar">مرحبا</bdi> 👋
          </span>
          <SofaBuddy mood="wave" size={210} />
        </div>
        <p className="welcome-kicker">Welcome to</p>
        <h1 className="welcome-title" aria-label={title}>
          {title.split("").map((ch, i) => (
            <span key={i} style={{ animationDelay: `${0.9 + i * 0.045}s` }} aria-hidden>
              {ch === " " ? " " : ch}
            </span>
          ))}
        </h1>
        <p className="welcome-ar" dir="rtl" lang="ar">
          أهلاً وسهلاً بكم في مسقط للأثاث
        </p>
        <p className="welcome-sub">Let&apos;s make your home happy 😊</p>
        <button className="welcome-go" onClick={leave} autoFocus>
          Start shopping <span aria-hidden>→</span>
        </button>
        <button className="welcome-skip" onClick={leave}>
          Skip
        </button>
      </div>
      <div className="welcome-progress" aria-hidden style={{ animationDuration: `${AUTO_MS}ms` }} />
    </div>
  );
}
