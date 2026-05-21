import { describe, it } from "vitest";
import { enforceSelectOnly } from "../index";

function reject(sql: string): string {
  const r = enforceSelectOnly(sql);
  if (r.ok) throw new Error(`expected rejection, got ok for: ${sql}`);
  return r.reason;
}

function accept(sql: string): void {
  const r = enforceSelectOnly(sql);
  if (!r.ok) throw new Error(`expected ok, got rejection for: ${sql} — ${r.reason}`);
}

describe("enforceSelectOnly", () => {
  describe("accepts", () => {
    it("a canonical SELECT", () => {
      accept("SELECT * FROM grants LIMIT 10");
    });

    it("a SELECT with a trailing semicolon", () => {
      accept("SELECT pi_name FROM grants WHERE fiscal_year = 2024;");
    });

    it("a WITH ... SELECT (CTE)", () => {
      accept(
        "WITH recent AS (SELECT * FROM grants WHERE fiscal_year >= 2023) SELECT * FROM recent",
      );
    });

    it("a select with line comments above the statement", () => {
      accept(`-- this is a comment\nSELECT pi_name FROM grants`);
    });

    it("a select with a block comment above the statement", () => {
      accept(`/* block\ncomment */ SELECT pi_name FROM grants`);
    });

    it("lower-case select", () => {
      accept("select pi_name from grants");
    });
  });

  describe("rejects", () => {
    it("an empty query", () => {
      reject("");
    });

    it("a whitespace-only query", () => {
      reject("   \n  \t  ");
    });

    it("a comment-only query", () => {
      reject("-- nothing here");
    });

    it("INSERT", () => {
      reject("INSERT INTO grants (pi_name) VALUES ('x')");
    });

    it("UPDATE", () => {
      reject("UPDATE grants SET pi_name = 'x' WHERE id = 1");
    });

    it("DELETE", () => {
      reject("DELETE FROM grants");
    });

    it("DROP", () => {
      reject("DROP TABLE grants");
    });

    it("TRUNCATE", () => {
      reject("TRUNCATE grants");
    });

    it("ALTER", () => {
      reject("ALTER TABLE grants ADD COLUMN x text");
    });

    it("multi-statement (SELECT; DELETE)", () => {
      reject("SELECT * FROM grants; DELETE FROM grants");
    });

    it("EXEC / CALL", () => {
      reject("EXEC malicious_procedure()");
      reject("CALL maintenance()");
    });

    it("a DELETE hidden behind a leading line comment that DOES NOT introduce SELECT", () => {
      // The first non-comment token here is DELETE — guard must catch it.
      reject(`-- harmless comment\nDELETE FROM grants`);
    });

    it("a forbidden keyword smuggled inside a block comment then DELETE", () => {
      reject(`/* SELECT just kidding */ DELETE FROM grants`);
    });
  });

  describe("does not get confused by forbidden keywords inside string literals", () => {
    it("allows the word 'DELETE' to appear inside a quoted string", () => {
      // A column value that mentions DELETE is fine as long as the statement is SELECT.
      accept(
        "SELECT pi_name FROM grants WHERE pi_name = 'will not DELETE this'",
      );
    });
  });
});
