const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const axios = require('axios');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

let zoneStats = {};
let lastHour = new Date().getHours();
let pivots = {};

// دالة جلب البيفوت وتحديثها
async function updatePivots() {
    try {
        const { data } = await axios.get('https://api.binance.com/api/v3/klines?symbol=BTCUSDT&interval=1d&limit=2');
        const h = parseFloat(data[0][2]), l = parseFloat(data[0][3]), c = parseFloat(data[0][4]);
        const p = (h + l + c) / 3;
        pivots = { R3: (2 * p) - (2 * l - h), R2: p + (h - l), R1: (2 * p) - l, P: p, S1: (2 * p) - h, S2: p - (h - l), S3: (2 * p) - (2 * h - l) };
        io.emit('pivots', pivots);
    } catch (e) { console.error(e); }
}

function getZoneName(price) {
    if (price > pivots.R2) return "R3-R2";
    if (price > pivots.R1) return "R2-R1";
    if (price > pivots.P) return "R1-P";
    if (price > pivots.S1) return "P-S1";
    if (price > pivots.S2) return "S1-S2";
    return "S2-S3";
}

// اتصال بينانس
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade');
ws.on('message', (data) => {
    const msg = JSON.parse(data);
    const now = new Date();
    if (now.getHours() !== lastHour) { zoneStats = {}; lastHour = now.getHours(); }

    const price = parseFloat(msg.p);
    const qty = parseFloat(msg.q);
    const zone = getZoneName(price);

    if (!zoneStats[zone]) zoneStats[zone] = { buy: 0, sell: 0 };
    if (msg.m) zoneStats[zone].sell += qty; else zoneStats[zone].buy += qty;
    
    io.emit('stats', { zone, stats: zoneStats[zone], price });
});

setInterval(updatePivots, 600000);
updatePivots();

server.listen(process.env.PORT || 3000, () => console.log('Server running...'));
