"use client";

import { useEffect, useRef, useState } from "react";

export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export type ShareResult = {
  share_code: string;
  share_url: string;
  share_expires_at: string | null;
  created: boolean;
};

type Options = {
  messages: readonly unknown[];
  status: ChatStatus;
  // Optional seed: messages copied in from a forked /c/<code> page.
  onSeedMessages?: (messages: unknown[]) => void;
};

export function useChatSession({
  messages,
  status,
  onSeedMessages,
}: Options) {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [bootstrapError, setBootstrapError] = useState<string | null>(null);
  const lastSyncedCountRef = useRef<number>(0);
  const inFlightPutRef = useRef<Promise<void> | null>(null);
  const previousStatusRef = useRef<ChatStatus>(status);

  /* ---------- bootstrap ---------- */
  useEffect(() => {
    let cancelled = false;
    const params =
      typeof window === "undefined"
        ? new URLSearchParams()
        : new URLSearchParams(window.location.search);
    const forkCode = params.get("fork");
    const body: Record<string, string> = {};
    if (forkCode) body.fork_share_code = forkCode;

    (async () => {
      try {
        const res = await fetch("/api/sessions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error(`bootstrap failed (${res.status})`);
        const data = (await res.json()) as {
          session_id: string;
          messages: unknown[];
        };
        if (cancelled) return;
        setSessionId(data.session_id);
        lastSyncedCountRef.current = Array.isArray(data.messages)
          ? data.messages.length
          : 0;
        if (
          forkCode &&
          onSeedMessages &&
          Array.isArray(data.messages) &&
          data.messages.length > 0
        ) {
          onSeedMessages(data.messages);
          // Strip ?fork=… from the URL so a reload starts a fresh session.
          if (typeof window !== "undefined") {
            const url = new URL(window.location.href);
            url.searchParams.delete("fork");
            window.history.replaceState({}, "", url.toString());
          }
        }
      } catch (err) {
        if (cancelled) return;
        setBootstrapError(
          err instanceof Error ? err.message : "could not start session",
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // Run once on mount. onSeedMessages is intentionally not in deps to keep
    // bootstrap a one-shot effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---------- persist on turn end ---------- */
  useEffect(() => {
    const prev = previousStatusRef.current;
    previousStatusRef.current = status;
    if (!sessionId) return;
    // Trigger on the transition into "ready" or "error" from a busy state —
    // that is when the assistant has finished writing the latest turn.
    const justFinished =
      (prev === "streaming" || prev === "submitted") &&
      (status === "ready" || status === "error");
    if (!justFinished) return;
    if (messages.length === lastSyncedCountRef.current) return;

    const snapshot = messages as unknown[];
    const send = async () => {
      try {
        const res = await fetch(
          `/api/sessions/${encodeURIComponent(sessionId)}`,
          {
            method: "PUT",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ messages: snapshot }),
          },
        );
        if (res.ok) {
          lastSyncedCountRef.current = snapshot.length;
        }
      } catch {
        // Persistence failure is non-fatal — the chat still works in-memory.
      }
    };
    // Chain to avoid out-of-order PUTs if two turns finish back-to-back.
    inFlightPutRef.current = (inFlightPutRef.current ?? Promise.resolve()).then(
      send,
    );
  }, [status, messages, sessionId]);

  /* ---------- share ---------- */
  const share = async (): Promise<ShareResult> => {
    if (!sessionId) throw new Error("session not ready");
    // Flush any pending PUT first so the shared transcript matches what the
    // viewer sees. A `Promise.race` would race against an indefinite hang; we
    // intentionally wait.
    if (inFlightPutRef.current) {
      try {
        await inFlightPutRef.current;
      } catch {
        // ignore — share proceeds with whatever is persisted.
      }
    }
    const res = await fetch(
      `/api/sessions/${encodeURIComponent(sessionId)}/share`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      },
    );
    if (!res.ok) {
      throw new Error(`share failed (${res.status})`);
    }
    return (await res.json()) as ShareResult;
  };

  return { sessionId, share, bootstrapError };
}
