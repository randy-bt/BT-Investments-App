import type { EntityLookup } from "@/actions/entity-lookup";

/** Count lines in HTML content that match an entity name (same logic as DashboardNotes gutter) */
export function countEntityMatches(html: string, entityLookup: EntityLookup[]): number {
  if (!html || entityLookup.length === 0) return 0;

  const stripEmojis = (str: string) =>
    str.replace(/[\p{Emoji_Presentation}\p{Extended_Pictographic}]/gu, "").replace(/\s+/g, " ").trim();

  const sortedEntities = [...entityLookup].sort((a, b) => b.name.length - a.name.length);

  // Split HTML into text lines by block tags
  const text = html.replace(/<\/(p|li|h[1-6])>/gi, "\n").replace(/<[^>]+>/g, "");
  let count = 0;

  for (const line of text.split("\n")) {
    const lineLower = stripEmojis(line).toLowerCase();
    if (!lineLower) continue;

    for (const entity of sortedEntities) {
      const nameLower = stripEmojis(entity.name).toLowerCase();
      if (nameLower.length >= 2 && lineLower.includes(nameLower)) {
        count++;
        break;
      }
    }
  }

  return count;
}
