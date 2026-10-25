# Product Requirements Document (PRD)

**Project Name:** CodeEzz — Next-Gen AI-Integrated Competitive Programming Platform  
**Document Version:** 1.0.0-PROD  
**Status:** Approved for Implementation Roadmap  
**Target Delivery:** Full-Stack Web Application (Phase 1: Architecture & Hardening, Phase 2: UI/UX Modernization, Phase 3: Cloud Deployment, Phase 4: Monetization)  
**Author:** Senior Software Architect & Lead Systems Engineer  

---

## 1. Executive Summary & Product Vision

### 1.1 Executive Summary
CodeEzz is a full-stack, distributed technical interview preparation and competitive programming platform. It pairs the classic interactive coding challenge interface (similar to LeetCode, Codeforces, and HackerRank) with two modern differentiator modules:
1. **Context-Aware AI Tutor (Google Gemini 1.5 Flash):** An intelligent, Socratic-method AI mentor that helps developers think through algorithmic edge cases, debug runtime errors, and analyze complexity without spoiling optimal solutions.
2. **Direct-to-Cloud Video Editorial Engine (Cloudinary):** High-throughput, cloud-signed video solutions allowing creators and admins to deliver video tutorials directly to candidates without routing heavy video binaries through the core application backend.

### 1.2 Core Vision
To provide candidates and students worldwide with a distraction-free, responsive, and pedagogy-first platform where algorithmic practice is supported by real-time compiler sandboxes, intelligent automated doubt resolution, and curated video explanations.

---

## 2. Target Personas & User Journeys

### 2.1 Persona Archetypes

| Persona | Role & Background | Pain Points | Desired Value |
|:---|:---|:---|:---|
| **Alex (The Interview Candidate)** | Mid-level engineer interviewing for Tier-1 / FAANG companies. | Context switching to external forums when stuck; slow compiler feedback loops; ambiguous test case errors. | Fast code execution (<2.5s turnaround), sample vs hidden test case feedback, clean submission telemetry (runtime & memory percentiles). |
| **Priya (The DSA Learner)** | Computer science undergraduate studying graphs and dynamic programming. | Complete solutions spoil learning; lacks personal guidance on edge cases; struggles to interpret compiler stack traces. | Socratic hints from the AI tutor, line-by-line code explanation, and video walkthroughs of complex algorithms. |
| **Jordan (Platform Admin / Educator)** | Course instructor / competitive programming creator. | Uploading video solutions strains servers; manual problem verification is error-prone. | Automated reference solution verification gate via Judge0, direct-to-cloud signed video uploads, and unified problem management. |

---

## 3. Comprehensive Functional Requirements (FR)

### 3.1 Authentication, Identity & Access Management (RBAC)
- **FR-AUTH-01 (Secure User Registration):** Users register via `firstName`, `lastName`, `emailId`, `password`, and optional `age`. Minimum password entropy is enforced (8+ characters, lowercase, uppercase, digits, symbols). Passwords are hashed using `bcrypt` (work factor 10).
- **FR-AUTH-02 (Stateless JWT Session Delivery):** Upon login, an HTTP-only, secure, `SameSite` protected cookie containing a signed JWT is issued with a 1-hour expiration.
- **FR-AUTH-03 (Immediate Token Revocation via Redis):** On user logout, the token is not simply cleared in the browser; the backend extracts the JWT's expiration timestamp (`exp`) and records the token key in Redis Cloud with an exact time-to-live (`EXPIREAT`). Any subsequent request presenting this token is rejected.
- **FR-AUTH-04 (Role-Based Access Control):** Supports `user` and `admin` roles. Admin endpoints (`/admin/*`, `/problem/create`, `/video/*`) are guarded by `adminMiddleware`.
- **FR-AUTH-05 (Cascading Account Deletion):** Deleting a user profile triggers an atomic cleanup of all associated user submissions.

### 3.2 Algorithmic Problem Management Engine
- **FR-PROB-01 (Problem Structure):** Problems require `title`, `description`, `difficulty` (`easy`, `medium`, `hard`), `tags` (`array`, `linkedList`, `graph`, `dp`), `visibleTestCases` (with input, output, explanation), and `hiddenTestCases` (input, output).
- **FR-PROB-02 (Multi-Language Starter Templates):** Every problem must provide boilerplate code for:
  - C++ (Language ID 54)
  - Java (Language ID 62)
  - JavaScript (Language ID 63)
- **FR-PROB-03 (Admin Verification Gate):** During problem creation or update, the admin must provide full reference solutions in all three languages. The backend executes these against the visible test cases using Judge0 batch execution. The problem is rejected if any reference solution fails (`status_id !== 3`).
- **FR-PROB-04 (Catalog & Filtering):** The public catalog supports combined filtering by:
  - Difficulty (`easy`, `medium`, `hard`)
  - Tag (`array`, `linkedList`, `graph`, `dp`)
  - Solved Status (`all`, `solved`)

### 3.3 Remote Sandboxed Execution Engine (Judge0 CE)
- **FR-EXEC-01 ("Run Code" Sandbox Mode):** Evaluates user code against visible test cases. Fast turnaround without recording a database submission. Returns stdout, execution time, peak memory, and per-testcase pass/fail badges.
- **FR-EXEC-02 ("Submit Code" Evaluation Mode):** Evaluates user code against all hidden test cases.
- **FR-EXEC-03 (Persistent Submission Audit):** Every submit action creates a `Submission` document with status `pending`, executes asynchronously against Judge0, updates with final metrics (`runtime`, `memory`, `testCasesPassed`, `errorMessage`), and updates the user's `problemSolved` array upon acceptance.
- **FR-EXEC-04 (Historical Submissions Viewer):** Users can inspect their past submissions per problem, including language, execution time, memory, timestamp, and the exact historical source code in a syntax-highlighted modal.

### 3.4 Grounded AI Doubt Solver (Google Gemini GenAI)
- **FR-AI-01 (Problem-Grounded System Prompting):** Injects problem context (`title`, `description`, `visibleTestCases`, `startCode`) directly into Gemini 1.5 Flash system instructions.
- **FR-AI-02 (Strict DSA Guardrails):** The AI tutor is bounded strictly to the active algorithmic challenge. Off-topic queries (web development, sysadmin, general chatter) are rejected with a helpful redirect.
- **FR-AI-03 (Socratic Hint Progression):** When asked for hints, the AI guides the user with conceptual questions and intuition without outputting copy-paste solutions.
- **FR-AI-04 (Code Review & Optimization):** Identifies edge-case vulnerabilities (e.g., integer overflows, recursion stack depth) and calculates asymptotic Big-O time and space complexity.

### 3.5 Cloud Video Editorial Pipeline (Cloudinary)
- **FR-VID-01 (Direct-to-Cloud Upload Architecture):** To avoid memory pressure on the Node.js server, video binaries bypass Express. The backend creates an HMAC-SHA1 signature (`/video/create/:problemId`), allowing the client to POST directly to Cloudinary's upload API.
- **FR-VID-02 (Metadata Synchronization):** Once Cloudinary completes transcoding, the frontend registers the video metadata (`cloudinaryPublicId`, `secureUrl`, `duration`) with the backend (`/video/save`).
- **FR-VID-03 (Custom Editorial Video Player):** Frontend editorial tab renders an integrated video player with play/pause triggers, timeline scrub controls, and thumbnail posters.

---

## 4. Non-Functional Requirements (NFR)

| Metric | Target Standard | Architectural Mechanism |
|:---|:---|:---|
| **System Availability** | 99.9% uptime | Stateless Express application tier ready for multi-container orchestration. |
| **Run Code Latency** | $\le$ 3.0 seconds (p95) | Batch execution on Judge0 with optimized polling delays. |
| **AI Generation Speed** | $\le$ 2.0 seconds first token | Gemini 1.5 Flash low-latency API integration. |
| **Security & Privacy** | OWASP Top 10 Compliant | HTTP-only cookies, Bcrypt 10 hashing, CORS origin lock, Zod input sanitization. |
| **Token Invalidation** | $\le$ 5ms lookup | In-memory Redis Cloud key verification on every protected route. |
| **Storage Scalability** | Zero video disk usage | 100% video storage and streaming offloaded to Cloudinary CDN. |
| **Database Performance** | Indexed lookups < 10ms | Compound index `{ userId: 1, problemId: 1 }` on submissions. |

---

## 5. Monetization & Commercial Strategy (Future Roadmap)

### 5.1 Subscription Tiers

```
+----------------------------+----------------------------+----------------------------+
| FEATURE                    | FREE COMMUNITY TIER        | CODEEZZ PRO ($12 / Month)  |
+----------------------------+----------------------------+----------------------------+
| Core Problem Bank          | 150+ Standard Problems     | Complete 1,000+ Questions  |
| Top-Company Problem Tags   | Basic                      | Google, Meta, Amazon, etc. |
| Code Execution Quota       | 50 Submissions / Day       | Unlimited High-Priority    |
| AI Doubt Resolution        | 5 Queries / Day            | Unlimited AI Co-Pilot      |
| Video Editorial Access     | First 2 Minutes Preview    | Full HD Video Walkthroughs |
| Solution Code Reveal       | After Successful Solve     | Instant Editorial Access   |
+----------------------------+----------------------------+----------------------------+
```

### 5.2 Payment Gateway Integration Architecture
- **Provider Support:** Stripe (Global) & Razorpay (India & APAC).
- **Payment Flow:**
  1. Frontend triggers `POST /billing/create-checkout-session`.
  2. Backend signs order and returns hosted checkout URL.
  3. User completes checkout on secure provider modal.
  4. Webhook handler (`POST /billing/webhook`) validates cryptographic signature and activates `isPremium: true` on the user record.
  5. Redis cache is invalidated for instantaneous feature unlocking.

---

## 6. Release & Milestones Roadmap

- **Phase 1 (Stabilization & Hardening):** Fix Judge0 polling loop, strip reference solution leaks, add rate limiting, verify cross-browser compatibility.
- **Phase 2 (UI/UX Transformation):** Dark obsidian glassmorphism design, resizable Monaco split panes, animated test case badges, responsive mobile layout.
- **Phase 3 (Containerization & Deployment):** Dockerize backend & frontend, configure Nginx reverse proxy, deploy on cloud infrastructure (Render / AWS / DigitalOcean), setup continuous delivery via GitHub Actions.
- **Phase 4 (Monetization & Scale):** Stripe/Razorpay checkout integration, pro membership entitlements, token consumption telemetry, automated contest leaderboards.
