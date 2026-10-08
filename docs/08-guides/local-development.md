# Local Development

You can develop in **GitHub Codespaces** (what we use now) or on **your own computer**. The commands are the same.

## Option A: GitHub Codespaces (browser only)

### What it is
A **Codespace** is a Linux virtual machine in GitHub's cloud with VS Code in your browser. "Local" here means *your own development environment*, even though it runs in the cloud.

### Start
1. GitHub → your repo → **Code → Codespaces →** open your existing codespace (don't create a new one each time).
2. Terminal (**Ctrl+`**):
```bash
cd /workspaces/realtime-chat
git checkout main && git pull
npm ci          # exact versions from package-lock.json
npm run dev     # starts the server with auto-restart
```
3. Popup → **Open in Browser** (or **Ports** tab → globe icon on port 3000).

### Test with several "users"
- Open the forwarded URL in 2–3 tabs, or one normal + one private window.
- **On your phone:** Ports tab → right-click port 3000 → **Port Visibility → Public** (temporary!) → open the URL on your phone. Set it back to **Private** afterwards.
  - The forwarded URL is **HTTPS**, so WebCrypto (E2EE) works.

### Stop (saves your free hours)
github.com/codespaces → ⋯ → **Stop codespace**. Codespaces have a monthly free usage allowance; idle ones also stop automatically after a timeout.

## Option B: Your own computer

### 1. Install
| Tool | How | Check |
|---|---|---|
| **Node.js 22** | nodejs.org (LTS installer), or a version manager (`nvm` on macOS/Linux, `nvm-windows` or `fnm` on Windows) | `node -v` → v22.x |
| **Git** | git-scm.com | `git --version` |
| **VS Code** (optional) | code.visualstudio.com | — |

### 2. Get the code and run
```bash
git clone https://github.com/futuresfsake/realtime-chat.git
cd realtime-chat
npm ci
npm run dev
```
Open **http://localhost:3000** in 2+ tabs.

### 3. Push changes
The first push from a new computer asks you to sign in to GitHub (browser popup, or a personal access token).

## Everyday commands
| Command | What it does |
|---|---|
| `npm run dev` | Dev server with auto-restart |
| `npm run typecheck` | TypeScript checks only |
| `npm test` / `npm run test:watch` | Run tests once / on every save |
| `npm run build && npm start` | Run exactly like production |
| `PORT=3001 npm run dev` | Use another port (on Windows PowerShell: `$env:PORT=3001; npm run dev`) |

## Environment variables locally
Defaults in `config.ts` work for local dev. To override, create a `.env` file (git-ignored) and run with Node's built-in loader:
```bash
node --env-file=.env dist/index.js
```
Never commit `.env`.

## Common problems
| Problem | Cause | Fix |
|---|---|---|
| `EADDRINUSE :::3000` | An old server is still running | Ctrl+C it, `kill $(lsof -t -i :3000)`, or use another port |
| `ERR_MODULE_NOT_FOUND` | Missing `.js` in a relative import | `import { x } from "./file.js"` (NodeNext) |
| `crypto.subtle is undefined` | Page opened over plain HTTP on a LAN IP | Use `localhost`, the Codespaces HTTPS URL, or the Render URL |
| Socket refused locally | Origin not in `ALLOWED_ORIGINS` | Add your local URL, or rely on the dev default |
| `npm ci` fails | `package-lock.json` out of sync | `npm install`, commit the updated lockfile |
| Changes not showing | Browser cache | Hard refresh: Ctrl+Shift+R |
| Wrong folder errors | Running commands from a subfolder | `cd` to the repo root first; check your prompt |

## Codespaces vs. your own computer
| | Codespaces | Own computer |
|---|---|---|
| Setup | None | Install Node + Git once |
| Works from | Any browser | That computer |
| Cost | Free monthly allowance | Free |
| Phone testing | Easy (HTTPS forwarded URL) | Needs HTTPS (deploy or a tunnel) |
| Offline | ❌ | ✅ |
