/**
 * メニュー画面
 *
 * コース選択とゲーム開始ボタンを提供する。
 */

import { startGame, shutdownGame } from './main.js';

/** @type {Array<{id: string, name: string}>} */
const courses = [
    { id: 'tomin', name: 'Tomin Motorland' },
    { id: 'okspo', name: 'Okegawa SportsLand' },
];

/** @type {string} */
let selectedCourseId = courses[0].id;

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
    startButton.addEventListener('click', () => {
        menuContainer.style.display = 'none';
        document.getElementById('game-container').style.display = 'block';
        startGame(selectedCourseId);
    });
}

// DOM 準備完了後にメニューを初期化
document.addEventListener('DOMContentLoaded', initMenu);