# Deploy so your **whole team** uses one dashboard

The team must all open **the same URL**. History (live feed + removals) must live in **one database** everyone reads—this app uses **PostgreSQL** when `DATABASE_URL` is set (Render+Neon, or the Postgres container in Docker Compose below).

---

## Option A — Managed host (no Docker on your side)

Good if you do not want to run a server yourself.

1. Create Postgres on [Neon](https://neon.tech) and copy the connection string.
2. Create a web service on [Render](https://render.com) from this repo, root directory `citi-active-merchants-dashboard`, env `DATABASE_URL` + optional `RUN_API_KEY`.
3. Share the `https://….onrender.com` URL Render gives you.

Details were already in the earlier steps in your repo; the flow is unchanged.

---

## Option B — **Docker for the whole team** (recommended when you want containers)

Docker Compose is **not** “for your laptop only.” Run it on an **always-on** machine your team can reach:

- A small **cloud VM** (AWS EC2, GCP Compute Engine, Azure VM, DigitalOcean Droplet, etc.), or  
- An **on-prem** or **office** Linux host that stays up and is allowed on your network.

### What you do once (ops / you)

1. Install Docker on that server (not only on your Mac).
2. Copy this folder to the server (or clone the repo there).
3. In `citi-active-merchants-dashboard`, copy `.env.example` to `.env` and set at least:
   - `POSTGRES_PASSWORD` — use a strong secret (everyone’s data is behind this DB).
   - Optional: `RUN_API_KEY` — so only people with the key can click **Run sync now**.
   - Optional: `DASHBOARD_PORT` — host port (default `3950`) if something else uses that port.
4. Start in the background:

   ```bash
   docker compose up -d --build
   ```

   Run these commands **from** the `citi-active-merchants-dashboard` folder so the build context is that directory. The Dockerfile copies `package.json`, `package-lock.json`, `server.js`, `lib/`, and `public/` into the image, runs `npm ci`, then starts Node as a non-root user.

5. **Firewall / security group:** allow inbound TCP on `DASHBOARD_PORT` (default **3950**) from your office IP, VPN, or the internet (if you are OK with HTTP).
6. **Give the team a URL:**
   - `http://<SERVER_PUBLIC_OR_PRIVATE_IP>:3950`  
   - Or put **HTTPS** in front (company reverse proxy, nginx, Caddy, Traefik, ALB) and share `https://citi-dashboard.yourcompany.com`.

Postgres data lives in the Docker volume **`citi_pg_data`**, so history survives container restarts. Use `docker compose down` without `-v` to keep data; use `-v` only when you intentionally wipe the database.

### Why this is “whole team,” not “local only”

| Where Compose runs | Who can use it |
|----------------------|----------------|
| Your laptop | Basically only you while it is on |
| A **shared server** + DNS or IP + firewall | **Everyone** with network access to that URL |

Same Docker files; the difference is **which machine** runs `docker compose up`.

### HTTPS (typical for teams)

Browser apps on plain HTTP are often blocked or warned. Put TLS in front of port **3950** using whatever your company already uses (load balancer, nginx, Caddy). The app behind the proxy stays on HTTP inside the Docker network.

---

## Option C — Docker image + external Postgres

Build the `Dockerfile` and run the container anywhere, setting `DATABASE_URL` to a managed Postgres (Neon, RDS, etc.) so multiple app replicas could share one DB if you scale later.

---

## Health check

`GET /api/health` returns `{ "ok": true, "store": "postgres" | "file" }`.
