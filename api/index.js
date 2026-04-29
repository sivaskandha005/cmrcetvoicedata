const http = require("http");
const fs   = require("fs");
const path = require("path");

// Vercel handles the port and static files. 
// We only need the API logic here.
const RECORDINGS_DIR = path.join("/tmp", "recordings");
const PROMPTS_FILE   = path.join("/tmp", "prompts.json");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Helper functions (keep these)
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", c => chunks.push(c));
    req.on("end",  () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

function setCORS(res) {
  res.setHeader("Access-Control-Allow-Origin",  "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

// Ensure /tmp directories exist (Vercel recreates /tmp on every execution)
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // API Route: GET /api/student/:roll
  if (req.method === "GET" && pathname.startsWith("/api/student/")) {
    // ... existing logic to find student ...
  }

  // API Route: GET /api/summary
  if (req.method === "GET" && pathname === "/api/summary") {
    // ... existing logic to return all students ...
  }

  // API Route: POST /api/save-recording
  if (req.method === "POST" && pathname === "/api/save-recording") {
    // ... existing logic to save audio to /tmp ...
  }

  // If no API route matches, let Vercel handle it or return 404
  res.writeHead(404);
  res.end("API route not found");
});

module.exports = server;