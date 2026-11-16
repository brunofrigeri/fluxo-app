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

Legend: `[x]` done and verified, `[~]` partly, `[ ]` not started.

### Access
- [x] Sign in with e-mail and password, session kept across restarts
- [ ] Profile and role loaded after sign-in (admin or instructor), working hours
- [ ] Missing profile (signed up on web, never opened it) explained, not a crash
- [ ] Sign out
- [n/a] Sign up and invitation acceptance stay on the web (`/signup`, `/convite`)

### Home
- [~] Today's sessions grouped by time (read-only so far)
- [ ] One-tap attendance (optimistic), justified miss asks for the reason
- [ ] Yesterday's pending: unmarked sessions, present without evolution
- [ ] Replacements to schedule
- [ ] Clients to watch, birthdays, weekly attendance rate and delta
- [ ] Modality filter (only when the studio has more than one)

### Agenda
- [ ] Views: Dia, 3 dias, Semana, Mês, with previous / next / today
- [ ] Modality filter
- [ ] Slot sheet: clients, status per client, instructor (admins), delete booking
- [ ] Add client to a slot: modality, date, hour, search, "É reposição?" flow, "Outra atividade"
- [ ] Class note per slot and modality
- [ ] Latest evolution of a client from the agenda

### Clientes
- [ ] List: search by name or document, Ativos / Arquivados, pagination, next session, weekly frequency
- [ ] Create client with modalities and responsible instructor per modality
- [ ] Client header: age, status, modalities, weekly routine
- [ ] Dados: edit personal and shared fields, health lists, archive / reactivate
- [ ] Horários semanais: add and remove recurring slots
- [ ] Documentos: upload (PDF, JPG, PNG, HEIC, up to 10 MB), open via signed URL, delete
- [ ] Evoluções: list (filter by modality, pagination), read view, new, edit, delete, session picker
- [ ] Avaliações: list, read, new, edit, delete (initial evaluation vs re-evaluation)
- [ ] Acupuncture client opens the evaluation right after creation
- [ ] Generic form renderer: text, textarea, choice, multichoice, boolean, number, date, rows, Pilates apparatus
      tree, tongue zones

### Espera
- [ ] List with period filter and counts, first in first listed
- [ ] Add, edit, remove (name, phone, period, modality)

### Usuários (admin)
- [ ] List, edit (name, role, working hours, modalities taught), reassign guard
- [ ] Invite by e-mail (through the web route handler)
- [ ] Remove (through the web route handler)

### Configurações (admin)
- [ ] Switch modalities on and off for the studio

## Not planned

- Wellhub (the web integration itself is unfinished).
- Offline writes. Reads are cached; writes need a connection and say so.
