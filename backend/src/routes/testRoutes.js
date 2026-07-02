const express = require("express");
const router = express.Router();
const redis = require("../utils/redisClient");
const { WINDOW_SIZE, MAX_REQUESTS, getIdentifier } = require("../middleware/slidingWindowLimiter");

const TOKEN_CAPACITY = 10;
const TOKEN_REFILL_RATE = 1;

router.get("/ping", (req, res) => {
  res.json({ message: "pong", timestamp: Date.now() });
});

router.get("/status/token", async (req, res) => {
  try {
    const identifier = req.user?.id || req.ip;
    const key = `ratelimit:${identifier}`;
    const bucket = await redis.get(key);

    if (!bucket) {
      return res.json({ tokens: TOKEN_CAPACITY, capacity: TOKEN_CAPACITY });
    }

    const now = Date.now();
    const elapsedSeconds = (now - bucket.lastRefill) / 1000;
    const currentTokens = Math.min(TOKEN_CAPACITY, bucket.tokens + elapsedSeconds * TOKEN_REFILL_RATE);

    res.json({ tokens: Math.max(0, currentTokens), capacity: TOKEN_CAPACITY });
  } catch (err) {
    res.json({ tokens: TOKEN_CAPACITY, capacity: TOKEN_CAPACITY });
  }
});

router.get("/status/sliding", async (req, res) => {
  try {
    const key = getIdentifier(req);
    const now = Date.now();

    await redis.zremrangebyscore(key, 0, now - WINDOW_SIZE);
    const count = await redis.zcard(key);

    res.json({ requests: count, limit: MAX_REQUESTS, windowMs: WINDOW_SIZE });
  } catch (err) {
    res.json({ requests: 0, limit: MAX_REQUESTS, windowMs: WINDOW_SIZE });
  }
});

module.exports = router;