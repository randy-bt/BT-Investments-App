import type { DigestBodyJson } from '@/lib/digest/schema'

// Renders the structured digest layout: a tinted "Today's lead" block
// at the top (when present) followed by sectioned bullets. Matches the
// dashed-border + sage palette used elsewhere in the app.

export function StructuredBody({ json }: { json: DigestBodyJson }) {
  return (
    <div className="text-sm text-neutral-700">
      {json.lead && (
        <div className="mb-5 rounded border-l-2 border-[#c5cca8] bg-[#f7f8f1] px-4 py-3">
          <p className="mb-1 text-[0.6rem] uppercase tracking-wider text-neutral-500">
            Today&apos;s lead
          </p>
          <p className="font-semibold text-neutral-900">{json.lead.title}</p>
          <p className="mt-1 leading-relaxed">{json.lead.body}</p>
        </div>
      )}

      {json.sections.map((section) => (
        <section key={section.name} className="mb-4 last:mb-0">
          <h3 className="mb-2 border-b border-dashed border-neutral-200 pb-1 text-[0.65rem] uppercase tracking-wider text-neutral-500">
            {section.name}
          </h3>
          <ul className="space-y-1.5 pl-0">
            {section.items.map((item, i) => (
              <li key={i} className="leading-relaxed">
                <span className="font-medium text-neutral-900">{item.subject}</span>
                <span className="text-neutral-400"> — </span>
                <span>{item.detail}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}
