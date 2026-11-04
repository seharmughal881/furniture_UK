"use client";

/**
 * The admin's only client component. Deliberately not auto-printing on load: a print
 * dialog opening by itself is hostile, and staff often open the note just to read it.
 */
export function PrintButton() {
  return (
    <button type="button" className="adm-btn adm-btn-primary" onClick={() => window.print()}>
      Print this note
    </button>
  );
}
