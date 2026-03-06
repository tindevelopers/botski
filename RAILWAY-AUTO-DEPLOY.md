# Railway auto-deploy from GitHub

This project is in **GitHub**: `https://github.com/tindevelopers/botski`. To have Railway deploy automatically on every push to `main`:

## 1. Connect the repo to Railway

1. Open **[Railway Dashboard](https://railway.app)** and sign in.
2. Open your **project** (or create one: **New Project**).
3. If the app is not yet linked to GitHub:
   - Click **"+ New"** → **"GitHub Repo"** (or **"Deploy from GitHub repo"**).
   - Authorize Railway to access GitHub if prompted.
   - Select **`tindevelopers/botski`**.
   - Choose branch **`main`** (or the branch you want to deploy).
4. If you already have a service that was deployed with the CLI (`railway up`):
   - Select that **service**.
   - Go to **Settings** (or the service’s **Settings** tab).
   - Under **Source**, click **Connect Repo** / **Change Source** and select **`tindevelopers/botski`**, branch **`main`**.

## 2. Configure build and deploy

- **Root directory**: Leave as repo root (or set to `recall` if your Railway app expects it; `railway.toml` in the repo root points to `recall/Dockerfile`).
- **Build**: Railway should use `railway.toml` (Dockerfile at `recall/Dockerfile`).
- **Branch**: Set to **`main`** so pushes to `main` trigger a deploy.

## 3. Environment variables

Ensure the service has the same variables as before (e.g. from **Variables** in the dashboard):

- `SECRET`, `RECALL_API_KEY`, `RECALL_API_HOST`, `PUBLIC_URL`
- `DATABASE_URL`, `REDIS_URL` (if you use Railway Postgres/Redis, they can be linked and set automatically)
- Any OAuth or other keys your app needs

## 4. Result

- Every **push to `main`** (e.g. `git push origin main`) will trigger a new build and deploy.
- You can also trigger a deploy manually from the Railway dashboard (e.g. **Redeploy**).

## Optional: deploy only a specific branch

In the service **Settings** → **Source**, set the **Production Branch** (or equivalent) to the branch you want to deploy (e.g. `main`). Only that branch will auto-deploy.
