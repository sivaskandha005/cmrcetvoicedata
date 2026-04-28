// ============================================================
//  VoiceBank — server.js (Modified for Vercel)
// ============================================================

const http = require("http");
const fs   = require("fs");
const path = require("path");

// Vercel assigns a dynamic port via process.env.PORT
const PORT = process.env.PORT || 3000;

// On Vercel, you can only write to the /tmp directory
const RECORDINGS_DIR = path.join("/tmp", "recordings");
const PROMPTS_FILE   = path.join("/tmp", "prompts.json");
const ADMIN_PASSWORD = "admin123";

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".ico":  "image/x-icon",
};

// Ensure directories exist in /tmp
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });
if (!fs.existsSync(PROMPTS_FILE)) {
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify([], null, 2), "utf8");
}

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

function serveFile(res, filePath) {
  const ext  = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] || "application/octet-stream";
  fs.readFile(filePath, (err, data) => {
    if (err) { 
      res.writeHead(404); 
      res.end("Not found"); 
      return; 
    }
    res.writeHead(200, { "Content-Type": mime + "; charset=utf-8" });
    res.end(data);
  });
}

function json(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data, null, 2));
}

function checkAdmin(req, res) {
  if (req.headers["x-admin-password"] !== ADMIN_PASSWORD) {
    json(res, 401, { ok: false, error: "Wrong password" }); return false;
  }
  return true;
}

function getPathname(req) {
  return new URL(req.url, `http://${req.headers.host}`).pathname;
}

function rollToFolder(roll) {
  return roll.trim().replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
}

function getAllStudents() {
  if (!fs.existsSync(RECORDINGS_DIR)) return [];
  return fs.readdirSync(RECORDINGS_DIR)
    .filter(f => fs.statSync(path.join(RECORDINGS_DIR, f)).isDirectory())
    .map(folder => {
      const dir   = path.join(RECORDINGS_DIR, folder);
      const files = fs.readdirSync(dir);
      let info    = {};
      try { info = JSON.parse(fs.readFileSync(path.join(dir, "student_info.json"), "utf8")); } catch(_) {}
      const audioFiles = files.filter(f => f !== "student_info.json");
      return {
        folder,
        roll:        info.roll        || folder,
        name:        info.name        || "Unknown",
        department:  info.department  || "",
        year:        info.year        || "",
        semester:    info.semester    || "",
        tags:        info.tags        || [],
        recordings:  audioFiles.length,
        lastSession: info.lastSession || info.timestamp || "",
        files:       audioFiles,
      };
    });
}

const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const pathname = getPathname(req);

  // Serve static assets from the current directory
  if (req.method === "GET" && (pathname === "/" || pathname === "/index.html")) {
    serveFile(res, path.join(__dirname, "index.html"));
    return;
  }
  if (req.method === "GET" && (pathname === "/admin" || pathname === "/admin.html")) {
    serveFile(res, path.join(__dirname, "admin.html"));
    return;
  }

  // API Route: GET /student/:roll
  if (req.method === "GET" && pathname.startsWith("/student/")) {
    const roll   = decodeURIComponent(pathname.split("/").pop());
    const folder = rollToFolder(roll);
    const dir    = path.join(RECORDINGS_DIR, folder);
    const meta   = path.join(dir, "student_info.json");
    if (!fs.existsSync(meta)) {
      json(res, 404, { ok: false, error: "Student not found" }); return;
    }
    try {
      const info = JSON.parse(fs.readFileSync(meta, "utf8"));
      const audioCount = fs.readdirSync(dir).filter(f => f !== "student_info.json").length;
      json(res, 200, {
        ok:         true,
        name:       info.name       || "",
        roll:       info.roll       || roll,
        department: info.department || "",
        year:       info.year       || "",
        semester:   info.semester   || "",
        tags:       info.tags       || [],
        recordings: audioCount,
      });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  // API Route: GET /summary
  if (req.method === "GET" && pathname === "/summary") {
    if (!checkAdmin(req, res)) return;
    try {
      const students = getAllStudents();
      students.sort((a, b) => b.recordings - a.recordings);
      json(res, 200, students);
    } catch(e) { json(res, 500, { error: e.message }); }
    return;
  }

  // API Route: POST /save-recording
  if (req.method === "POST" && pathname === "/save-recording") {
    try {
      const { studentInfo, audio, ext } = JSON.parse((await readBody(req)).toString());
      if (!audio) { json(res, 400, { ok: false, error: "No audio" }); return; }
      const folder     = rollToFolder(studentInfo.roll);
      const studentDir = path.join(RECORDINGS_DIR, folder);
      if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

      const existing  = fs.readdirSync(studentDir).filter(f => f !== "student_info.json");
      const recNumber = existing.length + 1;
      const fileName  = "recording_" + String(recNumber).padStart(3, "0") + "." + (ext || "webm");

      fs.writeFileSync(path.join(studentDir, fileName), Buffer.from(audio, "base64"));

      const updatedInfo = {
        ...studentInfo,
        lastSession: new Date().toISOString(),
        totalRecordings: recNumber,
      };
      
      const metaPath = path.join(studentDir, "student_info.json");
      if (fs.existsSync(metaPath)) {
        try {
          const old = JSON.parse(fs.readFileSync(metaPath, "utf8"));
          updatedInfo.firstSeen = old.firstSeen || old.timestamp || new Date().toISOString();
        } catch(_) {}
      } else {
        updatedInfo.firstSeen = new Date().toISOString();
      }
      fs.writeFileSync(metaPath, JSON.stringify(updatedInfo, null, 2));

      json(res, 200, { ok: true, file: fileName, totalRecordings: recNumber });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  res.writeHead(404); 
  res.end("Not found");
});

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

module.exports = server;