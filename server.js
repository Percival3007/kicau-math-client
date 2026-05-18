// KICAU MATH SERVER - SISTEM KECEPATAN DINAMIS
const http = require('http');
const socketIo = require('socket.io');

const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end('<h1>Kicau Math Server Running</h1>');
});

const io = socketIo(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling']
});

let players = [];
let spectators = [];
let gameStarted = false;
let winner = null;
let gameInterval = null;
let speedDecayInterval = null;

const MAX_SPEED = 200;
const MIN_SPEED = 50;
const SPEED_BONUS = 8;
const SPEED_PENALTY = 2;
const SPEED_DECAY = 1;
const DECAY_INTERVAL = 2000; // 2 detik
const TRACK_LENGTH = 7450;    // PANJANG LINTASAN
const START_X = 50;
const FINISH_X = 7450;

const colors = [
    '#FF4444', '#44FF44', '#FFAA44', '#4444FF', '#FF44FF',
    '#44FFFF', '#FF8844', '#88FF44', '#FF4488', '#44FF88'
];

const BIRD_Y_POSITIONS = {
    1: 40, 2: 85, 3: 130, 4: 175, 5: 220,
    6: 265, 7: 310, 8: 355, 9: 400, 10: 445
};

// ========== 200 SOAL MATEMATIKA ==========
const allQuestions = [
    { text: "3 + 2 = ?", answer: 5 }, { text: "5 + 4 = ?", answer: 9 },
    { text: "7 + 1 = ?", answer: 8 }, { text: "2 + 6 = ?", answer: 8 },
    { text: "4 + 4 = ?", answer: 8 }, { text: "9 - 3 = ?", answer: 6 },
    { text: "8 - 2 = ?", answer: 6 }, { text: "10 - 4 = ?", answer: 6 },
    { text: "7 - 1 = ?", answer: 6 }, { text: "6 - 3 = ?", answer: 3 },
    { text: "11 + 3 = ?", answer: 14 }, { text: "12 + 5 = ?", answer: 17 },
    { text: "10 + 8 = ?", answer: 18 }, { text: "9 + 7 = ?", answer: 16 },
    { text: "13 + 4 = ?", answer: 17 }, { text: "15 - 3 = ?", answer: 12 },
    { text: "18 - 5 = ?", answer: 13 }, { text: "14 - 2 = ?", answer: 12 },
    { text: "16 - 4 = ?", answer: 12 }, { text: "19 - 7 = ?", answer: 12 },
    { text: "2 × 3 = ?", answer: 6 }, { text: "3 × 2 = ?", answer: 6 },
    { text: "4 × 2 = ?", answer: 8 }, { text: "5 × 2 = ?", answer: 10 },
    { text: "3 × 3 = ?", answer: 9 }, { text: "4 × 3 = ?", answer: 12 },
    { text: "6 ÷ 2 = ?", answer: 3 }, { text: "8 ÷ 2 = ?", answer: 4 },
    { text: "10 ÷ 2 = ?", answer: 5 }, { text: "12 ÷ 2 = ?", answer: 6 },
    { text: "25 + 15 = ?", answer: 40 }, { text: "30 + 20 = ?", answer: 50 },
    { text: "35 + 25 = ?", answer: 60 }, { text: "50 - 20 = ?", answer: 30 },
    { text: "60 - 30 = ?", answer: 30 }, { text: "28 + 32 = ?", answer: 60 },
    { text: "45 + 25 = ?", answer: 70 }, { text: "75 - 25 = ?", answer: 50 },
    { text: "85 - 35 = ?", answer: 50 }, { text: "22 + 33 = ?", answer: 55 },
    { text: "11 × 3 = ?", answer: 33 }, { text: "12 × 4 = ?", answer: 48 },
    { text: "13 × 3 = ?", answer: 39 }, { text: "88 ÷ 8 = ?", answer: 11 },
    { text: "99 ÷ 9 = ?", answer: 11 }, { text: "120 ÷ 10 = ?", answer: 12 },
    { text: "25 × 2 = ?", answer: 50 }, { text: "30 × 3 = ?", answer: 90 },
    { text: "250 ÷ 5 = ?", answer: 50 }, { text: "300 ÷ 6 = ?", answer: 50 },
    { text: "15 × 5 = ?", answer: 75 }, { text: "20 × 5 = ?", answer: 100 },
    { text: "500 ÷ 10 = ?", answer: 50 }, { text: "600 ÷ 12 = ?", answer: 50 },
    { text: "1000 ÷ 20 = ?", answer: 50 }, { text: "72 + 28 = ?", answer: 100 },
    { text: "100 - 45 = ?", answer: 55 }, { text: "7 × 9 = ?", answer: 63 },
    { text: "144 ÷ 12 = ?", answer: 12 }, { text: "63 + 28 = ?", answer: 91 }
];

let playerQuestionsMap = new Map();
let playerCurrentQuestion = new Map();

function getRandomQuestionForPlayer(playerId) {
    let usedQuestions = playerQuestionsMap.get(playerId) || [];
    let availableQuestions = allQuestions.filter((q, index) => !usedQuestions.includes(index));
    
    if (availableQuestions.length === 0) {
        usedQuestions = [];
        availableQuestions = [...allQuestions];
    }
    
    const randomIndex = Math.floor(Math.random() * availableQuestions.length);
    const selectedQuestion = availableQuestions[randomIndex];
    const originalIndex = allQuestions.findIndex(q => q.text === selectedQuestion.text && q.answer === selectedQuestion.answer);
    
    usedQuestions.push(originalIndex);
    playerQuestionsMap.set(playerId, usedQuestions);
    
    return { ...selectedQuestion };
}

function broadcastGameState() {
    io.emit('game-state', {
        players: players.map(p => ({
            id: p.id, name: p.name, x: p.x, speed: p.speed,
            birdIndex: p.birdIndex, color: p.color
        }))
    });
}

function broadcastLeaderboard() {
    const sortedPlayers = [...players].sort((a, b) => b.x - a.x);
    io.emit('leaderboard-update', {
        leaderboard: sortedPlayers.map((p, idx) => ({
            rank: idx + 1, name: p.name, speed: p.speed,
            distance: Math.max(0, Math.floor((FINISH_X - p.x) / 10)), color: p.color
        })),
        winner: winner
    });
}

function broadcastPlayersUpdate() {
    io.emit('players-update', {
        players: players.map(p => ({ id: p.id, name: p.name, birdIndex: p.birdIndex, color: p.color })),
        spectators: spectators.map(s => ({ id: s.id, name: s.name }))
    });
}

function startSpeedDecay() {
    if (speedDecayInterval) clearInterval(speedDecayInterval);
    
    speedDecayInterval = setInterval(() => {
        if (!gameStarted || winner) return;
        
        let anyChange = false;
        players.forEach(player => {
            if (player.speed > MIN_SPEED) {
                const oldSpeed = player.speed;
                player.speed = Math.max(MIN_SPEED, player.speed - SPEED_DECAY);
                if (oldSpeed !== player.speed) {
                    anyChange = true;
                    console.log(`📉 ${player.name} kecepatan berkurang -${SPEED_DECAY} (${oldSpeed} → ${player.speed})`);
                    io.to(player.id).emit('speed-decay', { 
                        newSpeed: player.speed,
                        message: `⚠️ Kecepatan berkurang -${SPEED_DECAY}! Jawab soal!`
                    });
                }
            }
        });
        
        if (anyChange) {
            broadcastGameState();
            broadcastLeaderboard();
        }
    }, DECAY_INTERVAL);
}

io.on('connection', (socket) => {
    console.log('✅ Pemain terhubung:', socket.id);
    
    socket.on('join-as-player', (playerName, callback) => {
        if (gameStarted) {
            callback({ success: false, message: 'Game sudah dimulai!' });
            return;
        }
        
        if (players.length >= 10) {
            callback({ success: false, message: 'Lobby pemain penuh (10/10)!' });
            return;
        }
        
        const player = {
            id: socket.id,
            name: playerName || 'Pemain ' + (players.length + 1),
            birdIndex: players.length + 1,
            x: START_X,
            speed: MIN_SPEED,
            color: colors[players.length % colors.length]
        };
        
        players.push(player);
        playerQuestionsMap.set(socket.id, []);
        
        console.log(`👤 PLAYER ${player.name} bergabung. Total: ${players.length}/10`);
        
        callback({ 
            success: true, 
            role: 'player',
            playerData: player,
            players: players.map(p => ({ id: p.id, name: p.name, birdIndex: p.birdIndex, color: p.color })),
            totalNeeded: 10,
            currentCount: players.length
        });
        
        broadcastPlayersUpdate();
    });
    
    socket.on('join-as-spectator', (spectatorName, callback) => {
        if (gameStarted) {
            callback({ success: false, message: 'Game sudah dimulai!' });
            return;
        }
        
        const spectator = {
            id: socket.id,
            name: spectatorName || 'Penonton ' + (spectators.length + 1)
        };
        
        spectators.push(spectator);
        console.log(`👁️ SPECTATOR ${spectator.name} bergabung. Total penonton: ${spectators.length}`);
        
        callback({ 
            success: true, 
            role: 'spectator',
            players: players.map(p => ({ id: p.id, name: p.name, birdIndex: p.birdIndex, color: p.color }))
        });
        
        broadcastPlayersUpdate();
        
        if (players.length >= 2) {
            io.to(socket.id).emit('can-start-game', { canStart: true, playerCount: players.length });
        }
    });
    
    socket.on('spectator-start-game', () => {
        const isSpectator = spectators.some(s => s.id === socket.id);
        if (!isSpectator) {
            console.log('❌ Bukan spectator, tidak bisa mulai game');
            return;
        }
        
        if (gameStarted) {
            console.log('❌ Game sudah dimulai');
            return;
        }
        
        if (players.length < 2) {
            console.log(`❌ Tidak bisa mulai game. Minimal 2 pemain, saat ini: ${players.length}`);
            socket.emit('start-error', { message: `Minimal 2 pemain untuk memulai game! Saat ini: ${players.length} pemain` });
            return;
        }
        
        console.log(`🎮 SPECTATOR ${spectators.find(s => s.id === socket.id)?.name} MEMULAI GAME!`);
        console.log(`👥 Total pemain: ${players.length}`);
        
        io.emit('countdown', { message: 'Game akan dimulai oleh Spectator...', seconds: 3 });
        
        setTimeout(() => {
            if (!gameStarted && players.length >= 2) {
                startGame();
            }
        }, 3000);
    });
    
    function startGame() {
        gameStarted = true;
        winner = null;
        
        console.log('🏁 GAME DIMULAI! Track length: ' + (FINISH_X - START_X) + 'px 🏁');
        console.log(`⚡ Sistem: +${SPEED_BONUS} (benar) | -${SPEED_PENALTY} (salah) | -${SPEED_DECAY}/2dt (otomatis)`);
        
        players.forEach(player => {
            playerQuestionsMap.set(player.id, []);
            player.x = START_X;
            player.speed = MIN_SPEED;
            
            const firstQuestion = getRandomQuestionForPlayer(player.id);
            playerCurrentQuestion.set(player.id, firstQuestion);
            io.to(player.id).emit('new-question', firstQuestion);
        });
        
        io.emit('game-start', {
            players: players,
            startTime: Date.now(),
            spectatorMode: false
        });
        
        if (gameInterval) clearInterval(gameInterval);
        gameInterval = setInterval(() => {
            if (!gameStarted) return;
            broadcastGameState();
            broadcastLeaderboard();
        }, 50);
        
        startSpeedDecay();
    }
    
    socket.on('request-question', () => {
        if (!gameStarted || winner) return;
        const player = players.find(p => p.id === socket.id);
        if (player) {
            const newQuestion = getRandomQuestionForPlayer(socket.id);
            playerCurrentQuestion.set(socket.id, newQuestion);
            socket.emit('new-question', newQuestion);
        }
    });
    
    socket.on('player-answer', (answer) => {
        if (!gameStarted || winner) return;
        
        const player = players.find(p => p.id === socket.id);
        if (!player) return;
        
        const currentQ = playerCurrentQuestion.get(socket.id);
        if (!currentQ) return;
        
        const isCorrect = (answer === currentQ.answer);
        
        if (isCorrect) {
            let newSpeed = player.speed + SPEED_BONUS;
            if (newSpeed > MAX_SPEED) newSpeed = MAX_SPEED;
            player.speed = newSpeed;
            console.log(`✅ ${player.name} BENAR! Speed: ${player.speed} (+${SPEED_BONUS})`);
            socket.emit('answer-result', { 
                correct: true, 
                message: `Benar! +${SPEED_BONUS}`,
                newSpeed: player.speed
            });
        } else {
            let newSpeed = player.speed - SPEED_PENALTY;
            if (newSpeed < MIN_SPEED) newSpeed = MIN_SPEED;
            player.speed = newSpeed;
            console.log(`❌ ${player.name} SALAH! Speed: ${player.speed} (-${SPEED_PENALTY})`);
            socket.emit('answer-result', { 
                correct: false, 
                message: `Salah! -${SPEED_PENALTY}. Jawaban: ${currentQ.answer}`,
                newSpeed: player.speed
            });
        }
        
        const newQuestion = getRandomQuestionForPlayer(socket.id);
        playerCurrentQuestion.set(socket.id, newQuestion);
        socket.emit('new-question', newQuestion);
        
        broadcastGameState();
        broadcastLeaderboard();
    });
    
    socket.on('position-update', (data) => {
        const player = players.find(p => p.id === socket.id);
        if (player && gameStarted && !winner) {
            player.x = data.x;
            
            if (data.x >= FINISH_X && !winner) {
                winner = socket.id;
                const winnerPlayer = players.find(p => p.id === socket.id);
                console.log(`🏆 ${winnerPlayer.name} MENANG! 🏆`);
                io.emit('game-end', { winner: winnerPlayer.name, winnerId: socket.id });
                gameStarted = false;
                if (gameInterval) clearInterval(gameInterval);
                if (speedDecayInterval) clearInterval(speedDecayInterval);
                
                setTimeout(() => {
                    players = [];
                    spectators = [];
                    gameStarted = false;
                    winner = null;
                    playerQuestionsMap.clear();
                    playerCurrentQuestion.clear();
                    io.emit('game-reset');
                    console.log('🔄 Game direset, lobby baru tersedia');
                }, 15000);
            }
        }
    });
    
    socket.on('disconnect', () => {
        console.log('❌ Putus:', socket.id);
        playerQuestionsMap.delete(socket.id);
        playerCurrentQuestion.delete(socket.id);
        
        const playerIndex = players.findIndex(p => p.id === socket.id);
        if (playerIndex !== -1) players.splice(playerIndex, 1);
        
        const spectatorIndex = spectators.findIndex(s => s.id === socket.id);
        if (spectatorIndex !== -1) spectators.splice(spectatorIndex, 1);
        
        broadcastPlayersUpdate();
        
        if (gameStarted) {
            gameStarted = false;
            if (gameInterval) clearInterval(gameInterval);
            if (speedDecayInterval) clearInterval(speedDecayInterval);
            io.emit('game-stopped', { message: 'Game dihentikan karena ada pemain keluar' });
        }
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`
    ╔══════════════════════════════════════════════════════════════╗
    ║                                                              ║
    ║      🐦 KICAU MATH SERVER READY 🐦                          ║
    ║                                                              ║
    ║      Server: http://localhost:${PORT}                        ║
    ║                                                              ║
    ║      📏 Panjang lintasan: ${FINISH_X - START_X} px (${(FINISH_X - START_X)/1000} km)  ║
    ║                                                              ║
    ║      ⚡ SISTEM KECEPATAN DINAMIS:                           ║
    ║         ✅ Jawaban BENAR: +${SPEED_BONUS}                      ║
    ║         ❌ Jawaban SALAH: -${SPEED_PENALTY}                    ║
    ║         ⏰ Setiap 2 detik: -${SPEED_DECAY} (otomatis)          ║
    ║         📉 Minimal: ${MIN_SPEED} | Maksimal: ${MAX_SPEED}       ║
    ║                                                              ║
    ║      🎮 Pemain HARUS terus menjawab untuk mempertahankan    ║
    ║         kecepatan! Jika diam, kecepatan akan berkurang!     ║
    ║                                                              ║
    ╚══════════════════════════════════════════════════════════════╝
    `);
});