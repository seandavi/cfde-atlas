"use client";

export function ForkButton({ shareCode }: { shareCode: string }) {
  // Fork → /?fork=<code>. The Page bootstraps a new session whose
  // parent_session_id is the shared session and whose initial messages
  // are seeded from the parent (server-side, in /api/sessions POST).
  const href = `/?fork=${encodeURIComponent(shareCode)}`;
  return (
    <a
      href={href}
      className="text-xs font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-surface-muted whitespace-nowrap"
      title="Open this transcript in a new editable chat."
    >
      Fork into new chat
    </a>
  );
}
