# Where each Kids First PPST query could come from

Checked 2026-09-10 against NIH RePORTER, C2M2 (atlas `c2m2.*`), the DRC asset registry
(atlas `analytics.drc_code`), and the NIH Guide. Per-query detail is in
`KidsFirst_query_provenance.csv` (local, gitignored). 386 queries total.

| Query kind | N | Source | How | Verified |
|---|---:|---|---|---|
| R03 / U24 / U2C grant serials | 47 | RePORTER `projects/search` | `opportunity_numbers` for the Kids First FOAs: RFA-RM-16-001, RFA-RM-16-010, RFA-RM-21-011, RFA-RM-21-013, RFA-RM-21-014, RFA-RM-22-006, PAR-16-348, PAR-18-733, PAR-19-375, PAR-23-075. Every one is titled "Gabriella Miller Kids First" in the NIH Guide | 47/47 found |
| X01 grant serials | 78 | Program office | X01 resource-access awards carry no money and are **not in RePORTER** (0/78). The public list at commonfund.nih.gov/kidsfirst/X01Projects has ~80 projects but prints only 2 grant numbers | 0/78 |
| "Grant_Number" user-tier serials | 13 | Human | All 13 are in RePORTER, but under NIDCR/NICHD birth-defects PARs (PAR-17-236, PAR-20-045, PAR-21-229), not Kids First FOAs. The analyst knew these R01s used Kids First data; nothing structured says so | 13/13 exist, 0 derivable |
| dbGaP accessions | 38 | C2M2 | `c2m2.file.dbgap_study_id` where `id_namespace = 'kidsfirst:'` | 35/38 (3 missing were zero-hit or tagged Broader Influence) |
| Cites-awardee-paper PMIDs | 195 | RePORTER `publications/search` | `core_project_nums` of the 47 R03/U24/U2C cores returns 214 PMIDs; 166 of the 195 are among them. 6 more are publications of the 13 user-tier R01s. The remaining 23 are not RePORTER-linked at all; most acknowledge an X01 or a Kids First-adjacent grant, so they were almost certainly copied from PPST's own Awardee-tier output | 166/195 (85%) |
| Portal / repo URLs | 4 | DRC registry + C2M2 | `portal.kidsfirstdrc.org` and `github.com/kids-first` both appear in `analytics.drc_code`; the bare domain is `c2m2.dcc.dcc_url` | 4/4 |
| Program name variants, "Cavatica" AND "Kids First", cloud-credit phrase | 10 | Human | `c2m2.dcc.dcc_name` gives only the official long name | 0 |
| White paper PMID | 1 | Human | | 0 |

Totals: 265 derivable now, 6 partially, 115 not.

## Where the RePORTER ids come from in the first place

Not from RePORTER text search: a title search for "Gabriella Miller Kids First" returns 9 core
projects, 8 of the 125 awardee grants. The reliable bootstrap is the FOA list. RePORTER
`projects/search` with `opportunity_numbers` returns every R03/U24/U2C award, and the FOAs are
themselves discoverable by searching the NIH Guide for the program name. This is exactly what
`cfde-atlas-etl/config.yaml` already does for CFDE (`opportunities:` curated by PR), so
extending to another Common Fund program is a config change: add its FOAs.

The gap that FOAs cannot close is X01. Kids First's largest awardee cluster (78 of 125 grants,
87 unique PMIDs in Europe PMC) is invisible to RePORTER. Options: ask the program office for
the X01 award list, scrape the X01Projects page and reconcile PI + title against RePORTER for
the PI's other awards, or accept that the Awardee tier for Kids First is "R03/U24/U2C plus
whatever X01 numbers we are handed". This is specific to programs that make X01 awards.

## Reading

- For CFDE-scoped programs the atlas already has the FOA route, RePORTER publications, C2M2
  accessions, DRC URLs, and iCite citations. That covers 265 of 386 Kids First queries with
  no human input.
- The irreducibly human list for Kids First is short: 10 name/platform strings, 13 grants known
  to have used the data, 1 flagship paper, and the X01 numbers. Check it in as YAML per program.
- The Eval team's 195 "awardee papers" for citation chasing are not a curated set; they are the
  previous tier's output. Reproduce that mechanically (RePORTER publications of the awardee
  cores) rather than by hand, and the 214 vs 195 difference is the X01 gap in the other
  direction.
