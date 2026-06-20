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
        const response = await axios.post('https://api.kucoin.com/api/v1/bullet-public');
        const { token, instanceServers } = response.data.data;
        const endpoint = `${instanceServers[0].endpoint}?token=${token}`;

        const ws = new WebSocket(endpoint);

        ws.on('open', () => {
            console.log('✅ تم الاتصال بـ KuCoin بنجاح');
            // التعديل هنا: استخدمنا /market/match للحصول على الصفقات الحقيقية
            ws.send(JSON.stringify({
                "id": Date.now(),
                "type": "subscribe",
                "topic": "/market/match:BTC-USDT", 
                "response": true
            }));
        });

        ws.on('message', (data) => {
            const msg = JSON.parse(data);
            // التأكد من أن الرسالة هي صفقة (match)
            if (msg.topic === '/market/match:BTC-USDT' && msg.data) {
                const size = parseFloat(msg.data.size);
                const side = msg.data.side; // 'buy' أو 'sell'

                // فلتر الحيتان: إذا كانت الصفقة أكبر من 0.1 BTC
                if (size >= 0.1) {
                    if (side === 'buy') {
                        buyVolume += size;
                    } else if (side === 'sell') {
                        sellVolume += size;
                    }
                }
            }
        });

        ws.on('close', () => setTimeout(connectToKuCoin, 5000));
        ws.on('error', () => setTimeout(connectToKuCoin, 5000));

    } catch (error) {
        console.error("خطأ في الاتصال بـ KuCoin، سأحاول مجدداً بعد 5 ثوانٍ");
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
    buyVolume = 0;
    sellVolume = 0;
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`السيرفر يعمل على: ${PORT}`));
