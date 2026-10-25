const express = require('express');
const app = express();
require('dotenv').config();
const main = require('./config/db');
const cookieParser = require('cookie-parser');
const authRouter = require('./routes/userAuth');
const redisClient = require('./config/redis');
const problemRouter = require('./routes/problemCreator');
const submitRouter = require('./routes/submit');
const aiRouter = require('./routes/aiChatting');
const videoRouter = require('./routes/videoCreator');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// ─── CORS ────────────────────────────────────────────────────────────────────
// CORS origin is read from env so the same codebase works in dev AND production
// without code changes. In dev: http://localhost:5173  In prod: your Vercel URL
app.use(cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true
}));

// ─── Body Parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // Limit JSON body size — prevents large payload attacks
app.use(cookieParser());

// ─── Rate Limiting ────────────────────────────────────────────────────────────
// WHY: Without rate limiting, a single attacker can flood the Judge0 API (paid),
// brute-force passwords, or exhaust MongoDB connections.
// Auth routes: 10 attempts per 15 minutes (brute-force protection)
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { error: 'Too many attempts from this IP. Please try again after 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

// General API: 100 requests per 15 minutes per IP
const generalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    message: { error: 'Too many requests from this IP.' },
    standardHeaders: true,
    legacyHeaders: false
});

// Code submission: 20 per 15 min (Judge0 has rate limits on free tier)
const submissionLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Submission rate limit exceeded. Try again in 15 minutes.' },
    standardHeaders: true,
    legacyHeaders: false
});

app.use('/user/login', authLimiter);
app.use('/user/signup', authLimiter);
app.use('/submission', submissionLimiter);
app.use(generalLimiter); // Applied after specific limiters

// ─── Health Check ─────────────────────────────────────────────────────────────
// WHY: Docker and cloud platforms (Render, Railway, ECS) use this endpoint to
// verify the container is alive before routing traffic to it.
app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'healthy',
        service: 'codeezz-backend',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// ─── Application Routes ───────────────────────────────────────────────────────
app.use('/user', authRouter);
app.use('/problem', problemRouter);
app.use('/submission', submitRouter);
app.use('/ai', aiRouter);
app.use('/video', videoRouter);

// ─── 404 Handler ──────────────────────────────────────────────────────────────
app.use((req, res) => {
    res.status(404).json({ error: `Route ${req.method} ${req.path} not found` });
});

// ─── Global Error Handler ─────────────────────────────────────────────────────
// WHY: Without this, unhandled errors crash the Node.js process in production
// and leak stack traces to clients (a security risk). This catches any error
// thrown or passed to next(err) from any route handler.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
    console.error(`[ERROR] ${req.method} ${req.path}:`, err);
    res.status(err.status || 500).json({
        error: process.env.NODE_ENV === 'production'
            ? 'Internal Server Error'
            : err.message
    });
});

// ─── Server Bootstrap ─────────────────────────────────────────────────────────
const InitializeConnection = async () => {
    try {
        await Promise.all([main(), redisClient.connect()]);
        console.log('✅ MongoDB + Redis connected');

        app.listen(process.env.PORT, () => {
            console.log(`🚀 Server running on port ${process.env.PORT} [${process.env.NODE_ENV || 'development'}]`);
        });
    } catch (err) {
        console.error('❌ Failed to start server:', err);
        process.exit(1); // Exit cleanly so Docker/process managers can restart
    }
};

InitializeConnection();
