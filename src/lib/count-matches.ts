import type { EntityLookup } from "@/actions/entity-lookup";
import { stripEmojis } from "@/lib/strip-emojis";

/**
 * Walk the lines of an HTML note and yield the entity matched on each
 * line (or null if none). Shared scan logic for both countEntityMatches
 * and getEntityMatchIds so the two are guaranteed to agree.
 */
/**
 * Decode the HTML entities the editor actually writes, so this raw-HTML scan
 * sees the same characters the rendered DOM does.
 *
 * Without this, a lead stored as "Greg & Christina Wygant" never matched a
 * note line saved as "Greg &amp; Christina Wygant". The lead read as claimed
 * by no dashboard and showed as a discrepancy, which expanding the dashboard
 * appeared to fix: the collapsed view scans this HTML string, while the
 * mounted editor reads decoded DOM text and quietly overwrote the bad IDs.
 *
 * `&amp;` is decoded LAST on purpose. Decoding it first would turn a literal
 * "&amp;lt;" into "<" rather than the "&lt;" the author actually typed.
 */
function decodeEntities(s: string): string {
  const codePoint = (n: number) =>
    Number.isFinite(n) && n >= 0 && n <= 0x10ffff ? String.fromCodePoint(n) : "";
  return s
    .replace(/&nbsp;/gi, " ")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&apos;/gi, "'")
    .replace(/&#(\d+);/g, (_, d: string) => codePoint(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h: string) => codePoint(parseInt(h, 16)))
    .replace(/&amp;/gi, "&");
}

/**
 * Shared normalization for both sides of the comparison. Entities decode to
 * characters, but a non-breaking space is still not a space as far as
 * `includes` is concerned, so every run of whitespace collapses to a single
 * plain space. `\s` covers U+00A0, so a non-breaking space pasted straight
 * into a note is handled too.
 */
function normalizeName(s: string): string {
  return stripEmojis(s).toLowerCase().replace(/\s+/g, " ").trim();
}

/**
 * Same, plus entity decoding. Only the note HTML gets decoded: entity names
 * arrive from the database as plain text, so decoding them would corrupt any
 * name that legitimately contains a sequence like "&lt;".
 */
function normalizeLine(s: string): string {
  return normalizeName(decodeEntities(s));
}

function* scanLines(html: string, entityLookup: EntityLookup[]) {
  if (!html || entityLookup.length === 0) return;

  // Sort longest-first so multi-word names beat any single-word substring.
  // Names are normalized once here rather than per line.
  const sortedEntities = [...entityLookup]
    .map((entity) => ({ entity, nameLower: normalizeName(entity.name) }))
    .filter(({ nameLower }) => nameLower.length >= 2)
    .sort((a, b) => b.nameLower.length - a.nameLower.length);

  // Split HTML into text lines by block tags
  const text = html.replace(/<\/(p|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "");

  for (const line of text.split("\n")) {
    const lineLower = normalizeLine(line);
    if (!lineLower) continue;

    let matched: EntityLookup | null = null;
    for (const { entity, nameLower } of sortedEntities) {
      if (lineLower.includes(nameLower)) {
        matched = entity;
        break;
      }
    }
    yield matched;
  }
}

/** Count lines in HTML content that match an entity name (same logic as DashboardNotes gutter) */
export function countEntityMatches(html: string, entityLookup: EntityLookup[]): number {
  let count = 0;
  for (const m of scanLines(html, entityLookup)) {
    if (m) count++;
  }
  return count;
}

/**
 * Same scan as countEntityMatches, but returns the entity ID of every
 * matched line (NOT deduped — repeats are intentional so the
 * acquisitions reconciliation can detect when the same lead is listed
 * more than once on a single dashboard). Length here equals the value
 * of countEntityMatches.
 */
export function getEntityMatchIds(html: string, entityLookup: EntityLookup[]): string[] {
  const ids: string[] = [];
  for (const m of scanLines(html, entityLookup)) {
    if (m) ids.push(m.id);
  }
  return ids;
}
