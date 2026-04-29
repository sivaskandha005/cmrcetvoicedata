const http = require("http");
const fs = require("fs");
const path = require("path");

const RECORDINGS_DIR = path.join("/tmp", "recordings");

// Helper to ensure directories exist in the temporary cloud storage
function ensureDir(dirPath) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

const server = http.createServer(async (req, res) => {
  // Set CORS headers so your frontend can talk to this API
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  // Route for saving voice data
  if (req.method === "POST" && pathname === "/save-recording") {
    let body = "";
    req.on("data", chunk => body += chunk);
    req.on("end", () => {
      try {
        const { studentInfo, audio, ext } = JSON.parse(body);
        const studentFolder = path.join(RECORDINGS_DIR, studentInfo.roll.replace(/\s+/g, '_'));
        
        ensureDir(studentFolder);

        const fileName = `voice_${Date.now()}.${ext || 'webm'}`;
        fs.writeFileSync(path.join(studentFolder, fileName), Buffer.from(audio, "base64"));
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify({ ok: true, message: "Successfully saved to temporary storage." }));
      } catch (err) {
        res.writeHead(500);
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  // Route for Admin summary
  if (req.method === "GET" && pathname === "/summary") {
    ensureDir(RECORDINGS_DIR);
    const folders = fs.readdirSync(RECORDINGS_DIR);
    res.writeHead(200, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ studentCount: folders.length, folders }));
    return;
  }

  res.writeHead(404);
  res.end("Not Found");
});

// CRITICAL: Export the server for Vercel's environment
module.exports = server;