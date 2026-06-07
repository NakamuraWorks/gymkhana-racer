/**
 * メニュー画面
 *
 * コース選択、チュートリアル表示、カウントダウン付きゲーム開始を提供する。
 */

import { startGame, shutdownGame } from './main.js';

/** @type {Array<{id: string, name: string}>} */
const courses = [
    { id: 'tomin', name: 'Tomin Motorland' },
    { id: 'okspo', name: 'Okegawa SportsLand' },
];

/** @type {string} */
let selectedCourseId = courses[0].id;

/** @type {boolean} */
let tutorialSkipped = false;

/** チュートリアルをスキップしたかどうか（localStorageから読み込み） */
function isTutorialSkipped() {
    try {
        return localStorage.getItem('gymkhana-racer-tutorial-skipped') === 'true';
    } catch {
        return false;
    }
}

/** チュートリアルのスキップ状態を保存 */
function saveTutorialSkip() {
    try {
        localStorage.setItem('gymkhana-racer-tutorial-skipped', 'true');
    } catch {
        // localStorage が利用できない場合は無視
    }
}

/**
 * チュートリアルオーバーレイを表示する。
 * @param {() => void} onStart - 開始ボタンクリック時のコールバック
 */
function showTutorial(onStart) {
    const overlay = document.getElementById('tutorial-overlay');
    const startBtn = document.getElementById('tutorial-start-btn');
    const skipBtn = document.getElementById('tutorial-skip-btn');

    if (!overlay) return;

    overlay.classList.add('active');

    if (startBtn) {
        startBtn.addEventListener('click', () => {
            overlay.classList.remove('active');
            onStart();
        });
    }

    if (skipBtn) {
        skipBtn.addEventListener('click', () => {
            saveTutorialSkip();
            tutorialSkipped = true;
            overlay.classList.remove('active');
            onStart();
        });
    }
}

/**
 * スタートボタンクリック時の処理
 * チュートリアル表示またはカウントダウン後にゲームを開始
 */
function handleStartGame() {
    const menuContainer = document.getElementById('menu-container');
    const gameContainer = document.getElementById('game-container');

    menuContainer.style.display = 'none';
    gameContainer.style.display = 'block';

    if (tutorialSkipped || isTutorialSkipped()) {
        // チュートリアルをスキップ済みまたは既にスキップ → カウントダウン後に開始
        startCountdown(selectedCourseId);
    } else {
        // 初めてプレイ → チュートリアルを表示
        showTutorial(() => {
            startCountdown(selectedCourseId);
        });
    }
}

/**
 * カウントダウンを表示してゲームを開始する。
 *
 * @param {string} courseId - 選択されたコースID
 */
function startCountdown(courseId) {
    const countdownOverlay = document.getElementById('countdown-overlay');
    const countdownText = document.getElementById('countdown-text');

    if (!countdownOverlay || !countdownText) return;

    countdownOverlay.classList.add('active');

    let count = 3;
    countdownText.textContent = count;

    const interval = setInterval(() => {
        count--;
        if (count > 0) {
            countdownText.textContent = count;
            // アニメーションをリセット
            countdownText.style.animation = 'none';
            countdownText.offsetHeight; // リフロー強制
            countdownText.style.animation = '';
        } else if (count === 0) {
            countdownText.textContent = 'GO!';
            countdownText.style.color = '#4ade80';
        } else {
            clearInterval(interval);
            countdownOverlay.classList.remove('active');
            countdownText.style.color = '#e94560';
            startGame(courseId);
        }
    }, 1000);
}

/**
 * メニューを初期化する。
 */
function initMenu() {
    const menuContainer = document.getElementById('menu-container');
    const courseSelect = document.getElementById('course-select');
    const startButton = document.getElementById('start-button');

    if (!menuContainer || !courseSelect || !startButton) {
        console.error('Menu elements not found. Aborting init.');
        return;
    }

    // 以前のゲームインスタンスをクリーンアップ
    shutdownGame();

    // チュートリアルのスキップ状態を読み込み
    tutorialSkipped = isTutorialSkipped();

    // コースリストを埋め込み
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.name;
        courseSelect.appendChild(option);
    });

    // コース選択変更
    courseSelect.addEventListener('change', (event) => {
        selectedCourseId = event.target.value;
    });

    // スタートボタン
    startButton.addEventListener('click', handleStartGame);
}

// DOM 準備完了後にメニューを初期化
document.addEventListener('DOMContentLoaded', initMenu);