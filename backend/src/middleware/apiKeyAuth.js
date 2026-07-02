function apiKeyAuth(req, res, next) {
  const apiKey = req.headers["x-api-key"];

  if (!apiKey || apiKey !== process.env.API_KEY) {
    return res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or missing API key. Pass it as x-api-key header.",
    });
  }

  next();
}

module.exports = apiKeyAuth;
