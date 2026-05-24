import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "About — cfde-atlas",
  description:
    "About cfde-atlas: who built it, what it does, the data behind it, and how to cite or contribute.",
};

const REPO_URL = "https://github.com/seandavi/cfde-atlas";

export default function AboutPage() {
  return (
    <div className="h-full overflow-y-auto bg-background text-foreground">
      <header className="border-b border-border bg-background/85 backdrop-blur px-5 py-3 sticky top-0 z-10">
        <div className="mx-auto w-full max-w-3xl flex items-center justify-between gap-3">
          <Link
            href="/"
            className="font-mono text-[13px] tracking-wider uppercase text-accent hover:underline"
          >
            cfde-atlas
          </Link>
          <span className="text-xs text-foreground-muted">About</span>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-5 py-8 flex flex-col gap-8 text-[15px] leading-relaxed">
        <section className="flex flex-col gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            About cfde-atlas
          </h1>
          <p className="text-foreground-muted">
            A conversational lens on the Common Fund Data Ecosystem (CFDE) —
            bibliometrics, grants, code activity, and web traffic across CFDE
            programs, joined on NIH core project number. Ask in plain English;
            the model plans the query, runs it against a read-only Postgres,
            and returns tables and Vega-Lite charts side by side.
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Who built it</h2>
          <p className="text-foreground-muted">
            Built by <span className="text-foreground">Sean Davis</span> with
            the <span className="text-foreground">CFDE Evaluation Core</span>.
            Source, issues, and contribution guidelines live in the{" "}
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              GitHub repository
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">What&apos;s behind the answers</h2>
          <ul className="list-disc pl-5 text-foreground-muted flex flex-col gap-1.5 marker:text-foreground-faint">
            <li>
              Tables are joined on NIH core project number (e.g.{" "}
              <span className="font-mono text-foreground">U54OD036472</span>).
            </li>
            <li>
              The model has four tools:{" "}
              <span className="font-mono text-foreground">list_tables</span>,{" "}
              <span className="font-mono text-foreground">describe_table</span>,{" "}
              <span className="font-mono text-foreground">run_query</span>, and{" "}
              <span className="font-mono text-foreground">render_chart</span>.
            </li>
            <li>
              <span className="font-mono text-foreground">run_query</span> is
              SELECT-only — write statements are rejected at the guard.
            </li>
            <li>
              Every assistant turn footers the model used and the freshness of
              the data it touched.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Known limitations</h2>
          <ul className="list-disc pl-5 text-foreground-muted flex flex-col gap-1.5 marker:text-foreground-faint">
            <li>
              Answers are <span className="text-foreground">not citations</span>{" "}
              — verify against primary sources before quoting in reports.
            </li>
            <li>
              Joins are only as good as the core project number. Programs
              without one (or with stale assignments) under-count.
            </li>
            <li>
              Data refresh is periodic, not live. The footer on each response
              shows the freshness of the tables that fed it.
            </li>
          </ul>
        </section>

        <section className="flex flex-col gap-2">
          <h2 className="text-lg font-semibold">Reporting issues</h2>
          <p className="text-foreground-muted">
            Wrong number, broken chart, or a join that looks off? Please open
            an issue with the prompt and the shared transcript link:{" "}
            <a
              href={`${REPO_URL}/issues/new`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent hover:underline"
            >
              github.com/seandavi/cfde-atlas/issues
            </a>
            .
          </p>
        </section>

        <section className="flex flex-col gap-2 pt-2 border-t border-border">
          <p className="text-xs text-foreground-faint">
            cfde-atlas is open source under the MIT license.{" "}
            <Link href="/" className="hover:underline">
              Back to the chat
            </Link>
            .
          </p>
        </section>
      </main>
    </div>
  );
}
