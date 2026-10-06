# Fluxo

Agenda, attendance and session notes for a Pilates and physio studio. Next.js 15 (App Router) + Supabase (Postgres, Auth, RLS). The UI is in pt-BR and follows the Claude Design canvas.

## What is built

- Login (single admin), session refresh in the middleware, every other route requires a session
- App shell: sidebar (collapses to icons on tablet, bottom tab bar on phone), admin name and avatar, sign out
- Home: today's sessions with one-tap attendance, yesterday's pending items, replacements to schedule, clients to watch, birthdays, weekly attendance rate
- Agenda: Dia, 3 dias, Semana and Mês. Click a client chip to mark attendance, see the latest evolution, open the client or write an evolution. "+" on any slot adds a client, with the "É reposição?" flow that links to the justified miss being made up
- Clientes: list with search, active/archived filter and pagination; create client
- Lista de espera: people waiting for a vaga (not clients yet) with name, phone and period of the day (Manhã, Tarde, Noite). Add, edit, remove, filter by period; first in, first listed
- Client page: Dados (edit, doenças, cirurgias, weekly slots, archive/reactivate), Evoluções (table, read view, form with the apparatus tree, edit, delete), Avaliações (table, modal with the pre-filled form, new, edit, delete)
- Database: schema, business rules (as triggers), recurring-slot booking generator, RLS. The rules were run against Postgres 16 with a test script.

There is **no limit of clients per slot**. Slots show a plain count ("5 clientes").

Rules enforced in the database:

- An evolution can only be linked to a session where the client was present or made a replacement, and only to the client's own session.
- A session that already has an evolution cannot be changed to a miss or unmarked.
- A replacement points to a justified miss of the same client, and a miss can be replaced only once.
- The same client cannot be booked twice at the same date and time.
- A justified miss has a reason (text). Any other status has none. Misses saved before 0002 are kept as they are.

## Evolution exercises

For each apparatus (Reformer, Barrel, Cadillac, Chair, Balance) and exercise type (Mobilidade, Fortalecimento, Alongamento), the admin picks the regions worked: MMII, MMSS, Tronco, Core, Cervical, Quadril, Cintura escapular, Global (multiple choice), and can add an optional note. Stored in `evolutions.apparatus` as `{ "reformer": { "strengthening": { "regions": ["mmii", "hip"], "note": "..." } } }`. Evolutions saved with the first version (free text per area) are converted when read: Inferiores becomes MMII, Superiores becomes MMSS, and the text goes to the note.

## Run locally

```bash
cp .env.example .env.local   # fill in the two Supabase values
npm install
npm run dev
```

## Set up Supabase (São Paulo region)

1. Create a project in the `South America (São Paulo)` region.
2. SQL editor: run `supabase/migrations/0001_init.sql`, then `0002_miss_reason_and_regions.sql`, then `0003_wait_list.sql`. If you already ran the earlier ones, run only the new file(s). Optionally run `supabase/seed.sql` for fictional development data only.
3. Authentication > Providers > Email: turn **off** "Allow new users to sign up".
4. Authentication > Users > Add user: your email and password. Under the user's metadata set `{"full_name": "Your Name"}`, which feeds the name in the sidebar.
5. Project Settings > API: copy the project URL and the anon key into `.env.local`.

Recurring slots become bookings through `select generate_bookings(8)`. The SQL file has a commented `pg_cron` line to run it daily.

## Deploy on Vercel

1. Push this folder to a private Git repository and import it in Vercel.
2. Add the two environment variables from `.env.example`.
3. Deploy. In Supabase, Authentication > URL Configuration, set the Site URL to your Vercel domain.

Do not add the Supabase service-role key anywhere. Fluxo runs every query as the signed-in admin under RLS.

## Notes

- Dates are plain calendar dates in `America/Sao_Paulo`; see `src/lib/dates.ts`.
- Status labels (pt-BR) and design classes are in `src/lib/status.ts`.
- The evolution tree is validated by `src/lib/apparatus.ts` and stored in `evolutions.apparatus` (jsonb).
- Design tokens and components are `src/styles/fluxo.css`, copied unchanged from the design canvas.
- This is health data: keep the repository private, and keep Supabase backups on.
