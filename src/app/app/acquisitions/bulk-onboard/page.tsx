import { AppBackLink } from '@/components/AppBackLink'
import { BulkOnboardClient } from './client'

export default function BulkOnboardPage() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-8 px-6 py-10">
      <header className="flex items-center justify-between border-b border-dashed border-neutral-300 pb-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Bulk Onboarding</h1>
          <p className="text-sm text-neutral-600">
            Drop multiple properly-named audio files to create leads in batch
          </p>
        </div>
        <AppBackLink href="/app/acquisitions" />
      </header>

      <section className="rounded-lg border border-dashed border-neutral-300 bg-white p-6 shadow-sm">
        <BulkOnboardClient />
      </section>
    </main>
  )
}
