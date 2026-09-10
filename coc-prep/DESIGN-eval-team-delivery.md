# Design note: delivering publication-impact data back to the Eval team

Status: proposal, 2026-09-10. Companion to `DESIGN-publication-search.md`.

## Recommendation

Database is the system of record. Deliver to the Eval team as:

1. **A workbook in their own PPST shape, generated on demand.** Same five sheets they already
   produce (Summary, Query_Summary, Data_Tabular, Data_Matrixed_Query, Data_Matrixed_Cluster)
   plus two columns they lack: an evidence sentence per hit and a run identifier. One export
   query per sheet. They can diff our numbers against theirs the same afternoon.
2. **A static one-page report per program.** Tier counts, papers per year by tier, top
   journals, RCR distribution, with run date and query-set version printed on it. This is what
   gets pasted into a Council slide and what gets archived.
3. **Chat (existing cfde-atlas) as the ad hoc layer**, pointed at the same analytics views so
   the numbers agree. Not the primary delivery: an evaluator cannot cite a transcript in a
   closeout report, and the same question can produce different SQL twice.
4. **A review queue.** Table of hits with the evidence sentence and a way to override the
   tier, written back to a curation table the views respect. Every PPST label is an analyst
   judgment (see the two dbGaP accessions tagged Broader Influence in the Kids First run).
   Without this they will fix labels in Excel and the database drifts from their reported
   numbers within one cycle.

## Why not the alternatives

- **Pile of Excel files** is what they have now. Its failure is that nothing links runs.
  Generating the workbook from a versioned query set and a dated run table fixes that without
  changing what lands on their desk.
- **Filterable dashboard** is skipped for now. Evaluators report, they do not explore. Build
  it only if program officers, not evaluators, turn out to be the main readers.

## Who reads what

| Reader | Primary surface | Why |
|---|---|---|
| Eval team analyst | Workbook + review queue | Excel workflow, row-level review, feeds Stage 2 / closeout / progress reports |
| Program officer, Council | Static per-program page | Five or six numbers and one chart, citable, archived |
| Anyone with a new question | Chat | Unanticipated joins across programs and tiers |
