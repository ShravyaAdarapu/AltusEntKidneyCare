# Hostinger installation

This package uses PHP 8.2+ and MySQL with PDO MySQL enabled. No payment integration is included.

1. Upload `altus-website.zip` and extract its contents directly into the site's `public_html`. `index.html`, `api` and `admin` must be directly inside `public_html`, without a nested `dist` directory.
2. In hPanel, create a MySQL database and user. In phpMyAdmin import `backend/schema.sql` into that database. It seeds both doctors, with 30-minute slots between 6 PM and 10 PM Monday–Saturday, with Sunday closed. Change these through the staff dashboard when the clinic confirms the schedule.
3. Create an `altus-private` folder alongside (not inside) `public_html`. Copy `backend/private/config.example.php` there as `config.php`. Fill in the database name, username and password. Keep this file outside public access.
4. Generate a secret: `php -r "echo bin2hex(random_bytes(32));"`. Generate the staff password hash locally using `php backend/bin/password.php`. Put the results in `secret` and `admin_hash`. Choose a staff username. Do not upload the password helper or publish credentials.
5. Enable SSL for the domain and leave `require_https` true. Choose PHP 8.2 or newer, with PDO MySQL enabled. The API uses the configuration at `../altus-private/config.php` relative to `public_html`. If your hosting directory differs, set the `ALTUS_CONFIG` environment variable to the private file's absolute path.
6. Open `/api/index.php?action=bootstrap` on the domain. It should return dates and doctor names. Visit `/admin/` and sign in. Submit a test appointment, confirm it in the dashboard, and verify that the same time cannot be booked again for that doctor. Cancel the test appointment to release its time.

## Behaviour

- Availability and cut-offs use Asia/Kolkata on the server. At 6:30 PM, today's earliest possible start is 7 PM. The last start is 9:30 PM. Bookings are offered up to 90 days ahead.
- A requested appointment reserves its slot immediately. Staff must confirm it or cancel it. Cancelled slots become available again. Weekly-hour changes and date closures do not cancel existing appointments; staff must contact those patients separately.
- Staff can view appointments by date, change their status, manage weekly hours and closed dates, and resolve enquiries. Staff sessions expire after 30 minutes of inactivity.
- Forms store requests in the database and display a reference. They do not charge a payment or send an automatic WhatsApp/SMS/email notification. Reception must monitor the dashboard and call patients. Automatic messaging requires a separately configured provider and clinic-approved templates.
- Clinic totals displayed elsewhere on the site remain the supplied historical figures; the booking database is not a source for historical surgery or patient totals.
- Back up the database through Hostinger, limit staff access, and agree a retention policy with the clinic. Never put the database export, config, test helpers or private documents in public_html.

## Local checks

`python build.py` refreshes `dist` and copies only the public backend files. Serve `dist` with PHP (a Python static server cannot execute the API). Set `ALTUS_CONFIG` to a private development configuration with `require_https` false only on loopback.

`backend/bin/setup-test.php` and `test-api.py` are isolated local-test helpers, not production setup scripts. The test helper uses a disposable MySQL instance on port 33317 and a dedicated `altus_test` database. Do not run against a production database.

If the original schema has already been imported, run `backend/update-evening-hours.sql` once to update existing schedules to 6–10 PM. Existing appointments and closed dates are preserved.

## Automatic deployment from GitHub

The workflow `.github/workflows/hostinger.yml` builds from `src` on pushes to `main` and uploads only `dist` using encrypted SSH/SFTP. Manual runs are available under Actions → Deploy to Hostinger. Vercel can remain a separate preview deployment; PHP booking requires Hostinger.

One-time connection:

1. In hPanel → Websites → Manage Altus → Advanced → SSH Access, enable SSH. Note the host/IP, SSH username and port (normally 65002).
2. Create a dedicated Ed25519 deployment key on your local computer. Add its public key to Hostinger's SSH keys. Keep the private key off GitHub files and out of chat.
3. In the GitHub repository → Settings → Environments, create `hostinger-production`. Add environment secrets:
   - `HOSTINGER_HOST`: host/IP shown under SSH Access.
   - `HOSTINGER_PORT`: SSH port shown there.
   - `HOSTINGER_USER`: SSH account username (not the MySQL username).
   - `HOSTINGER_DEPLOY_PATH`: `/home/YOUR_SSH_USER/domains/altusentkidneycare.com/public_html`.
   - `HOSTINGER_SSH_KEY`: complete private deployment key.
   - `HOSTINGER_KNOWN_HOSTS`: pinned OpenSSH host-key line for this host and port. Obtain it with `ssh-keyscan -p PORT HOST`, then verify its fingerprint with Hostinger/support before trusting it. Do not use an unverified scan as proof of server identity.
4. Commit and push the workflow and source to `main`. Check the Actions run. Missing secrets cause a clear failure without uploading anything.
5. Verify the live homepage and booking form after the first successful run. One-time database/configuration setup is still required. Workflow success only confirms file transfer, not database readiness.

Uploads overwrite website files but do not delete unrelated remote files, execute SQL or alter the private configuration. If a page is intentionally removed, remove that obsolete file manually in Hostinger. Schema changes must be reviewed and applied separately through phpMyAdmin after backing up. Existing bookings persist across routine deployments.

## Staff accounts and doctor dashboards

Routes: `/admin/reception`, `/admin/dr.chetan`, `/admin/dr.mounika`. The `/admin/` entry sends a signed-in account to its workspace. Dashboard navigation never links to the public website.

For existing installations, import `backend/staff-accounts.sql` before deploying the staff-account API. Provision one receptionist account and one account per doctor in `staff_accounts`, using PHP `password_hash` output, never plaintext. Link each doctor account to its doctor ID. On this installation, these accounts were provisioned privately over SSH; login details are in the ignored `.deploy-private` folder. Do not put login files or staff seeds in public_html or Git.

Reception can view/manage both doctors. Doctors can view both in the shared reception workspace but can change appointments, create bookings and edit schedules only for their own doctor. Personal dashboard analytics and patient histories are scoped to their doctor by default. Shared reading is intentional and authorised; doctors cannot access contact enquiries.

Only doctor accounts can change their own passwords in the dashboard. Reception accounts have no password-change control and are denied by the API; their password is managed by the site owner. Password changes invalidate other sessions. Setting `active=0` in the account table revokes its sessions on the next protected request. Sessions have a 30-minute idle timeout and an 8-hour maximum duration. Passwords need at least 14 characters. A deployed account change requires signing in again.

Appointment creation, status changes, rescheduling, schedule changes, enquiry updates and password changes are recorded in `audit_log` using staff/record IDs rather than copying patient concerns. Analytics are computed from saved bookings; they are not clinical outcomes or revenue reports. Public booking still creates pending requests and has no online payment or automatic messaging integration.

Run `backend/bin/test-permissions.py` only with the isolated test PHP server on port 8094 and the disposable accounts from `setup-test.php`. The suite verifies doctor isolation and shared read-only behaviour, authorisation, input/CSRF checks, analytics scoping and session revocation.
