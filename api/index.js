const http = require("http");
const { put } = require("@vercel/blob");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

function setCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
}

const server = http.createServer(async (req, res) => {
    setCORS(res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    if (req.method === "POST" && url.pathname === "/save-recording") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const { studentInfo, audio, ext } = JSON.parse(body);
                
                // Validate that we have audio data
                if (!audio) throw new Error("No audio data received");

                const fileName = `recordings/${studentInfo.roll}_${Date.now()}.${ext || "webm"}`;

                // Upload to Vercel Blob
                const blob = await put(fileName, Buffer.from(audio, "base64"), {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, url: blob.url }));
            } catch (err) {
                console.error("Upload Error Details:", err.message);
                res.writeHead(500, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: false, error: err.message }));
            }
        });
        return;
    }
    
    res.writeHead(404);
    res.end("Not Found");
});

module.exports = server;