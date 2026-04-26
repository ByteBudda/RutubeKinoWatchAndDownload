import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { spawn } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT || 9764;
const TARGET_CHANNELS = ["38284124", "32869212", "24525890", "30107314"];
const DOWNLOAD_DIR = path.join(__dirname, '../../downloads');

if (!fs.existsSync(DOWNLOAD_DIR)) {
    fs.mkdirSync(DOWNLOAD_DIR, { recursive: true });
}

const activeDownloads = {};
const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

mapRoutes();
setupWebSocket();

server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});

function mapRoutes() {
    app.get('/api/search', async (req, res) => {
        const query = req.query.q || '';
        const results = await searchVideos(query);
        res.json(results);
    });

    app.get('/api/catalog', async (req, res) => {
        const page = parseInt(req.query.page) || 1;
        const size = parseInt(req.query.size) || 24;
        const results = await getCatalog(page, size);
        res.json(results);
    });

    app.get('/', (req, res) => {
        res.sendFile(path.join(__dirname, '../public/index.html'));
    });

    app.use('/public', express.static(path.join(__dirname, '../public')));
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
        } catch (error) {
            console.error('Search error:', error);
        }
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
        } catch (error) {
            console.error('Catalog error:', error);
        }
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

function setupWebSocket() {
    wss.on('connection', (ws) => {
        console.log('Client connected');
        
        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data.toString());
                handleMessage(ws, msg);
            } catch (error) {
                console.error('Message parse error:', error);
            }
        });

        ws.on('error', (error) => {
            console.error('WebSocket error:', error);
        });

        ws.on('close', () => {
            console.log('Client disconnected');
        });
    });
}

function handleMessage(ws, msg) {
    const url = msg.url;
    
    if (!url) return;
    
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
            ws.send(JSON.stringify({ 
                type: 'finished', 
                url, 
                filename: dl?.filename || 'Unknown' 
            }));
        } else if (wasCancelled) {
            ws.send(JSON.stringify({ type: 'error', url, message: 'cancelled' }));
        } else {
            ws.send(JSON.stringify({ type: 'error', url, message: `Exit code ${code}` }));
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

    // Parse filename - проверенные паттерны
    let filename = dl.filename;
    
    // 1. Пробуем Destination: обычно содержит полный путь с именем файла
    const destMatch = text.match(/\[download\]\s+Destination:\s+(.+)/i);
    if (destMatch) {
        filename = path.basename(destMatch[1]);
        dl.filename = filename;
    }
    
    // 2. Пробуем Saving to: с кавычками
    if (filename === 'Unknown') {
        const savingToMatch = text.match(/Saving to:\s+["'](.+)["']/i);
        if (savingToMatch) {
            filename = path.basename(savingToMatch[1]);
            dl.filename = filename;
        }
    }
    
    // 3. Пробуем Title из metadata
    if (filename === 'Unknown') {
        const titleMatch = text.match(/\[info\].*Title:\s+(.+)/i);
        if (titleMatch) {
            filename = titleMatch[1].split('[')[0].trim();
            dl.filename = filename;
        }
    }

    // Parse percentage - get all matches and take last
    const percentMatches = [...text.matchAll(/(\d+(?:\.\d+)?)%/g)];
    if (percentMatches.length === 0) return;
    
    const percent = parseFloat(percentMatches[percentMatches.length - 1][1]);

    // Parse speed
    let speed = null;
    const speedMatch = text.match(/at\s+(\d+(?:\.\d+)?\s*[KMG]?i?B\/s)/i);
    if (speedMatch) {
        speed = speedMatch[1];
    }
    
    // Parse file size
    let size = null;
    const sizeMatch = text.match(/of\s+~?(\d+(?:\.\d+)?\s*[KMG]?i?B)/i);
    if (sizeMatch) {
        size = sizeMatch[1];
    }
    
    // Parse ETA
    let eta = null;
    const etaMatch = text.match(/ETA\s+(\d{2}:\d{2}:\d{2}|\d{2}:\d{2})/i);
    if (etaMatch) {
        eta = etaMatch[1];
    }

    ws.send(JSON.stringify({
        type: 'progress',
        url,
        percent,
        filename,
        speed,
        size,
        eta
    }));
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
