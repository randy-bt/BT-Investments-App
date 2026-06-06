import type { DigestBodyJson } from '@/lib/digest/schema'

// Renders the structured digest layout: a tinted "Today's lead" block
// at the top (when present) followed by sectioned bullets. Matches the
// dashed-border + sage palette used elsewhere in the app.

export function StructuredBody({ json }: { json: DigestBodyJson }) {
  return (
    <div className="text-base text-neutral-800 dark:text-neutral-200">
      {json.lead && (
        <div className="mb-7 rounded border-l-2 border-[#c5cca8] bg-[#f7f8f1] px-5 py-4 dark:border-[#9aa37c] dark:bg-neutral-800">
          <p className="mb-2 text-xs uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            Today&apos;s lead
          </p>
          <p className="font-semibold text-neutral-900 dark:text-neutral-100">{json.lead.title}</p>
          <p className="mt-2 leading-relaxed text-neutral-800 dark:text-neutral-200">{json.lead.body}</p>
        </div>
      )}

      {json.sections.map((section) => (
        <section key={section.name} className="mb-7 last:mb-0">
          <h3 className="mb-3 border-b border-dashed border-neutral-300 pb-1.5 text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:border-neutral-600 dark:text-neutral-300">
            {section.name}
          </h3>
          <ul className="space-y-3 pl-0">
            {section.items.map((item, i) => (
              <li key={i} className="leading-relaxed">
                <span className="font-medium text-neutral-900 dark:text-neutral-100">{item.subject}</span>
                <span className="text-neutral-400 dark:text-neutral-500"> — </span>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
