# Design note: reproducing PPST-style publication impact tiers in the atlas

Status: proposal, 2026-09-10. Context in `README.md`.

## Problem

The NIH Office of Strategic Coordination's Eval team measures program impact with PPST, an
in-house spreadsheet-plus-script that runs quoted-phrase queries against Europe PMC and labels
each hit Awardee, User, or Broader Influence by which paper section the term appears in. The
atlas currently has only the Awardee tier (RePORTER grant linkage + iCite) and none of the Kids
First grants. For Council of Councils we want numbers in the same vocabulary, produced from the
ecosystem's own metadata, repeatable across years.

PPST has no public footprint. It is built on Europe PMC's public section-search prefixes
(`METHODS:`, `ACK_FUND:`, `CITES:`, `REF:`, ...) plus a hand-built query list per program.
Treat it as a method to be compatible with, not a tool to adopt.

## What is mechanical vs. human

Kids First 1.0 run: 386 queries, 371 derivable from structured sources, 15 free text.

| Query kind | Count | Source in the ecosystem |
|---|---|---|
| Grant serials (`*HL132363`) | 138 | RePORTER project list (atlas `analytics.core_projects`) |
| dbGaP accessions (`phs001138`) | 38 | `c2m2.file.dbgap_study_id` (35 of the 38; the other 3 were zero-hit or Broader Influence) |
| Cites-awardee-paper PMIDs | 194 | output of the Awardee tier fed back in |
| Portal / repo URLs | 4 | `c2m2.dcc.dcc_url` homepage + DRC "Apps URL" assets (`analytics.drc_code`) |
| Program name variants, platform disambiguators ("Cavatica" AND "Kids First"), flagship white paper PMID | 7 | human, per program |
| Method names + founding-paper DOIs (4DN example only) | n/a | human, per program |

The human contribution reduces to a short per-program list: name variants, one or two
disambiguating terms, and method names for programs that produce methods.

## Search backend: Europe PMC API, not a local full-text index

Measured 2026-09-10 against `https://www.ebi.ac.uk/europepmc/webservices/rest/search`:

| Query | Hits |
|---|---|
| `"portal.kidsfirstdrc.org" AND FIRST_PDATE:[2015 TO 2025]` | 29 (matches PPST query 130 exactly) |
| `"kidsfirstdrc.org" AND FIRST_PDATE:[2015 TO 2025]` | 62 |
| `ACK_FUND:"portal.kidsfirstdrc.org"` / `ACK_FUND:"kidsfirstdrc.org"` | 0 / 12 |
| `kidsfirstdrc*` / `*kidsfirstdrc*` / `METHODS:kidsfirstdrc*` | 68 / 137 / 18 |
| `phs00113*` / `HL13236*` | 28 / 41 |
| `HAS_FT:y` / `OPEN_ACCESS:y AND HAS_FT:y` | 12.3M / 8.2M |

Conclusions:

- PPST is plain quoted-phrase search on the public API; its counts reproduce exactly.
- The API already supports trailing and leading wildcards, composable with section fields.
- A local index of the Europe PMC OA bulk download indexes a strict subset of what the API
  searches (same OA-only full text, minus closed-access abstracts/metadata). Hundreds of GB and
  a keep-current pipeline for no coverage gain.
- The bare DCC domain (`kidsfirstdrc.org`) is the better seed than the portal subdomain; the
  portal form misses half the mentions, almost all in Acknowledgements and References.

Decision: API for recall. Fetch full-text XML (`/{PMCID}/fullTextXML`) only for the candidate
set (hundreds of papers per program) and do exact matching locally on those.

What the local pass on candidates adds: character-exact URL/accession matching (the API
tokenizer is loose on dotted strings), the evidence sentence stored next to the label, and a
frozen snapshot so a number reported to the Council is reproducible next year.

Revisit a full local index only if we need regex over the whole corpus, or if running all 18
Common Fund programs on a schedule hits API rate limits. Neither is true yet.

## Proposed shape

1. Per-program seed table, mostly generated: grant serials from `analytics.core_projects`,
   accessions from `c2m2.file`, domain from `c2m2.dcc.dcc_url`, app URLs from
   `analytics.drc_code`, plus a small hand-curated `terms` list (name variants, disambiguators,
   methods) checked in as YAML so the query set is versioned. PPST has no versioning; this is
   the main thing we would do better.
2. Query runner: one Europe PMC query per (term, section) with the program's date window;
   land raw hits in `raw.epmc_hits (pmid, program, term, section, query, fetched_at)`.
3. Candidate full-text pass: fetch XML for unique PMCIDs, extract the matching sentence per
   (term, section), store in `raw.epmc_evidence`.
4. Analytics view: one row per (pmid, program) with Awardee / User / Broader Influence flags
   and `final_assignment` under the Awardee > User > Broader Influence rule. Same shape as
   PPST's `Data_Matrixed_Cluster`, so the Eval team's numbers and ours are directly comparable.
5. Cites tier: iCite `cited_by` on the Awardee set, which `flows.citing_publications` already
   does.

## Known limits (shared with PPST)

- Section-level matching only works for open-access full text; closed papers match only on
  abstract and metadata, so the User tier undercounts.
- Grant wildcard `*HL132363` matches the six-character serial across activity codes and years.
- Cites-awardee-paper is a weak signal and dwarfs the other tiers (4648 PMIDs for Kids First
  vs 243 Awardee + 217 User). Report it separately, never summed.
