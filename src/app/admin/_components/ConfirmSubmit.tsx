"use client";

import { useState } from "react";
import { useFormStatus } from "react-dom";

/**
 * A submit button for something destructive: the first click asks, the second does it.
 *
 * Deliberately an inline two-step rather than window.confirm(). A native dialog blocks
 * the whole browser (which breaks automated testing of the panel), cannot be styled or
 * translated, and reads poorly on a phone -- and this panel is meant to be usable from
 * one. The question appears in the page, next to the thing it is about.
 */
export function ConfirmSubmit({
  label,
  confirmLabel,
  question,
  className = "adm-btn adm-btn-danger",
}: {
  label: string;
  confirmLabel: string;
  question: string;
  className?: string;
}) {
  const [asking, setAsking] = useState(false);
  const { pending } = useFormStatus();

  if (!asking) {
    return (
      <button type="button" className={className} onClick={() => setAsking(true)}>
        {label}
      </button>
    );
  }

  return (
    <span className="adm-confirm" role="group" aria-label={question}>
      <strong>{question}</strong>
      <button type="submit" className={className} disabled={pending}>
        {pending ? "Working…" : confirmLabel}
      </button>
      <button type="button" className="adm-btn adm-btn-quiet" onClick={() => setAsking(false)} disabled={pending}>
        Keep it
      </button>
    </span>
  );
}
