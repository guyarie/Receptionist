# Install Migration Runbook

How to move one install's live traffic and data from one deployment host to
another — e.g. a cloud droplet to a home server, or between two home
machines. This assumes the repo's multi-install layout: each install lives
in `installs/<name>/` with its own `.env`, optional `nginx.conf`, and PM2
process named `receptionist-<name>`, managed via `node manage.js`.

For a worked example with real values, see a specific migration doc (e.g.
`docs/RTC-MIGRATION.md`) — this file only covers the general mechanics.

## Placeholders used below

| Placeholder | Meaning |
|---|---|
| `$INSTALL` | Install directory name, e.g. `rtc` |
| `$SOURCE_HOST` | SSH-reachable address of the current host |
| `$TARGET_HOST` | SSH-reachable address of the new host (Tailscale IP, LAN IP, etc.) |
| `$DOMAIN` | Public hostname routed to this install |
| `$PORT` / `$SETUP_PORT` | This install's app port / setup-mode port |
| `receptionist-$INSTALL` | PM2 process name for this install |

## Pre-flight

- **If production is live, plan a real cutover window.** A botched cutover
  loses real traffic — lower the DNS TTL for `$DOMAIN` a few hours ahead of
  time so a rollback (Step 2) propagates fast if needed.
- Confirm the source host's `.env` for `$INSTALL` is authoritative before
  copying — a stale local copy (e.g. from an earlier test) can silently
  differ on things like SMTP credentials. Diff non-secret keys against any
  local copy you already have.
- Stop the app on the source host only immediately before archiving, and be
  ready to restart it there if the cutover stalls.

## Step 1 — Pull the live install off the source host

```bash
ssh $SOURCE_HOST 'ls -d /path/to/Receptionist/installs/*/'   # confirm the install path

ssh $SOURCE_HOST "pm2 stop receptionist-\$INSTALL"
ssh $SOURCE_HOST "tar czf /tmp/\$INSTALL-live.tar.gz -C /path/to/Receptionist/installs \$INSTALL"
scp $SOURCE_HOST:/tmp/$INSTALL-live.tar.gz .
```

Push it to the target host (over Tailscale if available):

```bash
scp $INSTALL-live.tar.gz $TARGET_HOST:/tmp/
```

On the target host, unpack over an empty skeleton install (create
`installs/$INSTALL/` first if it doesn't exist):

```bash
cd /path/to/Receptionist/installs
tar xzf /tmp/$INSTALL-live.tar.gz --strip-components=1 -C $INSTALL
```

Then reconcile `.env` — the source copy will carry the source host's ports
and any host-specific paths (e.g. `SSL_CERT_PATH`/`SSL_KEY_PATH` if the
source terminated its own TLS). Re-apply for the target host:

```env
INSTALL_NAME=$INSTALL
PORT=$PORT
SETUP_PORT=$SETUP_PORT
PUBLIC_URL=https://$DOMAIN
```

Delete `SSL_CERT_PATH` / `SSL_KEY_PATH` if the target uses nginx to
terminate TLS. Keep source values for anything not tied to the host itself
(API keys, SMTP credentials, etc.).

**Shortcut:** if you'll be doing this more than once, appending the target
host's public key to the source host's `~/.ssh/authorized_keys` lets the
whole step run from the target instead of hopping through a third machine.

## Step 2 — DNS

Point `$DOMAIN` at the target host. Prefer a **CNAME to a dynamic-DNS name**
(e.g. a DuckDNS hostname) over a literal A record if the target's IP isn't
static — this is how `dave.phone.16jets.com` is set up. A CNAME only works
for a subdomain, not the zone apex.

Drop the TTL on `$DOMAIN` ahead of the cutover if you want a fast rollback
path. Verify propagation with `dig +short $DOMAIN`.

## Step 3 — Certificate

Only after Step 2 has propagated — HTTP-01 challenges need the domain
already pointing at the target.

If the target's nginx config for this install expects TLS paths that don't
exist yet, issue the cert with a temporary cert-free config first:

```bash
cd /path/to/Receptionist
cp installs/$INSTALL/nginx.conf installs/$INSTALL/nginx.conf.tls   # save the real config
cp installs/$INSTALL/nginx.conf.pre-cert installs/$INSTALL/nginx.conf  # swap in a plain-HTTP one

sudo rm -f /etc/nginx/sites-enabled/$INSTALL   # remove any stale hand-placed file — see Step 4
sudo node manage.js deploy-nginx
sudo certbot certonly --nginx -d $DOMAIN

cp installs/$INSTALL/nginx.conf.tls installs/$INSTALL/nginx.conf   # swap the real config back
sudo node manage.js deploy-nginx
```

`certonly` is deliberate — it issues the cert without letting certbot
rewrite the nginx config, so the repo copy stays authoritative.

## Step 4 — nginx

`node manage.js deploy-nginx` picks up every install that has an
`nginx.conf` and symlinks it into `sites-enabled`. It **skips symlink
creation if a file already exists at that path** — so a stale hand-placed
config (e.g. left over from before this repo managed nginx) will silently
shadow the generated one. Delete any such file before running it (see Step
3).

Confirm afterwards:

```bash
ls -l /etc/nginx/sites-enabled/
sudo nginx -t
```

## Step 5 — Start and persist

```bash
node manage.js start $INSTALL
node manage.js status                # $INSTALL → online on $PORT
npx pm2 save                         # survive a reboot
curl -s -o /dev/null -w "%{http_code}\n" https://$DOMAIN/
```

## Step 6 — External integrations

If the hostname didn't change, webhook URLs pointing at it (Twilio, etc.)
stay valid automatically — the DNS cutover alone redirects traffic. Still
verify in each provider's console that the webhook targets `$DOMAIN`, and
exercise the integration for real (e.g. place a live test call) while
watching `npx pm2 logs receptionist-$INSTALL`.

If a non-production sibling install shares credentials with this one (same
API keys, same phone number), anything it initiates still bills/sends for
real even though it won't receive inbound traffic. Consider swapping
shared, one-directional credentials for a dedicated test set.

## Step 7 — Web / widget routing (if applicable)

If a web widget or frontend embeds this install's URL directly rather than
going through the domain, confirm:

- `ALLOWED_ORIGIN` in `installs/$INSTALL/.env` includes every origin that
  embeds the widget.
- Load the page and open the widget — a CORS or WebSocket failure in the
  browser console usually means the origin list or nginx's `Upgrade`
  headers need a look.

## Step 8 — Decommission the source

Leave the source host powered off but not destroyed for a week or two as a
rollback option.

```bash
ssh $SOURCE_HOST "pm2 delete receptionist-\$INSTALL && pm2 save"
```

Snapshot before destroying anything. Cancel any hosting billing only once
you're confident.

## Rollback

Point `$DOMAIN` back at `$SOURCE_HOST` and restart its PM2 process. This
only works cleanly if the source host was left running and its cert is
still valid — that's the reason Step 8 waits.
