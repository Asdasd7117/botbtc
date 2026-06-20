const socket = io();

socket.on('marketData', (data) => {
    // نستخدم parseFloat لضمان أننا نتعامل مع أرقام
    const buy = parseFloat(data.buy);
    const sell = parseFloat(data.sell);
    const net = parseFloat(data.net);

    document.getElementById('buy').innerText = buy.toFixed(6);
    document.getElementById('sell').innerText = sell.toFixed(6);
    
    const netEl = document.getElementById('net');
    netEl.innerText = net.toFixed(6);
    netEl.style.color = net >= 0 ? '#00ff00' : '#ff4444';
});
