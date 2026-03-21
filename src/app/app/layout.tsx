import { redirect } from "next/navigation";
import { getAuthUser } from "@/lib/auth";
import { AuthProvider } from "@/components/AuthProvider";
import { SearchCommand } from "@/components/SearchCommand";
import { AppToolbar } from "@/components/AppToolbar";
import { AppNavbar } from "@/components/AppNavbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getAuthUser();
  if (!user) redirect("/login");

  return (
    <AuthProvider user={user}>
      <SearchCommand />
      <AppToolbar />
      {children}
      <AppNavbar />
    </AuthProvider>
  );
}
