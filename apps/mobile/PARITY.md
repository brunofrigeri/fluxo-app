# Mobile parity with the web app

The mobile app has to do what the studio web app does, with the same rules. This file is the checklist and the
decisions behind it. Update it in the same commit as the feature.

## How parity is guaranteed

1. **One implementation of every rule.** Business rules live in the database (RLS, triggers, tested in
   `supabase/tests`). Everything the web does on top of that (validation, the order of calls, the pt-BR messages)
   lives in `@fluxo/api`, which takes a Supabase client. The web's server actions and the mobile app both call it.
   A feature is not "ported": it is shared. Do not re-implement a query or mutation in `apps/mobile`.
2. **Same wording and design.** Strings used by more than one product come from `@fluxo/copy`; colors, type and
   icons from `@fluxo/tokens`; forms from `@fluxo/forms`; dates and attendance rules from `@fluxo/domain`.
3. **Same security model.** The app only holds the anon key and the user's session, so every query runs under RLS
   exactly like the web. Anything that needs the service-role key (inviting and removing users) goes through a web
   route handler that checks the user's token. The key never ships in the app.
4. **Instant interactions** (see the repo's CLAUDE.md): opening a sheet never waits on the network; status changes
   and toggles are optimistic and revert with a message when the server refuses.
5. **Tested where it matters.** Shared mutations have unit tests; the database rules have SQL tests; the shared API
   is also exercised against a real local Supabase in CI (`packages/api/test/integration`).

## Navigation

Bottom tabs: **Home, Agenda, Clientes, Espera, Mais**. "Mais" holds Usuários and Configurações (admins only), the
signed-in person and sign out. Details open as stacked screens; forms and pickers open as sheets.

## Features

Legend: `[x]` built, with its shared logic covered by tests; `[ ]` not built.
**UI verification:** every screen type-checks and the app bundles for iOS and Android, and the shared logic behind it
(`@fluxo/api`) is tested against a real local Supabase. Screens have **not** all been exercised by hand on a device:
see "Verified on a simulator" at the end, and treat anything not listed there as unverified UI.

### Access
- [x] Sign in with e-mail and password, session kept across restarts
- [x] Profile and role loaded after sign-in (admin or instructor), working hours
- [x] Missing profile (signed up on web, never opened it) explained, not a crash
- [x] Sign out
- [n/a] Sign up and invitation acceptance stay on the web (`/signup`, `/convite`)

### Home
- [x] Today's sessions grouped by time
- [x] One-tap attendance (optimistic, reverts with a message); justified miss asks for the reason
- [x] Yesterday's pending: unmarked sessions, present without evolution (links to the new-evolution form)
- [x] Replacements to schedule (opens the add sheet in Agenda)
- [x] Clients to watch, birthdays, weekly attendance rate and delta
- [x] Modality filter (only when the studio has more than one)

### Agenda
- [x] Views: Dia, 3 dias, Semana, Mês, with previous / next / today. Week and 3 days are day sections (a 7-column grid does not fit a phone)
- [x] Modality filter; instructor filter for admins (Todos, Só minhas, each instructor, Sem instrutor)
- [x] Slot sheet: clients, status per client, instructor (admins), delete booking
- [x] Add client to a slot: modality, date, hour, search, "É reposição?" flow, "Outra atividade"
- [x] Class note per slot and modality
- [x] Latest evolution of a client from the agenda

### Clientes
- [x] List: search by name or document, Ativos / Arquivados, pagination, next session, weekly frequency
- [x] Create client with modalities and responsible instructor per modality
- [x] Client header: age, status, modalities, weekly routine
- [x] Dados: edit personal and shared fields, health lists, archive / reactivate
- [x] Horários semanais: add and remove recurring slots
- [x] Documentos: upload (PDF, JPG, PNG, HEIC, up to 10 MB), open via signed URL, delete
- [x] Evoluções: list (filter by modality, pagination), read view, new, edit, delete, session picker
- [x] Avaliações: list, new, edit, delete (initial evaluation vs re-evaluation)
- [x] Acupuncture client opens the evaluation right after creation
- [x] Generic form renderer: text, textarea, choice, multichoice, boolean, number, date, rows, Pilates apparatus
      tree, tongue zones

### Espera
- [x] List with period filter and counts, first in first listed
- [x] Add, edit, remove (name, phone, period, modality)

### Usuários (admin)
- [x] List, edit (name, role, working hours, modalities taught), reassign guard
- [x] Invite by e-mail (through the web route handler)
- [x] Remove (through the web route handler)

### Configurações (admin)
- [x] Switch modalities on and off for the studio

## Known differences from the web

- Week and 3-day views are lists of days, not a time grid.
- Leaving an unsaved evolution form does not warn (the form shows an "Alterações não salvas" marker only).
- Admin invite and remove need `EXPO_PUBLIC_WEB_URL` pointing at the deployed web app.
- Offline: reads show cached data; writes need a connection and report the failure.

## Not planned

- Wellhub (the web integration itself is unfinished).
- Offline writes.

## Tests that guard parity

| Layer | Where | Runs |
| --- | --- | --- |
| Database rules (RLS, triggers) | `supabase/tests` | `npm test` |
| Shared logic against a real Supabase (RLS, replacements, scoping, storage) | `packages/api/test/integration` | CI web job, `npm run test:integration -w @fluxo/api` with `SUPABASE_TEST_*` |
| Shared logic, request shapes and messages | `packages/api/test` | `npm test` |
| Mobile-only routes the app calls (Bearer token, over HTTP) | `apps/web/test/api-users.integration.test.ts` | CI web job, `npm run test:api -w @fluxo/web` |
| Web end to end | `apps/web/tests` | CI web job, `npm run e2e:local` |
| Mobile typecheck, unit tests, Metro bundle | `apps/mobile` | CI mobile job |

## Verified on a simulator

(none recorded yet)
