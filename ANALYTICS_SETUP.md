# Student activity setup

The Students tab shows anonymous browser activity from the last 90 days. It does not identify a student by name or email. A visit is a page load with JavaScript enabled. A download is a request to the site's resource endpoint; delivery by Google Drive or Internet Archive cannot be confirmed.

1. Create a Cloudflare D1 database for the Pages project. Apply `migrations/0001_analytics.sql` to it.
2. Bind the database to the Pages project with the variable name `ANALYTICS_DB` for production (and preview if wanted). Configure the binding in Cloudflare Pages settings or the project's Wrangler configuration.
3. Set the Pages secret `ANALYTICS_ADMIN_TOKEN` to a random value of at least 32 characters. Keep it out of Git.
4. On the computer that runs `.local-admin/server.mjs`, set `ANALYTICS_REPORT_URL` to `https://YOUR-SITE/api/analytics/report` and set `ANALYTICS_ADMIN_TOKEN` to the same secret. Start the local panel after setting these environment variables. The panel reads them only on the server and never sends the token to the browser.
5. Deploy the site code, then visit a page and request a resource. Open the local admin panel, sign in, and select **Students**.

Without the D1 binding, analytics is disabled and public site features continue to work. Without the local environment variables, the Students tab shows a setup message. The dashboard has no historical data before deployment. Old events are deleted opportunistically during traffic, and reports include only the last 90 days.

The local admin folder is intentionally ignored by Git. Copy its updated source to the second administrator's computer through the existing private sharing process; never add its credentials to the public repository.
