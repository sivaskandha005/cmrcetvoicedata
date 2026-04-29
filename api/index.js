const http = require("http");
const fs = require("fs");
const path = require("path");

const RECORDINGS_DIR = path.join("/tmp", "recordings");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Helper to ensure roll numbers match folder names across all routes
const sanitize = (str) => str.replace(/[^a-zA-Z0-9]/g, "_");

if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

function setCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
}

const server = http.createServer(async (req, res) => {
    setCORS(res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const authHeader = req.headers['x-admin-password'];

    // 1. SAVE RECORDING
    if (req.method === "POST" && pathname === "/save-recording") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try {
                const { studentInfo, audio, ext } = JSON.parse(body);
                const folderName = sanitize(studentInfo.roll);
                const studentDir = path.join(RECORDINGS_DIR, folderName);
                if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

                const timestamp = new Date().toISOString();
                const fileName = `rec_${Date.now()}.${ext || "webm"}`;
                
                fs.writeFileSync(path.join(studentDir, fileName), Buffer.from(audio, "base64"));
                
                // Meta-data includes timestamp and fileName for the admin dashboard
                const info = { ...studentInfo, timestamp, fileName };
                fs.writeFileSync(path.join(studentDir, "info.json"), JSON.stringify(info));

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: "Upload failed" }));
            }
        });
        return;
    }

    // 2. SUMMARY ROUTE
    if (req.method === "GET" && pathname === "/summary") {
        if (authHeader !== ADMIN_PASSWORD) {
            res.writeHead(401); return res.end(JSON.stringify({ error: "Unauthorized" }));
        }
        try {
            const folders = fs.readdirSync(RECORDINGS_DIR);
            const data = folders.map(f => {
                const p = path.join(RECORDINGS_DIR, f, "info.json");
                return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null;
            }).filter(x => x);
            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(data));
        } catch (err) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Read failed" }));
        }
        return;
    }

    // 3. DOWNLOAD ROUTE (Fixes 404)
    if (req.method === "GET" && pathname === "/download") {
        const roll = url.searchParams.get("roll");
        const file = url.searchParams.get("file");

        if (!roll || !file) {
            res.writeHead(400); return res.end("Missing parameters");
        }

        const filePath = path.join(RECORDINGS_DIR, sanitize(roll), file);

        if (fs.existsSync(filePath)) {
            res.writeHead(200, {
                "Content-Type": "audio/webm",
                "Content-Disposition": `attachment; filename=${file}`
            });
            fs.createReadStream(filePath).pipe(res);
        } else {
            res.writeHead(404); res.end("File Not Found");
        }
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
});

module.exports = server;