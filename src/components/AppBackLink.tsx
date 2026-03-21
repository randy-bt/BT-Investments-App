"use client";

import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";

type AppBackLinkProps = {
  href?: string;
  label?: string;
};

export function AppBackLink({ href, label = "Back" }: AppBackLinkProps) {
  const router = useRouter();
  const pathname = usePathname();

  const isRecordPage =
    pathname.includes("/lead-record/") ||
    pathname.includes("/investor-record/");

  if (isRecordPage) {
    return (
      <button
        type="button"
        onClick={() => window.close()}
        className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
      >
        &larr; {label}
      </button>
    );
  }

  if (href) {
    return (
      <Link
        href={href}
        className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
      >
        &larr; {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
    >
      &larr; {label}
    </button>
  );
}
