import { UserManagement } from "@/components/UserManagement";
import { getUsers } from "@/actions/users";

export default async function AppSettingsPage() {
  const result = await getUsers();

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Settings</h1>
          <p className="text-sm text-neutral-600">
            App preferences and user management
          </p>
        </div>
      </header>

      <section className="space-y-6">
        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
          <h2 className="text-sm font-medium text-neutral-700 mb-4">
            Team Members
          </h2>
          {result.success ? (
            <UserManagement initialUsers={result.data} />
          ) : (
            <p className="text-sm text-neutral-500">{result.error}</p>
          )}
        </div>

        <div className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 text-sm text-neutral-400 shadow-sm">
          API connections, templates, and app preferences coming in a future
          phase.
        </div>
      </section>
    </main>
  );
}
