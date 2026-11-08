"use client";
import { useEffect, useRef, useId, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
export function ReviewDialog({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  useEffect(() => {
    const opener =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const node = ref.current;
    node?.showModal();
    return () => {
      node?.close();
      if (opener?.isConnected) opener.focus();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className="evidence-drawer planning-dialog"
      aria-labelledby={titleId}
      onCancel={(e) => {
        e.stopPropagation();
        e.preventDefault();
        onClose();
      }}
      onKeyDown={(e) => {
        if (e.key !== "Tab") return;
        e.stopPropagation();
        const nodes = Array.from(
          e.currentTarget.querySelectorAll<HTMLElement>(
            'button:not(:disabled), input:not(:disabled), select:not(:disabled), a[href], [tabindex="0"]',
          ),
        );
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }}
    >
      <header className="finance-toolbar">
        <h2 id={titleId}>{title}</h2>
        <Button onClick={onClose} autoFocus>
          Close
        </Button>
      </header>
      {children}
    </dialog>
  );
}
