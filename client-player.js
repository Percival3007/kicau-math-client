// KICAU MATH - PLAYER MODE (Proporsional PC & Android)

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const questionText = document.getElementById('questionText');
const answerInput = document.getElementById('answerInput');
const submitBtn = document.getElementById('submitBtn');
const playerStatus = document.getElementById('playerStatus');
const lobbyInfo = document.getElementById('lobbyInfo');

let socket = null;
let localPlayer = null;
let otherPlayers = {};
let gameStarted = false;
let currentQuestion = null;
let winner = null;
let animationId = null;
let isWaitingForResponse = false;
let playerName = '';
let imagesLoaded = false;
let lobbyImageLoaded = false;

// Konfigurasi game (ukuran logis tetap 1024x576)
const TRACK_LENGTH = 7450;
const FINISH_LINE_X = 7450;
const START_X = 50;
const LOGIC_WIDTH = 1024;
const LOGIC_HEIGHT = 576;
const MAX_SPEED = 200;
const MIN_SPEED = 50;

let cameraX = 0;
let targetCameraX = 0;
let raceStartTime = 0;
let playerAnswers = 0;
let currentFrame = 0;
let lastFrameChange = 0;
let leaderboardData = [];
let lastServerSend = 0;

const BIRD_Y_POSITIONS = {
    1: 40, 2: 85, 3: 130, 4: 175, 5: 220,
    6: 265, 7: 310, 8: 355, 9: 400, 10: 445
};

const playerColors = {
    1: '#FF4444', 2: '#44FF44', 3: '#FFAA44', 4: '#4444FF', 5: '#FF44FF',
    6: '#44FFFF', 7: '#FF8844', 8: '#88FF44', 9: '#333333', 10: '#CCCCCC'
};

// Load gambar
const images = { 
    sky: new Image(),
    lobby: new Image()
};
const birdNames = ['red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'orange', 'lime', 'black', 'white'];

birdNames.forEach(name => {
    images[`bird_${name}_frame1`] = new Image();
    images[`bird_${name}_frame2`] = new Image();
});

let loadedCount = 0;
const totalImages = 2 + (birdNames.length * 2);

function allImagesLoaded() {
    loadedCount++;
    if (loadedCount === totalImages) {
        imagesLoaded = true;
        console.log('✅ Semua gambar siap!');
        drawLobbyScreen();
        showNameInput();
    }
}

birdNames.forEach(name => {
    images[`bird_${name}_frame1`].src = `images/bird_${name}_frame1.png`;
    images[`bird_${name}_frame2`].src = `images/bird_${name}_frame2.png`;
    images[`bird_${name}_frame1`].onload = allImagesLoaded;
    images[`bird_${name}_frame2`].onload = allImagesLoaded;
    images[`bird_${name}_frame1`].onerror = () => allImagesLoaded();
    images[`bird_${name}_frame2`].onerror = () => allImagesLoaded();
});

images.sky.src = 'images/sky.png';
images.lobby.src = 'images/lobby.png';
images.sky.onload = allImagesLoaded;
images.lobby.onload = () => { lobbyImageLoaded = true; allImagesLoaded(); };
images.lobby.onerror = () => allImagesLoaded();

function getBirdImage(birdIndex) {
    const name = birdNames[birdIndex - 1] || 'red';
    const frame = currentFrame === 0 ? 'frame1' : 'frame2';
    return images[`bird_${name}_${frame}`];
}

function drawLobbyScreen() {
    ctx.clearRect(0, 0, LOGIC_WIDTH, LOGIC_HEIGHT);
    if (lobbyImageLoaded && images.lobby.complete && images.lobby.naturalWidth > 0) {
        ctx.drawImage(images.lobby, 0, 0, LOGIC_WIDTH, LOGIC_HEIGHT);
    } else {
        const grad = ctx.createLinearGradient(0, 0, 0, LOGIC_HEIGHT);
        grad.addColorStop(0, '#1a5a8a');
        grad.addColorStop(0.5, '#3a8aca');
        grad.addColorStop(1, '#87CEEB');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, LOGIC_WIDTH, LOGIC_HEIGHT);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 30px "Comic Sans MS", cursive';
        ctx.fillText('🐦 KICAU MATH 🐦', LOGIC_WIDTH/2 - 150, LOGIC_HEIGHT/2);
        ctx.font = '16px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('Menunggu spectator memulai game...', LOGIC_WIDTH/2 - 160, LOGIC_HEIGHT/2 + 50);
    }
}

function drawGameBackground() {
    if (images.sky.complete && images.sky.naturalWidth > 0) {
        const w = images.sky.naturalWidth;
        const start = Math.floor(cameraX / w) * w;
        for (let x = start - w; x < start + LOGIC_WIDTH + w; x += w) {
            ctx.drawImage(images.sky, x - cameraX, 0, w, LOGIC_HEIGHT);
        }
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, LOGIC_WIDTH, LOGIC_HEIGHT);
    }
}

function drawFinishLine() {
    const fx = FINISH_LINE_X - cameraX;
    if (fx > -50 && fx < LOGIC_WIDTH + 50) {
        ctx.fillStyle = 'red';
        ctx.fillRect(fx - 8, 40, 12, LOGIC_HEIGHT - 80);
        for (let i = 0; i < 8; i++) {
            const y = 45 + (i * 30);
            ctx.fillStyle = (i % 2 === 0) ? 'white' : 'black';
            ctx.fillRect(fx - 8, y, 12, 15);
        }
        ctx.fillStyle = 'white';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('🏁', fx - 20, 70);
        ctx.fillText('🏁', fx - 20, 200);
        ctx.fillText('🏁', fx - 20, 330);
        ctx.fillText('🏁', fx - 20, 460);
        ctx.fillStyle = 'gold';
        ctx.font = 'bold 18px Arial';
        ctx.fillText('FINISH', fx - 55, 35);
    }
}

function drawBird(x, y, birdIndex, isLocal, speed, name) {
    const img = getBirdImage(birdIndex);
    const size = 40;
    const screenX = x - cameraX;
    
    if (screenX + size/2 < -80 || screenX - size/2 > LOGIC_WIDTH + 80) return;
    
    if (img && img.complete && img.naturalWidth > 0) {
        if (isLocal && gameStarted && !winner) {
            const bobY = Math.sin(Date.now() * 0.008) * 2;
            ctx.drawImage(img, screenX - size/2, y - size/2 + bobY, size, size);
            
            if (speed > 100) {
                ctx.globalAlpha = 0.3;
                for (let i = 1; i <= 2; i++) {
                    ctx.drawImage(img, screenX - size/2 - (i * 6), y - size/2 + bobY, size, size);
                }
                ctx.globalAlpha = 1;
            }
            
            ctx.shadowBlur = 8;
            ctx.shadowColor = 'gold';
            ctx.drawImage(img, screenX - size/2, y - size/2 + bobY, size, size);
            ctx.shadowBlur = 0;
        } else {
            ctx.drawImage(img, screenX - size/2, y - size/2, size, size);
        }
    } else {
        ctx.fillStyle = playerColors[birdIndex] || '#FF4444';
        ctx.beginPath();
        ctx.ellipse(screenX, y, 15, 12, 0, 0, Math.PI*2);
        ctx.fill();
    }
    
    ctx.fillStyle = '#2c3e2f';
    ctx.font = isLocal ? 'bold 10px Arial' : '9px Arial';
    ctx.fillText(name.length > 10 ? name.substring(0, 8) + '..' : name, screenX - 18, y - 25);
    
    if (isLocal && gameStarted && !winner && speed) {
        ctx.fillStyle = '#FFD700';
        ctx.font = 'bold 9px Arial';
        ctx.fillText('⚡' + Math.floor(speed), screenX - 10, y + 28);
    }
}

function drawLeaderboard() {
    if (!gameStarted) return;
    const lbX = LOGIC_WIDTH - 180;
    const lbY = 8;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(lbX, lbY, 170, 200);
    ctx.strokeStyle = '#FFD700';
    ctx.strokeRect(lbX, lbY, 170, 200);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 10px Arial';
    ctx.fillText('🏆 LEADERBOARD', lbX + 35, lbY + 16);
    
    leaderboardData.slice(0, 10).forEach((p, i) => {
        const y = lbY + 30 + i * 17;
        let rankColor = '#FFFFFF';
        if (p.rank === 1) rankColor = '#FFD700';
        else if (p.rank === 2) rankColor = '#C0C0C0';
        else if (p.rank === 3) rankColor = '#CD7F32';
        ctx.fillStyle = rankColor;
        ctx.font = p.isMe ? 'bold 9px monospace' : '9px monospace';
        ctx.fillText(`${p.rank}. ${p.name.substring(0, 8)}`, lbX + 5, y);
        ctx.fillStyle = '#4CAF50';
        ctx.fillText(`${Math.floor(p.speed)}`, lbX + 135, y);
    });
}

function drawProgress() {
    if (!localPlayer || !gameStarted) return;
    const progress = Math.min(1, Math.max(0, (localPlayer.x - START_X) / (FINISH_LINE_X - START_X)));
    const bw = 160, bh = 12;
    const bx = LOGIC_WIDTH - bw - 15;
    const by = 220;
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(bx, by, bw, bh);
    ctx.fillStyle = '#4CAF50';
    ctx.fillRect(bx, by, bw * progress, bh);
    ctx.fillStyle = 'white';
    ctx.font = '9px Arial';
    ctx.fillText(Math.floor(progress * 100) + '%', bx + bw/2 - 15, by + 10);
}

function drawTimer() {
    if (!gameStarted || winner) return;
    const elapsed = (Date.now() - raceStartTime) / 1000;
    const m = Math.floor(elapsed / 60);
    const s = Math.floor(elapsed % 60);
    const timeStr = (m > 0 ? m + ':' + (s < 10 ? '0' : '') : '') + s + 's';
    
    const baseX = LOGIC_WIDTH - 180;
    const baseY = 242;
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(baseX, baseY, 170, 24);
    ctx.fillStyle = 'white';
    ctx.font = 'bold 12px monospace';
    ctx.fillText('⏱️ ' + timeStr, baseX + 8, baseY + 17);
}

function drawAnswers() {
    if (!gameStarted) return;
    
    const baseX = LOGIC_WIDTH - 180;
    const baseY = 272;
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(baseX, baseY, 170, 24);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('✅ Jawaban: ' + playerAnswers, baseX + 8, baseY + 17);
}

function drawSpeedInfo() {
    if (!gameStarted || !localPlayer) return;
    
    const baseX = LOGIC_WIDTH - 180;
    const baseY = 302;
    
    ctx.fillStyle = 'rgba(0,0,0,0.7)';
    ctx.fillRect(baseX, baseY, 170, 24);
    ctx.fillStyle = '#FFD700';
    ctx.font = 'bold 11px Arial';
    ctx.fillText('⚡ Kecepatan: ' + Math.floor(localPlayer.speed), baseX + 8, baseY + 17);
}

function updateLeaderboard() {
    const allPlayers = [];
    if (localPlayer) allPlayers.push({ ...localPlayer, isMe: true });
    for (let id in otherPlayers) {
        if (otherPlayers[id] && otherPlayers[id].x !== undefined) {
            allPlayers.push({ ...otherPlayers[id], isMe: false });
        }
    }
    allPlayers.sort((a, b) => (b.x || 0) - (a.x || 0));
    leaderboardData = allPlayers.map((p, idx) => ({
        rank: idx + 1, name: p.name, speed: p.speed || MIN_SPEED, isMe: p.isMe
    }));
}

function updateCamera() {
    if (!gameStarted || !localPlayer) return;
    let target = localPlayer.x - LOGIC_WIDTH / 3.5;
    target = Math.max(0, Math.min(target, TRACK_LENGTH - LOGIC_WIDTH));
    targetCameraX = target;
    cameraX = cameraX + (targetCameraX - cameraX) * 0.06;
}

function sendAnswer() {
    if (!gameStarted || !currentQuestion || winner || isWaitingForResponse) return;
    const answer = parseInt(answerInput.value);
    if (!isNaN(answer)) {
        isWaitingForResponse = true;
        socket.emit('player-answer', answer);
        answerInput.value = '';
        answerInput.disabled = true;
        submitBtn.disabled = true;
        setTimeout(() => {
            if (gameStarted) {
                answerInput.disabled = false;
                submitBtn.disabled = false;
                isWaitingForResponse = false;
                answerInput.focus();
            }
        }, 1000);
    }
}

function showNameInput() {
    lobbyInfo.innerHTML = '<div style="background:#2c3e2f;padding:12px;border-radius:10px;"><p>🐦 Masukkan nama:</p><input type="text" id="nameInput" placeholder="Nama" style="padding:6px;margin-right:8px;"><button id="joinBtn" style="padding:6px 12px;background:green;color:white;border:none;border-radius:5px;">🚀 Gabung</button></div>';
    document.getElementById('joinBtn').addEventListener('click', () => {
        playerName = document.getElementById('nameInput').value.trim();
        if (!playerName) playerName = 'Pemain' + Math.floor(Math.random() * 100);
        lobbyInfo.innerHTML = '<p>⏳ Menghubung...</p>';
        connectToServer();
    });
}

function connectToServer() {
    socket = io('https://kicau-math.onrender.com');
    
    socket.on('connect', () => {
        socket.emit('join-as-player', playerName, (res) => {
            if (res.success) {
                localPlayer = res.playerData;
                lobbyInfo.innerHTML = `<p>👤 ${localPlayer.name} bergabung! Menunggu spectator...</p>`;
            } else {
                alert(res.message);
                showNameInput();
            }
        });
    });
    
    socket.on('players-update', (data) => {
        if (!gameStarted && data.players) {
            let html = '<h4>🐦 Pemain:</h4>';
            data.players.forEach(p => {
                html += `<div style="font-size:10px;margin:2px 0;">${p.id === socket.id ? '👉' : '🐦'} ${p.name}</div>`;
            });
            for (let i = data.players.length; i < 10; i++) {
                html += `<div style="opacity:0.5;font-size:10px;">⬜ Slot kosong (${i+1})</div>`;
            }
            playerStatus.innerHTML = html;
            lobbyInfo.innerHTML = `<p>👥 ${data.players.length}/10 pemain.</p>`;
        }
    });
    
    socket.on('countdown', (data) => {
        lobbyInfo.innerHTML = `<p style="background:orange;color:black;padding:4px;">⏰ ${data.seconds} detik...</p>`;
    });
    
    socket.on('game-start', (data) => {
        gameStarted = true;
        winner = null;
        raceStartTime = Date.now();
        playerAnswers = 0;
        cameraX = 0;
        targetCameraX = 0;
        currentFrame = 0;
        
        data.players.forEach(p => {
            if (p.id === socket.id) {
                localPlayer = p;
            } else {
                otherPlayers[p.id] = { ...p, targetX: p.x };
            }
        });
        
        socket.emit('request-question');
        answerInput.disabled = false;
        submitBtn.disabled = false;
        answerInput.focus();
        lobbyInfo.innerHTML = '<p style="background:green;color:yellow;padding:4px;">🏁 RACE START! 🏁</p>';
        
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
    });
    
    socket.on('new-question', (q) => {
        currentQuestion = q;
        questionText.innerText = q.text;
        answerInput.disabled = false;
        submitBtn.disabled = false;
        answerInput.focus();
        isWaitingForResponse = false;
    });
    
    socket.on('answer-result', (data) => {
        if (data.correct) {
            questionText.style.color = 'green';
            if (localPlayer) {
                localPlayer.speed = data.newSpeed;
                playerAnswers++;
            }
            setTimeout(() => questionText.style.color = '#2c3e2f', 500);
        } else {
            questionText.style.color = 'red';
            if (localPlayer) localPlayer.speed = data.newSpeed;
            setTimeout(() => questionText.style.color = '#2c3e2f', 500);
        }
    });
    
    socket.on('speed-decay', (data) => {
        if (localPlayer) {
            localPlayer.speed = data.newSpeed;
            questionText.style.color = 'orange';
            setTimeout(() => questionText.style.color = '#2c3e2f', 500);
        }
    });
    
    socket.on('game-state', (data) => {
        if (gameStarted && !winner && data.players) {
            data.players.forEach(p => {
                if (p.id === socket.id && localPlayer) {
                    localPlayer.x = p.x;
                    localPlayer.speed = p.speed;
                } else if (otherPlayers[p.id]) {
                    otherPlayers[p.id].targetX = p.x;
                    otherPlayers[p.id].x = otherPlayers[p.id].x || p.x;
                    otherPlayers[p.id].speed = p.speed;
                }
            });
            updateLeaderboard();
        }
    });
    
    socket.on('game-end', (data) => {
        gameStarted = false;
        winner = data.winner;
        const t = (Date.now() - raceStartTime) / 1000;
        lobbyInfo.innerHTML = `<p style="background:gold;color:black;padding:8px;">🏆 ${data.winner} MENANG! 🏆<br>⏱️ ${Math.floor(t/60)}m ${Math.floor(t%60)}s | ✅ ${playerAnswers}</p>`;
        answerInput.disabled = true;
        submitBtn.disabled = true;
        drawLobbyScreen();
    });
    
    socket.on('leaderboard-update', (data) => {
        leaderboardData = data.leaderboard.map(p => ({ ...p, isMe: p.name === localPlayer?.name }));
    });
}

let lastFrameTime = 0;

function gameLoop(currentTime) {
    currentTime = currentTime || 0;
    
    if (!imagesLoaded) {
        drawLobbyScreen();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    if (!gameStarted) {
        drawLobbyScreen();
        requestAnimationFrame(gameLoop);
        return;
    }
    
    let deltaTime = Math.min(0.033, (currentTime - lastFrameTime) / 1000);
    lastFrameTime = currentTime;
    
    if (localPlayer && !winner) {
        localPlayer.x += localPlayer.speed * deltaTime;
        if (localPlayer.x > FINISH_LINE_X) localPlayer.x = FINISH_LINE_X;
        
        if (currentTime - lastServerSend > 100) {
            socket.emit('position-update', { x: localPlayer.x });
            lastServerSend = currentTime;
        }
    }
    
    for (let id in otherPlayers) {
        const p = otherPlayers[id];
        if (p && p.targetX !== undefined) {
            p.x = (p.x || p.targetX) + (p.targetX - (p.x || p.targetX)) * 0.3;
        }
    }
    
    const now = Date.now();
    let frameInterval = 150;
    if (localPlayer && localPlayer.speed) {
        frameInterval = Math.max(60, 200 - Math.floor(localPlayer.speed / 1.5));
    }
    if (now - lastFrameChange > frameInterval) {
        currentFrame = 1 - currentFrame;
        lastFrameChange = now;
    }
    
    updateCamera();
    
    drawGameBackground();
    drawFinishLine();
    
    for (let id in otherPlayers) {
        const p = otherPlayers[id];
        if (p && p.x) {
            const y = BIRD_Y_POSITIONS[p.birdIndex] || 220;
            drawBird(p.x, y, p.birdIndex, false, p.speed, p.name);
        }
    }
    
    if (localPlayer && gameStarted) {
        const y = BIRD_Y_POSITIONS[localPlayer.birdIndex] || 220;
        drawBird(localPlayer.x, y, localPlayer.birdIndex, true, localPlayer.speed, localPlayer.name);
    }
    
    drawLeaderboard();
    drawProgress();
    drawTimer();
    drawAnswers();
    drawSpeedInfo();
    
    if (winner && !gameStarted) {
        ctx.font = 'bold 28px Arial';
        ctx.fillStyle = 'gold';
        ctx.fillText('🏆 ' + winner + ' MENANG! 🏆', LOGIC_WIDTH/2 - 140, 60);
    }
    
    requestAnimationFrame(gameLoop);
}

answerInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        e.preventDefault();
        sendAnswer();
    }
});
submitBtn.addEventListener('click', () => {
    sendAnswer();
});

function start() {
    if (imagesLoaded) {
        console.log('🚀 PLAYER MODE READY - Proporsional PC & Android');
        drawLobbyScreen();
    } else {
        setTimeout(start, 200);
    }
}

start();