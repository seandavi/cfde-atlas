// Realistic-shaped mock data for the CFDE evaluation surface.
// Numbers and names are illustrative — do NOT cite. Real ETL lives in icc-eval-core.

export type TableName =
  | "publications"
  | "grants"
  | "github_activity"
  | "ga_pageviews";

export type ColumnSpec = {
  name: string;
  type: string;
  notes?: string;
  fk_to?: string;
};

export type TableSpec = {
  name: TableName;
  description: string;
  row_count: number;
  columns: ColumnSpec[];
  rows: Record<string, unknown>[];
};

const CORE_PROJECT_FK = "grants.core_project_number";

export const TABLES: Record<TableName, TableSpec> = {
  grants: {
    name: "grants",
    description:
      "NIH RePORTER grant records, one row per (core project, fiscal year). Source of truth for core_project_number — every other table joins back here.",
    row_count: 142,
    columns: [
      {
        name: "core_project_number",
        type: "text",
        notes:
          "Primary key program officers navigate by. Format like U54OD036472. PRIMARY KEY of CFDE for joining.",
      },
      { name: "pi_name", type: "text" },
      {
        name: "mechanism",
        type: "text",
        notes: "Activity code, e.g. U54, U24, R03, OT2.",
      },
      { name: "fiscal_year", type: "integer", notes: "NIH FY (Oct–Sep)." },
      { name: "total_funding_usd", type: "numeric" },
      {
        name: "nofo",
        type: "text",
        notes: "Notice of Funding Opportunity / RFA identifier.",
      },
      { name: "institution", type: "text" },
      { name: "program", type: "text", notes: "CFDE program name." },
    ],
    rows: [
      {
        core_project_number: "U54OD036472",
        pi_name: "Ma'ayan, Avi",
        mechanism: "U54",
        fiscal_year: 2024,
        total_funding_usd: 5_140_000,
        nofo: "RFA-RM-23-007",
        institution: "Icahn School of Medicine at Mount Sinai",
        program: "CFDE Coordinating Center",
      },
      {
        core_project_number: "U24CA268168",
        pi_name: "Stein, Lincoln",
        mechanism: "U24",
        fiscal_year: 2024,
        total_funding_usd: 2_880_000,
        nofo: "RFA-RM-21-019",
        institution: "Ontario Institute for Cancer Research",
        program: "Bridge2AI",
      },
      {
        core_project_number: "U54HG012510",
        pi_name: "Kellis, Manolis",
        mechanism: "U54",
        fiscal_year: 2024,
        total_funding_usd: 4_220_000,
        nofo: "RFA-HG-22-001",
        institution: "Broad Institute",
        program: "LINCS",
      },
      {
        core_project_number: "U24DK131000",
        pi_name: "Snyder, Michael",
        mechanism: "U24",
        fiscal_year: 2024,
        total_funding_usd: 3_410_000,
        nofo: "RFA-RM-22-011",
        institution: "Stanford University",
        program: "MoTrPAC",
      },
      {
        core_project_number: "U24CA224276",
        pi_name: "Regev, Aviv",
        mechanism: "U24",
        fiscal_year: 2024,
        total_funding_usd: 2_650_000,
        nofo: "RFA-RM-22-014",
        institution: "Genentech",
        program: "HuBMAP",
      },
      {
        core_project_number: "U54OD036472",
        pi_name: "Ma'ayan, Avi",
        mechanism: "U54",
        fiscal_year: 2023,
        total_funding_usd: 4_970_000,
        nofo: "RFA-RM-23-007",
        institution: "Icahn School of Medicine at Mount Sinai",
        program: "CFDE Coordinating Center",
      },
      {
        core_project_number: "U54HG012510",
        pi_name: "Kellis, Manolis",
        mechanism: "U54",
        fiscal_year: 2023,
        total_funding_usd: 4_080_000,
        nofo: "RFA-HG-22-001",
        institution: "Broad Institute",
        program: "LINCS",
      },
    ],
  },

  publications: {
    name: "publications",
    description:
      "Grant-acknowledging publications, joined from NIH RePORTER citations to PubMed. One row per (pmid, core_project_number) — a publication can attribute multiple grants.",
    row_count: 3814,
    columns: [
      { name: "pmid", type: "integer", notes: "PubMed ID." },
      {
        name: "core_project_number",
        type: "text",
        fk_to: CORE_PROJECT_FK,
        notes: "Grant the publication acknowledges.",
      },
      { name: "title", type: "text" },
      { name: "journal", type: "text" },
      { name: "year", type: "integer" },
      {
        name: "citation_count",
        type: "integer",
        notes: "Citations as of last ETL refresh.",
      },
      { name: "first_author", type: "text" },
      { name: "is_open_access", type: "boolean" },
    ],
    rows: [
      {
        pmid: 38765112,
        core_project_number: "U54OD036472",
        title: "An open data ecosystem for the NIH Common Fund",
        journal: "Nature Methods",
        year: 2024,
        citation_count: 41,
        first_author: "Clarke DJB",
        is_open_access: true,
      },
      {
        pmid: 38201044,
        core_project_number: "U54OD036472",
        title: "DRC-Portals: discoverability infrastructure for CFDE",
        journal: "Bioinformatics",
        year: 2024,
        citation_count: 12,
        first_author: "Evangelista JE",
        is_open_access: true,
      },
      {
        pmid: 37865001,
        core_project_number: "U54HG012510",
        title: "Connectivity-map style perturbational signatures at scale",
        journal: "Cell",
        year: 2023,
        citation_count: 88,
        first_author: "Subramanian A",
        is_open_access: false,
      },
      {
        pmid: 39001220,
        core_project_number: "U24DK131000",
        title: "Multi-omic responses to endurance training in humans",
        journal: "Nature",
        year: 2024,
        citation_count: 117,
        first_author: "Amar D",
        is_open_access: true,
      },
      {
        pmid: 38442200,
        core_project_number: "U24CA224276",
        title: "A spatial atlas of the human intestine",
        journal: "Nature",
        year: 2024,
        citation_count: 64,
        first_author: "Hickey JW",
        is_open_access: true,
      },
      {
        pmid: 37550901,
        core_project_number: "U24CA268168",
        title:
          "Foundations for trustworthy AI in biomedical research: a Bridge2AI consortium perspective",
        journal: "Nature Biomedical Engineering",
        year: 2023,
        citation_count: 53,
        first_author: "Boutros PC",
        is_open_access: true,
      },
      {
        pmid: 38990012,
        core_project_number: "U54OD036472",
        title: "Cross-program data harmonization across CFDE",
        journal: "Scientific Data",
        year: 2024,
        citation_count: 7,
        first_author: "Avila-Pacheco J",
        is_open_access: true,
      },
    ],
  },

  github_activity: {
    name: "github_activity",
    description:
      "Activity snapshot across ~175 CFDE-affiliated GitHub repositories. One row per (repo, snapshot_date). Repos resolve to grants via the cfde-eval-core ETL.",
    row_count: 1750,
    columns: [
      { name: "repo", type: "text", notes: "owner/name on GitHub." },
      {
        name: "core_project_number",
        type: "text",
        fk_to: CORE_PROJECT_FK,
      },
      { name: "snapshot_date", type: "date" },
      {
        name: "commits_last_90d",
        type: "integer",
      },
      { name: "contributors_last_90d", type: "integer" },
      { name: "releases_total", type: "integer" },
      { name: "open_issues", type: "integer" },
      { name: "primary_language", type: "text" },
      { name: "stars", type: "integer" },
    ],
    rows: [
      {
        repo: "nih-cfde/drc-portals",
        core_project_number: "U54OD036472",
        snapshot_date: "2026-05-01",
        commits_last_90d: 312,
        contributors_last_90d: 14,
        releases_total: 27,
        open_issues: 42,
        primary_language: "TypeScript",
        stars: 38,
      },
      {
        repo: "nih-cfde/data-resource-portal",
        core_project_number: "U54OD036472",
        snapshot_date: "2026-05-01",
        commits_last_90d: 88,
        contributors_last_90d: 6,
        releases_total: 11,
        open_issues: 19,
        primary_language: "Python",
        stars: 22,
      },
      {
        repo: "broadinstitute/lincs-toolkit",
        core_project_number: "U54HG012510",
        snapshot_date: "2026-05-01",
        commits_last_90d: 144,
        contributors_last_90d: 9,
        releases_total: 18,
        open_issues: 27,
        primary_language: "R",
        stars: 96,
      },
      {
        repo: "motrpac/motrpac-portal",
        core_project_number: "U24DK131000",
        snapshot_date: "2026-05-01",
        commits_last_90d: 51,
        contributors_last_90d: 4,
        releases_total: 9,
        open_issues: 12,
        primary_language: "Python",
        stars: 31,
      },
      {
        repo: "hubmapconsortium/portal-ui",
        core_project_number: "U24CA224276",
        snapshot_date: "2026-05-01",
        commits_last_90d: 421,
        contributors_last_90d: 17,
        releases_total: 64,
        open_issues: 73,
        primary_language: "TypeScript",
        stars: 54,
      },
      {
        repo: "bridge2ai/data-portal",
        core_project_number: "U24CA268168",
        snapshot_date: "2026-05-01",
        commits_last_90d: 78,
        contributors_last_90d: 5,
        releases_total: 4,
        open_issues: 21,
        primary_language: "TypeScript",
        stars: 17,
      },
    ],
  },

  ga_pageviews: {
    name: "ga_pageviews",
    description:
      "Google Analytics traffic aggregated per CFDE web property and quarter. One row per (property, quarter). Properties map to grants via cfde-eval-core.",
    row_count: 480,
    columns: [
      { name: "property", type: "text", notes: "GA4 property hostname." },
      {
        name: "core_project_number",
        type: "text",
        fk_to: CORE_PROJECT_FK,
      },
      { name: "quarter", type: "text", notes: "Format YYYY-Qn." },
      { name: "page_views", type: "integer" },
      { name: "unique_users", type: "integer" },
      { name: "avg_session_seconds", type: "integer" },
      { name: "top_country", type: "text" },
    ],
    rows: [
      {
        property: "data.cfde.cloud",
        core_project_number: "U54OD036472",
        quarter: "2026-Q1",
        page_views: 18_420,
        unique_users: 6_140,
        avg_session_seconds: 184,
        top_country: "US",
      },
      {
        property: "data.cfde.cloud",
        core_project_number: "U54OD036472",
        quarter: "2025-Q4",
        page_views: 14_870,
        unique_users: 5_212,
        avg_session_seconds: 171,
        top_country: "US",
      },
      {
        property: "portal.hubmapconsortium.org",
        core_project_number: "U24CA224276",
        quarter: "2026-Q1",
        page_views: 31_290,
        unique_users: 9_804,
        avg_session_seconds: 248,
        top_country: "US",
      },
      {
        property: "clue.io",
        core_project_number: "U54HG012510",
        quarter: "2026-Q1",
        page_views: 22_510,
        unique_users: 7_330,
        avg_session_seconds: 312,
        top_country: "US",
      },
      {
        property: "motrpac-data.org",
        core_project_number: "U24DK131000",
        quarter: "2026-Q1",
        page_views: 5_804,
        unique_users: 1_902,
        avg_session_seconds: 220,
        top_country: "US",
      },
      {
        property: "bridge2ai.org",
        core_project_number: "U24CA268168",
        quarter: "2026-Q1",
        page_views: 9_410,
        unique_users: 3_186,
        avg_session_seconds: 152,
        top_country: "US",
      },
    ],
  },
};

export const TABLE_NAMES: TableName[] = Object.keys(TABLES) as TableName[];
