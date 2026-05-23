import { notFound } from "next/navigation";
import Link from "next/link";

import {
  bumpShareView,
  getSessionByShareCode,
  isShareExpired,
  type SessionRow,
} from "@/app/lib/sessions";
import { StaticTranscript } from "@/app/components/MessageView";
import { ForkButton } from "./ForkButton";

export const dynamic = "force-dynamic";

type Params = { code: string };
type Search = { [key: string]: string | string[] | undefined };

function fmtDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtRange(min: string | null, max: string | null): string | null {
  const a = fmtDate(min);
  const b = fmtDate(max);
  if (!a && !b) return null;
  if (a && b && a !== b) return `${a} – ${b}`;
  return a ?? b ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}) {
  const { code } = await params;
  const row = await getSessionByShareCode(code);
  if (!row) return { title: "cfde-atlas — not found" };
  const title = row.title ?? "Shared conversation";
  return {
    title: `${title} · cfde-atlas`,
    description:
      "Read-only transcript shared from cfde-atlas. Anyone with the link can view.",
    robots: { index: false, follow: false },
  };
}

export default async function SharedConversationPage({
  params,
  searchParams,
}: {
  params: Promise<Params>;
  searchParams: Promise<Search>;
}) {
  const { code } = await params;
  const search = await searchParams;
  const embed = search.embed === "1" || search.embed === "true";

  const row = await getSessionByShareCode(code);
  if (!row) notFound();
  if (isShareExpired(row)) {
    return <ExpiredView code={code} />;
  }

  // Fire-and-forget view bump.
  bumpShareView(code).catch(() => undefined);

  return (
    <div className="grid h-full grid-rows-[auto_1fr] bg-background text-foreground">
      {!embed && <SharedHeader row={row} code={code} />}
      <main className="overflow-y-auto scroll-smooth">
        <div className="mx-auto w-full max-w-3xl px-5 py-10 flex flex-col gap-6">
          {!embed && <Banner row={row} />}
          <StaticTranscript
            messages={(row.messages as unknown as TranscriptMessages) ?? []}
          />
          {!embed && (
            <div className="text-[10px] text-foreground-faint mt-2 text-center">
              Mocked sample data. Verify against source systems before citing in any briefing.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

type TranscriptMessages = Array<{
  id: string;
  role: string;
  parts: Array<Record<string, unknown>>;
}>;

function SharedHeader({ row, code }: { row: SessionRow; code: string }) {
  return (
    <header className="border-b border-border bg-background/85 backdrop-blur px-5 py-3">
      <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-3">
        <div className="flex items-baseline gap-3 min-w-0">
          <Link
            href="/"
            className="font-mono text-[13px] tracking-wider uppercase text-accent hover:underline"
          >
            cfde-atlas
          </Link>
          <span className="text-xs text-foreground-muted truncate">
            {row.title ?? "Shared conversation"}
          </span>
        </div>
        <ForkButton shareCode={code} />
      </div>
    </header>
  );
}

function Banner({ row }: { row: SessionRow }) {
  const saved = fmtDate(row.last_message_at ?? row.created_at);
  const dataRange = fmtRange(
    row.data_refreshed_at_min,
    row.data_refreshed_at_max,
  );
  return (
    <div className="rounded-md border border-border bg-surface-muted text-foreground-muted text-xs px-4 py-3 leading-relaxed">
      <div>
        <span className="font-medium text-foreground">Read-only view.</span>{" "}
        Anyone with this link can read this conversation.
      </div>
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-foreground-muted">
        {saved && <span>Saved {saved}.</span>}
        {dataRange && <span>Data as of {dataRange}.</span>}
        {row.share_expires_at && (
          <span>Link expires {fmtDate(row.share_expires_at)}.</span>
        )}
      </div>
    </div>
  );
}

function ExpiredView({ code }: { code: string }) {
  return (
    <div className="grid h-full place-items-center bg-background text-foreground p-6">
      <div className="max-w-md text-center flex flex-col gap-3">
        <h1 className="text-xl font-semibold">This link has expired.</h1>
        <p className="text-sm text-foreground-muted">
          The share link <code className="font-mono">/c/{code}</code> is past
          its expiration date. Ask the person who shared it to create a new one.
        </p>
        <Link
          href="/"
          className="inline-block text-xs font-medium px-3 py-1.5 rounded-md border border-border text-foreground hover:bg-surface-muted self-center"
        >
          Start a new conversation
        </Link>
      </div>
    </div>
  );
}
