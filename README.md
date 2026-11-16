# Fluxo

Agenda, attendance and session notes for Pilates, acupuncture and physio studios. Next.js 15 (App Router) + Supabase (Postgres, Auth, Storage, RLS). The UI is in pt-BR and follows the Claude Design canvas.

Fluxo is multi-tenant: anyone can sign up and get their own isolated studio, invite instructors, and manage clients, agenda and clinical records inside it.

## What is built

### Accounts, studios and roles

- **Self-signup (`/signup`)**: creates an auth user. The new studio and its admin profile are provisioned on the first authenticated page load (`ensureProfile` in `src/lib/admin.ts`), so it also works when email confirmation is required.
- **Studios**: every admin owns an isolated studio. Everything created by that admin or their instructors is scoped to the studio and invisible to every other studio.
- **Roles**: `admin` and `instructor`, plus optional working hours per user.
  - Admins see and manage everyone in the studio.
  - Instructors see a client only in the modalities where they are responsible, and only the slots, bookings, evaluations, evolutions and notes of those modalities. Documents have no modality: any instructor responsible for the client in any modality sees them.
  - The wait list and session notes are studio-wide, since nobody owns a prospect and a slot note is not tied to one client. Notes are per modality.
- **Users (`/usuarios`, admin only)**: invite by email (role, name, working hours, modalities taught), edit and remove users. Invitees land on `/convite` and set their first password.
- Login, session refresh in the middleware; every route except `/login`, `/signup` and `/convite` requires a session.

### Modalities

Launch modalities are **Pilates** and **Acupuntura**; a user can teach one or both. Modalities are code-owned (no studio-defined ones): each has a seed row in `modalities` and form definitions in `packages/forms`.

- A studio switches modalities on in **Configurações** (admin). A new studio starts with Pilates on. Each user is marked with the modalities they teach (`/usuarios`).
- A client is enrolled in one or more modalities, with a **responsible instructor per modality** (`client_modality_instructors`). Only admins reassign. A modality that already has slots or records on a client cannot be removed from them.
- Slots, bookings, evaluations, evolutions, class notes and wait list entries all carry a modality. Scheduling is identical for every modality (no client limit per slot).
- Adding a client to the agenda starts with the modality (limited to the ones the user teaches). Agenda and Home have a modality filter, chips carry the modality colour, and the weekly attendance rate follows the filter.
- **Outra atividade**: a one-off booking with a free-text label, no modality and no evolution form, for classes Fluxo has no forms for.
- A client who starts in Acupuncture opens the Acupuncture evaluation right away (it can be skipped and done later).

### Forms per modality

Evaluations and evolutions share two tables for every modality: real columns (`studio_id`, `client_id`, `modality_id`, `date`, `created_by`; evolutions also `booking_id` and `session_number`) plus `data jsonb` and `schema_version`.

The forms are code, in the workspace package **`packages/forms`** (`@fluxo/forms`, no React, so the mobile app can use it too): sections, fields, Zod validation, list summaries and read views, per modality and kind. Field kinds: short text, long text, single choice, multi choice, yes/no, number, date, repeating rows, and two custom kinds (the Pilates apparatus tree, the tongue zones).

- Validation runs on the server with the definition's strict Zod schema; unknown keys are rejected, empty values are dropped (`parseData`).
- One generic renderer draws any definition (`src/components/forms/FormFields.tsx`) and one read view (`FormReadView.tsx`). **Adding a modality = a definition file + a seed row in `modalities`**, no new screens.
- Socio-demographic and history data (sex, marital status, city, profession, workplace, children, parents, current and previous treatments, medication) is **client data**, filled once on the client's Dados, and is not repeated in the acupuncture evaluation.

### App

- **App shell**: sidebar (collapses to icons on tablet, bottom tab bar on phone), user name and avatar, sign out.
- **Home**: today's sessions with one-tap attendance, yesterday's pending items, replacements to schedule, clients to watch, birthdays, weekly attendance rate.
- **Agenda**: Dia, 3 dias, Semana and Mês. Click a client chip to mark attendance, see the latest evolution, open the client or write an evolution. "+" on any slot adds a client, with the "É reposição?" flow that links to the justified miss being made up.
  - **Notas da turma**: a free-text note per class slot (date + time), edited from the slot.
- **Clientes**: list with search, active/archived filter and pagination; create client with a responsible instructor ("Instrutor responsável"). Only admins can reassign it.
- **Lista de espera**: people waiting for a vaga (not clients yet) with name, phone and period of the day (Manhã, Tarde, Noite). Add, edit, remove, filter by period; first in, first listed.
- **Client page**:
  - **Dados**: edit, doenças, cirurgias, weekly slots, archive/reactivate.
  - **Evoluções**: table, read view, form with the apparatus tree, edit, delete.
  - **Avaliações**: table, modal with the pre-filled form, new, edit, delete.
  - **Documentos**: upload and download of medical files (up to 10MB each), stored in a private Storage bucket.

There is **no limit of clients per slot** for manual bookings. Slots show a plain count ("5 clientes"). A capacity exists only for the weekly class times a studio publishes to Wellhub (`class_slots`, see below), and only bookings that arrive from Wellhub are checked against it.

### Database

Schema, business rules (as triggers), recurring-slot booking generator and RLS, in `supabase/migrations/`:

| Migration | Adds |
| --- | --- |
| `0001_init.sql` | Core schema: clients, evaluations, recurring slots, bookings, evolutions |
| `0002_miss_reason_and_regions.sql` | Reason for justified misses, region-based evolution exercises |
| `0003_wait_list.sql` | Wait list |
| `0004_documents.sql` | Client documents table and the private `client-documents` bucket |
| `0005_session_notes.sql` | Per-slot class notes |
| `0006_profiles_and_scoping.sql` | Profiles, roles, `app_role()`, per-instructor scoping of clients and their data, scoped Storage policy |
| `0007_multi_tenant.sql` | Studios, `my_studio()`, studio scoping, self-signup policies |
| `0008_fix_signup_policy.sql` | Closes a blind spot in the signup profile policy (`studio_is_unclaimed()`) |
| `0009_modalities.sql` | Modalities, studio/user/client assignment, `modality_id` on slots, bookings, evaluations, evolutions, notes and wait list (backfilled to Pilates), labelled bookings, modality-scoped RLS, `can_access_client()`, storage policy fix |
| `0010_generic_forms.sql` | `data jsonb` + `schema_version` on evaluations and evolutions, `studio_id`, `created_by`, `session_number`; Pilates rows migrated into `data` |
| `0012_admins_teach_by_default.sql` | Admins teach every modality the studio offers by default (backfilled; triggers keep it true for new admins and newly enabled modalities) |
| `0011_client_shared_fields.sql` | Shared client fields (sex, marital status, city, profession, workplace, children, parents) and treatments / medication lists |
| `0013_wellhub.sql` | Wellhub: weekly capacity per class time (`class_slots`), the studio's connection and booking rules (`wellhub_connections`), the per-gym webhook secret (`wellhub_secrets`, no policy), `bookings.wellhub_booking_number`, and the service-only `wellhub_book` / `wellhub_cancel` / `wellhub_link_gym` |

Rules enforced in the database:

- An evolution can only be linked to a session where the client was present or made a replacement, and only to the client's own session.
- A session that already has an evolution cannot be changed to a miss or unmarked.
- A replacement points to a justified miss of the same client, and a miss can be replaced only once.
- The same client cannot be booked twice at the same date and time.
- A justified miss has a reason (text). Any other status has none. Misses saved before 0002 are kept as they are.
- Row access is scoped by studio and, for instructors, by the modalities they are responsible for per client (RLS, `can_access_client()`).
- A client can only be scheduled and recorded in modalities they are enrolled in; an instructor only teaches modalities the studio offers; an evolution and a replacement must be of the same modality as their session.
- A labelled one-off booking has no modality and never takes an evolution.

## Evolution exercises

For each apparatus (Reformer, Barrel, Cadillac, Chair, Balance) and exercise type (Mobilidade, Fortalecimento, Alongamento), the user picks the regions worked: MMII, MMSS, Tronco, Core, Cervical, Quadril, Cintura escapular, Global (multiple choice), and can add an optional note. Stored in `evolutions.data` under `apparatus` as `{ "apparatus": { "reformer": { "strengthening": { "regions": ["mmii", "hip"], "note": "..." } } } }`. Evolutions saved with the first version (free text per area) are converted when read: Inferiores becomes MMII, Superiores becomes MMSS, and the text goes to the note.

## Wellhub (in progress)

Sharing the agenda with Wellhub (Gympass) uses Wellhub's **Booking API** and **Integration Setup API**. Built so far: the database rules and the server-side building blocks. **Not built yet:** the webhook routes, the sync job that publishes slots, and the Configurações screen with the connect button.

### How a studio connects (no credentials are typed in Fluxo)

Fluxo is a *system* on Wellhub's side. Wellhub gives Fluxo one API token for the whole system (a partnership with Wellhub, `WELLHUB_API_TOKEN`); studios never enter a token or password.

1. An admin clicks **Conectar ao Wellhub** in Configurações. Fluxo creates the studio's `wellhub_connections` row (status `awaiting`) and shows a **connection code**.
2. In Wellhub's Partner Portal the studio opens Integrações, picks Fluxo as its system, enters the code, and clicks *Solicitar Integração*.
3. Wellhub sends `SYSTEM_INTEGRATION_REQUESTED` (gym id, name, custom fields) to Fluxo's webhook. The code in the custom field is the proof that this gym is that studio: `wellhub_link_gym` links them and sets the status to `connected`.
4. Fluxo subscribes the gym's booking webhooks with a per-gym secret it generates (`subscribeGymWebhooks`), then publishes the classes and slots.

### Flow after that

- **Publish:** each modality becomes a Wellhub *class*; each published `class_slots` time becomes *slots* for the coming days, with `total_capacity` and `total_booked` (`src/lib/wellhub/slots.ts`).
- **Booking:** `booking-requested` is verified (`X-Gympass-Signature`, HMAC-SHA1 of the raw body), answered within 1 second, and `wellhub_book` takes the place or returns Wellhub's reason (`CLASS_IS_FULL`, `USER_IS_ALREADY_BOOKED`, ...). Fluxo then answers `RESERVED` or `REJECTED` through the Booking API (Wellhub auto-rejects after 15 minutes). The same booking number twice is harmless.
- **Cancel:** `booking-canceled` removes the booking; `booking-late-canceled` keeps it as a justified miss. Both free the place.
- **Counters:** after any booking change the slot's `total_booked` is patched. A class overbooked by hand is reported as full, never above its capacity.

The functions that write bookings are callable only by the server (service role), and the secret table has no policy. Business rules are tested in `supabase/tests/wellhub.test.ts`; payloads, signatures, slot building and the API client in `test/wellhub.test.ts`.

| Variable | Where | Purpose |
| --- | --- | --- |
| `WELLHUB_API_TOKEN` | **server only** | The token Wellhub issues to Fluxo as a system. Empty: the integration is off. |
| `WELLHUB_ENV` | server | `sandbox` (default) or `production` |
| `WELLHUB_CODE_FIELD` | server | Custom-field key that carries the connection code (`cms_id` by default; Wellhub sets it per system) |

## Instant interactions

Opening or closing a modal and flipping a toggle never waits on the server: dialogs are client state, small mutations are optimistic. The rule is in `CLAUDE.md` / `AGENTS.md`.

## Monorepo layout

```
apps/landing/    # @fluxo/landing: marketing site (static Next.js, no database). Port 3001 in dev
apps/mobile/     # @fluxo/mobile: Expo (React Native) app. Sign-in and today's sessions so far
apps/web/        # @fluxo/web: the Next.js studio app (everything described above; src/, tests/, vercel.json)
packages/forms/  # @fluxo/forms: modalities and form definitions (no React)
packages/copy/   # @fluxo/copy: shared pt-BR wording (status, calendar, periods, roles, option labels). Plain data
packages/domain/ # @fluxo/domain: pure logic (dates in America/Sao_Paulo, attendance rules, phone, age, wait-list schema)
packages/api/    # @fluxo/api: Supabase queries and result types; take a Supabase client, so web (cookies) and mobile (AsyncStorage) share them
packages/ui-web/ # @fluxo/ui-web: component CSS (fluxo.css), Icon, Logo; shared by the studio app and the landing
packages/tokens/ # @fluxo/tokens: colors (light/dark), type scale, icon paths. tokens.css is generated from the TS
supabase/        # migrations, seed and SQL tests, shared by every app
scripts/         # e2e-local.sh
turbo.json       # Turborepo task graph (build, typecheck, test)
```

Planned: shared `packages/config` (tsconfig/eslint presets). Dependency rules (apps never import apps; base packages stay free of React, Next and Supabase) are enforced by `npm run check:boundaries`, which runs in CI. Each app deploys on its own; the dependency direction is always `apps -> packages`.

Paths in the sections below are relative to `apps/web` unless they start with `supabase/` or `packages/`.

## Workspaces and tests

The repo is an npm workspace driven by Turborepo. `apps/web/next.config.ts` lists `@fluxo/forms` in `transpilePackages`. The package manager is npm (`package-lock.json`).

```bash
npm test          # (from the repo root) form definitions, SQL migrations + RLS (in-process Postgres via PGlite), form rendering
npm run typecheck
```

The SQL tests (`supabase/tests/`) run every migration on an in-process Postgres with small stand-ins for Supabase's `auth` and `storage` schemas, migrate a pre-modalities database, and check RLS across two studios, instructor scoping per modality and the business-rule triggers. They need no Docker and no Supabase project.

## Run locally

```bash
cd apps/web && cp .env.example .env.local   # fill in the three Supabase values
cd ../.. && npm install
npm run dev                  # starts @fluxo/web
```

## Environment variables

| Variable | Where | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | browser + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | browser + server | Anon key; every normal query runs as the signed-in user under RLS |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | Used only to invite users (`src/lib/supabase/admin.ts`). It bypasses RLS. |

Never prefix the service-role key with `NEXT_PUBLIC_`, and never use it anywhere except the invite flow.

## Set up Supabase (São Paulo region)

1. Create a project in the `South America (São Paulo)` region.
2. SQL editor: run the migrations in order, `0001` through `0012`. If you already ran some, run only the new files. Optionally run `supabase/seed.sql` for fictional development data only.
3. Authentication > Providers > Email: turn **on** "Allow new users to sign up". Self-signup (`/signup`) needs it. Older versions of this README said to turn it off; that was for the single-admin model.
4. Authentication > URL Configuration: set the Site URL to your app's domain. Invite links redirect to `/convite` on it.
5. Project Settings > API: copy the project URL, the anon key and the service-role key into `.env.local`.
6. Open `/signup` and create the first account. It becomes the admin of a new studio. Invite everyone else from `/usuarios`.

**Upgrading to 0009-0011** (modalities): everything that exists is Pilates. The migrations enable Pilates for every studio, mark every user as teaching it, enroll every client in it (keeping their instructor), and move evaluations and evolutions into `data`. The old columns (`evaluations.main_complaint`..`obs`, `evolutions.apparatus`, `clients.instructor_id`) are **kept but unused** until you verify the result. Verification queries are at the bottom of `0010_generic_forms.sql`; after that, drop them in a cleanup migration. Back up before running.

Upgrading an existing single-admin database: 0006 turns existing accounts into admins, and 0007 puts all existing data into one studio ("Meu estúdio"), so nothing is split apart.

Recurring slots become bookings through `select generate_bookings(8)`. The SQL file has a commented `pg_cron` line to run it daily.

## Tests and releases (CI)

`.github/workflows/web.yml` (the studio app) runs on every pull request that touches it and every push to `master`:

1. **checks**: `npm run typecheck` and `npm test`.
2. **e2e**: starts a throwaway local Supabase from `supabase/migrations` (never the production project), builds and starts the app, and runs the [e2e](https://e2e.com/docs) tests.
3. **deploy** (push to `master` only): runs **only if checks and e2e passed**, and deploys to Vercel production with the Vercel CLI.

`apps/web/vercel.json` turns off Vercel's own auto-deploy for `master`, so a release can only go out through this workflow. Pull-request preview deployments from Vercel still work.

**Running the e2e tests on your machine:** `npm run e2e:local` (needs Docker). It starts a throwaway local Supabase from `supabase/migrations`, builds the app against it, runs the tests and cleans up. Run one file with `npm run e2e:local -- tests/auth.e2e.ts`.

> **Never point the e2e tests at the hosted Supabase project.** Every test signs up a new account, which creates real users and studios and sends real emails. The script above sets the database explicitly so `.env.local` cannot leak in. If you run `npx e2e run` by hand, make sure the app on `:3000` was started against the local Supabase.

**What the tests cover** (`tests/*.e2e.ts`, each test signs up its own account and studio, so they never share data):

| File | Covers |
| --- | --- |
| `auth` | Sign-up creates a studio and shows the person's name (not the email); wrong password refused; sign-out and back in; signed-out visitors cannot open any page |
| `clients` | Create a client, search, required fields, duplicate document refused |
| `agenda` | Book a client into a slot; mark attendance and keep it after reload; booking search |
| `evolutions` | Typed spaces are kept (regression); an evolution is saved on the client; empty evolution refused |
| `waitlist` | Add, filter by period, incomplete entry refused |
| `modalities` | A modality is hidden everywhere until the studio switches it on, and again when switched off |
| `users` | Owner is admin, renaming shows everywhere; invite validation |
| `mobile` | Bottom navigation bar on phone, small phone and tablet; Clientes and Usuários icons differ; users list does not overflow |

**Writing tests:** add `tests/<name>.e2e.ts` and use the helpers in `tests/helpers.ts` (`signUp`, `createClient`, `open`, `untilSaved`). Two things to know: use `open(page, path)` instead of `app.open`, because it waits until the page is interactive (a click before hydration does nothing); and wrap clicks on optimistic controls in `untilSaved`, because navigating right after one cancels the background save. Without `APP_URL`, `npm run test:e2e` starts `npm run dev` itself. Node 24.8+ is required, and the browser is installed once with `npx e2e-web install chromium`. Steps written as natural-language goals (`agent.act`, `agent.assert`) also need `AI_GATEWAY_API_KEY`; deterministic tests do not.

**GitHub repository secrets** (Settings > Secrets and variables > Actions):

| Secret | Purpose |
| --- | --- |
| `VERCEL_TOKEN` | Vercel account token for the deploy job |
| `VERCEL_ORG_ID` | `orgId` from `.vercel/project.json` after running `npx vercel link` once |
| `VERCEL_PROJECT_ID` | `projectId` from the same file |
| `AI_GATEWAY_API_KEY` | Optional. Only for agent steps in e2e tests |

**Landing** (`.github/workflows/landing.yml`): typecheck, tests and build, then deploy to its own Vercel project on push to `master`. Setup: create a second Vercel project with Root Directory `apps/landing`, set `NEXT_PUBLIC_APP_URL` (the studio app's address) and `NEXT_PUBLIC_SITE_URL` (the landing's own address), and add the GitHub secret `VERCEL_LANDING_PROJECT_ID`. Each workflow only runs when its own files or shared packages change; because of that, mark required checks carefully (a path-filtered check that is skipped never reports).

**Mobile** (`.github/workflows/mobile.yml`): typecheck, tests and a Metro bundle for iOS and Android on every change to the app or its shared packages. Releases never block or follow the web deploy: a JS-only change goes out as an EAS Update on push to `master`; store builds start on a `mobile-v*` tag or by hand. Both release jobs stay off until you run `eas init` in `apps/mobile`, add the secret `EXPO_TOKEN` and set the repository variable `EAS_ENABLED=true` (plus `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` as variables). Run it locally: `cp apps/mobile/.env.example apps/mobile/.env`, then `npm run start -w @fluxo/mobile`. The mobile app is read-only for now (sign-in, today's sessions); accounts are created on the web or by invitation.

To make the gate strict, in GitHub: Settings > Branches > protect `master` and require the `Typecheck and unit tests` and `End-to-end tests` checks.

## Deploy on Vercel

1. Push this repo to a private Git repository and import it in Vercel with **Root Directory = `apps/web`** (keep "Include source files outside of the Root Directory" on, so `packages/*` is available).
2. Add the three environment variables above in Vercel (Production). The service-role key is a server-only secret. The deploy job uploads the code and Vercel builds it with these variables (so variables marked Sensitive work; do not switch the job to `vercel pull` + `vercel build`, which cannot read them).
3. In Supabase, Authentication > URL Configuration, set the Site URL to your Vercel domain.
4. Add the GitHub secrets from the table above. After that, merging to `master` releases through CI.

## Notes

- Dates are plain calendar dates in `America/Sao_Paulo`; see `packages/domain/src/dates.ts`.
- Status codes and rules are in `@fluxo/domain`, their pt-BR labels in `@fluxo/copy`; `src/lib/status.ts` only adds the web's CSS classes. Put wording that more than one product needs in `@fluxo/copy`.
- The Pilates evolution tree is defined in `packages/forms/src/apparatus.ts` and stored in `evolutions.data.apparatus` (jsonb).
- Design tokens live in `packages/tokens` (the only place a color or icon path is defined). After editing them run `npm run generate -w @fluxo/tokens`; a test fails if `tokens.css` is stale. Web and landing load `@fluxo/tokens/tokens.css`, mobile imports the TS. Component styles are `packages/ui-web/fluxo.css` (it consumes the tokens), shared with the landing page.
- `next.config.ts` sets `experimental.staleTimes.dynamic = 30` so revisits within 30s reuse the cached page instead of re-showing the loading fallback. Mutations still refresh through `revalidatePath()`.
- This is health data: keep the repository private, keep Supabase backups on, and keep the service-role key out of the browser and out of Git.
