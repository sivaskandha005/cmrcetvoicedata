const http = require("http");
const { put } = require("@vercel/blob");
const fs = require("fs");
const path = require("path");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";
const DATA_DIR = path.join("/tmp", "metadata"); // We still use /tmp for the list, but the AUDIO is permanent

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const server = http.createServer(async (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");

    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // 1. SAVE RECORDING TO BLOB
    if (req.method === "POST" && url.pathname === "/save-recording") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const { studentInfo, audio, ext } = JSON.parse(body);
                const fileName = `recordings/${studentInfo.roll}_${Date.now()}.${ext || "webm"}`;

                // Upload to Permanent Cloud
                const blob = await put(fileName, Buffer.from(audio, "base64"), {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });

                // Save metadata so the Admin Panel knows the URL
                const studentData = { ...studentInfo, fileUrl: blob.url, timestamp: new Date().toISOString() };
                const metaPath = path.join(DATA_DIR, `${studentInfo.roll}.json`);
                fs.writeFileSync(metaPath, JSON.stringify(studentData));

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, url: blob.url }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ error: "Upload failed" }));
            }
        });
        return;
    }

    // 2. SUMMARY ROUTE
    if (req.method === "GET" && url.pathname === "/summary") {
        const auth = req.headers['x-admin-password'];
        if (auth !== ADMIN_PASSWORD) { res.writeHead(401); return res.end(); }

        const files = fs.readdirSync(DATA_DIR);
        const data = files.map(f => JSON.parse(fs.readFileSync(path.join(DATA_DIR, f))));
        
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(JSON.stringify(data));
        return;
    }
});

module.exports = server;