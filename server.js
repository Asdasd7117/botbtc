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
            console.log('✅ تم الاتصال!');
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
                if (msg.topic === '/market/match:BTC-USDT' && msg.data) {
                    const size = parseFloat(msg.data.size);
                    const side = msg.data.side;
                    
                    // فلتر صغير جداً لنضمن ظهور أي حركة
                    if (size >= 0.000001) { 
                        if (side === 'buy') buyVolume += size;
                        else if (side === 'sell') sellVolume += size;
                    }
                }
            } catch (e) {}
        });

        ws.on('close', () => setTimeout(connectToKuCoin, 5000));
        ws.on('error', () => setTimeout(connectToKuCoin, 5000));
    } catch (error) { setTimeout(connectToKuCoin, 5000); }
}

connectToKuCoin();

setInterval(() => {
    io.emit('marketData', {
        buy: buyVolume,
        sell: sellVolume,
        net: (buyVolume - sellVolume)
    });
    // لا تصفر القيم إذا أردت رؤية تراكمي، أو صفرها إذا أردت تدفق كل ثانية
    buyVolume = 0; 
    sellVolume = 0;
}, 1000);

const PORT = process.env.PORT || 3000;
server.listen(PORT);
