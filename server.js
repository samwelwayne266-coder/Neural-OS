const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');
const { exec } = require('child_process'); // Allows running system commands
const os = require('os'); // To get system stats
const axios = require('axios');

const app = express();
const PORT = 3001;
const STORAGE_DIR = path.join(__dirname, 'neural_storage');

if (!fs.existsSync(STORAGE_DIR)) fs.mkdirSync(STORAGE_DIR);

app.get('/api/proxy', async (req, res) => {
    try {
        const response = await axios.get(req.query.url, {
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        // Remove headers that block iframes
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.send(response.data);
    } catch (e) {
        res.status(500).send("Neural Link Severed.");
    }
});


// 1. GLOBAL MIDDLEWARE
// Set high limits for large file uploads (photos/music)
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ limit: '500mb', extended: true }));

// Enable CORS for all routes so the browser doesn't block audio data
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST']
}));

// 2. STATIC STORAGE (THE KEY FIX)
// We add custom headers here to ensure the AudioContext can read the bits
// This tells the server: "Allow anyone to stream these files for analysis"
app.use('/neural_storage', (req, res, next) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Methods", "GET");
    res.header("Access-Control-Allow-Headers", "Content-Type, Accept, Range");
    next();
}, express.static(path.join(__dirname, 'neural_storage')));

app.use(express.static('.'));

// 3. PROXY ENGINE
app.get('/api/proxy', async (req, res) => {
    try {
        const response = await axios.get(req.query.url, {
            responseType: 'text',
            headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        res.removeHeader('X-Frame-Options');
        res.removeHeader('Content-Security-Policy');
        res.send(response.data);
    } catch (e) {
        res.status(500).send("Neural Link Severed.");
    }
});

// 4. FILE OPERATIONS (Consolidated)
app.post('/api/save', (req, res) => {
    const { filename, content } = req.body;
    const uploadPath = path.join(__dirname, 'neural_storage', filename);

    if (content.startsWith('data:image')) {
        // Remove the "data:image/png;base64," header to get just the raw data
        const base64Data = content.replace(/^data:image\/\w+;base64,/, "");
        fs.writeFileSync(uploadPath, base64Data, 'base64');
    } else {
        // Save as standard text
        fs.writeFileSync(uploadPath, content, 'utf8');
    }
    
    console.log(`Neural Write: ${filename} stored.`);
    res.json({ success: true });
});


app.get('/api/files', (req, res) => {
    const files = fs.readdirSync(path.join(__dirname, 'neural_storage'));
    res.json(files);
});

app.get('/api/files/:name', (req, res) => {
    res.sendFile(path.join(__dirname, 'neural_storage', req.params.name));
});

// --- NEW: System Stats API ---
app.get('/api/stats', (req, res) => {
    res.json({
        cpu: os.loadavg()[0].toFixed(2),
        mem: (1 - os.freemem() / os.totalmem()).toFixed(2) * 100,
        uptime: Math.floor(os.uptime() / 3600) + "h " + Math.floor((os.uptime() % 3600) / 60) + "m"
    });
});

// 6. TERMINAL EXECUTION (Secure)
app.post('/api/terminal', (req, res) => {
    const { command } = req.body;
    // Basic security: only allow safe commands
    const allowed = ['ping', 'dir', 'ls', 'echo', 'ipconfig', 'hostname'];
    const cmdBase = command.split(' ')[0];
    
    if (!allowed.includes(cmdBase)) {
        return res.json({ output: `Access Denied: Command '${cmdBase}' not in whitelist.` });
    }

    exec(command, (error, stdout, stderr) => {
        res.json({ output: stdout || stderr || error.message });
    });
});

app.listen(PORT, () => console.log(`Neural Kernel v2.5 active on http://localhost:${PORT}`));

