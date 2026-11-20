# Database security tests

(Not in `supabase/tests/`: the Supabase CLI runs every `.sql` file there as a pgTAP test with
`supabase test db`, and `stub.sql` is meant only for the throwaway database below.)

`npm run test:db` (or `bash supabase/security-tests/run.sh`) starts a throwaway PostgreSQL in a temp
folder, applies every migration in `../migrations`, loads `seed.sql`, and runs
`security.test.sh`: about 180 checks of RLS, column grants, the security definer functions and
the triggers (Pro rewards, limits, pushes), each run as a guest, a free user, a Pro user or an
admin, the way PostgREST would. It never connects to the live project.

Needs PostgreSQL 15+ (`brew install postgresql@16`); set `PG_BIN` if `initdb` isn't on your
PATH. `VERBOSE=1` prints every check, not just failures. Exits non-zero on any failure.

| File | What it is |
| --- | --- |
| `run.sh` | Starts the database, applies migrations, runs the checks, cleans up |
| `stub.sql` | What Supabase provides before our migrations: API roles, `auth.uid()`, storage tables, pg_cron and pg_net look-alikes (`net.http_post` only records calls in `net.calls`) |
| `seed.sql` | Test accounts (free A–D, a Pro subscriber, an admin) and 20 catalog meals |
| `lib.sh` | `t "<name>" <who> <ok\|deny\|=value> "<sql>"`: one check as one identity |
| `security.test.sh` | The checks, in order (later ones build on earlier ones) |

Adding a table, policy or security definer function: add checks for who can and can't use it
to `security.test.sh` in the same change. Note `S2` is deliberately asserted as still open
(public saved meals return the stored snapshot) until that fix lands; update it then.
