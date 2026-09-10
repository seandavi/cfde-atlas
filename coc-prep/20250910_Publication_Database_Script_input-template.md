# 20250910_Publication_Database_Script_input-template.xlsx (text rendering)

Text rendering of the CFDE Eval team's PPST (Program Publication Search Tool) input template.
Sheets: `Script_Input`, `Term_Glossary`, `Field_lookup`, `Example`, `User_Guide`.
Original xlsx: https://drive.google.com/file/d/1E9x5tM_LRQECvRP7OoIYM9qWBEXInlsB/view

## Sheet: User_Guide

| Sheet | Description |
|---|---|
| Script_Input | Where the inputs are entered |
| Term_Glossary | Provides descriptions of the different column headers in Script_Input |
| Field_Lookup | A guide for each of the different options for search field. Also contains the lookup table for the dropdowns. |
| Example | Displays an example input spreadsheet |

## Sheet: Script_Input (header row only)

```
Impact.Category, Query.Cluster, Search.terms, Search.Field, OR.terms, OR.Search.Field, AND.terms, AND.Search.Field, NOT.terms, NOT.Search.Field, Notes
```

## Sheet: Term_Glossary

| Header | Description |
|---|---|
| Impact.Category | A label assigned by the analyst to characterize the publication's connection to the program based on the location of the search term. Choices are: awardee, user, or broader.influence |
| Query.Cluster | Clusters can be used to group together similar queries. For instance, a cluster named "Datasets" could be used to group together queries for a program's datasets. This field is optional, but encouraged. |
| Search.terms | Enter your search terms here. Search terms listed with commas (ie. 4D Nucleome, 4DN) are treated as 'OR' (ie. the query becomes: "4DN Nucleome" OR "4DN"). |
| Search.Field | Choose which section of the paper you would like to search for the search term. Leave the field search blank if you would like to search in the entire full text and metadata. Choices are explained in the Field_lookup sheet. |
| OR.terms | This allows you to add search terms to your main search terms under the "OR" Boolean operator. |
| OR.Search.Field | Choose which section of the paper you would like to search for the OR search term. This does not have to be the same search field as the main Search.Field. Leave blank to search the entire full text and metadata. |
| AND.terms | This allows you to add search terms to your main search terms under the "AND" Boolean operator. |
| AND.Search.Field | Choose which section of the paper you would like to search for the AND search term. Does not have to match the main Search.Field. Leave blank to search the entire full text and metadata. |
| NOT.terms | This allows you to add search terms to your main search terms under the "NOT" Boolean operator. |
| NOT.Search.Field | Choose which section of the paper you would like to search for the NOT search term. Does not have to match the main Search.Field. Leave blank to search the entire full text and metadata. |
| Notes | Enter in any notes in this section -- good for record keeping. |

## Sheet: Field_lookup

Search fields map to Europe PMC (ePMC) query prefixes.

| Field_Search | Field_Search_lookup | Description | Notes |
|---|---|---|---|
| Title | `TITLE:` | Search for a term or terms in publication titles | |
| Abstract | `ABSTRACT:` | Search for a term or terms in the Abstract section | |
| Title and Abstract | `TITLE_ABS:` | Search for a term or terms in the Title and Abstract sections | |
| Grant *do not use* | `GRANT_ID:` | Limit your search by ID of the grant which funded the research. *Should not be used to search for NIH grant numbers | ePMC does not consistently record grant numbers in the "Grants and Funding" section of a paper's metadata. To search for a grant number, leave the Search Field blank, and enter the grant number in this format: `*HD1234567` |
| Author | `AUTH:` | Search for a surname and (optionally) initial(s) in publication author list | |
| Result | `RESULTS:` | Search for a term or terms in the Results section | |
| Supplemental | `SUPPL:` | Search for a term or terms in the Supplemental section | |
| Other | `OTHER:` | Search for a term or terms in the Other section | |
| Keyword | `KEYWORD:` | Search for a term or terms in the Keyword section. *Keywords are not the same as MeSH terms | |
| Methods | `METHODS:` | Search for a term or terms in the Methods section | |
| Introduction | `INTRO:` | Search for a term or terms in the Introduction section | |
| Discussion | `DISCUSS:` | Search for a term or terms in the Discussion section | |
| Conclusion | `CONCL:` | Search for a term or terms in the Conclusion section | |
| Acknowledgement & Funding | `ACK_FUND:` | Search for a term or terms in the Acknowledgements and Funding section. *Should not be used to search for a grant number. Leave field blank to search for a grant number. | |
| Abbreviation | `ABBR:` | Search for a term or terms in the Abbreviations section | |
| Cites | `CITES:` | Search for publications that cite a given article given its PMID number. Format: `8521067_med`. *Should not be used for doi numbers ("References" should be used for that) | A Cites search is not an exact match type search, but rather will output papers that cite the paper you provide. The PMID you provide has to be in the following format: `8521067_med` |
| References | `REF:` | Search for a term or terms in the References section. This is an exact match-type search. *Should not be used to search for citations of a given PMID ("Cites" should be used for that). *Should be used to search for doi numbers | A References search looks in the references section of a paper for an exact match to the search term. Use this when searching doi numbers. Do not use this for PMIDs, as those are not usually found as an exact match in a paper's references section. |
| Publication Type | `PUB_TYPE:` | Limit your search by publication type; common options: "Review" for review, "PPR" for preprint; use NOT Review or PPR for journal articles only | This is available as an option, but it is better to filter your search according to publication type after the search is performed. |
| --blank-- | | Leaving the Search.Field blank will tell the code to look in every section of the paper and metadata | |

Meaning_Assignment dropdown values: `Awardee`, `User`, `Broader.Influence`.

## Sheet: Example (4D Nucleome)

```csv
Impact.Category,Query.Cluster,Search.terms,Search.Field,OR.terms,OR.Search.Field,AND.terms,AND.Search.Field,NOT.terms,NOT.Search.Field,Notes
Broader.Influence,Program name,4D nucleome,Methods,,,,,,,
Broader.Influence,Program name,4D nucleome,Acknowledgement & Funding,,,,,,,
Broader.Influence,Program name,4D nucleome,Title and Abstract,,,,,,,
Broader.Influence,Program name,4D nucleome,,,,,,,,
Broader.Influence,Program name,4DN,Methods,,,"chromatin,genome",,,,
Broader.Influence,Program name,4DN,Acknowledgement & Funding,,,"chromatin,genome",,,,
Broader.Influence,Program name,4DN,Title and Abstract,,,"chromatin,genome",,,,
Broader.Influence,White paper,"28905911_med, 36640770_med, 37419111_med, 39484446_med",Cites,,,,,,,
User,Data resource identifier,4dnucleome.org,Methods,,,,,,,
User,Data resource identifier,4dnucleome.org,Acknowledgement & Funding,,,,,,,
Broader.Influence,Data resource identifier,4dnucleome.org,,,,,,,,
User,Data resource paper,35501320_med,Cites,,,,,,,
User,Method,"C-BERST, dCas9-APEX2 biotinylation at genomic elements by restricted spatial tagging",Methods,,,,,,,
User,Method,"C-BERST, dCas9-APEX2 biotinylation at genomic elements by restricted spatial tagging",Methods,,,"29735996, 10.1038/s41592-018-0006-2, 10.1101/171819",References,,,
User,Method,OligoDNA-PAINT,Methods,,,,,,,
User,Method,OligoDNA-PAINT,Methods,,,"25962338, 10.1038/ncomms8147",References,,,
User,Method,"OligoFISSEQ, Oligopaint fluorescent in situ sequencing",Methods,,,,,,,
User,Method,"OligoFISSEQ, Oligopaint fluorescent in situ sequencing",Methods,,,"32719531, 10.1038/s41592-020-0890-0",References,,,
User,Method,OligoSTORM,Methods,,,,,,,
User,Method,OligoSTORM,Methods,,,"25962338, 10.1038/ncomms8147",References,,,
User,Method,"Optical reconstruction of chromatin architecture, ORCA",Methods,,,"30886393, 10.1038/s41586-019-1035-4",References,,,
User,Method,Optical reconstruction of chromatin architecture,Methods,,,,,,,
User,Method,pA-DamID,Methods,,,,,,,
User,Method,pA-DamID,Methods,,,"32893442, 10.15252/embr.202050636, 10.1101/2019.12.19.881979",References,,,
User,Method,Perturb-tracing,Methods,,,,,,,
User,Method,Perturb-tracing,Methods,,,"40211002, 36778402, 10.1038/s41592-025-02652-z, 10.1101/2023.01.31.525983",References,,,
User,Method,"SPRITE, SensiTive Recognition of Individual DNA Ends",Methods,,,"29887377, 10.1016/j.cell.2018.05.024, 10.1101/219683",References,,,
User,Method,SensiTive Recognition of Individual DNA Ends,Methods,,,,,,,
User,Method,"STRIDE, SensiTive Recognition of Individual DNA Ends",Methods,,,"31832687, 10.1093/nar/gkz1118, 10.1101/772269",References,,,
User,Method,SensiTive Recognition of Individual DNA Ends,Methods,,,,,,,
User,Method,"SuPreMo, Sequence Mutator for Predictive Models",Methods,,,"38796686, 10.1093/bioinformatics/btae340, 10.1101/2023.11.03.565556",References,,,
User,Method,Sequence Mutator for Predictive Models,Methods,,,,,,,
User,Method,"TSA-seq, TSA sequencing",Methods,,,,,,,
User,Method,"TSA-seq, TSA sequencing",Methods,,,"30154186, 10.1083/jcb.201807108, 10.1101/307892",References,,,
User,Method,Visual Cell Sorting,Methods,,,"32500953, 10.15252/msb.20209442, 10.1101/856476",References,,,
Broader.Influence,Awardee pub,40480976_med,Cites,,,,,,,
Broader.Influence,Awardee pub,40433977_med,Cites,,,,,,,
Broader.Influence,Awardee pub,40410418_med,Cites,,,,,,,
Broader.Influence,Awardee pub,39587360_med,Cites,,,,,,,
Broader.Influence,Awardee pub,39579767_med,Cites,,,,,,,
Broader.Influence,Awardee pub,39574698_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35508662_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35332165_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35325048_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35320726_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35303483_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35301492_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35288709_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35271371_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35259165_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35254895_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35240980_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35228745_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35210612_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35196517_med,Cites,,,,,,,
Broader.Influence,Awardee pub,35180380_med,Cites,,,,,,,
Awardee,Grant number,*CA200147,,,,,,,,
Awardee,Grant number,*CA200059,,,,,,,,
Awardee,Grant number,*DK127391,,,,,,,,
Awardee,Grant number,*DK127405,,,,,,,,
Awardee,Grant number,*DK127419,,,,,,,,
Awardee,Grant number,*DK127420,,,,,,,,
Awardee,Grant number,*DK127421,,,,,,,,
Awardee,Grant number,*DK127422,,,,,,,,
Awardee,Grant number,*DK127429,,,,,,,,
Awardee,Grant number,*DK127432,,,,,,,,
Awardee,Grant number,*HG011536,,,,,,,,
Awardee,Grant number,*HG011585,,,,,,,,
Awardee,Grant number,*HG011586,,,,,,,,
Awardee,Grant number,*HG011593,,,,,,,,
Awardee,Grant number,*CA260699,,,,,,,,
Awardee,Grant number,*CA260700,,,,,,,,
Awardee,Grant number,*CA260701,,,,,,,,
Awardee,Grant number,*DA052713,,,,,,,,
```
