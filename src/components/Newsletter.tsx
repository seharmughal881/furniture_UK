"use client";

import { useState } from "react";

export function Newsletter() {
  const [state, setState] = useState<"idle" | "sending" | "done" | "error">("idle");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setState("sending");
    const email = new FormData(e.currentTarget).get("email");
    const res = await fetch("/api/newsletter", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    }).catch(() => null);
    setState(res?.ok ? "done" : "error");
  }

  return (
    <form className="newsletter" onSubmit={submit}>
      <p className="label">The workshop letter</p>
      <p>New pieces, studio open days and offcut sales. Monthly at most.</p>
      {state === "done" ? (
        <p className="notice">You&apos;re on the list. Thank you.</p>
      ) : (
        <div className="newsletter-row">
          <input name="email" type="email" required placeholder="Email address" aria-label="Email address" autoComplete="email" />
          <button className="btn solid" disabled={state === "sending"}>
            {state === "sending" ? "…" : "Subscribe"}
          </button>
        </div>
      )}
      {state === "error" && <p className="notice err">Please check the email address and try again.</p>}
    </form>
  );
}
