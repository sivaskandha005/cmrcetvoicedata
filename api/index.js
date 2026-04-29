const http = require("http");
const fs = require("fs");
const path = require("path");

const RECORDINGS_DIR = path.join("/tmp", "recordings");

const server = http.createServer(async (req, res) => {
    // CORS headers
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
        res.writeHead(204);
        res.end();
        return;
    }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/save-recording") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", () => {
            try {
                const { studentInfo, audio, ext } = JSON.parse(body);

                if (!audio) {
                    res.writeHead(400);
                    return res.end(JSON.stringify({ ok: false, error: "Missing audio data" }));
                }

                // Create folder in /tmp
                const folderName = studentInfo.roll.replace(/[^a-zA-Z0-9]/g, "_");
                const studentDir = path.join(RECORDINGS_DIR, folderName);
                if (!fs.existsSync(studentDir)) fs.mkdirSync(studentDir, { recursive: true });

                const fileName = `rec_${Date.now()}.${ext || "webm"}`;
                fs.writeFileSync(path.join(studentDir, fileName), Buffer.from(audio, "base64"));
                fs.writeFileSync(path.join(studentDir, "info.json"), JSON.stringify(studentInfo));

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true }));
            } catch (err) {
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: "Server processing error" }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
});

module.exports = server;