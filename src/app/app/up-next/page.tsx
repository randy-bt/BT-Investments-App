import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { getUpNextQueue } from "@/actions/up-next";
import { UpNextClient } from "./client";

export const dynamic = "force-dynamic";

export default async function UpNextPage() {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") {
    redirect("/app");
  }

  const result = await getUpNextQueue();
  const queue = result.success ? result.data : [];

  return <UpNextClient initialQueue={queue} />;
}
