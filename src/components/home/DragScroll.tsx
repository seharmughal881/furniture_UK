"use client";

import { useRef } from "react";

/** A horizontal scroller you can also drag with the mouse; a drag doesn't count as a click. */
export function DragScroll({ className, children }: { className?: string; children: React.ReactNode }) {
  const el = useRef<HTMLDivElement>(null);
  const drag = useRef({ down: false, x: 0, left: 0, moved: false });

  return (
    <div
      ref={el}
      className={className}
      data-lenis-prevent-wheel
      onPointerDown={(e) => {
        if (e.pointerType !== "mouse" || !el.current) return;
        drag.current = { down: true, x: e.clientX, left: el.current.scrollLeft, moved: false };
      }}
      onPointerMove={(e) => {
        const d = drag.current;
        if (!d.down || !el.current) return;
        const dx = e.clientX - d.x;
        if (Math.abs(dx) > 4) d.moved = true;
        el.current.scrollLeft = d.left - dx;
      }}
      onPointerUp={() => (drag.current.down = false)}
      onPointerLeave={() => (drag.current.down = false)}
      onClickCapture={(e) => {
        if (drag.current.moved) {
          e.preventDefault();
          e.stopPropagation();
          drag.current.moved = false;
        }
      }}
    >
      {children}
    </div>
  );
}
