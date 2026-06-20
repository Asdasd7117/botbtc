const socket = io();

socket.on('marketData', (data) => {
    // تحديث السعر
    if (data.price) {
        document.getElementById('price').innerText = parseFloat(data.price).toLocaleString();
    }

    // تحديث السيولة
    document.getElementById('buy').innerText = parseFloat(data.buy).toFixed(6);
    document.getElementById('sell').innerText = parseFloat(data.sell).toFixed(6);
    
    // تحديث الصافي
    const netEl = document.getElementById('net');
    const netVal = parseFloat(data.net);
    netEl.innerText = netVal.toFixed(6);
    netEl.style.color = netVal >= 0 ? '#00ff00' : '#ff4444';
});
