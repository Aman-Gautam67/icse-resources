# Student resource sharing setup

The home page contains the share form and receipt-based status sidebar. Submitted files stay private in R2 until an administrator approves them. Approved files appear in the Class 10 or Class 12 student-shared list on Study Materials. Discord and Reddit IDs remain visible only in the local admin panel.

1. Apply `migrations/0002_student_submissions.sql` to the same Cloudflare D1 database used for analytics, then bind it to the Pages project as `ANALYTICS_DB`. The migration creates separate submission tables and does not change analytics data.
2. Create a **private** Cloudflare R2 bucket. Bind it to the Pages project as `SUBMISSIONS_BUCKET`. Do not expose the bucket through a public domain.
3. Set Pages secret `SUBMISSIONS_ADMIN_TOKEN` to a random string of at least 32 characters. The secret protects the admin review API and keys the upload rate limit. Keep it outside Git.
4. On the computer running `.local-admin/server.mjs`, set `SUBMISSIONS_ADMIN_URL=https://YOUR-SITE/api/submissions/admin` and `SUBMISSIONS_ADMIN_TOKEN` to the same secret. Restart the local panel. Open **Submissions** after signing in with an allowed admin account.
5. Deploy the site. Test with a small PDF or image: submit on home page, copy the tracking code, confirm **pending**, inspect the file in the local admin panel, approve it, then confirm **approved** and a public download on Study Materials.

Uploads require the Cloudflare IP header, same-origin requests, and a valid PDF/JPEG/PNG/GIF/WebP signature. Limit: 20 MB per file and five attempts per IP per hour. User-controlled file names never become storage paths. R2 objects are private; the public file route only serves approved rows. Anyone holding a receipt can see its status, so treat tracking codes as private. The local admin folder is ignored by Git; copy its updated files to any other authorized admin computer through the existing private process.
