const http = require("http");
const fs = require("fs");
const path = require("path");

const RECORDINGS_DIR = path.join("/tmp", "recordings");
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Ensure storage directory exists
if (!fs.existsSync(RECORDINGS_DIR)) fs.mkdirSync(RECORDINGS_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
    // CORS configuration
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;
    const authHeader = req.headers['x-admin-password'];

    // 1. ROUTE: POST /save-recording (Student Upload)
    if (req.method === "POST" && pathname === "/save-recording") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try {
                const { studentInfo, audio, ext } = JSON.parse(body);
                const folderName = studentInfo.roll.replace(/[^a-zA-Z0-9]/g, "_");
                const studentDir = path.join(RECORDINGS_DIR, folderName);
                
                if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

                const fileName = `rec_${Date.now()}.${ext || "webm"}`;
                fs.writeFileSync(path.join(studentDir, fileName), Buffer.from(audio, "base64"));
                
                // Track student info for the summary table
                const infoPath = path.join(studentDir, "info.json");
                let existingData = { recordings: 0 };
                if (fs.existsSync(infoPath)) existingData = JSON.parse(fs.readFileSync(infoPath));
                
                const updatedInfo = {
                    ...studentInfo,
                    recordings: (existingData.recordings || 0) + 1,
                    lastSession: new Date().toISOString()
                };
                fs.writeFileSync(infoPath, JSON.stringify(updatedInfo));

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: "Upload failed" }));
            }
        });
        return;
    }

    // 2. ROUTE: POST /admin/verify (Login)
    if (req.method === "POST" && pathname === "/admin/verify") {
        const isOk = (authHeader === ADMIN_PASSWORD);
        res.writeHead(isOk ? 200 : 401, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ ok: isOk }));
    }

    // 3. ROUTE: GET /summary (Admin Dashboard Data)
    if (req.method === "GET" && pathname === "/summary") {
        if (authHeader !== ADMIN_PASSWORD) {
            res.writeHead(401);
            return res.end(JSON.stringify({ error: "Unauthorized" }));
        }

        try {
            const folders = fs.readdirSync(RECORDINGS_DIR);
            const summary = folders.map(folder => {
                const p = path.join(RECORDINGS_DIR, folder, "info.json");
                return fs.existsSync(p) ? JSON.parse(fs.readFileSync(p)) : null;
            }).filter(x => x !== null);

            res.writeHead(200, { "Content-Type": "application/json" });
            res.end(JSON.stringify(summary));
        } catch (e) {
            res.writeHead(500);
            res.end(JSON.stringify({ error: "Failed to read data" }));
        }
        return;
    }

    // 4. ROUTE: GET /prompts (Placeholder to prevent server check error)
    if (req.method === "GET" && pathname === "/prompts") {
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify([])); // Returns empty list for now
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
});

module.exports = server;