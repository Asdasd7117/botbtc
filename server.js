const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let buyVolume = 0;
let sellVolume = 0;

// دالة الاتصال بـ WebSocket
function connectToBinance() {
    console.log("جارٍ محاولة الاتصال بـ Binance...");
    const ws = new WebSocket('wss://stream.binance.com:9443/ws/btcusdt@trade');

    ws.on('open', () => {
        console.log('✅ تم الاتصال بنجاح بـ Binance');
    });

    ws.on('message', (data) => {
        try {
            const trade = JSON.parse(data);
            const quantity = parseFloat(trade.q);
            const isBuyerMaker = trade.m; 

            if (quantity >= 1.0) {
                if (isBuyerMaker) sellVolume += quantity;
                else buyVolume += quantity;
            }
        } catch (e) {
            console.error("خطأ في معالجة البيانات:", e);
        }
    });

    // التعامل مع الأخطاء وإعادة الاتصال
    ws.on('error', (err) => {
        console.error('⚠️ خطأ في WebSocket:', err.message);
        // لا تنهي التطبيق، انتظر 5 ثواني وأعد الاتصال
        setTimeout(connectToBinance, 5000);
    });

    ws.on('close', () => {
        console.log('🔄 تم إغلاق الاتصال، جارٍ إعادة المحاولة...');
        setTimeout(connectToBinance, 5000);
    });
}

// تشغيل الدالة لأول مرة
connectToBinance();

// إرسال البيانات للواجهة
setInterval(() => {
    io.emit('marketData', {
        buy: buyVolume.toFixed(2),
        sell: sellVolume.toFixed(2),
        net: (buyVolume - sellVolume).toFixed(2)
    });
    buyVolume = 0;
    sellVolume = 0;
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`السيرفر يعمل على المنفذ: ${PORT}`);
});
