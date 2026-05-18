// KICAU MATH - SPECTATOR MODE (Track 7.450px)

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const leaderboardList = document.getElementById('leaderboardList');
const startGameBtn = document.getElementById('startGameBtn');
const playerCountSpan = document.getElementById('playerCount');
const winnerInfo = document.getElementById('winnerInfo');

let socket = null;
let players = {};
let gameStarted = false;
let winner = null;
let animationId = null;
let cameraX = 0;
let spectatorName = '';
let canStart = false;
let lobbyImageLoaded = false;

// KONFIGURASI TRACK (7.450px)
const TRACK_LENGTH = 7450;
const FINISH_LINE_X = 7450;
const START_X = 50;
const CANVAS_WIDTH = 1024;
const CANVAS_HEIGHT = 576;

const BIRD_Y_POSITIONS = {
    1: 40, 2: 85, 3: 130, 4: 175, 5: 220,
    6: 265, 7: 310, 8: 355, 9: 400, 10: 445
};

const playerColors = {
    1: '#FF4444', 2: '#44FF44', 3: '#FFAA44', 4: '#4444FF', 5: '#FF44FF',
    6: '#44FFFF', 7: '#FF8844', 8: '#88FF44', 9: '#FF4488', 10: '#44FF88'
};

let imagesLoaded = false;
const images = { 
    sky: new Image(),
    lobby: new Image()
};
const birdNames = ['red', 'green', 'yellow', 'blue', 'purple', 'cyan', 'orange', 'lime', 'pink', 'mint'];

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
        console.log('Semua gambar siap! Spectator Mode');
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

let currentFrame = 0;
let lastFrameChange = 0;

function getBirdImage(birdIndex) {
    const name = birdNames[birdIndex - 1] || 'red';
    const frame = currentFrame === 0 ? 'frame1' : 'frame2';
    return images[`bird_${name}_${frame}`];
}

function drawLobbyScreen() {
    if (lobbyImageLoaded && images.lobby.complete && images.lobby.naturalWidth > 0) {
        ctx.drawImage(images.lobby, 0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    } else {
        const grad = ctx.createLinearGradient(0, 0, 0, CANVAS_HEIGHT);
        grad.addColorStop(0, '#1a5a8a');
        grad.addColorStop(0.5, '#3a8aca');
        grad.addColorStop(1, '#87CEEB');
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 36px "Comic Sans MS", cursive';
        ctx.fillText('🐦 KICAU MATH 🐦', CANVAS_WIDTH/2 - 180, CANVAS_HEIGHT/2);
        ctx.font = '22px "Comic Sans MS", cursive';
        ctx.fillText('Mode PENGAWAS / SPECTATOR', CANVAS_WIDTH/2 - 170, CANVAS_HEIGHT/2 + 50);
        ctx.font = '18px Arial';
        ctx.fillStyle = '#FFD700';
        ctx.fillText('Tekan START GAME untuk memulai balapan!', CANVAS_WIDTH/2 - 190, CANVAS_HEIGHT/2 + 100);
        
        const playerCount = Object.keys(players).length;
        if (playerCount < 2 && !gameStarted) {
            ctx.fillStyle = 'rgba(0,0,0,0.6)';
            ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
            ctx.fillStyle = 'white';
            ctx.font = '20px Arial';
            ctx.fillText(`Minimal 2 pemain untuk memulai game`, CANVAS_WIDTH/2 - 200, CANVAS_HEIGHT/2);
            ctx.fillText(`Saat ini: ${playerCount} pemain`, CANVAS_WIDTH/2 - 100, CANVAS_HEIGHT/2 + 40);
        }
    }
}

function drawGameBackground() {
    if (images.sky.complete && images.sky.naturalWidth > 0) {
        const w = images.sky.naturalWidth;
        const start = Math.floor(cameraX / w) * w;
        for (let x = start - w; x < start + CANVAS_WIDTH + w; x += w) {
            ctx.drawImage(images.sky, x - cameraX, 0, w, CANVAS_HEIGHT);
        }
    } else {
        ctx.fillStyle = '#87CEEB';
        ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
    }
}

function drawFinishLine() {
    const fx = FINISH_LINE_X - cameraX;
    if (fx > -50 && fx < CANVAS_WIDTH + 50) {
        ctx.fillStyle = 'red';
        ctx.fillRect(fx - 8, 40, 12, CANVAS_HEIGHT - 80);
        for (let i = 0; i < 8; i++) {
            const y = 45 + (i * 30);
            ctx.fillStyle = (i % 2 === 0) ? 'white' : 'black';
            ctx.fillRect(fx - 8, y, 12, 15);
        }
        ctx.fillStyle = 'white';
        ctx.font = 'bold 28px Arial';
        ctx.fillText('🏁', fx - 25, 75);
        ctx.fillText('🏁', fx - 25, 210);
        ctx.fillText('🏁', fx - 25, 345);
        ctx.fillText('🏁', fx - 25, 480);
        ctx.fillStyle = 'gold';
        ctx.font = 'bold 22px Arial';
        ctx.fillText('FINISH', fx - 65, 40);
    }
}

function drawBird(x, y, birdIndex, name) {
    const img = getBirdImage(birdIndex);
    const size = 45;
    const screenX = x - cameraX;
    if (screenX + size/2 < -100 || screenX - size/2 > CANVAS_WIDTH + 100) return;
    
    if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, screenX - size/2, y - size/2, size, size);
    } else {
        ctx.fillStyle = playerColors[birdIndex] || '#FF4444';
        ctx.beginPath();
        ctx.ellipse(screenX, y, 18, 14, 0, 0, Math.PI*2);
        ctx.fill();
    }
    
    ctx.fillStyle = '#2c3e2f';
    ctx.font = '10px Arial';
    ctx.fillText(name.length > 12 ? name.substring(0, 10) + '..' : name, screenX - 25, y - 28);
}

function updateCameraForSpectator() {
    if (!gameStarted) return;
    const playersArray = Object.values(players);
    if (playersArray.length === 0) return;
    const leader = playersArray.reduce((max, p) => (p.x > max.x) ? p : max, playersArray[0]);
    if (leader) {
        let target = leader.x - CANVAS_WIDTH / 3;
        target = Math.max(0, Math.min(target, TRACK_LENGTH - CANVAS_WIDTH));
        cameraX = cameraX + (target - cameraX) * 0.08;
    }
}

function updateLeaderboardDisplay(leaderboard, winnerName) {
    if (!leaderboard || leaderboard.length === 0) {
        leaderboardList.innerHTML = '<div style="text-align:center;color:#aaa;">Belum ada data...</div>';
        return;
    }
    
    let html = '';
    leaderboard.forEach(p => {
        let rankClass = '';
        if (p.rank === 1) rankClass = 'rank-1';
        else if (p.rank === 2) rankClass = 'rank-2';
        else if (p.rank === 3) rankClass = 'rank-3';
        html += `<div class="leaderboard-item">
            <span class="${rankClass}">${p.rank}. ${p.name.substring(0, 15)}</span>
            <span style="color:#4CAF50;">⚡${Math.floor(p.speed)}</span>
            <span style="color:#FFD700;">${p.distance}m</span>
        </div>`;
    });
    leaderboardList.innerHTML = html;
    
    if (winnerName) {
        winnerInfo.style.display = 'block';
        winnerInfo.innerHTML = `🏆 WINNER: ${winnerName} 🏆`;
    }
}

function showNameInput() {
    const container = document.querySelector('.spectator-bar');
    const inputDiv = document.createElement('div');
    inputDiv.id = 'spectatorJoin';
    inputDiv.innerHTML = '<input type="text" id="spectatorName" placeholder="Nama Pengawas" style="padding:5px;margin-right:5px;"><button id="joinSpectatorBtn" style="padding:5px 10px;background:#8B00FF;color:white;border:none;border-radius:5px;">👁️ Gabung sebagai Pengawas</button>';
    container.appendChild(inputDiv);
    
    document.getElementById('joinSpectatorBtn').onclick = () => {
        spectatorName = document.getElementById('spectatorName').value.trim() || 'Pengawas';
        inputDiv.remove();
        connectToServer();
    };
}

function connectToServer() {
    socket = io('http://localhost:3000');
    
    socket.on('connect', () => {
        socket.emit('join-as-spectator', spectatorName, (res) => {
            if (res.success) {
                console.log('Bergabung sebagai spectator');
            } else {
                alert(res.message);
            }
        });
    });
    
    socket.on('can-start-game', (data) => {
        if (data.canStart && data.playerCount >= 2) {
            canStart = true;
            startGameBtn.disabled = false;
            startGameBtn.textContent = `🎮 START GAME (${data.playerCount} pemain)`;
        } else {
            canStart = false;
            startGameBtn.disabled = true;
            startGameBtn.textContent = '🎮 START GAME (tunggu minimal 2 pemain)';
        }
    });
    
    socket.on('players-update', (data) => {
        if (data.players) {
            data.players.forEach(p => { players[p.id] = p; });
            playerCountSpan.textContent = `👥 ${data.players.length}/10 pemain`;
            
            if (!gameStarted && data.players.length >= 2) {
                canStart = true;
                startGameBtn.disabled = false;
                startGameBtn.textContent = `🎮 START GAME (${data.players.length} pemain)`;
            } else if (!gameStarted && data.players.length < 2) {
                canStart = false;
                startGameBtn.disabled = true;
                startGameBtn.textContent = '🎮 START GAME (tunggu minimal 2 pemain)';
            }
            drawLobbyScreen();
        }
    });
    
    socket.on('countdown', (data) => {
        startGameBtn.disabled = true;
        startGameBtn.textContent = `⏰ ${data.message} ${data.seconds}...`;
        setTimeout(() => {
            if (!gameStarted) {
                startGameBtn.textContent = '🎮 START GAME';
                startGameBtn.disabled = canStart ? false : true;
            }
        }, 3000);
    });
    
    socket.on('game-start', () => {
        gameStarted = true;
        winner = null;
        cameraX = 0;
        startGameBtn.disabled = true;
        startGameBtn.textContent = '🏁 GAME BERJALAN';
        winnerInfo.style.display = 'none';
        if (animationId) cancelAnimationFrame(animationId);
        gameLoop();
    });
    
    socket.on('game-state', (data) => {
        if (data.players) {
            data.players.forEach(p => { players[p.id] = p; });
        }
    });
    
    socket.on('leaderboard-update', (data) => {
        updateLeaderboardDisplay(data.leaderboard, data.winner);
        if (data.winner) winner = data.winner;
    });
    
    socket.on('game-end', (data) => {
        gameStarted = false;
        winner = data.winner;
        startGameBtn.disabled = true;
        startGameBtn.textContent = '🏁 GAME SELESAI';
        drawLobbyScreen();
    });
    
    socket.on('start-error', (data) => {
        alert(data.message);
        startGameBtn.disabled = false;
        startGameBtn.textContent = `🎮 START GAME (${Object.keys(players).length} pemain)`;
    });
    
    startGameBtn.onclick = () => {
        if (canStart && !gameStarted) {
            socket.emit('spectator-start-game');
            startGameBtn.disabled = true;
            startGameBtn.textContent = '⏳ Memulai game...';
        } else {
            alert('Belum bisa memulai game. Minimal 2 pemain!');
        }
    };
}

function gameLoop(time) {
    time = time || 0;
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
    
    const now = Date.now();
    if (now - lastFrameChange > 100) {
        currentFrame = 1 - currentFrame;
        lastFrameChange = now;
    }
    
    updateCameraForSpectator();
    drawGameBackground();
    drawFinishLine();
    
    const playersArray = Object.values(players);
    playersArray.forEach(p => {
        if (p.x) drawBird(p.x, BIRD_Y_POSITIONS[p.birdIndex] || 220, p.birdIndex, p.name);
    });
    
    if (winner && !gameStarted) {
        ctx.font = 'bold 36px Arial';
        ctx.fillStyle = 'gold';
        ctx.fillText('🏆 ' + winner + ' MENANG! 🏆', CANVAS_WIDTH/2 - 160, 70);
    }
    
    requestAnimationFrame(gameLoop);
}

function start() {
    if (imagesLoaded) {
        console.log('🚀 SPECTATOR MODE READY - Track 7.450px');
        drawLobbyScreen();
    } else {
        setTimeout(start, 200);
    }
}
start();