"use client";

import { useEffect, useRef, useState } from "react";

import { trackFeedbackSubmitted } from "@/app/lib/analytics";

type Rating = 1 | -1 | null;
type SubmitState = "idle" | "saving" | "saved" | "error";

// How long the inline note input stays open after a thumbs-down before
// auto-collapsing (per issue #36 — "~10s after submit").
const NOTE_AUTO_DISMISS_MS = 10_000;

type Props = {
  sessionId: string | null;
  messageId: string;
};

export default function FeedbackBar({ sessionId, messageId }: Props) {
  const [rating, setRating] = useState<Rating>(null);
  const [hasNote, setHasNote] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [note, setNote] = useState("");
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const dismissRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const noteInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    return () => {
      if (dismissRef.current) clearTimeout(dismissRef.current);
    };
  }, []);

  const disabled = !sessionId || submitState === "saving";

  const post = async (next: Rating, nextNote: string | null) => {
    if (!sessionId) return;
    setSubmitState("saving");
    setErrMsg(null);
    try {
      const res = await fetch(
        `/api/sessions/${encodeURIComponent(sessionId)}/feedback`,
        {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            message_id: messageId,
            rating: next,
            note: nextNote,
          }),
        },
      );
      if (!res.ok) {
        throw new Error(`feedback failed (${res.status})`);
      }
      setRating(next);
      setHasNote(next === -1 && !!nextNote);
      setSubmitState("saved");
      trackFeedbackSubmitted({
        rating: next === 1 ? "up" : next === -1 ? "down" : "cleared",
        had_note: !!nextNote,
      });
    } catch (err) {
      setSubmitState("error");
      setErrMsg(err instanceof Error ? err.message : "feedback failed");
    }
  };

  const clickThumb = async (clicked: 1 | -1) => {
    if (disabled) return;
    // Re-clicking the active rating clears it.
    if (rating === clicked) {
      setNoteOpen(false);
      setNote("");
      await post(null, null);
      return;
    }
    await post(clicked, null);
    if (clicked === -1) {
      setNoteOpen(true);
      // Focus on the next paint so the input is rendered.
      setTimeout(() => noteInputRef.current?.focus(), 0);
    } else {
      setNoteOpen(false);
      setNote("");
    }
  };

  const submitNote = async () => {
    if (!sessionId || rating !== -1) return;
    const trimmed = note.trim();
    if (!trimmed) {
      setNoteOpen(false);
      return;
    }
    await post(-1, trimmed);
    setNote("");
    setNoteOpen(false);
    // Re-open briefly after a successful save so the user sees confirmation,
    // then auto-collapse per the spec.
    if (dismissRef.current) clearTimeout(dismissRef.current);
    dismissRef.current = setTimeout(() => {
      setSubmitState("idle");
    }, NOTE_AUTO_DISMISS_MS);
  };

  const thumbBtn = (which: 1 | -1, label: string, glyph: string) => {
    const active = rating === which;
    return (
      <button
        type="button"
        aria-label={label}
        aria-pressed={active}
        title={label}
        disabled={disabled}
        onClick={() => clickThumb(which)}
        className={[
          "px-2 py-1 rounded-md border text-sm leading-none transition-colors",
          "disabled:opacity-40 disabled:cursor-not-allowed",
          active
            ? "border-accent bg-accent-soft text-accent-soft-fg"
            : "border-border text-foreground-muted hover:text-foreground hover:bg-surface-muted hover:border-border-strong",
        ].join(" ")}
      >
        {glyph}
      </button>
    );
  };

  return (
    <div className="flex flex-col gap-1.5 mt-2 text-xs">
      <div className="flex items-center gap-1.5">
        <span className="text-foreground-faint mr-1">Was this helpful?</span>
        {thumbBtn(1, "Helpful", "👍")}
        {thumbBtn(-1, "Not helpful", "👎")}
        {submitState === "saved" && rating !== null && (
          <span
            className="text-foreground-faint"
            aria-live="polite"
          >
            {hasNote ? "Thanks — note saved." : "Thanks."}
          </span>
        )}
        {submitState === "error" && (
          <span className="text-danger" role="status">
            {errMsg ?? "Could not save feedback."}
          </span>
        )}
      </div>
      {noteOpen && (
        <form
          className="flex items-center gap-1.5"
          onSubmit={(e) => {
            e.preventDefault();
            void submitNote();
          }}
        >
          <input
            ref={noteInputRef}
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything we should know?"
            maxLength={2000}
            className="flex-1 min-w-0 px-2 py-1 rounded-md border border-border bg-surface text-foreground placeholder:text-foreground-faint text-xs outline-none focus:border-accent"
          />
          <button
            type="submit"
            disabled={disabled || !note.trim()}
            className="px-2 py-1 rounded-md border border-border text-foreground-muted hover:text-foreground hover:bg-surface-muted disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Send
          </button>
          <button
            type="button"
            onClick={() => {
              setNoteOpen(false);
              setNote("");
            }}
            className="px-2 py-1 rounded-md text-foreground-muted hover:text-foreground"
            aria-label="Close note input"
          >
            ×
          </button>
        </form>
      )}
    </div>
  );
}
