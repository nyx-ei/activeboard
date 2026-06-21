# ActiveBoard restore point - 2026-06-21 pre-matchmaker

This restore point freezes the current ActiveBoard product state before any
match-maker work starts. It covers the application code and the versioned
Supabase schema migrations available in this repository.

## Git references

- Restore branch: `archive/activeboard-2026-06-21-pre-matchmaker`
- Restore tag: `restore/activeboard-2026-06-21-pre-matchmaker`
- Frozen commit: `e730ee709b1310b617257173c23fdd312db45792`
- Frozen commit subject: `Polish admin console policy wiring`
- Local creation date: 2026-06-21

The archive branch and tag must be pushed to GitHub so the restore point is not
only local.

```bash
git push origin archive/activeboard-2026-06-21-pre-matchmaker
git push origin restore/activeboard-2026-06-21-pre-matchmaker
```

## Product scope

This point represents the current ActiveBoard application before match-maker
features. It includes:

- dashboard v11 as the main application surface;
- group zone, scheduled sessions, live session flow, answer flow, review flow;
- billing quota rules and the admin policy console;
- Ops dashboard for adoption monitoring;
- all Supabase migrations currently versioned up to:
  `supabase/migrations/20260615143000_admin_policy_french_copy.sql`.

It intentionally does not include any future match-maker tables, views, routes,
RPCs, UI, or matching logic.

## Restore application code

To restore the code to this point:

```bash
git fetch origin --tags
git switch -c restore/pre-matchmaker-2026-06-21 restore/activeboard-2026-06-21-pre-matchmaker
npm install
npm run typecheck
npm run build
```

For a hotfix based on the archived state:

```bash
git fetch origin --tags
git switch -c hotfix/pre-matchmaker-restore origin/archive/activeboard-2026-06-21-pre-matchmaker
```

If GitHub does not expose the tag as a remote branch, use the tag directly:

```bash
git switch -c hotfix/pre-matchmaker-restore restore/activeboard-2026-06-21-pre-matchmaker
```

## Supabase schema restore strategy

The repository freezes schema migrations, but it does not contain a live
database dump. Supabase data and schema state must also be captured outside Git.

Before starting match-maker work, create two backups from the production
project:

1. Schema-only dump.
2. Full data dump or Supabase point-in-time backup, depending on the plan.

Recommended CLI commands when Supabase CLI and project access are available:

```bash
supabase link --project-ref <production-project-ref>
supabase db dump --schema public --file backups/2026-06-21-pre-matchmaker-schema.sql
supabase db dump --file backups/2026-06-21-pre-matchmaker-full.sql
```

If the project is on a Supabase plan with Point-in-Time Recovery, also create or
record a PITR restore marker for 2026-06-21 before deploying match-maker
migrations.

Do not commit full production data dumps to Git. Store them in the approved
secure backup location only.

## Supabase migration boundary

When restoring the pre-match-maker schema from migrations, apply migrations only
through this file:

```text
supabase/migrations/20260615143000_admin_policy_french_copy.sql
```

Any migration after this boundary must be considered post-restore-point work and
must be reviewed before applying to a restored pre-match-maker environment.

## Runtime environment checklist

Record or preserve these environment variables alongside the restore point:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `NEXT_PUBLIC_APP_URL`
- `ADMIN_CONSOLE_ALLOWED_EMAILS`
- `OPS_DASHBOARD_ALLOWED_EMAILS`
- Stripe variables used by billing
- MailerSend variables used by invitations and reminders
- cron secrets used by scheduled jobs

Do not store secret values in this repository.

## Verification after restore

After restoring code and schema, verify:

- `/fr/dashboard` and `/en/dashboard` load for an authenticated user;
- the admin console is accessible to an allowed admin at `/fr/admin`;
- session creation and scheduled session display work;
- session start, answer submit, advance, complete, and review work;
- billing quota and question counter use the configured admin policy values;
- group invitations and session calendar emails still dispatch when email env is
  configured;
- Ops dashboard loads at `/fr/ops` for allowed users.

## Notes

This restore point is not complete until both Git references are pushed and the
Supabase backup is created or recorded in the operational backup system.
