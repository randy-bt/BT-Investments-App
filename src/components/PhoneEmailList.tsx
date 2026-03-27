"use client";

import { useState, useTransition } from "react";

type PhoneItem = {
  id: string;
  phone_number: string;
  label: string | null;
  is_primary: boolean;
};

type EmailItem = {
  id: string;
  email: string;
  label: string | null;
  is_primary: boolean;
};

type PhoneEmailListProps = {
  phones: PhoneItem[];
  emails: EmailItem[];
  onAddPhone: (data: {
    phone_number: string;
    label?: string;
    is_primary: boolean;
  }) => Promise<void>;
  onRemovePhone: (id: string) => Promise<void>;
  onAddEmail: (data: {
    email: string;
    label?: string;
    is_primary: boolean;
  }) => Promise<void>;
  onRemoveEmail: (id: string) => Promise<void>;
};

export function PhoneEmailList({
  phones,
  emails,
  onAddPhone,
  onRemovePhone,
  onAddEmail,
  onRemoveEmail,
}: PhoneEmailListProps) {
  const [isPending, startTransition] = useTransition();
  const [newPhone, setNewPhone] = useState("");
  const [newEmail, setNewEmail] = useState("");

  function handleAddPhone() {
    if (!newPhone.trim()) return;
    startTransition(async () => {
      await onAddPhone({
        phone_number: newPhone.trim(),
        is_primary: phones.length === 0,
      });
      setNewPhone("");
    });
  }

  function handleAddEmail() {
    if (!newEmail.trim()) return;
    startTransition(async () => {
      await onAddEmail({
        email: newEmail.trim(),
        is_primary: emails.length === 0,
      });
      setNewEmail("");
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h4 className="text-xs font-medium text-neutral-700 mb-1">Phones</h4>
        <ul className="space-y-1">
          {phones.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between rounded border border-dashed border-neutral-200 px-2 py-1 text-sm font-editable"
            >
              <span>
                <a href={`tel:${p.phone_number}`} className="text-cyan-600 hover:underline">
                  {p.phone_number}
                </a>
                {p.label && (
                  <span className="ml-1 text-xs text-neutral-400">
                    ({p.label})
                  </span>
                )}
                {p.is_primary && (
                  <span className="ml-1 text-xs text-green-600">&#9733;</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => onRemovePhone(p.id))}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-1">
          <input
            value={newPhone}
            onChange={(e) => setNewPhone(e.target.value)}
            placeholder="Add phone..."
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            onKeyDown={(e) => e.key === "Enter" && handleAddPhone()}
          />
          <button
            type="button"
            onClick={handleAddPhone}
            disabled={isPending}
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
          >
            +
          </button>
        </div>
      </div>

      <div>
        <h4 className="text-xs font-medium text-neutral-700 mb-1">Emails</h4>
        <ul className="space-y-1">
          {emails.map((e) => (
            <li
              key={e.id}
              className="flex items-center justify-between rounded border border-dashed border-neutral-200 px-2 py-1 text-sm font-editable"
            >
              <span>
                {e.email}
                {e.label && (
                  <span className="ml-1 text-xs text-neutral-400">
                    ({e.label})
                  </span>
                )}
                {e.is_primary && (
                  <span className="ml-1 text-xs text-green-600">&#9733;</span>
                )}
              </span>
              <button
                type="button"
                onClick={() => startTransition(() => onRemoveEmail(e.id))}
                disabled={isPending}
                className="text-xs text-red-400 hover:text-red-600"
              >
                &times;
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-1 flex gap-1">
          <input
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            placeholder="Add email..."
            className="flex-1 rounded border border-neutral-300 px-2 py-1 text-sm font-editable"
            onKeyDown={(e) => e.key === "Enter" && handleAddEmail()}
          />
          <button
            type="button"
            onClick={handleAddEmail}
            disabled={isPending}
            className="rounded border border-neutral-300 px-2 py-1 text-xs hover:bg-neutral-50"
          >
            +
          </button>
        </div>
      </div>
    </div>
  );
}
