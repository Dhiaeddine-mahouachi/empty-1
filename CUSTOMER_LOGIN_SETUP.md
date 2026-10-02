# AuraPops customer accounts

Customers can create an account with their name, email and password either on `/login` or when preparing a page in the builder. The account exists immediately; public page access requires the existing manual payment confirmation and admin approval. The dashboard is `/dashboard`, and the private activation dashboard remains `/aurapops/admin`.

Existing drafts can be linked only with their original owner token stored on the device that created them. Knowing a page address does not grant ownership. No existing data is deleted.

## Google sign-in

Create a Google OAuth client of type Web application. Add these authorized redirect URIs:

- `https://aurapops.online/api/aurapops/account/google/callback`
- `https://www.aurapops.online/api/aurapops/account/google/callback`

Set `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` as secrets on the Cloudflare `aurapops` Worker. The Google button appears only when both are configured. Password accounts must sign in first before connecting their verified Google identity; accounts are not merged automatically by email.

Google setup requires access to the user's Google Cloud project and consent-screen publishing. OAuth state and PKCE are single-use and expire after ten minutes. Only openid/email/profile scopes are requested; Gmail inbox access is not requested.

## Validation

Run `npm run check` and `node --test tests/customer.test.mjs`. Deployment validation also runs a Wrangler dry run. Customer tables are added with CREATE TABLE IF NOT EXISTS when the API starts. API/session responses are never cached; sessions use HttpOnly Secure cookies and hashed random tokens. Passwords use salted PBKDF2-SHA256. Password changes invalidate old sessions.

Password-reset email delivery is not configured. The login provides a support contact for recovery. Payment collection remains manual; customers cannot set payment or approval state.


## Password confirmation and verification codes

Signup and password changes require matching password confirmation. Email signup creates only a pending registration. A six-digit code expires after ten minutes, is consumed once, has a five-attempt limit and cannot be resent for sixty seconds. The account is created only after a valid code. Existing password accounts must verify their email before managing pages. Google identities use Google's verified-email claim.

Set `RESEND_API_KEY` as a secret on the Cloudflare **aurapops** Worker, using a Resend API key with sending permission for `auradigitalworks.com`. The default sender is `AuraPops <noreply@auradigitalworks.com>`; optional `AURAPOPS_EMAIL_FROM` can override it. The deployment checks for the secret before publishing, so an unconfigured sender cannot disable live registration.

## AuraMenu integration

The same account credentials work on AuraPops and AuraMenu, with separate secure cookies for each domain. Add `auramenu.space` to the deploy token's Zone Resources with Workers Routes Edit and Zone Read. The account UI is `/login` and `/account` on AuraMenu; its existing menu editor remains `/dashboard.html?id=...`.

Menu access requires a verified account whose email matches the menu request's contact email. A request number alone cannot grant access. The existing backend continues to enforce paid editing periods; this integration does not grant free editing. The frontend uses same-origin API routes handled by the aurapops Worker and forwarded to the existing agency backend. Its bridge credential remains on the server and is derived from a runtime secret; it is never sent to the browser.

Publish the account Worker successfully before merging the AuraMenu frontend branch `customer-email-verification`.
