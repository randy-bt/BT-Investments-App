import { getScript } from "@/actions/scripts";

export default async function CallScriptPage({ params }: { params: Promise<{ type: string }> }) {
  const { type } = await params;
  const result = await getScript(type);

  if (!result.success || !result.data) {
    return (
      <main className="mx-auto max-w-2xl px-6 py-16 text-center">
        <p className="text-neutral-500">Script not found.</p>
      </main>
    );
  }

  const script = result.data;

  return (
    <main className="mx-auto max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight mb-8">
        {script.title}
      </h1>
      <div className="space-y-5">
        {script.lines.map((line, i) => (
          <p key={i} className="text-neutral-700 font-editable leading-relaxed text-[18px]">
            {line}
          </p>
        ))}
      </div>
    </main>
  );
}
