import { getArticle } from "@/actions/news";
import { isArticleSaved } from "@/actions/saved-articles";
import { ArticleDetailClient } from "./client";

export default async function ArticleDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [result, savedResult] = await Promise.all([
    getArticle(id),
    isArticleSaved(id),
  ]);

  if (!result.success) {
    return (
      <main className="mx-auto flex max-w-2xl flex-col gap-8 px-6 py-10">
        <p className="text-sm text-neutral-500">Article not found.</p>
      </main>
    );
  }

  const initiallySaved = savedResult.success ? savedResult.data : false;

  return <ArticleDetailClient article={result.data} initiallySaved={initiallySaved} />;
}
