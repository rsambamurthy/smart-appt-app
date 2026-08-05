# Decommissioning SmartAppt Lite

Lite was a demonstration environment for prospective customers. Nobody is live
on it, so it is being deleted rather than paused.

Read the whole thing before starting. The dangerous step is step 5, and the
name of the service you are deleting is `smart-appt-app-**production**` — which
is *Lite*. Gold runs on `smart-appt-app-**development**`. That inversion has
already caused one incident; do not rely on the name alone at the moment of
deletion, check the variables.

---

## 1. Prove nobody is on it

Run against **Lite** (`smart-appt-app-production`). Expect small numbers and
old dates. If anything here surprises you, stop.

```sql
SELECT a.name,
       (SELECT COUNT(*) FROM units u WHERE u.association_id = a.id AND u.deleted_at IS NULL) AS units,
       (SELECT COUNT(*) FROM users x WHERE x.association_id = a.id AND x.deleted_at IS NULL) AS users,
       (SELECT MAX(p.payment_date) FROM payments p WHERE p.association_id = a.id)            AS last_payment,
       (SELECT MAX(b.created_at)   FROM bills b    WHERE b.association_id = a.id)            AS last_bill
  FROM associations a
 ORDER BY a.name;

-- Anyone who signed in recently is a person who thinks this product exists.
SELECT COUNT(*) AS logins_last_30d
  FROM users
 WHERE last_login_at > NOW() - INTERVAL '30 days';
```

## 2. Back it up anyway

"Just a testing bed" still means real prospects' names and phone numbers.

Copy Lite's `DATABASE_URL` from Railway → Variables **straight into your
terminal**. Do not paste it into a chat, an email, or a file in this repo.

```bash
pg_dump "<LITE_DATABASE_URL>" --format=custom --no-owner --no-privileges ^
        --file=smartappt-lite-final-2026-08-04.dump
```

Keep the dump somewhere private and backed up — not in this repository. It is
a complete copy of every prospect's personal data, and it will be the only one.

## 3. Verify the backup before you destroy the original

A dump you have not read is not a backup.

```bash
pg_restore --list smartappt-lite-final-2026-08-04.dump | find /c "TABLE DATA"
```

Expect a couple of dozen tables. If that number is 0 or the command errors,
the dump is bad — do not continue.

## 4. Vercel: remove the Lite domain

Project `smart-appt-app` → Settings → Domains → `smartapptlite.integratatech.ai`
→ Remove. Leave `smartapptgold.integratatech.ai` alone.

Also delete the **Production**-scoped `VITE_API_URL` variable, which points at
Lite's backend. The Preview-scoped one on `feature/accounting-v2` is Gold's and
must stay.

## 5. Railway: delete the Lite service — YOU do this, not automation

Before clicking delete, open the service's **Variables** tab and confirm the
`DATABASE_URL` host matches the one you just dumped. The service *name* is the
misleading part; the connection string is the truth.

Delete the Lite Postgres database and the Lite backend service.

**This is irreversible.** Your dump from step 2 is the only remaining copy.

---

## 6. Then fix the naming — the actual reason to do this

With Lite gone there is one environment, and it should stop being called
"development".

**Do not simply rename the Railway service.** The public hostname is derived
from the service name, so renaming changes
`smart-appt-app-development.up.railway.app` to something else, and every APK in
the field breaks until rebuilt and reinstalled — including the gate handset.

Do this instead:

1. Add a **custom domain** to Gold's Railway service, e.g. `api.integratatech.ai`.
   Railway generates the DNS record to add.
2. Point the app at the custom domain in all three places:
   - `frontend/.env.mobile` → `VITE_API_URL`
   - `frontend/vercel.json` → the `/api/v1` rewrite destination
   - Vercel → the Preview-scoped `VITE_API_URL`
3. Update the assertion in `build-apk-prod.bat` (`EXPECTED_HOST`) to match.
4. Rebuild and reinstall the APK.
5. Only once nothing references the `.up.railway.app` hostname, rename the
   service freely — the custom domain is stable regardless of its name.

The point is that after this, no URL depends on a service name, so the class of
bug where "production" secretly means Lite cannot recur.

## 7. Git

`feature/accounting-v2` is the de facto trunk. Rename it to `main` on GitHub,
then update Vercel → Settings → Git → Production Branch, and locally:

```bash
git branch -m feature/accounting-v2 main
git push origin -u main
git push origin --delete feature/accounting-v2
```

Do this **after** step 6, not before: the Vercel Preview-scoped `VITE_API_URL`
is bound to the branch name, and renaming the branch orphans it. Gold would
fall back to the production-scoped value — which, until step 4 is done, still
points at Lite.
