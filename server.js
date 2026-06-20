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
    try {
        console.log("--- بدء محاولة الاتصال بـ KuCoin ---");
        const response = await axios.post('https://api.kucoin.com/api/v1/bullet-public');
        const { token, instanceServers } = response.data.data;
        const endpoint = `${instanceServers[0].endpoint}?token=${token}`;

        const ws = new WebSocket(endpoint);

        ws.on('open', () => {
            console.log('✅ تم الاتصال بالسيرفر! جارٍ الاشتراك في البيانات...');
            ws.send(JSON.stringify({
                "id": Date.now(),
                "type": "subscribe",
                "topic": "/market/match:BTC-USDT",
                "response": true
            }));
        });

        ws.on('message', (data) => {
            try {
                const msg = JSON.parse(data);
                
                // طباعة كل رسالة تصل من المنصة في سجلات (Logs) موقع Render
                // إذا رأيت هذا السطر في الـ Logs، فهذا يعني أن البيانات تصلك!
                console.log("الرسالة المستلمة:", JSON.stringify(msg));

                if (msg.type === 'message' && msg.topic === '/market/match:BTC-USDT') {
                    const size = parseFloat(msg.data.size);
                    const side = msg.data.side;

                    // سنلغي شرط الحجم حالياً (0.1) لنتأكد أن البيانات تصل
                    if (side === 'buy') {
                        buyVolume += size;
                    } else if (side === 'sell') {
                        sellVolume += size;
                    }
                }
            } catch (e) {
                console.error("خطأ في قراءة الرسالة:", e);
            }
        });

        ws.on('error', (err) => {
            console.error('⚠️ خطأ WebSocket:', err.message);
        });

        ws.on('close', () => {
            console.log('🔄 انقطع الاتصال، سأعيد المحاولة بعد 5 ثوانٍ...');
            setTimeout(connectToKuCoin, 5000);
        });

    } catch (error) {
        console.error("خطأ في جلب التوكن (Token) أو الاتصال:", error.message);
        setTimeout(connectToKuCoin, 5000);
    }
}

connectToKuCoin();

setInterval(() => {
    io.emit('marketData', {
        buy: buyVolume.toFixed(2),
        sell: sellVolume.toFixed(2),
        net: (buyVolume - sellVolume).toFixed(2)
    });
    // لا تقم بتصفير القيم فوراً، دعنا نرى إذا كانت تتراكم
    // buyVolume = 0; sellVolume = 0; 
}, 3000); // زدنا الوقت لـ 3 ثوانٍ لنرى تراكم البيانات

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر يعمل على المنفذ: ${PORT}`));
