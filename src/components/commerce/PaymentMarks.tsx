/**
 * Acceptance marks for the checkout payment section.
 *
 * Drawn here rather than loaded as images: they are a handful of shapes, they must stay
 * crisp at 20px, and a checkout should not open a connection to a third party just to
 * show a logo. Keep them small and plain -- they say "these are accepted", nothing more.
 *
 * Server component: no state, no handlers, so it costs the browser nothing.
 */

/** Mastercard's two interlocking discs. The overlap darkens on its own via the opacity. */
function Mastercard() {
  return (
    <svg className="pay-mark" viewBox="0 0 34 22" role="img" aria-label="Mastercard">
      <rect x="0.5" y="0.5" width="33" height="21" rx="3.5" className="pay-mark-plate" />
      <circle cx="14" cy="11" r="6" fill="#eb001b" />
      <circle cx="20" cy="11" r="6" fill="#f79e1b" fillOpacity="0.85" />
    </svg>
  );
}

/** A plate with a word on it, for the marks that are really just a wordmark. */
function WordMark({ word, label, tone }: { word: string; label: string; tone: "visa" | "apple" | "epp" }) {
  return (
    <span className={`pay-mark pay-word ${tone}`} role="img" aria-label={label}>
      {word}
    </span>
  );
}

export function PaymentMarks() {
  return (
    <span className="pay-marks">
      <WordMark word="VISA" label="Visa" tone="visa" />
      <Mastercard />
      <WordMark word="Pay" label="Apple Pay" tone="apple" />
      <WordMark word="EPP" label="Bank Muscat instalments" tone="epp" />
    </span>
  );
}

/** Closed padlock, for the "secure and encrypted" line. */
export function LockIcon() {
  return (
    <svg className="lock-icon" viewBox="0 0 16 16" aria-hidden focusable="false">
      <path d="M4.75 7V5a3.25 3.25 0 0 1 6.5 0v2" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      <rect x="3" y="7" width="10" height="7" rx="1.6" fill="currentColor" />
    </svg>
  );
}
