"use client";

/** A submit button that asks before it goes through. Use inside a <form action={...}>, or point `form` at one. */
export function ConfirmButton({ message, className, children, ariaLabel, form }: { message: string; className?: string; children: React.ReactNode; ariaLabel?: string; form?: string }) {
  return (
    <button
      type="submit"
      form={form}
      className={className}
      aria-label={ariaLabel}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
