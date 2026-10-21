# Fluxo: working rules

Next.js 15 (App Router) + Supabase, pt-BR UI. Shared form definitions live in `packages/forms`. Run `npm test` and `npm run typecheck` before finishing a change.

## Interactions must be instant

Nothing the user taps may wait on the network before it responds. Slow modals and toggles have been a recurring problem here, so check this on every change that touches UI.

- **Opening or closing a modal, menu, popover or dialog never triggers a server round trip.** Do not open or close with `router.push` / `<Link href="?x=1">` on a `force-dynamic` page: that re-runs the whole server page. Keep open/close in client state and render from data the page already has. If the content needs data, fetch it before the tap (on mount, on hover) or show the shell at once with a skeleton.
- **Toggles, status changes and other small mutations are optimistic.** Update the UI first, call the server action in the background, and revert with an error message if it fails. Never disable the control or show a spinner for a change that will almost always succeed.
- **Only real submits wait.** A form submit that saves data may show a pending state, but the modal or menu around it still opens and closes instantly.
- **Keep revalidation narrow.** Avoid `revalidatePath("/", "layout")`; revalidate only the pages that show the changed data.
- **Navigation between pages** goes through `<Link>` with a `loading.tsx` boundary, so the click is acknowledged immediately. Do not add `await`s to a page that it does not need.
- When you add a button or navigation, say in your summary how it stays instant. If you cannot make it instant, tell the user why.

## Other conventions

- Admins are also instructors by default: they teach every modality the studio offers unless unticked on Users.
- Business rules live in the database (triggers, RLS) and have a test in `supabase/tests`. Do not enforce them only in the UI.
- Never put the service-role key in client code.
