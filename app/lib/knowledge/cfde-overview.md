# CFDE program overview

The Common Fund Data Ecosystem (CFDE) is an NIH Common Fund initiative
that knits together the many program-specific data resources funded by
the Common Fund into a discoverable, interoperable ecosystem. Most CFDE
work is keyed in NIH RePORTER on the **core project number** — e.g.
`U54OD036472`, `R03OD032630`. Activity codes commonly seen across CFDE:
`U54`, `U24`, `R03`, `R21`, `RC2`, `OT2`.

## In-scope programs (representative, not exhaustive)

- **Bridge2AI** — generative AI-ready datasets across health domains
- **LINCS** — Library of Integrated Network-based Cellular Signatures
- **GTEx** — Genotype-Tissue Expression
- **HuBMAP** — Human BioMolecular Atlas Program
- **MoTrPAC** — Molecular Transducers of Physical Activity Consortium
- **4DN** — 4D Nucleome
- **KidsFirst** — pediatric cancer + structural birth defects
- **CFDE-CC** — Coordinating Center
- **DRC** — Data Resource Center (asset manifest sits behind `analytics.drc_*`)

## How CFDE impact is usually measured

Council-of-Councils-style storytelling tends to lean on these axes — most
have a corresponding analytics table:

- **Publications** — counts, citation counts (iCite NIH RCR), top-cited
  papers, journal-level prestige (SCImago). Lives in
  `analytics.publications`, `analytics.journals`.
- **Derivative funding** — downstream NIH grants that cite CFDE
  publications. Pipeline: `analytics.citing_publications` →
  `analytics.citing_grants` → `analytics.citing_grant_details`. Useful
  for "$1 of CFDE → $X of derivative R-series funding" stories. Treat as
  correlation, not causation.
- **Software / data resources** — `analytics.github_repos` for code
  activity (stars, forks, commits, contributors, releases),
  `analytics.drc_*` for the DRC asset manifest.
- **Web traffic** — `analytics.ga_reports` (Google Analytics aggregates,
  joined by URL → program where possible).
- **Opportunities (FOAs / RFAs / NOFOs)** — `analytics.opportunities`,
  PR-curated in the ETL repo `config.yaml`.

## Stat / chart conventions program officers expect

- Counts and totals over a fiscal year (FY runs Oct 1 → Sep 30 for NIH).
  Partial-year FY data needs an explicit caveat.
- iCite **Relative Citation Ratio (RCR)** ~ field-normalized citations
  per year, expected value 1.0. RCR > 2 is "well-cited." Means are
  noisy; medians or distributions are preferable for small N.
- Citation counts include preprints when iCite has them — note that.
- Avoid pseudo-precision: round funding to nearest $1M and citations to
  nearest 10 when the underlying N is small.
- For derivative funding charts, Sankey / chord beats bar — the
  fan-out is the point.

## Methodological caveats worth surfacing in legends

- "Cited by an NIH-funded paper" ≠ "depended on CFDE." Wording matters.
- iCite RCR requires ≥2 years post-publication; recent papers underread.
- RePORTER's `total_cost` mixes direct + indirect + supplements; flag
  what the chart slices on.
- Cross-program "joint pub" counts depend on co-authorship attribution
  which is itself imperfect.
