"use client";

import { startTransition, useActionState } from "react";

/**
 * Runs a server action from a form's onSubmit instead of the form's `action` prop.
 * With `<form action={fn}>` React 19 resets every uncontrolled field when the action finishes,
 * even when it returned an error, so the person would lose what they typed. Here the fields stay as they are.
 */
export function useFormAction<S>(action: (prev: S, formData: FormData) => Promise<S>, initial: S) {
  const [state, dispatch, pending] = useActionState<S, FormData>(action as (prev: Awaited<S>, formData: FormData) => S | Promise<S>, initial as Awaited<S>) as unknown as [S, (payload: FormData) => void, boolean];
  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => dispatch(data));
  };
  return { state, onSubmit, pending };
}
