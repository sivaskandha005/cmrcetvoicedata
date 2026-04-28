// ============================================================
//  VoiceBank — server.js  (v12)
//  NEW:
//  - GET /student/:roll      → lookup student by roll number
//  - GET /summary            → roll-wise recording count (admin)
//  - POST /save-recording    → now uses roll as folder key,
//                              always updates student_info.json
//                              and increments recording count
// ============================================================

const http = require("http");
const fs   = require("fs");
const path = require("path");

const PORT           = 3000;
const RECORDINGS_DIR = path.join(__dirname, "recordings");
const PROMPTS_FILE   = path.join(__dirname, "prompts.json");
const ADMIN_PASSWORD = "admin123";

const MIME = {
  ".html": "text/html",
  ".css":  "text/css",
  ".js":   "application/javascript",
  ".json": "application/json",
  ".ico":  "image/x-icon",
};

if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

if (!fs.existsSync(PROMPTS_FILE)) {
  fs.writeFileSync(PROMPTS_FILE, JSON.stringify([], null, 2), "utf8");
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
    if (err) { res.writeHead(404); res.end("Not found"); return; }
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
  return new URL(req.url, "http://localhost").pathname;
}

// ── Safe folder name from roll number ────────────────────────────────────────
// Using roll number ONLY as the key so the same student always
// maps to the same folder regardless of what they type as name.
function rollToFolder(roll) {
  return roll.trim().replace(/[^a-zA-Z0-9_-]/g, "_").substring(0, 60);
}

// ── Get all student folders with their info + recording count ─────────────────
function getAllStudents() {
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

// ── Server ────────────────────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  setCORS(res);
  if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

  const pathname = getPathname(req);

  // Static files
  if (req.method === "GET" && pathname.startsWith("/public/")) {
    const filePath = path.join(__dirname, pathname);
    if (!filePath.startsWith(__dirname)) { res.writeHead(403); res.end(); return; }
    serveFile(res, filePath); return;
  }

  // Pages
  if (req.method === "GET" && pathname === "/")      { serveFile(res, path.join(__dirname, "index.html")); return; }
  if (req.method === "GET" && pathname === "/admin") { serveFile(res, path.join(__dirname, "admin.html")); return; }

  // ── GET /student/:roll  →  look up returning student ─────────────────────
  // Returns their saved details so the form auto-fills.
  // Public endpoint — no password needed (only returns name/dept/year/sem).
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

  // ── GET /summary  →  roll-wise summary (admin) ────────────────────────────
  if (req.method === "GET" && pathname === "/summary") {
    if (!checkAdmin(req, res)) return;
    try {
      const students = getAllStudents();
      // sort by most recordings first
      students.sort((a, b) => b.recordings - a.recordings);
      json(res, 200, students);
    } catch(e) { json(res, 500, { error: e.message }); }
    return;
  }

  // ── POST /admin/verify ────────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/admin/verify") {
    json(res, 200, { ok: req.headers["x-admin-password"] === ADMIN_PASSWORD }); return;
  }

  // ── Prompt CRUD (kept for admin, student app no longer uses them) ─────────
  if (req.method === "GET" && pathname === "/prompts") {
    try { json(res, 200, JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"))); } catch(_) { json(res, 200, []); }
    return;
  }
  if (req.method === "POST" && pathname === "/admin/prompts") {
    if (!checkAdmin(req, res)) return;
    try {
      const body    = JSON.parse((await readBody(req)).toString());
      const prompts = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
      const newId   = prompts.length > 0 ? Math.max(...prompts.map(p => p.id)) + 1 : 1;
      const newP    = { id: newId, language: body.language || "Telugu", tags: body.tags || [], text: (body.text || "").trim(), translation: body.translation || "" };
      prompts.push(newP);
      fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2), "utf8");
      json(res, 200, { ok: true, prompt: newP });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }
  if (req.method === "PUT" && pathname.startsWith("/admin/prompts/")) {
    if (!checkAdmin(req, res)) return;
    try {
      const id      = parseInt(pathname.split("/").pop(), 10);
      const body    = JSON.parse((await readBody(req)).toString());
      const prompts = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
      const idx     = prompts.findIndex(p => p.id === id);
      if (idx === -1) { json(res, 404, { ok: false, error: "Not found" }); return; }
      if (body.tags) body.tags = body.tags.map(t => t.trim().toLowerCase()).filter(Boolean);
      prompts[idx] = { ...prompts[idx], ...body, id };
      fs.writeFileSync(PROMPTS_FILE, JSON.stringify(prompts, null, 2), "utf8");
      json(res, 200, { ok: true, prompt: prompts[idx] });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }
  if (req.method === "DELETE" && pathname.startsWith("/admin/prompts/")) {
    if (!checkAdmin(req, res)) return;
    try {
      const id  = parseInt(pathname.split("/").pop(), 10);
      let ps    = JSON.parse(fs.readFileSync(PROMPTS_FILE, "utf8"));
      const len = ps.length;
      ps = ps.filter(p => p.id !== id);
      if (ps.length === len) { json(res, 404, { ok: false, error: "Not found" }); return; }
      fs.writeFileSync(PROMPTS_FILE, JSON.stringify(ps, null, 2), "utf8");
      json(res, 200, { ok: true });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  // ── POST /save-recording ──────────────────────────────────────────────────
  if (req.method === "POST" && pathname === "/save-recording") {
    try {
      const { studentInfo, audio, ext } = JSON.parse((await readBody(req)).toString());
      if (!audio)               { json(res, 400, { ok: false, error: "No audio" }); return; }
      if (!studentInfo || !studentInfo.roll) { json(res, 400, { ok: false, error: "No roll number" }); return; }

      // Folder is keyed by roll number
      const folder     = rollToFolder(studentInfo.roll);
      const studentDir = path.join(RECORDINGS_DIR, folder);
      if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

      // Count existing recordings to generate next filename
      const existing  = fs.readdirSync(studentDir).filter(f => f !== "student_info.json");
      const recNumber = existing.length + 1;
      const fileName  = "recording_" + String(recNumber).padStart(3, "0") + "." + (ext || "webm");

      // Save audio
      fs.writeFileSync(path.join(studentDir, fileName), Buffer.from(audio, "base64"));

      // Always update student_info.json with latest details + session timestamp
      const updatedInfo = {
        ...studentInfo,
        lastSession: new Date().toISOString(),
        totalRecordings: recNumber,
      };
      // Keep firstSeen from original if exists
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

      console.log("✅ Saved: " + folder + "/" + fileName + " (total: " + recNumber + ")");
      json(res, 200, { ok: true, file: fileName, totalRecordings: recNumber });
    } catch(e) { json(res, 500, { ok: false, error: e.message }); }
    return;
  }

  // ── GET /list-recordings  (kept for backwards compat) ────────────────────
  if (req.method === "GET" && pathname === "/list-recordings") {
    if (!checkAdmin(req, res)) return;
    try { json(res, 200, getAllStudents()); } catch(e) { json(res, 500, { error: e.message }); }
    return;
  }

  res.writeHead(404); res.end("Not found");
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("========================================");
  console.log("🎙️  VoiceBank server running!");
  console.log("🌐  Student app  ->  http://localhost:" + PORT);
  console.log("🔧  Admin panel  ->  http://localhost:" + PORT + "/admin");
  console.log("🔑  Password: " + ADMIN_PASSWORD);
  console.log("========================================");
});
