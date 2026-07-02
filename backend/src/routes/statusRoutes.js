const express = require("express");
const router = express.Router();
const redis = require("../utils/redisClient");
const { computeCurrentTokens } = require("../utils/bucketState");
const {
  WINDOW_SIZE,
  MAX_REQUESTS,
  getIdentifier,
} = require("../middleware/slidingWindowLimiter");

router.get("/status/token", async (req, res) => {
  try {
    const identifier = req.user?.id || req.ip;
    const key = `ratelimit:${identifier}`;
    const bucket = await redis.get(key);
    const { tokens, capacity } = computeCurrentTokens(bucket);

    res.json({ tokens: Math.floor(tokens), capacity });
  } catch (err) {
    console.error("Token status error:", err);
    const { tokens, capacity } = computeCurrentTokens(null);
    res.json({ tokens: Math.floor(tokens), capacity });
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
    console.error("Sliding status error:", err);
    res.json({ requests: 0, limit: MAX_REQUESTS, windowMs: WINDOW_SIZE });
  }
});

module.exports = router;
