# coc-prep: Council of Councils preparation

Materials from Christy Kano (CFDE Program Officer), forwarded 2026-09-09 from her Eval team.
Source folder: https://drive.google.com/drive/folders/13jqvXxM6VmBQPPJHlwSY6nyrbGCgc3AJ

Christy's note: the first spreadsheet (`2026.04.24_...`) is an example the Eval team ran for the
Kids First program; the second (`20250910_...`) is the input template; the pptx explains what the
terms and fields in the spreadsheet mean and how they are used to generate the results.

## What the tool is

PPST = Program Publication Search Tool. An in-house, keyword-based Europe PMC search driven by an
input spreadsheet. Each query row is a search term plus a paper section (Methods, Acknowledgements,
Title/Abstract, Cites, References, ...). Where the term is found determines the publication's
relationship to the program, with a strict hierarchy:

| Impact category | Typical evidence |
|---|---|
| Awardee | Program grant number in Grants & Funding |
| User | Method name, data portal, or program name in Methods / Acknowledgements |
| Broader Influence (a.k.a. Influenced By) | Cites an awardee paper; program name in Acknowledgements, Title/Abstract, or body |

Awardee > User > Broader Influence: a paper gets the highest category any query hits.
Output is a workbook with `Data_Tabular` (all hits, one row per query hit), `Data_Matrixed_Query`
(unique PMIDs x query, with `Final_Assignment`), and `Data_Matrixed_Cluster` (unique PMIDs x
query cluster). iCite metadata is joined in.

## Files

| File | What it is |
|---|---|
| `PPST_Background, Inputs, Output Sheets Meaning.pptx` | Original deck (byte-exact copy from Drive) |
| `PPST_Background_Inputs_Output_Sheets_Meaning.md` | Slide text dump of the deck |
| `20250910_Publication_Database_Script_input-template.md` | Full text rendering of the input template: column glossary, Europe PMC field lookup, and the 4D Nucleome example query set |
| `KidsFirst_Query_Summary.csv` | The 386 queries the Eval team ran for Kids First 1.0 (2015-2025), with the exact Europe PMC query string and hit counts per query |
| `2026.04.24_PPST_KidsFirstoutput.txt` | Text rendering of the Kids First output workbook: Summary sheet plus a truncated `Data_Matrixed_Query`. `Data_Tabular` did not survive the rendering |
| `20250910_Publication_Database_Script_input-template.xlsx` | Original input template (downloaded manually) |
| `2026.04.24_PPST_KidsFirstoutput.xlsx` | Original Kids First output workbook (downloaded manually) |
| `DESIGN-publication-search.md` | Design note: reproducing the PPST tiers from ecosystem metadata via the Europe PMC API |

## Kids First 1.0 run at a glance (from the Summary sheet)

Analyst Vanessa Barnes, run 2026-04-24, period 2015-2025.

| Impact category | Query clusters | Unique PMIDs |
|---|---|---|
| Awardee | X01, R03, U24, U2C | 243 |
| User | Data_Resource_Identifier, Cloud_Credit_Search_Term, Program_Name, dBGap_accession_number, Grant_Number | 217 |
| Broader Influence | White_paper (7 PMIDs), Cites_Awardee_Paper (194 awardee papers, 4648 citing PMIDs) | not totalled in the Summary sheet |

Awardee queries are grant numbers searched with the `*HL132363` wildcard form and a
`FIRST_PDATE:[2015 TO 2025]` date clamp.
