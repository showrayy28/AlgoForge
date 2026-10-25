# System Architecture & Technical Workflow Documentation

**Project Name:** CodeEzz (LeetCode-Style Platform with Gemini AI & Cloudinary Video Solutions)  
**Document Classification:** Technical Architecture & System Workflow Specification  
**Version:** 1.0.0-PROD  
**Target Environment:** Production Full-Stack Distributed Deployment  

---

## 1. High-Level Architecture Overview

CodeEzz is architected as an asynchronous, distributed full-stack application. It delegates resource-intensive and specialized tasks (untrusted code execution, generative AI inference, high-bandwidth media transcoding) to external managed services while preserving a lightweight, secure orchestration layer.

```mermaid
graph TB
    subgraph Client Tier [Frontend Client - React 19 + Vite]
        UI[DaisyUI / Tailwind 4 Views]
        Monaco[Monaco Code Editor]
        Player[Editorial Video Player]
        Redux[Redux Toolkit State Store]
        Axios[Axios HTTP Client]
    end

    subgraph Gateway Tier [Reverse Proxy & Web Server]
        Nginx[Nginx / Cloud Ingress]
    end

    subgraph Application Tier [Express.js Core Backend]
        Router[Express Routing Pipeline]
        AuthMW[User & Admin JWT Middleware]
        UserCtrl[Authentication Controller]
        ProbCtrl[Problem Management Controller]
        SubCtrl[Submission & Judge Controller]
        AICtrl[Gemini AI Tutor Controller]
        VidCtrl[Cloudinary Video Controller]
    end

    subgraph Persistence & Caching Tier [Storage Layer]
        Mongo[(MongoDB Atlas Database)]
        Redis[(Redis Cloud - Token Revocation)]
    end

    subgraph External Infrastructure [Cloud Backbones]
        Judge0[Judge0 CE Sandbox Engine]
        Gemini[Google Gemini 1.5 Flash API]
        Cloudinary[Cloudinary Media CDN]
    end

    UI --> Redux
    Monaco --> Axios
    Player --> Cloudinary
    Redux --> Axios
    Axios -->|HTTP + Cookies| Nginx
    Nginx --> Router

    Router --> AuthMW
    AuthMW -->|Verify Blacklist| Redis
    AuthMW -->|Fetch User Record| Mongo

    AuthMW --> UserCtrl
    AuthMW --> ProbCtrl
    AuthMW --> SubCtrl
    AuthMW --> AICtrl
    AuthMW --> VidCtrl

    UserCtrl -->|CRUD Users| Mongo
    UserCtrl -->|Revoke Tokens| Redis

    ProbCtrl -->|CRUD Problems| Mongo
    ProbCtrl -->|Verify Reference Soln| Judge0

    SubCtrl -->|Record Submission| Mongo
    SubCtrl -->|Batch Run Code| Judge0

    AICtrl -->|Problem Grounded Prompt| Gemini

    VidCtrl -->|Generate HMAC Signature| Cloudinary
    VidCtrl -->|Save Media Metadata| Mongo
    Axios -.->|Direct Video Upload| Cloudinary
```

---

## 2. Data Models & Entity Relationship Specification

### 2.1 Entity Relationship Diagram

```mermaid
erDiagram
    USER ||--o{ SUBMISSION : "submits"
    USER ||--o{ PROBLEM : "creates (admin)"
    USER ||--o{ SOLUTION_VIDEO : "uploads"
    PROBLEM ||--o{ SUBMISSION : "tested against"
    PROBLEM ||--o| SOLUTION_VIDEO : "has editorial"

    USER {
        ObjectId _id PK
        string firstName
        string lastName
        string emailId UK
        string password "Bcrypt Hash (10 rounds)"
        number age
        string role "user | admin"
        ObjectId[] problemSolved FK
        date createdAt
        date updatedAt
    }

    PROBLEM {
        ObjectId _id PK
        string title
        string description
        string difficulty "easy | medium | hard"
        string tags "array | linkedList | graph | dp"
        TestCase[] visibleTestCases "input, output, explanation"
        TestCase[] hiddenTestCases "input, output"
        CodeSnippet[] startCode "language, initialCode"
        SolutionSnippet[] referenceSolution "language, completeCode"
        ObjectId problemCreator FK
        date createdAt
    }

    SUBMISSION {
        ObjectId _id PK
        ObjectId userId FK
        ObjectId problemId FK
        string code
        string language "c++ | java | javascript"
        string status "pending | accepted | wrong | error"
        number runtime "milliseconds"
        number memory "kilobytes"
        string errorMessage
        number testCasesPassed
        number testCasesTotal
        date createdAt
    }

    SOLUTION_VIDEO {
        ObjectId _id PK
        ObjectId problemId FK
        ObjectId userId FK
        string cloudinaryPublicId UK
        string secureUrl
        string thumbnailUrl
        number duration "seconds"
        date createdAt
    }
```

### 2.2 Redis In-Memory Key Schema
- **Key Format:** `token:<raw_jwt_string>`
- **Value:** `"Blocked"`
- **TTL Strategy:** Synchronized to the JWT `exp` timestamp via `redisClient.expireAt(key, payload.exp)`.
- **Space Efficiency:** Keys automatically expire from memory once the token naturally expires, preventing memory leaks in Redis.

---

## 3. Module-by-Module Technical Deep Dive

### 3.1 Identity, Session & RBAC Module
- **Password Hashing:** `bcrypt` with 10 salt rounds.
- **Session Delivery:** HTTP-only cookie (`token`) containing a signed JSON Web Token (`JWT_KEY`) with a 1-hour expiration.
- **Middleware Guards:**
  - `userMiddleware`: Decodes token, validates user existence in MongoDB, checks against Redis blocklist.
  - `adminMiddleware`: Extends `userMiddleware` by verifying `payload.role === 'admin'`.
- **Logout & Invalidation:** Token payload `exp` is read and saved to Redis. Subsequent requests with the same cookie are blocked with HTTP 401.

### 3.2 Problem Catalog & Creator Module
- **Automated Validation Gate:** On problem creation (`POST /problem/create`) and update (`PUT /problem/update/:id`), the backend submits all reference solutions (C++, Java, JavaScript) to Judge0 batch endpoints against the visible test cases. If any test case yields `status_id !== 3`, the request is rejected with HTTP 400.
- **Query Optimizations:** Catalog retrieval (`GET /problem/getAllProblem`) uses selective projections (`.select('_id title difficulty tags')`) to keep payloads light.
- **User Solved Association:** Solved status is populated via `user.problemSolved` array reference lookups.

### 3.3 Sandboxed Code Execution Pipeline
- **Engine:** RapidAPI Judge0 Community Edition (CE).
- **Supported Languages & IDs:**
  - C++ (GCC 9.2.0) $\rightarrow$ Language ID: `54`
  - Java (OpenJDK 13.0.1) $\rightarrow$ Language ID: `62`
  - JavaScript (Node.js 12.14.0) $\rightarrow$ Language ID: `63`
- **Execution Modes:**
  1. **Run Code:** Evaluates user code against `visibleTestCases`. No persistent database write. Returns execution breakdown per sample case.
  2. **Submit Code:** Creates a persistent `Submission` record with status `pending`. Dispatches batch payload to Judge0 against `hiddenTestCases`. Polls execution tokens until completion (`status_id > 2`). Aggregates total execution time and peak memory. If all test cases pass, updates `user.problemSolved`.

### 3.4 AI Doubt Solver Engine (Google Gemini)
- **Model:** `gemini-1.5-flash` via `@google/genai` SDK.
- **Grounded Prompt Construction:** Injects the active problem's title, description, visible test cases, and starter code into system instructions.
- **Pedagogical Guardrails:**
  - Enforces Socratic dialogue (asks guiding questions instead of giving answers).
  - Strictly rejects non-DSA questions (web development, sysadmin, general knowledge).
  - Reviews student code submissions for logic errors and explains Big-O complexities.

### 3.5 Cloud Video Editorial Pipeline (Cloudinary)
- **Zero-Server-Load Pattern:**
  1. Admin frontend requests signed upload credentials from Express (`GET /video/create/:problemId`).
  2. Express signs timestamp, public ID, and API key using `CLOUDINARY_API_SECRET` (HMAC-SHA1).
  3. Frontend uploads binary directly to Cloudinary's REST API with live upload progress tracking.
  4. Frontend informs Express of successful upload (`POST /video/save`).
  5. Express verifies the resource on Cloudinary, auto-generates video thumbnail URLs, and stores metadata in MongoDB.

### 3.6 Frontend Architecture & State Management
- **Framework:** React 19 + Vite.
- **Styling & Components:** Tailwind CSS 4 + DaisyUI 5.
- **Editor:** `@monaco-editor/react` (VS Code core) configured for dynamic language switching, dark theme (`vs-dark`), syntax highlighting, and auto-formatting.
- **State Store (Redux Toolkit):** `authSlice` manages global user authentication, session bootstrap (`checkAuth`), and login/logout state.
- **Form Handling:** `react-hook-form` paired with `@hookform/resolvers/zod` for type-safe client-side validation.

---

## 4. End-to-End Real-World System Workflows

### 4.1 Authentication & Token Revocation Workflow

```mermaid
sequenceDiagram
    autonumber
    actor Client as User / Browser
    participant API as Express Auth Router
    participant DB as MongoDB Atlas
    participant Cache as Redis Cloud

    Note over Client,Cache: 1. Registration / Login Flow
    Client->>API: POST /user/login { emailId, password }
    API->>DB: User.findOne({ emailId })
    DB-->>API: User Document (Bcrypt Hash)
    API->>API: bcrypt.compare(password, user.password)
    API->>API: jwt.sign({ _id, emailId, role }, JWT_KEY, expiresIn: 1h)
    API-->>Client: Set-Cookie: token=JWT; HttpOnly; MaxAge=3600
    
    Note over Client,Cache: 2. Authenticated Request
    Client->>API: GET /problem/getAllProblem (Cookie attached)
    API->>API: jwt.verify(token, JWT_KEY)
    API->>Cache: EXISTS token:{token}
    Cache-->>API: 0 (Token Valid)
    API->>DB: User.findById(_id)
    API-->>Client: 200 OK (Problem List)

    Note over Client,Cache: 3. Logout Flow (Immediate Token Revocation)
    Client->>API: POST /user/logout
    API->>API: jwt.decode(token) -> extracts exp
    API->>Cache: SET token:{token} 'Blocked'
    API->>Cache: EXPIREAT token:{token} exp
    API-->>Client: Clear-Cookie: token; 200 "Logged Out Successfully"
    
    Note over Client,Cache: 4. Rejected Re-use of Blocked Token
    Client->>API: GET /problem/getAllProblem (Using old token)
    API->>Cache: EXISTS token:{token}
    Cache-->>API: 1 (Blocked!)
    API-->>Client: 401 Unauthorized ("Invalid Token")
```

---

### 4.2 Problem Creation & Reference Solution Verification Gate

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Admin Content Creator
    participant UI as Frontend AdminPanel
    participant API as Problem Creator Controller
    participant Judge as Judge0 Remote Sandbox
    participant DB as MongoDB Atlas

    Admin->>UI: Inputs Problem Info + 3 Reference Solutions (C++, Java, JS)
    UI->>UI: Zod Validation (ensures complete schema & test cases)
    UI->>API: POST /problem/create (Payload)
    
    loop For each Reference Solution (C++, Java, JS)
        API->>API: Map language string to Judge0 ID (54, 62, 63)
        API->>API: Create batch submissions array from visible test cases
        API->>Judge: POST /submissions/batch { submissions }
        Judge-->>API: 201 Created [ { token: "uuid-1" }, { token: "uuid-2" } ]
        
        loop Poll until status_id > 2
            API->>Judge: GET /submissions/batch?tokens=uuid-1,uuid-2
            Judge-->>API: 200 OK { submissions: [ { status_id: 3, stdout: "..." } ] }
        end
        
        alt Any testcase status_id != 3 (Accepted)
            API-->>UI: 400 Bad Request ("Error Occurred in Reference Solution")
        end
    end

    API->>DB: Problem.create({ ...data, problemCreator: adminId })
    DB-->>API: Stored Problem Document
    API-->>UI: 201 Created ("Problem Saved Successfully")
```

---

### 4.3 Code Execution Pipeline: "Run" vs "Submit"

```mermaid
sequenceDiagram
    autonumber
    actor C as Developer
    participant UI as Monaco Workspace
    participant API as Submission Controller
    participant DB as MongoDB Atlas
    participant J as Judge0 Sandbox

    alt Mode A: User clicks "RUN CODE" (Fast Feedback)
        C->>UI: Clicks "Run Code"
        UI->>API: POST /submission/run/:problemId { code, language }
        API->>DB: Problem.findById(problemId) (Reads visibleTestCases)
        API->>J: POST /submissions/batch (source_code, visibleTestCases)
        J-->>API: [ { token } ]
        API->>J: Poll tokens until execution complete
        J-->>API: Execution Results (time, memory, stdout, stderr, status_id)
        API-->>UI: 201 JSON { success, testCases, runtime, memory }
        UI->>C: Displays Console Output (Pass/Fail Cards)
    else Mode B: User clicks "SUBMIT CODE" (Persistent Evaluation)
        C->>UI: Clicks "Submit Code"
        UI->>API: POST /submission/submit/:problemId { code, language }
        API->>DB: Problem.findById(problemId) (Reads hiddenTestCases)
        API->>DB: Submission.create({ userId, problemId, code, status: 'pending' })
        DB-->>API: savedSubmission (_id)
        
        API->>J: POST /submissions/batch (source_code, hiddenTestCases)
        J-->>API: [ { token } ]
        API->>J: Poll tokens until execution complete
        J-->>API: Batch Evaluation Results
        
        API->>API: Calculate aggregate runtime, peak memory, and status
        API->>DB: Submission.findByIdAndUpdate(savedSubmission._id, { status, runtime, memory, ... })
        
        opt If status == 'accepted'
            API->>DB: User.updateOne({ _id: userId }, { $addToSet: { problemSolved: problemId } })
        end
        
        API-->>UI: 201 JSON { accepted, passedTestCases, totalTestCases, runtime, memory }
        UI->>C: Displays Result Modal (Accepted / Wrong Answer)
    end
```

---

### 4.4 AI Context-Aware Doubt Resolution Workflow

```mermaid
sequenceDiagram
    autonumber
    actor User as Student / Candidate
    participant UI as ChatAi Component
    participant API as AI Express Controller
    participant Gemini as Google Gemini 1.5 Flash

    User->>UI: Submits Query: "How can I optimize this from O(N^2) to O(N)?"
    UI->>UI: Optimistic render: Append User message
    UI->>API: POST /ai/chat { messages, title, description, testCases, startCode }
    
    API->>API: Assemble Grounded System Instruction with Problem Context
    Note over API: Injects: Title, Description, Constraints,<br/>Socratic Hint Guidelines, and Anti-Spoil Directives.
    
    API->>Gemini: ai.models.generateContent({ model: 'gemini-1.5-flash', contents, systemInstruction })
    Gemini-->>API: Generated Socratic Response
    API-->>UI: 201 JSON { message: "Consider using a two-pointer approach or hash map..." }
    UI->>User: Formats and displays Markdown in chat thread
```

---

### 4.5 Cloudinary Direct Video Editorial Upload Pipeline

```mermaid
sequenceDiagram
    autonumber
    actor Admin as Content Creator
    participant UI as AdminUpload Component
    participant API as Video Section Controller
    participant Cloud as Cloudinary CDN
    participant DB as MongoDB Atlas

    Admin->>UI: Selects video file (MP4 / WebM)
    UI->>API: GET /video/create/:problemId (Request Upload Signature)
    API->>API: Verify problem existence & Admin credentials
    API->>API: Generate timestamp & unique public_id
    API->>API: Compute HMAC-SHA1 signature with CLOUDINARY_API_SECRET
    API-->>UI: 200 JSON { signature, timestamp, public_id, api_key, cloud_name, upload_url }
    
    Note over UI,Cloud: Direct Binary Upload (Zero Server Load)
    UI->>Cloud: POST upload_url (FormData: file, signature, timestamp, public_id, api_key)
    Cloud-->>UI: 200 OK { public_id, secure_url, duration, format }
    
    UI->>API: POST /video/save { problemId, cloudinaryPublicId, secureUrl, duration }
    API->>Cloud: Verify asset exists (cloudinary.api.resource)
    API->>API: Auto-generate video thumbnail URL
    API->>DB: SolutionVideo.create({ problemId, userId, cloudinaryPublicId, secureUrl, thumbnailUrl, duration })
    DB-->>API: Created Record
    API-->>UI: 201 Created ("Video solution saved successfully")
```

---

## 5. Architectural Findings & Code Audit

During our architectural inspection of `14Dev/backend` and `14Dev/frontend`, four technical findings were identified for immediate remediation during Phase 1 hardening:

### Finding 1: Broken Sleep Mechanism in Judge0 Poller (`problemUtility.js`) — [RESOLVED in Phase 1]
- **Location:** `backend/src/utils/problemUtility.js`
- **Resolution:** Replaced the non-blocking `setTimeout` with a standard Promise-based delay utility:
  ```javascript
  const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
  // In polling loop:
  await delay(1000);
  ```
- **Result:** Code execution requests now wait 1000ms between polls, eliminating CPU spinlocks and preventing 429 Too Many Requests errors.

### Finding 2: Direct Network Exposure of Complete Reference Solutions — [RESOLVED in Phase 1]
- **Location:** `backend/src/controllers/userProblem.js`
- **Resolution:** Stripped `referenceSolution` from the public `getProblemById` query projection:
  ```javascript
  const getProblem = await Problem.findById(id).select('_id title description difficulty tags visibleTestCases startCode');
  ```
- **Result:** Reference solutions are no longer visible via client-side network inspectors. Full solutions will be unlocked only after verification or via Pro subscription authorization.

### Finding 3: Unconditional Problem Solved Marker on Submissions — [RESOLVED in Phase 1]
- **Location:** `backend/src/controllers/userSubmission.js`
- **Resolution:** Added condition to only append `problemId` to `user.problemSolved` when `status === 'accepted'` and added detailed error status codes (TLE, Compilation Error, Runtime Error).

### Finding 4: Lack of Queueing for Code Submissions — [Scheduled for Phase 3]
- **Location:** `backend/src/controllers/userSubmission.js`
- **Architectural Risk:** Every submission directly spawns asynchronous batch calls to Judge0. Under concurrent traffic, this easily hits 429 Too Many Requests errors.
- **Remediation Specification:** Integrate BullMQ with Redis to buffer submissions during traffic spikes and process executions deterministically.

---

## 6. Cloud Production Deployment Architecture

```mermaid
graph LR
    subgraph Users [Global Traffic]
        DNS[Cloudflare DNS / DDoS / SSL]
    end

    subgraph CDN & Static Delivery [Frontend Hosting]
        Vercel[Vercel / Cloudflare Pages<br/>React 19 SPA]
    end

    subgraph Compute Cluster [Backend Hosting - AWS ECS / Render]
        ALB[Load Balancer]
        AppPod1[Express Backend Pod 1]
        AppPod2[Express Backend Pod 2]
    end

    subgraph Managed Cloud Databases [Data Tier]
        Mongo[(MongoDB Atlas)]
        RedisCloud[(Redis Cloud)]
    end

    subgraph SaaS Backbones [3rd-Party APIs]
        J0[Judge0 Sandbox]
        Cloudi[Cloudinary CDN]
        GemAI[Google Gemini 1.5 Flash]
    end

    DNS --> Vercel
    DNS --> ALB
    ALB --> AppPod1
    ALB --> AppPod2
    AppPod1 --> Mongo
    AppPod2 --> Mongo
    AppPod1 --> RedisCloud
    AppPod2 --> RedisCloud
    AppPod1 --> J0
    AppPod1 --> Cloudi
    AppPod1 --> GemAI
```

### 6.1 Docker Containerization Strategy
- **Backend `Dockerfile`:** Multi-stage build based on `node:20-alpine`. Employs production node flags, runs under an unprivileged `node` user, and includes a native health check calling `/health`.
- **Frontend `Dockerfile` / Static Export:** Built with `npm run build` producing optimized Vite chunks, served via Nginx with HTTP/2 and Brotli compression.

---

## 7. Monetization Integration Architecture (Stripe / Razorpay)

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant WebApp as React Client
    participant API as Express Billing Controller
    participant Gateway as Stripe / Razorpay
    participant Webhook as Webhook Handler
    participant DB as MongoDB Atlas

    User->>WebApp: Selects "Upgrade to Pro" ($12/mo)
    WebApp->>API: POST /billing/checkout-session
    API->>Gateway: Create Session (Customer, Price, Metadata: userId)
    Gateway-->>API: Session { id, checkout_url }
    API-->>WebApp: { checkout_url }
    WebApp->>User: Redirects to secure checkout

    User->>Gateway: Enters Payment & Approves
    Gateway-->>User: Redirects to /payment/success
    
    Note over Gateway,Webhook: Asynchronous Webhook Guarantee
    Gateway->>Webhook: POST /billing/webhook (checkout.session.completed)
    Webhook->>Webhook: Verify Cryptographic Signature
    Webhook->>DB: User.findByIdAndUpdate(userId, { isPremium: true, tier: 'pro' })
    Webhook-->>Gateway: 200 OK (Event Handled)
    
    User->>WebApp: Profile refreshed -> Pro features immediately unlocked
```
