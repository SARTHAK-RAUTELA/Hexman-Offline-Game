// ============================================================
//  HEX-MAN — Complete Game Engine
//  Canvas 2D | Web Audio API | Pure Vanilla JS
//  10 Progressive Levels with expanding maps
// ============================================================

'use strict';

// ─── CANVAS SETUP ────────────────────────────────────────────
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const overlay = document.getElementById('overlay');
const overlayContent = document.getElementById('overlay-content');

// ─── CONSTANTS ───────────────────────────────────────────────
const BASE_COLS = 21;
const BASE_ROWS = 23;
let TILE = 20; // computed dynamically per level

// Compute best tile size to fill the viewport for given maze dims
function computeTile(cols, rows) {
    // Measure actual HUD and bottom bar heights dynamically
    const hudE1 = document.getElementById('hud');
    const botE1 = document.getElementById('bottom-bar');
    let hudH;

    if (hudEl) {
        hudH = hudEl.offsetHeight;
    } else {
        hudH = 54;
    }

    let botH;

    if (botEl) {
        botH = botEl.offsetHeight;
    } else {
        botH = 30;
    }

    const maxW = window.innerWidth;
    const maxH = window.innerHeight - hudH - botH;
    const tileW = Math.floor(maxW / cols);
    const tileH = Math.floor(maxH / rows);

    return Math.max(14, Math.min(tileW, tileH));

}

// Level configs: cols, rows, ghost speed multiplier, dots bonus, fruit score
const LEVEL_CONFIGS = [
    { cols: 23, rows: 23, ghostSpd: 0.50, name: 'SECTOR 1', color: '#00ffff', dotBonus: 1.0 },
    { cols: 21, rows: 23, ghostSpd: 0.58, name: 'SECTOR 2', color: '#00ff88', dotBonus: 1.1 },
    { cols: 23, rows: 25, ghostSpd: 0.65, name: 'SECTOR 3', color: '#ffff00', dotBonus: 1.2 },
    { cols: 23, rows: 25, ghostSpd: 0.72, name: 'SECTOR 4', color: '#ff8800', dotBonus: 1.3 },
    { cols: 25, rows: 27, ghostSpd: 0.78, name: 'SECTOR 5', color: '#ff00ff', dotBonus: 1.4 },
    { cols: 25, rows: 27, ghostSpd: 0.83, name: 'SECTOR 6', color: '#ff4444', dotBonus: 1.5 },
    { cols: 29, rows: 29, ghostSpd: 0.88, name: 'SECTOR 7', color: '#aa44ff', dotBonus: 1.6 },
    { cols: 29, rows: 29, ghostSpd: 0.92, name: 'SECTOR 8', color: '#ff6600', dotBonus: 1.8 },
    { cols: 35, rows: 31, ghostSpd: 0.96, name: 'SECTOR 9', color: '#ff0088', dotBonus: 2.0 },
    { cols: 35, rows: 31, ghostSpd: 1.00, name: 'SECTOR 10', color: '#ffffff', dotBonus: 2.5 },
];

// Tile types
const T = { WALL: 0, DOT: 1, EMPTY: 2, POWER: 3, GHOST_HOUSE: 4, TUNNEL: 5 };

// Directions
const DIR = { UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 }, NONE: { x: 0, y: 0 } };
const DIRS = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];