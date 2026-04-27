"use client";

import { useEffect } from "react";

type Props = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

export function Modal({ open, onClose, title, children, footer }: Props) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-md rounded-lg border border-dashed border-neutral-300 bg-white p-5 shadow-xl"
      >
        {title && (
          <h2 className="text-sm font-medium text-neutral-700 mb-3">{title}</h2>
        )}
        <div>{children}</div>
        {footer && (
          <div className="mt-4 flex justify-end gap-2">{footer}</div>
        )}
      </div>
    </div>
  );
}
