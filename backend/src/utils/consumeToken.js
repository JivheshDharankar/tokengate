const redis = require("./redisClient");
const { CAPACITY, REFILL_RATE, KEY_TTL } = require("../config/rateLimit");

const TOKEN_BUCKET_SCRIPT = `
local key = KEYS[1]
local capacity = tonumber(ARGV[1])
local refill_rate = tonumber(ARGV[2])
local now = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

local raw = redis.call("GET", key)
local tokens
local last_refill

if not raw then
  tokens = capacity
  last_refill = now
else
  local bucket = cjson.decode(raw)
  tokens = tonumber(bucket.tokens)
  last_refill = tonumber(bucket.lastRefill)
  local elapsed = (now - last_refill) / 1000
  tokens = math.min(capacity, tokens + elapsed * refill_rate)
end

if tokens < 1 then
  local updated = cjson.encode({ tokens = tokens, lastRefill = now })
  redis.call("SET", key, updated, "EX", ttl)
  local retry_after = math.ceil((1 - tokens) / refill_rate)
  return { 0, tokens, retry_after }
end

tokens = tokens - 1
local updated = cjson.encode({ tokens = tokens, lastRefill = now })
redis.call("SET", key, updated, "EX", ttl)
return { 1, tokens, 0 }
`;

async function consumeToken(key) {
  const now = Date.now();
  const [allowed, tokens, retryAfter] = await redis.eval(
    TOKEN_BUCKET_SCRIPT,
    [key],
    [CAPACITY, REFILL_RATE, now, KEY_TTL]
  );

  return {
    allowed: allowed === 1,
    tokens: Number(tokens),
    retryAfter: Number(retryAfter),
  };
}

module.exports = consumeToken;
