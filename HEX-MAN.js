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