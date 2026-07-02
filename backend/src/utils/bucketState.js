const { CAPACITY, REFILL_RATE } = require("../config/rateLimit");

function computeCurrentTokens(bucket, now = Date.now()) {
  if (!bucket) {
    return { tokens: CAPACITY, capacity: CAPACITY };
  }

  const elapsedSeconds = (now - bucket.lastRefill) / 1000;
  const tokens = Math.min(CAPACITY, bucket.tokens + elapsedSeconds * REFILL_RATE);

  return { tokens, capacity: CAPACITY };
}

module.exports = { computeCurrentTokens };
