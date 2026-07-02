const { CAPACITY } = require("../config/rateLimit");
const consumeToken = require("../utils/consumeToken");

async function tokenBucketLimiter(req, res, next) {
  try {
    const identifier = req.user?.id || req.ip;
    const key = `ratelimit:${identifier}`;

    const { allowed, tokens, retryAfter } = await consumeToken(key);

    if (!allowed) {
      res.set("Retry-After", retryAfter.toString());
      res.set("X-RateLimit-Remaining", "0");
      res.set("X-RateLimit-Capacity", CAPACITY.toString());
      return res.status(429).json({
        error: "Too Many Requests",
        message: `Rate limit exceeded. Try again in ${retryAfter}s.`,
        tokensRemaining: 0,
      });
    }

    res.set("X-RateLimit-Remaining", Math.floor(tokens).toString());
    res.set("X-RateLimit-Capacity", CAPACITY.toString());
    next();
  } catch (err) {
    console.error("Rate limiter error:", err);
    next();
  }
}

module.exports = tokenBucketLimiter;
