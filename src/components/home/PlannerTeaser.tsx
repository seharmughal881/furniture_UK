"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAmbient3D } from "@/components/Canvas3D";

/** three.js arrives with this chunk, and only when useAmbient3D allows it. */
const PlannerTeaserScene = dynamic(() => import("./PlannerTeaserScene"), { ssr: false });

export type PlannerTeaserCopy = {
  label: string;
  heading: string;
  emphasis: string;
  headingEnd: string;
  body: string;
  buttonLabel: string;
};

/**
 * Wording arrives as a prop rather than being read here: this is a client component (it
 * drives a WebGL view), and getContent() is server-only. The home page reads the content
 * and passes it down.
 */
export function PlannerTeaser({ copy }: { copy: PlannerTeaserCopy }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  // decoration: desktop only, after idle
  const ready3D = useAmbient3D();
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.3 });
    if (ref.current) io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return (
    <div className="teaser">
      <div className="teaser-copy above">
        <p className="label" style={{ color: "#9a9a9a" }}>
          {copy.label}
        </p>
        <h2>
          {copy.heading} <em style={{ color: "#ff4d5a" }}>{copy.emphasis}</em> {copy.headingEnd}
        </h2>
        <p>{copy.body}</p>
        <Link href="/planner" className="btn light">
          {copy.buttonLabel}
        </Link>
      </div>
      <div className="teaser-view" ref={ref}>
        {seen && ready3D && <PlannerTeaserScene />}
      </div>
    </div>
  );
}
