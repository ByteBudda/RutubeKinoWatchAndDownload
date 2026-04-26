# Kino Downloader - Professional Video Downloader

A professional Electron application for downloading videos from Rutube with a modern UI, multiple simultaneous downloads, and reliable progress tracking.

## Features

- **Modern UI**: Glassmorphism design with smooth animations
- **Multiple Downloads**: Each download has its own panel
- **Accurate Progress**: Real-time progress tracking with last percentage parsing
- **Pause/Resume**: Control downloads individually
- **Search & Catalog**: Browse and search videos
- **Auto-Reconnect**: WebSocket auto-reconnects if connection drops
- **Error Handling**: Graceful error recovery

## Architecture

```
new-project/
├── src/
│   ├── main.js          # Electron main process
│   └── server.js        # Express + WebSocket server
├── public/
│   └── index.html       # Frontend UI
├── package.json
└── README.md
```

## Installation

```bash
# Clone or navigate to project
cd new-project

# Install dependencies
npm install

# Create downloads directory
mkdir downloads
```

## Usage

### Development
```bash
npm run dev
```

This starts both Electron app and server simultaneously.

### Production
```bash
# Start server
npm run server

# In another terminal, start Electron
npm start
```

## Requirements

- Node.js >= 18.0.0
- yt-dlp (must be installed on system and in PATH)
- Electron 28+

## Project Structure

### Server (src/server.js)
- Express HTTP server on port 9764
- WebSocket server for real-time communication
- API endpoints: `/api/search`, `/api/catalog`
- Download manager with yt-dlp
- Progress parsing from stdout/stderr

### Main Process (src/main.js)
- Electron window management
- Menu setup
- Process lifecycle handling

### Frontend (public/index.html)
- Responsive grid layout
- Player overlay with embed
- Downloads panel container
- Class-based DownloadPanel manager
- WebSocket client connection
- Smooth animations with CSS

## Key Technical Improvements

1. **Progress Parsing**: Uses regex `/\d+(?:\.\d+)?)%/g` to find ALL percentages in output and takes the last one
2. **Multiple Panels**: Each download creates a new `DownloadPanel` instance stored in `activeDownloads[url]`
3. **Error Safety**: All DOM operations wrapped in null checks using `safeQuery()`
4. **Memory Management**: Panels are properly removed on complete/cancel/error
5. **WebSocket Reliability**: Auto-reconnect with 5 second delay
6. **Modern JavaScript**: Uses ES6+ classes, async/await, template literals

## Configuration

Edit `src/server.js` to change:
- `PORT` - server port (default: 9764)
- `TARGET_CHANNELS` - Rutube channel IDs to search
- `DOWNLOAD_DIR` - downloads location

## License

MIT
