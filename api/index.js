const http = require("http");
const { put } = require("@vercel/blob");

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || "admin123";

// Helper for CORS
function setCORS(res) {
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, GET, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, X-Admin-Password");
}

const server = http.createServer(async (req, res) => {
    setCORS(res);
    if (req.method === "OPTIONS") { res.writeHead(204); res.end(); return; }

    const url = new URL(req.url, `http://${req.headers.host}`);

    // 1. SAVE TO PERMANENT BLOB STORAGE
    if (req.method === "POST" && url.pathname === "/save-recording") {
        let body = "";
        req.on("data", chunk => body += chunk);
        req.on("end", async () => {
            try {
                const { studentInfo, audio, ext } = JSON.parse(body);
                // Create a clear folder structure in the cloud
                const blobPath = `recordings/${studentInfo.roll}/${Date.now()}.${ext || "webm"}`;

                // Upload to Vercel Blob
                const blob = await put(blobPath, Buffer.from(audio, "base64"), {
                    access: 'public',
                    addRandomSuffix: true,
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });

                // Note: In a full research setup, you should save studentInfo + blob.url 
                // to a database (like Vercel KV) to list them in the admin dashboard.

                res.writeHead(200, { "Content-Type": "application/json" });
                res.end(JSON.stringify({ ok: true, url: blob.url }));
            } catch (err) {
                console.error("Blob Error:", err);
                res.writeHead(500);
                res.end(JSON.stringify({ ok: false, error: "Cloud storage failed" }));
            }
        });
        return;
    }

    res.writeHead(404);
    res.end("Not Found");
});

module.exports = server;