const redis = require("../utils/redisClient");

const WINDOW_SIZE = 10000;
const MAX_REQUESTS = 10;

function getIdentifier(req) {
  return `sliding:${req.headers["x-api-key"] || req.ip}`;
}

async function slidingWindowLimiter(req, res, next) {
  try {
    const key = getIdentifier(req);
    const now = Date.now();

    await redis.zremrangebyscore(key, 0, now - WINDOW_SIZE);
    const count = await redis.zcard(key);

    if (count >= MAX_REQUESTS) {
      res.set("X-RateLimit-Remaining", "0");
      res.set("X-RateLimit-Capacity", MAX_REQUESTS.toString());
      return res.status(429).json({
        error: "Too Many Requests",
        message: "Sliding window limit reached.",
        requestsInWindow: count,
        limit: MAX_REQUESTS,
      });
    }

    await redis.zadd(key, { score: now, member: `${now}-${Math.random()}` });
    await redis.expire(key, 20);

    res.set("X-RateLimit-Remaining", (MAX_REQUESTS - count - 1).toString());
    res.set("X-RateLimit-Capacity", MAX_REQUESTS.toString());
    next();
  } catch (err) {
    console.error("Sliding window limiter error:", err);
    next();
  }
}

module.exports = slidingWindowLimiter;
module.exports.WINDOW_SIZE = WINDOW_SIZE;
module.exports.MAX_REQUESTS = MAX_REQUESTS;
module.exports.getIdentifier = getIdentifier;
