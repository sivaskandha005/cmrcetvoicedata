# 🎙️ VoiceBank — Setup Guide
### Student Voice Data Collection System

---

## 📦 What's in this folder?

```
voicebank/
├── server.js       ← The backend (saves audio files)
├── index.html      ← The app students use in browser
├── package.json    ← Project info
└── recordings/     ← Audio files get saved here automatically
```

---

## 🖥️ Step-by-Step Setup (Follow in order)

---

### STEP 1 — Install Node.js on your computer

Node.js is free software that runs the server.

1. Go to: **https://nodejs.org**
2. Click the big green button **"LTS"** (recommended version)
3. Download and install it (click Next → Next → Finish)
4. To check it worked: open **Command Prompt** (Windows) or **Terminal** (Mac/Linux)
   and type:
   ```
   node --version
   ```
   You should see something like: `v20.11.0`  ✅

---

### STEP 2 — Copy the voicebank folder to your computer

Put the **voicebank** folder anywhere on your computer, for example:
- Windows: `C:\voicebank\`
- Mac/Linux: `/home/yourname/voicebank/`

---

### STEP 3 — Start the server

**On Windows:**
1. Open the `voicebank` folder
2. Click the address bar at the top, type `cmd`, press Enter
3. In the black window that appears, type:
   ```
   node server.js
   ```
4. You'll see:
   ```
   🎙️  VoiceBank server running!
   🌐  Open in browser:  http://localhost:3000
   📁  Recordings saved to: ./recordings/
   ```

**On Mac/Linux:**
1. Open Terminal
2. Type `cd ` (with a space), then drag the voicebank folder into the terminal, press Enter
3. Type:
   ```
   node server.js
   ```

---

### STEP 4 — Open the app in a browser

On the **same computer** the server is running on:
- Open any browser (Chrome recommended)
- Go to: **http://localhost:3000**
- You'll see the VoiceBank app! ✅

---

### STEP 5 — Let other students use it on the same network (Intranet)

To let students use it from OTHER computers on the same Wi-Fi/LAN:

1. Find your computer's IP address:
   - **Windows:** Open Command Prompt → type `ipconfig` → look for **IPv4 Address** (e.g. `192.168.1.5`)
   - **Mac:** System Preferences → Network → look for the IP address
   - **Linux:** Open Terminal → type `hostname -I`

2. Tell students to open their browser and go to:
   ```
   http://192.168.1.5:3000
   ```
   (Replace `192.168.1.5` with YOUR computer's actual IP address)

3. That's it! Multiple students can record at the same time. 🎉

---

## 📁 Where are the recordings saved?

After students submit, audio files are saved to:
```
voicebank/
└── recordings/
    └── CS2024-042_ArjunSharma/
        ├── student_info.json    ← Student details
        ├── prompt_01.webm       ← Recording for prompt 1
        ├── prompt_02.webm       ← Recording for prompt 2
        └── ...
```

Each student gets their own folder named with their ID + name.

---

## 🔍 View all saved recordings (admin)

While the server is running, open this URL in your browser:
```
http://localhost:3000/list-recordings
```
This shows a list of all students who have submitted recordings.

---

## ❓ Common Problems

| Problem | Solution |
|---|---|
| "node is not recognized" | Restart your computer after installing Node.js |
| Page won't load on other computers | Make sure all devices are on the same Wi-Fi |
| Microphone not working | Use Chrome browser; click "Allow" when asked for mic access |
| Port 3000 in use | Edit server.js line 5, change `3000` to `3001` |

---

## ⛔ To Stop the Server

Press **Ctrl + C** in the terminal/command prompt window.

---

*VoiceBank — Built for intranet voice data collection*
