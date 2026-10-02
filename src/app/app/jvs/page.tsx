import { redirect } from "next/navigation";

// The JVs page moved into /app/acquisitions as the JVs tab (consolidation,
// Randy Oct 2026). JvInboxClient in ./client.tsx is unchanged and rendered
// from there; this route stays so old links still land.
export default function JvsPage() {
  redirect("/app/acquisitions?tab=jvs");
}
