import Link from "next/link";

type ScriptType = "acquisitions" | "dispositions" | "agent_outreach" | "investor_outreach";

export function CallScriptViewer({ scriptType }: { scriptType: ScriptType }) {
  return (
    <Link
      href={`/app/call-script/${scriptType}`}
      target="_blank"
      title="View Call Script"
      className="flex items-center justify-center rounded-md border border-neutral-300 bg-neutral-50 p-1.5 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 transition-colors"
    >
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" />
        <line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    </Link>
  );
}
