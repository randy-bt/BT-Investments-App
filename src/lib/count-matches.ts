import type { EntityLookup } from "@/actions/entity-lookup";
import { stripEmojis } from "@/lib/strip-emojis";

/**
 * Walk the lines of an HTML note and yield the entity matched on each
 * line (or null if none). Shared scan logic for both countEntityMatches
 * and getEntityMatchIds so the two are guaranteed to agree.
 */
function* scanLines(html: string, entityLookup: EntityLookup[]) {
  if (!html || entityLookup.length === 0) return;

  // Sort longest-first so multi-word names beat any single-word substring.
  const sortedEntities = [...entityLookup].sort((a, b) => b.name.length - a.name.length);

  // Split HTML into text lines by block tags
  const text = html.replace(/<\/(p|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "");

  for (const line of text.split("\n")) {
    const lineLower = stripEmojis(line).toLowerCase();
    if (!lineLower) continue;

    let matched: EntityLookup | null = null;
    for (const entity of sortedEntities) {
      const nameLower = stripEmojis(entity.name).toLowerCase();
      if (nameLower.length >= 2 && lineLower.includes(nameLower)) {
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
