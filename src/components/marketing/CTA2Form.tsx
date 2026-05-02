"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * CTA2Form — client form on the homepage's CTA2 section. Captures
 * Name + Email + Phone, then navigates to /join-buyers-list with the
 * data as URL params so the long-form there pre-fills those fields.
 * Final submission happens on /join-buyers-list.
 */
export function CTA2Form() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const params = new URLSearchParams();
    if (name) params.set("name", name);
    if (email) params.set("email", email);
    if (phone) params.set("phone", phone);
    const qs = params.toString();
    router.push(`/join-buyers-list${qs ? `?${qs}` : ""}`);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5 sm:space-y-6">
      <FormField
        label="Name / Company"
        placeholder="Jane Doe"
        value={name}
        onChange={setName}
        required
      />
      <FormField
        label="Email"
        placeholder="jane@example.com"
        type="email"
        value={email}
        onChange={setEmail}
        required
      />
      <FormField
        label="Phone"
        placeholder="(206) 555-0142"
        type="tel"
        value={phone}
        onChange={setPhone}
        required
      />
      <button
        type="submit"
        className="w-full rounded-full font-mkt-sans py-3.5 transition-opacity hover:opacity-90"
        style={{
          background: "var(--mkt-olive)",
          color: "var(--mkt-cream)",
          fontWeight: 500,
          fontSize: "0.95rem",
        }}
      >
        Continue &nbsp;&rarr;
      </button>
    </form>
  );
}

function FormField({
  label,
  placeholder,
  type = "text",
  value,
  onChange,
  required,
}: {
  label: string;
  placeholder: string;
  type?: string;
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <div
        className="font-mkt-sans uppercase tracking-[0.18em] text-[0.65rem] mb-2"
        style={{ color: "var(--mkt-muted-dark)" }}
      >
        {label}
      </div>
      <input
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full bg-transparent border-0 font-mkt-sans text-base outline-none pb-2 placeholder-opacity-50"
        style={{
          color: "var(--mkt-text-on-dark)",
          borderBottom: "1px solid rgba(245,239,226,0.18)",
        }}
      />
    </label>
  );
}
