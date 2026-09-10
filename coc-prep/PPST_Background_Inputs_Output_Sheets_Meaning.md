# PPST_Background, Inputs, Output Sheets Meaning (pptx text dump)


## Slide 1

- Program Publication Search ToolDefining Program Impact Beyond Direct Outputs
- Challenge
- CF programs are designed to have sustained impact beyond initial research investment, yet current NIH tools struggle to capture this broader impact.
- Solution
- Creation of a tool that identifies program‑related publications and categorizes their connection, enabling systematic measurement of direct and indirect impact.
- Purpose & Design
- Keyword-based search tool built in-house
- Systematically identifies program-related publications by automating targeted searches across different publication sections
- Process is analogous to building a grant portfolio
- Value-Add & Features
- Captures direct outputs from awardees, as well as more indirect impacts like user adoption and broader scientific influence of a program 
- Robust, high-throughput, iterative
- Integrates data from iCite
- Enables clustering of output data
- Use Cases & Limitations
- Can be used to characterize program outputs, outcomes, and impact
- Valuable for Stage 2 proposals, closeout reports, progress reports
- Limited by 1) the completeness of the input data and 2) weaknesses of keyword searches

## Slide 2

- Hierarchy: Awardee > User > Influenced By
- Meaning
- Field Search
- Program Feature
- Awardee
- Grants and Funding
- Program grant numbers
- User
- Methods
- Method name
- User
- Methods
- Data portal
- User
- Acknowledgements
- Data portal
- User
- Methods
- Program name
- Influenced by
- References
- Awardee publication
- Influenced by
- Acknowledgements
- Program name
- Influenced by
- Title or abstract
- Program name
- Influenced by
- Body
- Program name
- Input1C. Identify Search Fields & Interpret Connections

## Slide 3

- Output spreadsheet - the script generates a multi-sheet Excel workbook containing your publication search results and analysis.
- Data_Tabular - Complete list of all publications found by all queries with full metadata (id, pmid, title, authors, journal, etc.) plus query tracking information (Query_Number, Query_Cluster, Meaning, Original_Query).
- Output Spreadsheet
- Publication Details
- Query Details

## Slide 4

- Output spreadsheet - the script generates a multi-sheet Excel workbook containing your publication search results and analysis.
- Data_Matrixed_Query - Unique publications matrix showing which individual queries found each publication (Query_1, Query_2, etc. columns with "x" marks) plus meaning analysis columns (Awardee, User, Influenced By, Final_Assignment).
- Output Spreadsheet
- Publication Details
- Query Details
- Meaning Assignment
- Hierarchy: Awardee > User > Influenced By

## Slide 5

- Output spreadsheet - the script generates a multi-sheet Excel workbook containing your publication search results and analysis.
- Data_Matrixed_Cluster - Unique publications matrix showing which query clusters found each publication (cluster name columns with "x" marks) plus meaning analysis for cluster-level impact assessment.
- Output Spreadsheet
- Publication Details
- Cluster
- Meaning Assignment
