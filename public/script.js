const socket = io();

socket.on('marketData', (data) => {
    document.getElementById('buy').innerText = data.buy;
    document.getElementById('sell').innerText = data.sell;
    const netEl = document.getElementById('net');
    netEl.innerText = data.net;
    netEl.style.color = data.net >= 0 ? '#00ff00' : '#ff4444';
});
