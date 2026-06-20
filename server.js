const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const WebSocket = require('ws');
const axios = require('axios');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

let buyVolume = 0;
let sellVolume = 0;

async function connectToKuCoin() {
    console.log("جارٍ جلب رمز الاتصال من KuCoin...");
    
    // 1. طلب رمز الاتصال (Token) من KuCoin
    const response = await axios.post('https://api.kucoin.com/api/v1/bullet-public');
    const { token, instanceServers } = response.data.data;
    const endpoint = `${instanceServers[0].endpoint}?token=${token}`;

    console.log("✅ تم الحصول على الرمز، جارٍ الاتصال...");
    const ws = new WebSocket(endpoint);

    ws.on('open', () => {
        console.log('✅ تم الاتصال بنجاح بـ KuCoin');
        // 2. الاشتراك في بيانات السوق (Ticker) لزوج BTC-USDT
        ws.send(JSON.stringify({
            "id": 1,
            "type": "subscribe",
            "topic": "/market/ticker:BTC-USDT",
            "response": true
        }));
    });

    ws.on('message', (data) => {
        const msg = JSON.parse(data);
        // KuCoin ترسل بيانات التداول في نوع "message"
        if (msg.type === 'message' && msg.data && msg.data.lastTradedPrice) {
            // ملاحظة: KuCoin ترسل تحديثات السعر والكمية. 
            // سنحسب التدفق بناءً على التغيرات (هذا مجرد مثال بسيط)
            const price = parseFloat(msg.data.lastTradedPrice);
            const size = parseFloat(msg.data.size);

            // منطق مبسط: إذا السعر ارتفع = شراء، انخفض = بيع
            // (يمكنك تطويره لاحقاً حسب بيانات KuCoin المتقدمة)
            if (size > 0.1) { // فلتر الحيتان
                buyVolume += size; 
            }
        }
    });

    ws.on('close', () => {
        console.log('🔄 انقطع الاتصال، إعادة المحاولة بعد 5 ثوانٍ...');
        setTimeout(connectToKuCoin, 5000);
    });

    ws.on('error', (err) => {
        console.error('⚠️ خطأ:', err.message);
        setTimeout(connectToKuCoin, 5000);
    });
}

connectToKuCoin();

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
server.listen(PORT, () => console.log(`السيرفر يعمل على المنفذ: ${PORT}`));
