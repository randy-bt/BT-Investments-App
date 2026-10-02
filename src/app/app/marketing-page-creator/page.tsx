import { redirect } from "next/navigation";

export type { ActiveListingPageWithLead } from "./types";

// The Marketing Page Creator landing moved into the Dispositions page as the
// Marketing Page Database tab (rebuild, Randy Oct 2026). This route stays so
// old links and bookmarks still arrive somewhere, and the create / edit /
// archive routes below it are UNCHANGED - they are full-screen forms that
// work exactly as they always have, and are reached from the tab.
export default function ListingPageCreatorPage() {
  redirect("/app/dispositions?tab=pages");
}
