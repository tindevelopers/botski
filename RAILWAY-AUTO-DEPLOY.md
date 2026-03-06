# Railway auto-deploy from GitHub

Repo: **https://github.com/tindevelopers/botski**

Use this checklist to connect the repo and fix "not deploying" issues.

---

## 1. Connect GitHub to Railway

1. Go to **[railway.app](https://railway.app)** → your **project**.
2. **If you don’t have a service from this repo yet:**
   - Click **"+ New"** → **"GitHub Repo"**.
   - Authorize Railway for GitHub if asked.
   - Choose **`tindevelopers/botski`** and branch **`main`**.
3. **If you already have a service** (e.g. from CLI):
   - Click the **service** (main app).
   - Open **Settings**.
   - Under **Source** / **Repository**, click **Connect Repo** or **Change Source**.
   - Select **`tindevelopers/botski`** and branch **`main`**.
   - Save.

---

## 2. Root Directory (critical)

The repo has two valid setups. Use **one** of these:

| Option | Root Directory (in Railway) | What gets used |
|--------|-----------------------------|----------------|
| **A**  | *(leave empty / blank)*     | Root `railway.toml` + `recall/Dockerfile` |
| **B**  | `recall`                    | `recall/railway.toml` + `recall/Dockerfile.railway` |

- **Settings** → **Source** or **Build** → **Root Directory**.
- Either leave it **empty** (Option A) or set it to **`recall`** (Option B). Do not use any other path.

---

## 3. Branch and auto-deploy

- **Settings** → **Source** → **Branch**: set to **`main`** (or the branch you push to).
- Ensure **Deploy on push** / **Auto-deploy** is **on** for that branch (usually on by default when connected to GitHub).

---

## 4. Build and start

- With Option A (root): Railway uses root **`railway.toml`** → Dockerfile path **`recall/Dockerfile`**, start **`npm start`** (from Dockerfile CMD).
- With Option B (root = `recall`): Railway uses **`recall/railway.toml`** → **`Dockerfile.railway`**, same start.
- You do **not** need to set a custom start command unless you override the Dockerfile CMD (e.g. for a worker service).

---

## 5. Environment variables

In the service **Variables** tab, ensure at least:

- `SECRET`
- `RECALL_API_KEY`
- `RECALL_API_HOST` (e.g. `https://api.recall.ai`)
- `PUBLIC_URL` (e.g. `https://your-app.up.railway.app` — set after first deploy / adding a domain)
- `DATABASE_URL` (from Railway Postgres if you use it)
- `REDIS_URL` (from Railway Redis if you use it)

---

## 6. Trigger a deploy

- **Push to `main`:** `git push origin main` → Railway should start a new build.
- **Manual:** In the service, open **Deployments** → **Deploy** / **Redeploy** (or **Trigger Deploy**).

---

## 7. If it still doesn’t deploy

- **No new build on push:** Confirm in **Settings** → **Source** that the repo is **`tindevelopers/botski`**, branch **`main`**, and Root Directory is either empty or `recall`. Then push again and check **Deployments** for a new build.
- **Build fails:** Open the failed deployment → **View build logs**. Typical causes:
  - Wrong Root Directory (e.g. `recall/` with a typo, or root when only `recall` is valid).
  - Dockerfile path wrong for chosen root (use Option A or B above).
- **Deploy fails / app won’t start:** Check **Deploy logs** and **Variables** (e.g. `DATABASE_URL`, `SECRET`, `PUBLIC_URL`).

---

## 8. Health check

After a successful deploy, the app exposes **`/health`**. In **Settings** → **Deploy** you can set **Healthcheck Path** to **`/health`** (this is also set in `railway.toml`).
