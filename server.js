const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// خدمة ملفات الـ frontend
app.use(express.static(path.join(__dirname, 'public')));

let buyVolume = 0;
let sellVolume = 0;

// الاتصال المباشر بـ WebSocket الخاص ببينانس
const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

ws.on('message', (data) => {
    const trade = JSON.parse(data);
    const quantity = parseFloat(trade.q);
    const isBuyerMaker = trade.m; // true = بيع، false = شراء

    // فلتر: فقط الصفقات الكبيرة (مثلاً 1 BTC فما فوق)
    if (quantity >= 1.0) {
        if (isBuyerMaker) sellVolume += quantity;
        else buyVolume += quantity;
    }
});

// إرسال البيانات للواجهة كل ثانية
setInterval(() => {
    io.emit('marketData', {
        buy: buyVolume.toFixed(2),
        sell: sellVolume.toFixed(2),
        net: (buyVolume - sellVolume).toFixed(2)
    });
    // تصفير القيم
    buyVolume = 0;
    sellVolume = 0;
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ: ${PORT}`);
});
