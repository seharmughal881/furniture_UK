"use client";

import { useSyncExternalStore } from "react";
import type { Week } from "@/lib/showrooms";

/**
 * "Open now" and today's row in the timetable depend on the visitor's clock, which the
 * prerendered page cannot know. The server snapshot is "", so nothing time-based is drawn
 * until the browser takes over -- no hydration mismatch, and no stale "Open" in a cached page.
 */

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "day:minutes" in Muscat time, whatever timezone the visitor's device is set to. */
function muscatNow() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Muscat",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return `${DAYS.indexOf(get("weekday"))}:${Number(get("hour")) * 60 + Number(get("minute"))}`;
}

const subscribe = (onChange: () => void) => {
  const id = window.setInterval(onChange, 30_000);
  return () => window.clearInterval(id);
};

function useMuscatClock(): { day: number; min: number } | null {
  const snap = useSyncExternalStore(subscribe, muscatNow, () => "");
  if (!snap) return null;
  const [day, min] = snap.split(":").map(Number);
  return { day, min };
}

const clock = (m: number) => {
  const hr = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = hr >= 12 ? "pm" : "am";
  const h12 = hr % 12 || 12;
  return `${h12}${mm ? `:${String(mm).padStart(2, "0")}` : ""} ${suffix}`;
};

function status(week: Week, day: number, min: number) {
  const span = week[day].find(([o, c]) => min >= o && min < c);
  if (span) return { open: true, text: `Open now · closes ${clock(span[1])}` };
  const later = week[day].find(([o]) => o > min);
  if (later) return { open: false, text: `Closed · opens ${clock(later[0])} today` };
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (week[d][0]) return { open: false, text: `Closed · opens ${clock(week[d][0][0])} ${i === 1 ? "tomorrow" : DAYS[d]}` };
  }
  return { open: false, text: "Closed" };
}

export function OpenStatus({ week }: { week: Week }) {
  const now = useMuscatClock();
  if (!now) return <span className="open-status pending" aria-hidden />;
  const s = status(week, now.day, now.min);
  return (
    <span className={`open-status ${s.open ? "is-open" : "is-closed"}`} role="status">
      <i aria-hidden />
      {s.text}
    </span>
  );
}

/** The week laid out Saturday first, as the Omani week runs, with today marked. */
export function HoursTable({ week }: { week: Week }) {
  const now = useMuscatClock();
  const order = [6, 0, 1, 2, 3, 4, 5];
  return (
    <ul className="hours-table">
      {order.map((d) => (
        <li key={d} className={now?.day === d ? "today" : undefined} aria-current={now?.day === d ? "date" : undefined}>
          <span>
            {DAYS[d]}
            {now?.day === d && <em> · today</em>}
          </span>
          <span>{week[d].length ? week[d].map(([o, c]) => `${clock(o)} – ${clock(c)}`).join(", ") : "Closed"}</span>
        </li>
      ))}
    </ul>
  );
}
