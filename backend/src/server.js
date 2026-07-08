require("dotenv").config();
const express = require("express");
const cors = require("cors");

const tokenBucketLimiter = require("./middleware/tokenBucketLimiter");
const slidingWindowLimiter = require("./middleware/slidingWindowLimiter");
const apiKeyAuth = require("./middleware/apiKeyAuth");
const testRoutes = require("./routes/testRoutes");
const statusRoutes = require("./routes/statusRoutes");

if (!process.env.API_KEY) {
  console.error("FATAL: API_KEY environment variable is required");
  process.exit(1);
}

function algorithmSelector(req, res, next) {
  if (req.query.algo === "sliding") {
    return slidingWindowLimiter(req, res, next);
  }
  return tokenBucketLimiter(req, res, next);
}

const app = express();
app.set("trust proxy", true);
app.use(
  cors({
    exposedHeaders: ["X-RateLimit-Remaining", "X-RateLimit-Capacity", "Retry-After"],
  })
);
app.use(express.json());

app.get("/health", (req, res) => res.json({ status: "ok" }));

app.use("/api", apiKeyAuth);
app.use("/api", statusRoutes);
app.use("/api", algorithmSelector, testRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Rate limiter server running on port ${PORT}`);
});
