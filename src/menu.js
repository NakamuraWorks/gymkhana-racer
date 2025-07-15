import { startGame, shutdownGame } from './main.js';

// Available courses
const courses = [
    { id: 'tomin', name: 'Tomin Motorland' },
    { id: 'okspo', name: 'Okegawa SportsLand' },
    // Add more courses here in the future
];

let selectedCourseId = courses[0].id;

function initMenu() {
    const menuContainer = document.getElementById('menu-container');
    const gameContainer = document.getElementById('game-container');
    const courseSelect = document.getElementById('course-select');
    const startButton = document.getElementById('start-button');

    // Ensure the menu is displayed and any previous game instance is cleared.
    shutdownGame();

    // Populate course selection
    courses.forEach(course => {
        const option = document.createElement('option');
        option.value = course.id;
        option.textContent = course.name;
        courseSelect.appendChild(option);
    });

    // Handle course selection
    courseSelect.addEventListener('change', (event) => {
        selectedCourseId = event.target.value;
    });

    // Handle start button click
    startButton.addEventListener('click', () => {
        menuContainer.style.display = 'none';
        gameContainer.style.display = 'block';
        startGame(selectedCourseId);
    });
}

// Initialize the menu when the DOM is ready
document.addEventListener('DOMContentLoaded', initMenu);