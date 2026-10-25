# ⚡ CodeEzz — Distributed Competitive Programming & AI-Tutored Coding Platform

[![Node.js](https://img.shields.io/badge/Node.js-20.x-green.svg)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.x-blue.svg)](https://react.dev/)
[![Express](https://img.shields.io/badge/Express-5.x-lightgrey.svg)](https://expressjs.com/)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-brightgreen.svg)](https://www.mongodb.com/atlas)
[![Redis](https://img.shields.io/badge/Redis-Cloud-red.svg)](https://redis.io/)
[![Google Gemini](https://img.shields.io/badge/AI-Gemini%201.5%20Flash-orange.svg)](https://aistudio.google.com/)
[![License](https://img.shields.io/badge/License-MIT-purple.svg)](LICENSE)

> A full-stack, distributed technical interview preparation and algorithmic practice platform featuring real-time sandboxed code execution, context-grounded AI tutoring (Google Gemini), direct-to-cloud video editorials (Cloudinary), and immediate session token revocation via Redis.

---

## 📌 Architectural Highlights & Production Design

- **Stateless Authentication with Immediate Token Revocation:** Uses HTTP-Only secure cookies containing signed JWTs coupled with an in-memory Redis token blacklist with synchronized TTLs on logout.
- **Isolated Sandboxed Execution:** Untrusted user code is safely executed via remote containerized environments (Judge0 CE), eliminating arbitrary code execution threats on the host server.
- **Reference Solution Verification Gate:** Admin problem authoring automatically executes reference solutions in C++, Java, and JavaScript across all visible test cases before database persistence.
- **Zero-Server-Load Media Streaming:** Direct-to-cloud signed video uploads via Cloudinary with HMAC-SHA1 signatures, completely bypassing backend memory overhead for multi-megabyte video solutions.
- **Context-Grounded Socratic AI Tutor:** Google Gemini 1.5 Flash integrated with strict DSA guardrails and active problem context to provide conceptual hints without spoiling direct answers.
- **Hardened API Gateway:** Multi-tier IP-based rate limiting (auth, submission, general API), global error handling with sanitized production output, and CORS origin isolation.

---

## 🏗️ System Architecture

```
[ Client: React 19 + Vite + Tailwind + Monaco Editor ]
                           │
                 (HTTP-Only Cookie + JSON)
                           ▼
          [ Express.js 5 Core API Gateway ]
          ├── Auth & Rate Limiter Middleware
          ├── Redis In-Memory Token Blacklist (O(1))
          └── Role-Based Access Control (RBAC)
          ┌────────────────┬────────────────┐
          ▼                ▼                ▼
   [ MongoDB Atlas ]   [ Judge0 Sandbox ]   [ Gemini 1.5 Flash ]
   (Users, Problems,   (C++, Java, JS       (Socratic DSA
    Submissions)        Code Execution)      Doubt Solver)
                           ▲
          [ Cloudinary Video Pipeline ]
          (Direct-to-Cloud Signed Uploads)
```

---

## 📂 Repository Structure

```
.
├── backend/                  # Express.js REST API
│   ├── src/
│   │   ├── config/           # MongoDB and Redis Cloud client setups
│   │   ├── controllers/      # Auth, Problems, Submissions, AI, Video
│   │   ├── middleware/       # JWT Auth, Admin RBAC, Rate Limiters
│   │   ├── models/           # Mongoose schemas (User, Problem, Submission, Video)
│   │   ├── routes/           # REST endpoints
│   │   └── utils/            # Judge0 batch poller, validators
│   ├── .env.example          # Environment variable template
│   └── package.json
├── frontend/                 # React 19 + Vite SPA
│   ├── src/
│   │   ├── components/       # Monaco Workspace, ChatAi, Video Player, Admin
│   │   ├── pages/            # Homepage, ProblemPage, Login, Signup, Admin
│   │   ├── store/            # Redux Toolkit store & authSlice
│   │   └── index.css         # Tailwind & modern styling
│   └── package.json
└── docs/                     # Architectural Documentation
    ├── PRD.md                # Comprehensive Product Requirements Document
    └── SYSTEM_WORKFLOW_ARCHITECTURE.md # Workflows, Sequence Diagrams, ERD
```

---

## 🚀 Getting Started

### 1. Prerequisites
- Node.js >= 20.x
- Git
- MongoDB Atlas cluster
- Redis Cloud instance
- RapidAPI Judge0 key
- Google Gemini API key
- Cloudinary account

### 2. Backend Setup
```bash
cd backend
npm install
cp .env.example .env
# Fill in your own database URIs and API credentials in .env
npm run dev
```

### 3. Frontend Setup
```bash
cd ../frontend
npm install
npm run dev
```

Access the frontend at `http://localhost:5173` and backend API at `http://localhost:3000`.

---

## 🔒 Security Posture
- ❌ **No Secrets in Source:** Secrets are stored exclusively in environment variables and managed via platform secret managers in deployment.
- 🛡️ **OWASP Top 10 Mitigations:** Strict input sanitization with Zod & Mongoose, HTTP-Only Cookie session transport against XSS, and Bcrypt (10 rounds) password hashing.
- ⏱️ **Rate Limiting:** Protects authentication endpoints from credential stuffing and submission routes from sandbox flooding.

---

## 📖 Detailed Documentation
- [Product Requirements Document (PRD)](./docs/PRD.md)
- [System Architecture & Sequence Workflows](./docs/SYSTEM_WORKFLOW_ARCHITECTURE.md)
