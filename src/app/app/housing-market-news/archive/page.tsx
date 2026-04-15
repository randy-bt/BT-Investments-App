import { AppBackLink } from "@/components/AppBackLink";
import { getArchiveArticles } from "@/actions/news";
import { ArchiveClient } from "./client";

export default async function ArchivePage() {
  const result = await getArchiveArticles(1, 100);
  const articles = result.success ? result.data.items : [];

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            News Archive
          </h1>
          <p className="text-sm text-neutral-600">
            Browse all past articles
          </p>
        </div>
        <AppBackLink href="/app/housing-market-news" />
      </header>

      <ArchiveClient initialArticles={articles} />
    </main>
  );
}
