"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";

type AppBackLinkProps = {
  href?: string;
  label?: string;
};

export function AppBackLink({ href, label = "Back" }: AppBackLinkProps) {
  const router = useRouter();

  if (href) {
    return (
      <Link
        href={href}
        className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
      >
        ← {label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-neutral-600 underline underline-offset-4 hover:text-neutral-900"
    >
      ← {label}
    </button>
  );
}

