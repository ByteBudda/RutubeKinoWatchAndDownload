import { app, BrowserWindow, Menu, shell } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import express from 'express';
import { spawn } from 'child_process';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = 9764;
const TARGET_CHANNELS = ["38284124", "32869212", "24525890", "30107314"];
const DOWNLOAD_DIR = app.getPath('downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

const activeDownloads = {};
const appExpress = express();
const server = createServer(appExpress);
const wss = new WebSocketServer({ server });

// Setup routes
appExpress.get('/api/search', async (req, res) => {
    const query = req.query.q || '';
    const results = await searchVideos(query);
    res.json(results);
});

appExpress.get('/api/catalog', async (req, res) => {
    const page = parseInt(req.query.page) || 1;
    const size = parseInt(req.query.size) || 24;
    const results = await getCatalog(page, size);
    res.json(results);
});

appExpress.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/index.html'));
});

appExpress.use('/public', express.static(path.join(__dirname, '../public')));

// WebSocket
wss.on('connection', (ws) => {
    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data.toString());
            handleMessage(ws, msg);
        } catch (error) {}
    });
});

function handleMessage(ws, msg) {
    if (!msg || !msg.url || !msg.action) return;
    const url = msg.url;
    
    switch (msg.action) {
        case 'start':
            startDownload(ws, url);
            break;
        case 'cancel':
            cancelDownload(url);
            break;
        case 'pause':
            pauseDownload(url);
            break;
        case 'resume':
            resumeDownload(url);
            break;
    }
}

function startDownload(ws, url) {
    if (activeDownloads[url]) {
        ws.send(JSON.stringify({ type: 'error', url, message: 'Already downloading' }));
        return;
    }

    const outputTemplate = path.join(DOWNLOAD_DIR, '%(title)s.%(ext)s');
    const ytdlp = spawn('yt-dlp', [
        '-o', outputTemplate,
        '--progress',
        '--no-color',
        '--newline',
        '--no-playlist',
        url
    ]);

    activeDownloads[url] = {
        process: ytdlp,
        cancelled: false,
        filename: 'Unknown',
        paused: false
    };

    const handleOutput = (chunk) => {
        const text = chunk.toString();
        parseProgress(text, ws, url);
    };

    ytdlp.stdout.on('data', handleOutput);
    ytdlp.stderr.on('data', handleOutput);

    ytdlp.on('close', (code) => {
        const dl = activeDownloads[url];
        const wasCancelled = dl?.cancelled || false;
        delete activeDownloads[url];
        
        if (code === 0 && !wasCancelled) {
            ws.send(JSON.stringify({ type: 'finished', url, filename: dl?.filename || 'Unknown' }));
        } else if (wasCancelled) {
            ws.send(JSON.stringify({ type: 'error', url, message: 'cancelled' }));
        }
    });

    ytdlp.on('error', (error) => {
        delete activeDownloads[url];
        ws.send(JSON.stringify({ type: 'error', url, message: error.message }));
    });
}

function parseProgress(text, ws, url) {
    const dl = activeDownloads[url];
    if (!dl || dl.cancelled) return;

    let filename = dl.filename;
    const destMatch = text.match(/\[download\]\s+Destination:\s+(.+)/i);
    if (destMatch) {
        filename = path.basename(destMatch[1]);
        dl.filename = filename;
    }
    if (filename === 'Unknown') {
        const titleMatch = text.match(/\[info\].*Title:\s+(.+)/i);
        if (titleMatch) {
            filename = titleMatch[1].split('[')[0].trim();
            dl.filename = filename;
        }
    }

    const percentMatches = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)];
    if (percentMatches.length === 0) return;
    const percent = parseFloat(percentMatches[percentMatches.length - 1][1]);

    let speed = null;
    const speedMatch = text.match(/at\s+(\d+(?:\.\d+)?\s*[KMG]?i?B\/s)/i);
    if (speedMatch) speed = speedMatch[1];

    let size = null;
    const sizeMatch = text.match(/of\s+~?(\d+(?:\.\d+)?\s*[KMG]?i?B)/i);
    if (sizeMatch) size = sizeMatch[1];

    let eta = null;
    const etaMatch = text.match(/ETA\s+(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/i);
    if (etaMatch) eta = etaMatch[1];

    ws.send(JSON.stringify({ type: 'progress', url, percent, filename, speed, size, eta }));
}

function cancelDownload(url) {
    const dl = activeDownloads[url];
    if (dl && dl.process) {
        dl.cancelled = true;
        dl.process.kill('SIGTERM');
    }
}

function pauseDownload(url) {
    const dl = activeDownloads[url];
    if (dl && dl.process && !dl.paused) {
        dl.process.kill('SIGSTOP');
        dl.paused = true;
    }
}

function resumeDownload(url) {
    const dl = activeDownloads[url];
    if (dl && dl.process && dl.paused) {
        dl.process.kill('SIGCONT');
        dl.paused = false;
    }
}

async function searchVideos(query) {
    const videos = [];
    const seen = new Set();
    for (const channelId of TARGET_CHANNELS) {
        try {
            const apiUrl = `https://rutube.ru/api/search/video/?query=${encodeURIComponent(query)}&person=${channelId}`;
            const response = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = await response.json();
            for (const item of data.results || []) {
                const authorId = item.author?.id?.toString();
                if (!seen.has(item.id) && authorId === channelId && (item.duration || 0) > 600) {
                    seen.add(item.id);
                    videos.push(formatVideo(item));
                }
            }
        } catch (error) {}
    }
    return videos;
}

async function getCatalog(page = 1, pageSize = 24) {
    const videos = [];
    const seen = new Set();
    for (const channelId of TARGET_CHANNELS) {
        try {
            const apiUrl = `https://rutube.ru/api/video/person/${channelId}/?page=${page}&page_size=${pageSize}`;
            const response = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = await response.json();
            for (const item of data.results || []) {
                if (!seen.has(item.id) && (item.duration || 0) > 600) {
                    seen.add(item.id);
                    videos.push(formatVideo(item));
                }
            }
        } catch (error) {}
    }
    return videos;
}

function formatVideo(item) {
    return {
        id: item.id,
        title: item.title || 'Untitled',
        thumb: item.thumbnail_url || '',
        embed: item.embed_url || '',
        url: `https://rutube.ru/video/${item.id}/`
    };
}

// Electron window management
let mainWindow = null;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1400,
        height: 900,
        backgroundColor: '#050505',
        icon: path.join(__dirname, '../icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            sandbox: true
        },
        title: 'Kino Downloader'
    });

    mainWindow.loadURL(`http://localhost:${PORT}`);

    mainWindow.on('closed', () => { mainWindow = null; });

    const menu = Menu.buildFromTemplate([
        {
            label: 'File',
            submenu: [
                { label: 'Open Downloads', click: () => shell.openPath(DOWNLOAD_DIR) },
                { type: 'separator' },
                { label: 'Exit', role: 'quit' }
            ]
        },
        {
            label: 'View',
            submenu: [
                { label: 'Reload', role: 'reload' },
                { label: 'Toggle DevTools', role: 'toggleDevTools' },
                { label: 'Fullscreen', role: 'togglefullscreen' }
            ]
        }
    ]);
    Menu.setApplicationMenu(menu);
}

// Start server
server.listen(PORT, '127.0.0.1', () => {
    console.log(`Server running on port ${PORT}`);
});

app.whenReady().then(() => {
    createWindow();
    app.on('activate', () => {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', () => {
    for (const url of Object.keys(activeDownloads)) {
        cancelDownload(url);
    }
    server.close();
    if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', (e) => {
    e.preventDefault();
    for (const url of Object.keys(activeDownloads)) {
        cancelDownload(url);
    }
    server.close(() => { app.quit(); });
    setTimeout(() => { process.exit(0); }, 2000);
});
