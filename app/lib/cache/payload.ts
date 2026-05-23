import { promises as fs } from "node:fs";
import path from "node:path";

import { dumpAllAnalyticsSchemas, getDataRefreshedAt } from "@/app/lib/tools/schema";

export type CachePayload = {
  systemInstruction: string;
  cachedUserText: string;
  schemaFingerprint: string;
};

async function readKnowledge(): Promise<string> {
  const dir = path.join(process.cwd(), "app", "lib", "knowledge");
  let entries: string[];
  try {
    entries = await fs.readdir(dir);
  } catch {
    return "";
  }
  const md = entries.filter((f) => f.endsWith(".md")).sort();
  const parts: string[] = [];
  for (const f of md) {
    const body = await fs.readFile(path.join(dir, f), "utf8");
    parts.push(`# Knowledge: ${f.replace(/\.md$/, "")}\n\n${body.trim()}`);
  }
  return parts.join("\n\n---\n\n");
}

export async function buildCachePayload(
  systemPrompt: string,
): Promise<CachePayload> {
  const [schemaDump, knowledge, refreshedAt] = await Promise.all([
    dumpAllAnalyticsSchemas(),
    readKnowledge(),
    getDataRefreshedAt(),
  ]);

  // The cache holds a single synthetic "user" turn whose content the
  // model treats as durable context: schema reference + knowledge
  // files. The live chat turn is then appended at request time.
  const cachedUserText = [
    "# CFDE Atlas — durable context",
    "",
    "The sections below are static reference material attached via",
    "Gemini context caching. Treat them as authoritative read-only",
    "context. The conversational turn(s) that follow are the live user",
    "messages.",
    "",
    `Schema snapshot as of: ${refreshedAt ?? "unknown"} (UTC)`,
    "",
    "## Analytics schema reference",
    "",
    schemaDump,
    "",
    "---",
    "",
    knowledge,
  ].join("\n");

  // Fingerprint changes when schema or refresh time changes; cache
  // gets rebuilt on mismatch.
  const schemaFingerprint = `${refreshedAt ?? "none"}|${cachedUserText.length}`;
  return {
    systemInstruction: systemPrompt,
    cachedUserText,
    schemaFingerprint,
  };
}
