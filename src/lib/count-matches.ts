import type { EntityLookup } from "@/actions/entity-lookup";

const stripEmojis = (str: string) =>
  str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim();

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
 * Same scan as countEntityMatches, but returns the unique IDs of every
 * entity referenced anywhere in the HTML. Used by the acquisitions
 * dashboard to reconcile against the leads table.
 */
export function getEntityMatchIds(html: string, entityLookup: EntityLookup[]): string[] {
  const ids = new Set<string>();
  for (const m of scanLines(html, entityLookup)) {
    if (m) ids.add(m.id);
  }
  return Array.from(ids);
}
