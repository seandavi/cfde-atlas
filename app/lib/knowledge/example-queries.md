# Canonical SQL patterns

These are example shapes only — adapt to the user's question. All
identifiers live in the `analytics` schema (default search_path).

## Top-cited CFDE publications

```sql
SELECT pmid, doi, title, journal_name,
       publication_year, citation_count, relative_citation_ratio
FROM publications
ORDER BY citation_count DESC NULLS LAST
LIMIT 10;
```

## Publications per core project

```sql
SELECT core_project_number, count(*) AS n_pubs
FROM publications
GROUP BY core_project_number
ORDER BY n_pubs DESC;
```

## Derivative funding multiplier per core project

```sql
SELECT cp.core_project_number,
       count(DISTINCT cg.downstream_core_project_number) AS downstream_grants,
       sum(cgd.total_cost)                               AS downstream_total_cost
FROM citing_grants cg
JOIN publications p
  ON p.pmid = cg.cited_pmid
JOIN citing_grant_details cgd
  ON cgd.downstream_core_project_number = cg.downstream_core_project_number
GROUP BY 1
ORDER BY downstream_total_cost DESC NULLS LAST;
```

## GitHub activity per repo

```sql
SELECT full_name, stargazers_count, forks_count,
       commits_last_year, contributors_last_year
FROM github_repos
ORDER BY commits_last_year DESC NULLS LAST
LIMIT 20;
```

## Web traffic (GA) joined to program

```sql
SELECT program, sum(sessions) AS sessions, sum(page_views) AS views
FROM ga_reports
WHERE report_date >= date_trunc('month', now()) - interval '12 months'
GROUP BY program
ORDER BY sessions DESC;
```
