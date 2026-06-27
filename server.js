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
    } catch (e) { console.error("Error fetching pivots:", e.message); }
}

function getZoneName(price) {
    if (!pivots.R2) return "انتظار البيانات...";
    if (price > pivots.R2) return "R3-R2";
    if (price > pivots.R1) return "R2-R1";
    if (price > pivots.P) return "R1-P";
    if (price > pivots.S1) return "P-S1";
    if (price > pivots.S2) return "S1-S2";
    return "S2-S3";
}

// دالة الاتصال المحدثة مع ترويسات لتجاوز الحظر
function connectWebSocket() {
    console.log("Attempting to connect to Binance...");
    
    // إضافة ترويسات لمحاكاة متصفح حقيقي وتجاوز خطأ 451
    const options = {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "Origin": "https://www.binance.com"
        }
    };

    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@aggTrade', options);

    ws.on('open', () => {
        console.log("Connected to Binance WebSocket!");
    });

    ws.on('message', (data) => {
        try {
            const msg = JSON.parse(data);
            const now = new Date();
            // تصفير البيانات عند بداية ساعة جديدة
            if (now.getHours() !== lastHour) { 
                zoneStats = {}; 
                lastHour = now.getHours(); 
            }

            const price = parseFloat(msg.p);
            const qty = parseFloat(msg.q);
            const zone = getZoneName(price);

            if (!zoneStats[zone]) zoneStats[zone] = { buy: 0, sell: 0 };
            if (msg.m) zoneStats[zone].sell += qty; else zoneStats[zone].buy += qty;
            
            io.emit('stats', { zone, stats: zoneStats[zone], price });
        } catch (e) {
            console.error("Message Processing Error:", e);
        }
    });

    // معالجة الأخطاء لمنع انهيار البرنامج
    ws.on('error', (err) => {
        console.error("WebSocket Error:", err.message);
    });

    // إعادة الاتصال تلقائياً عند الإغلاق
    ws.on('close', () => {
        console.log("Connection closed. Reconnecting in 5 seconds...");
        setTimeout(connectWebSocket, 5000);
    });
}

// تشغيل النظام
updatePivots();
setInterval(updatePivots, 600000);
connectWebSocket(); 

server.listen(process.env.PORT || 3000, () => console.log('Server running on port 3000'));
