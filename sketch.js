const remoteVideo = document.getElementById('remote-video');
const setupScreen = document.getElementById('setup-screen');
const gameScreen = document.getElementById('game-screen');
const statusMsg = document.getElementById('status-msg');
const aiHandDisplay = document.getElementById('ai-hand');
const qrcodeContainer = document.getElementById('qrcode-container');
const countdownElt = document.getElementById('countdown');

let peer;
let gameState = "WAITING"; // WAITING, COUNTDOWN, RESULT, COOLDOWN
let currentUserGesture = "UNKNOWN";

const hands = new Hands({
    locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/hands/${file}`
});

// 1. 處理 PeerJS 連線
const urlParams = new URLSearchParams(window.location.search);
const remoteId = urlParams.get('join');

if (remoteId) {
    // 手機端模式
    setupScreen.innerHTML = "<h2 style='color:#00f3ff'>STREAMING TO HOST...</h2>";
    peer = new Peer();
    peer.on('open', (id) => {
        navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' }, audio: false })
            .then(stream => {
                peer.call(remoteId, stream);
            });
    });
} else {
    // 電腦展示端模式
    peer = new Peer();
    peer.on('open', (id) => {
        const joinUrl = `${window.location.origin}${window.location.pathname}?join=${id}`;
        new QRCode(qrcodeContainer, { text: joinUrl, width: 180, height: 180 });
    });

    peer.on('call', (call) => {
        call.answer();
        call.on('stream', (stream) => {
            remoteVideo.srcObject = stream;
            // 確保影片播放
            remoteVideo.onloadedmetadata = () => {
                remoteVideo.play().catch(e => console.error("Play error:", e));
            };
            setupScreen.style.display = 'none';
            gameScreen.style.display = 'block';
            initHandTracking();
        });
    });
}

// 2. 手勢辨識設定
function initHandTracking() {
    hands.setOptions({
        maxNumHands: 1,
        modelComplexity: 1,
        minDetectionConfidence: 0.7,
        minTrackingConfidence: 0.7
    });
    hands.onResults(onResults);
    
    // 手動處理影像影格，避免嘗試開啟本地攝影機導致的失敗
    async function processFrame() {
        if (remoteVideo.readyState >= 2 && !remoteVideo.paused) {
            try {
                await hands.send({ image: remoteVideo });
            } catch (e) {
                console.error("MediaPipe error:", e);
            }
        }
        requestAnimationFrame(processFrame);
    }
    processFrame();
}

function onResults(results) {
    if (!results.multiHandLandmarks || results.multiHandLandmarks.length === 0) return;
    
    const landmarks = results.multiHandLandmarks[0];
    currentUserGesture = detectGesture(landmarks);

    if (gameState === "WAITING" && ["ROCK", "PAPER", "SCISSORS"].includes(currentUserGesture)) {
        startCountdown();
    } else if (gameState === "COOLDOWN" && currentUserGesture === "THUMBS_UP") {
        resetGame();
    }
}

// 3. 猜拳手勢邏輯辨識
function detectGesture(lm) {
    const fingerTips = [8, 12, 16, 20];
    const fingerBases = [6, 10, 14, 18];
    let openFingers = 0;

    for (let i = 0; i < 4; i++) {
        if (lm[fingerTips[i]].y < lm[fingerBases[i]].y) openFingers++;
    }

    const thumbExtended = Math.abs(lm[4].x - lm[2].x) > 0.1;

    // 簡單判斷邏輯
    if (thumbExtended && openFingers === 0) return "THUMBS_UP";
    if (openFingers === 0) return "ROCK";
    if (openFingers === 2) return "SCISSORS";
    if (openFingers === 4) return "PAPER";
    return "UNKNOWN";
}

// 4. 遊戲流程
const moves = ["ROCK", "PAPER", "SCISSORS"];
const emojis = { ROCK: "✊", PAPER: "✋", SCISSORS: "✌️", UNKNOWN: "❓" };

function startCountdown() {
    gameState = "COUNTDOWN";
    let count = 3;
    countdownElt.style.display = "block";
    
    const timer = setInterval(() => {
        if (count > 0) {
            countdownElt.innerText = count;
            statusMsg.innerText = `準備... ${count}`;
            aiHandDisplay.innerText = "🎲"; // 轉動中
            count--;
        } else {
            clearInterval(timer);
            countdownElt.style.display = "none";
            playRPS();
        }
    }, 800);
}

function playRPS() {
    gameState = "RESULT";
    const aiMove = moves[Math.floor(Math.random() * 3)];
    aiHandDisplay.innerText = emojis[aiMove];
    
    const userGesture = currentUserGesture; // 取得揭曉瞬間的手勢

    let result = "";
    if (userGesture === "UNKNOWN") {
        result = "MISSED (偵測失敗)";
    } else if (userGesture === aiMove) {
        result = "DRAW (平手)";
    } else if (
        (userGesture === "ROCK" && aiMove === "SCISSORS") ||
        (userGesture === "PAPER" && aiMove === "ROCK") ||
        (userGesture === "SCISSORS" && aiMove === "PAPER")
    ) {
        result = "YOU WIN! (玩家勝利)";
        spawnConfetti();
    } else {
        result = "YOU LOSE! (玩家失敗)";
    }

    statusMsg.innerHTML = `<span style="color:white">${result}</span><br>比出 👍 手勢以重新開始`;
    gameState = "COOLDOWN";
}

function resetGame() {
    gameState = "WAITING";
    statusMsg.innerText = "偵測中... 請出拳！";
    aiHandDisplay.innerText = "🤖";
}

function spawnConfetti() {
    const duration = 3 * 1000;
    const end = Date.now() + duration;

    (function frame() {
        confetti({
            particleCount: 3,
            angle: 60,
            spread: 55,
            origin: { x: 0 },
            colors: ['#00f3ff', '#ff00ff']
        });
        confetti({
            particleCount: 3,
            angle: 120,
            spread: 55,
            origin: { x: 1 },
            colors: ['#00f3ff', '#ff00ff']
        });
        if (Date.now() < end) requestAnimationFrame(frame);
    }());
}