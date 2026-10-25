# 🧠 CodeEzz — Project Changelog & System Memory

**Last Updated:** Phase 1 Stabilization & GitHub Setup  
**Lead Engineer:** Senior Full-Stack Architect  
**Project Status:** Git Initialized (Local `main`) | Backend Hardened | Awaiting Remote GitHub Link & Environment Credentials  

---

## 📌 Memory Bank: Architectural Decisions & Why We Made Them

| Module / Decision | Implementation | Architectural Defense (Interview Talking Points) |
|:---|:---|:---|
| **Stateless Auth + Token Blacklist** | `userMiddleware.js`, `redis.js` | JWTs cannot be invalidated by standard means before expiry. We store the token hash in Redis Cloud with `EXPIREAT` set to the token's `exp` timestamp. Lookup is $O(1)$ and memory cleans up automatically. |
| **Sandboxed Code Execution** | RapidAPI Judge0 CE (`problemUtility.js`) | Executing arbitrary user C++, Java, or JS code on the local Node.js process is a catastrophic security vulnerability (RCE, fork bombs, resource exhaustion). We delegate execution to isolated sandboxes. |
| **Direct-to-Cloud Video Pipeline** | Cloudinary HMAC-SHA1 (`videoSection.js`) | Video binaries never touch the Express server memory or filesystem. Express generates an HMAC-signed upload token; the client uploads directly to Cloudinary. Zero server bandwidth/RAM cost. |
| **Promise-Based Delay Mechanism** | `problemUtility.js:50-54` | A native `setTimeout` inside an async function without a Promise resolution returns immediately, leading to a spinlock that fires hundreds of requests a second. A wrapped `Promise((resolve) => setTimeout(resolve, ms))` actually yields control back to the event loop. |
| **Public API Data Sanitization** | `userProblem.js:171` | Problem reference solutions are explicitly excluded from `getProblemById` queries. Solutions are only revealed after solving or via Pro subscription access guards. |
| **Conditional Problem Solved Logic** | `userSubmission.js:93-100` | Submissions now require `status === 'accepted'` before adding `problemId` to `user.problemSolved`. |
| **Defense-in-Depth Secret Isolation** | Root `.gitignore` & `backend/.gitignore` | `.env` and `**/.env*` are strictly ignored. `backend/.env.example` is tracked to document required variable keys safely for public repositories and CI/CD. |
| **Production Server Protection** | `index.js` | `express-rate-limit` prevents credential brute force (10/15min) and API abuse (20/15min on execution). Global error handler catches unhandled exceptions and masks stack traces in production. `/health` route enables Docker/Cloud liveness checks. |

---

## 📋 Changelog of Recent Modifications

### [Phase 1: Backend Hardening & Bug Fixes]
- **`backend/src/utils/problemUtility.js`**:
  - Replaced broken `waiting()` with real Promise-based `delay(ms)`.
  - Added 1-second delay between Judge0 batch status polls.
- **`backend/src/controllers/userProblem.js`**:
  - Removed `referenceSolution` from the public `getProblemById` select projection to prevent cheat exploits via DevTools.
- **`backend/src/controllers/userSubmission.js`**:
  - Fixed bug where `user.problemSolved` was appended on every submission attempt regardless of verdict.
  - Added detailed error classification (Wrong Answer, TLE, Compilation Error, Runtime Error).
- **`backend/src/index.js`**:
  - Configured dynamic CORS using `process.env.CORS_ORIGIN || 'http://localhost:5173'`.
  - Added JSON payload limit (`10kb`).
  - Added IP rate limiters for Auth, Submission, and General routes.
  - Added `/health` liveness probe.
  - Added global error handling middleware masking internal stack traces in production.
  - Configured clean `process.exit(1)` on bootstrap failure for container restart compatibility.
- **`backend/package.json`**:
  - Added `express-rate-limit` and `nodemon` (dev).
  - Renamed service to `codeezz-backend` and configured `npm run dev` and `npm start`.
- **`backend/.env.example` & Root `README.md`**:
  - Created standardized configuration template and project documentation.

### [Phase 1.5: Git Repository & Workflow]
- Initialized Git on default branch `main`.
- Created robust multi-layer `.gitignore` safeguarding all credentials.
- Verified zero secret leakage into Git staging (`git diff --cached`).
- Created initial commit `feat: initial commit with hardened backend, architecture docs, and secure env template`.

---

## 🔄 Current Pending Blockers & Next Actions

1. **GitHub Remote Link**: User creates repository on GitHub (`https://github.com/new`) and runs:
   ```bash
   git remote add origin <REMOTE_URL>
   git push -u origin main
   ```
2. **Environment Variable Configuration**: User populates `backend/.env` with personal free-tier keys for MongoDB Atlas, Redis Cloud, Judge0, Gemini, and Cloudinary as outlined in `ENV_SETUP_GUIDE.md`.
3. **Phase 2 UI/UX Modernization**: Implement dark obsidian glassmorphism, 3D interactive hero, Monaco split-pane layout, animated test badges, and mobile responsiveness.
