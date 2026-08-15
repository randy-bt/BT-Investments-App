import { getDispoQueue, getLiveDeals, getScoredJvDeals } from "@/actions/dispo";
import { DispoQueuePanel } from "@/components/dispo/DispoQueuePanel";
import { JvIntakePanel } from "./jv-intake-panel";

// DSP2 (agent-requests #14.4): the dispo counterpart of ACQ2, but
// read-mostly and populated ENTIRELY from live data - sends, statuses,
// and Aldo's board emojis. Deliberately no agent round notes anywhere:
// Randy opens this cold whenever he wants; nothing waits on an analyst.
// Like ACQ2 it hangs off a direct URL, not the navbar.
export const dynamic = "force-dynamic";

export default async function Dsp2Page() {
  const [queue, live, jvs] = await Promise.all([
    getDispoQueue(),
    getLiveDeals(),
    getScoredJvDeals(),
  ]);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-5 px-4 py-8 sm:px-6">
      <header className="border-b border-dashed border-neutral-300 pb-4">
        <h1 className="text-3xl font-semibold tracking-tight">DSP2</h1>
        <p className="mt-1 text-sm text-neutral-400">
          Queue, live deals, and new JVs. Everything here is live data.
        </p>
      </header>

      <section className="space-y-3 rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm">
        <h2 className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-400">
          Ready to Send
        </h2>
        <DispoQueuePanel initialRows={queue.success ? queue.data : []} />
      </section>

      <section className="space-y-3 rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm">
        <h2 className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-400">
          Live Deals
        </h2>
        {!live.success || live.data.length === 0 ? (
          <p className="text-sm text-neutral-400">Nothing being marketed right now.</p>
        ) : (
          <div className="space-y-2">
            {live.data.map((d) => (
              <div
                key={`${d.kind}-${d.id}`}
                className="rounded-md border border-dashed border-neutral-200 px-3 py-2.5"
              >
                <div className="flex items-baseline justify-between gap-3">
                  <span className="min-w-0 truncate font-editable text-[15px] font-semibold">
                    {d.deal_name}
                  </span>
                  {d.price && <span className="shrink-0 text-sm text-neutral-500">{d.price}</span>}
                </div>
                <p className="mt-1 text-[13px] text-neutral-500">
                  {d.sent_count > 0 ? (
                    <>
                      sent {d.sent_at ? new Date(d.sent_at).toLocaleDateString("en-US", { month: "numeric", day: "numeric" }) : ""} to {d.sent_count}
                      {" · "}
                      <span className="text-[#46683F]">
                        ✅ interested: {d.interested_names.length > 0 ? d.interested_names.join(", ") : "0"}
                      </span>
                      {" · "}❌ passed: {d.passed_count}
                      {" · "}silent: {d.silent_count}
                    </>
                  ) : (
                    "not sent yet"
                  )}
                  {d.page_url && (
                    <>
                      {" · "}
                      <a
                        href={d.page_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="underline decoration-dotted underline-offset-2 hover:text-neutral-800"
                      >
                        page
                      </a>
                    </>
                  )}
                </p>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="space-y-3 rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-sm">
        <h2 className="text-[0.65rem] font-bold uppercase tracking-wider text-neutral-400">
          New JVs Worth a Look
        </h2>
        <JvIntakePanel initialDeals={jvs.success ? jvs.data : []} />
      </section>
    </main>
  );
}
