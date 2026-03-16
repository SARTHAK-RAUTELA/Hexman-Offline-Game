
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
    const hudEl = document.getElementById('hud');
    const botEl = document.getElementById('bottom-bar');
    const hudH = hudEl ? hudEl.offsetHeight : 54;
    const botH = botEl ? botEl.offsetHeight : 30;
    const maxW = window.innerWidth;
    const maxH = window.innerHeight - hudH - botH;
    const tileW = Math.floor(maxW / cols);
    const tileH = Math.floor(maxH / rows);
    // No upper cap — use whatever fills the screen
    return Math.max(14, Math.min(tileW, tileH));
}

// Level configs: cols, rows, ghost speed multiplier, dots bonus, fruit score
const LEVEL_CONFIGS = [
    { cols: 23, rows: 23, ghostSpd: 0.70, name: 'SECTOR 1', color: '#00ffff', dotBonus: 1.0 },
    { cols: 21, rows: 23, ghostSpd: 0.75, name: 'SECTOR 2', color: '#00ff88', dotBonus: 1.1 },
    { cols: 23, rows: 25, ghostSpd: 0.79, name: 'SECTOR 3', color: '#ffff00', dotBonus: 1.2 },
    { cols: 23, rows: 25, ghostSpd: 0.83, name: 'SECTOR 4', color: '#ff8800', dotBonus: 1.3 },
    { cols: 25, rows: 27, ghostSpd: 0.86, name: 'SECTOR 5', color: '#ff00ff', dotBonus: 1.4 },
    { cols: 25, rows: 27, ghostSpd: 0.89, name: 'SECTOR 6', color: '#ff4444', dotBonus: 1.5 },
    { cols: 29, rows: 29, ghostSpd: 0.92, name: 'SECTOR 7', color: '#aa44ff', dotBonus: 1.6 },
    { cols: 29, rows: 29, ghostSpd: 0.95, name: 'SECTOR 8', color: '#ff6600', dotBonus: 1.8 },
    { cols: 35, rows: 31, ghostSpd: 0.97, name: 'SECTOR 9', color: '#ff0088', dotBonus: 2.0 },
    { cols: 35, rows: 31, ghostSpd: 1.00, name: 'SECTOR 10', color: '#ffffff', dotBonus: 2.5 },
];

// Tile types
const T = { WALL: 0, DOT: 1, EMPTY: 2, POWER: 3, GHOST_HOUSE: 4, TUNNEL: 5 };

// Directions
const DIR = { UP: { x: 0, y: -1 }, DOWN: { x: 0, y: 1 }, LEFT: { x: -1, y: 0 }, RIGHT: { x: 1, y: 0 }, NONE: { x: 0, y: 0 } };
const DIRS = [DIR.UP, DIR.DOWN, DIR.LEFT, DIR.RIGHT];

// Ghost colors & personalities
const GHOST_DEFS = [
    { name: 'ALPHA', color: '#ff3333', eyeColor: '#fff', scatter: { x: 0, y: 0 } }, // Blinky-like
    { name: 'BETA', color: '#ff88ff', eyeColor: '#fff', scatter: { x: -1, y: 0 } }, // Pinky-like
    { name: 'GAMMA', color: '#00ffff', eyeColor: '#fff', scatter: { x: 0, y: -1 } }, // Inky-like
    { name: 'DELTA', color: '#ffaa00', eyeColor: '#fff', scatter: { x: 1, y: 0 } }, // Clyde-like
];

// ─── AUDIO ENGINE ────────────────────────────────────────────
class AudioEngine {
    constructor() {
        this.ctx = null;
        this.bgNode = null;
        this.masterGain = null;
        this.enabled = true;
    }

    init() {
        if (this.ctx) return;
        try {
            this.ctx = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.ctx.createGain();
            this.masterGain.gain.value = 0.4;
            this.masterGain.connect(this.ctx.destination);
        } catch (e) { this.enabled = false; }
    }

    _beep(freq, dur, type = 'square', vol = 0.3, detune = 0) {
        if (!this.enabled || !this.ctx) return;
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.connect(gain);
        gain.connect(this.masterGain);
        osc.type = type;
        osc.frequency.value = freq;
        osc.detune.value = detune;
        gain.gain.setValueAtTime(vol, this.ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + dur);
        osc.start(this.ctx.currentTime);
        osc.stop(this.ctx.currentTime + dur);
    }

    eatDot() {
        if (!this.enabled || !this.ctx) return;
        this._beep(800 + Math.random() * 200, 0.06, 'square', 0.15);
    }

    eatPower() {
        if (!this.enabled || !this.ctx) return;
        [200, 300, 400, 600].forEach((f, i) => {
            setTimeout(() => this._beep(f, 0.12, 'sawtooth', 0.25), i * 60);
        });
    }

    eatGhost() {
        if (!this.enabled || !this.ctx) return;
        [600, 800, 1000, 800, 600].forEach((f, i) => {
            setTimeout(() => this._beep(f, 0.08, 'square', 0.3), i * 50);
        });
    }

    death() {
        if (!this.enabled || !this.ctx) return;
        let freqs = [500, 450, 400, 350, 300, 250, 200, 150, 100];
        freqs.forEach((f, i) => setTimeout(() => this._beep(f, 0.12, 'sawtooth', 0.3), i * 80));
    }

    levelComplete() {
        if (!this.enabled || !this.ctx) return;
        let melody = [523, 659, 784, 1047, 784, 1047, 1319];
        melody.forEach((f, i) => setTimeout(() => this._beep(f, 0.15, 'square', 0.25), i * 100));
    }

    gameOver() {
        if (!this.enabled || !this.ctx) return;
        let m = [400, 350, 300, 250, 200, 180, 150];
        m.forEach((f, i) => setTimeout(() => this._beep(f, 0.2, 'sawtooth', 0.3), i * 120));
    }

    startJingle() {
        if (!this.enabled || !this.ctx) return;
        let m = [330, 392, 523, 659, 784, 659, 784, 1047];
        m.forEach((f, i) => setTimeout(() => this._beep(f, 0.15, 'square', 0.2), i * 90));
    }

    startBgLoop(level) {
        if (!this.enabled || !this.ctx) return;
        this.stopBg();
        // Subtle ambient drone
        const drone = this.ctx.createOscillator();
        const droneGain = this.ctx.createGain();
        drone.type = 'sine';
        drone.frequency.value = 55 + level * 5;
        droneGain.gain.value = 0.03;
        drone.connect(droneGain);
        droneGain.connect(this.masterGain);
        drone.start();
        this.bgNode = drone;
        this.bgGain = droneGain;
    }

    stopBg() {
        if (this.bgNode) { try { this.bgNode.stop(); } catch (e) { } this.bgNode = null; }
    }

    powerMode(on) {
        if (!this.enabled || !this.ctx) return;
        if (on) {
            this._beep(150, 0.5, 'sawtooth', 0.1);
        }
    }
}

const audio = new AudioEngine();

// ─── MAZE GENERATOR ──────────────────────────────────────────
// 10 handcrafted mazes. Each string row uses:
//   # = wall   . = dot   o = power pellet
//   G = ghost house   T = tunnel exit   P = player spawn   (space) = empty corridor
//
// Rules followed in every maze:
//  • Symmetric left↔right
//  • All dots flood-fill reachable from P
//  • Ghost house 5 wide × 3 tall in centre
//  • Tunnel row exits on both sides
//  • Levels grow in size: 21→21→23→23→25→25→27→27→29→29 cols

const RAW_MAZES = [
    // ── LEVEL 1 ── 21×23 ── Simple open layout ──────────────
    [
        '#####################',
        '#o#.............#..o#',
        '#.#########.#.###.#.#',
        '#...#.....#.#.....#.#',
        '###.#.###.###.#####.#',
        '#.#.#...#...#.....#.#',
        '#.#.###.###.#####.#.#',
        '#.#.....#.#.....#.#.#',
        '#.#######.#####.###.#',
        '#.............#.....#',
        '#.#####.GG.GG.#####.#',
        'T...................T',
        '#.#####.GGGGG.###.#.#',
        '#.#...#.........#.#.#',
        '#.#.#.#.#.#.###.#.#.#',
        '#.#.#...#.P...#.#...#',
        '#.#.#####.###.#.#####',
        '#.#.#...#...#...#...#',
        '#.#.#.#####.#####.###',
        '#...#.#...#...#.....#',
        '#####.#.#.###.#####.#',
        '#o......#..........o#',
        '#####################',
    ],

    // ── LEVEL 2 ── 21×23 ── Tighter turns ──────────────
    [
        '#####################',
        '#o#.......#........o#',
        '#.#####.#.#.#.#####.#',
        '#.......#.#.#.....#.#',
        '#########.#.#####.###',
        '#.....#...#.#...#...#',
        '#.###.#.###.###.###.#',
        '#.#...#...#.....#...#',
        '#.#######.#####.#.###',
        '#...............#...#',
        '#.#####.GG.GG.#####.#',
        'T...................T',
        '#.#####.GGGGG.#.#.#.#',
        '#...............#...#',
        '#########.###.#####.#',
        '#...#...#.P...#.....#',
        '#.###.#.#######.#####',
        '#...#.#.......#.#...#',
        '#.#.#.###.#####.#.###',
        '#.#...#.#.#.....#...#',
        '#.#####.#.#.#######.#',
        '#o......#..........o#',
        '#####################',
    ],

    // ── LEVEL 3 ── 23×25 ── Dense maze ──────────────
    [
        '#######################',
        '#o......#............o#',
        '#######.#.#######.#####',
        '#.....#.#.......#.....#',
        '#.#####.#######.#####.#',
        '#...#...#.....#.#...#.#',
        '#.#.#.###.###.#.###.#.#',
        '#.#...#.....#.......#.#',
        '#.#####.#########.###.#',
        '#.#...#.#.....#...#...#',
        'T.....................T',
        '#...#...GGG.GGG.#...#.#',
        '###.#.#.GGGGGGG.#.###.#',
        '#...#...GGGGGGG.#.#...#',
        '#.#####.........#.#####',
        '#.........#.#.........#',
        '##########.P.##.#####.#',
        '#.......#.#...#.#.....#',
        '###.###.#.###.###.###.#',
        '#...#.#...#.#...#...#.#',
        '#.###.###.#.###.###.###',
        '#...#.........#...#...#',
        '#.#.#############.###.#',
        '#o#..................o#',
        '#######################',
    ],

    // ── LEVEL 4 ── 23×25 ── Winding corridors ──────────────
    [
        '#######################',
        '#o....#.....#........o#',
        '#####.#.###.#####.###.#',
        '#...#...#...#...#.#.#.#',
        '#.#.#####.###.#.#.#.#.#',
        '#.#...#...#...#...#...#',
        '#.#####.###.#######.###',
        '#.....#...#.......#...#',
        '#.###.###.#.#####.###.#',
        '#.#...#.#.#.....#.#.#.#',
        'T.....................T',
        '#.#.#...GGG.GGG...#...#',
        '#.#.###.GGGGGGG.###.###',
        '#.#.#...GGGGGGG.#.#...#',
        '#.#.#.#.........#.###.#',
        '#.#...#.#.#.....#.#...#',
        '#.#####.##.P.####.#.###',
        '#.....#.......#...#.#.#',
        '#####.#######.#.#.#.#.#',
        '#...#...#...#.#.#...#.#',
        '#.#.###.###.#.#.#####.#',
        '#.#...#.....#.#...#...#',
        '#.#.#######.#.###.###.#',
        '#o#.........#........o#',
        '#######################',
    ],

    // ── LEVEL 5 ── 25×27 ── Larger map ──────────────
    [
        '#########################',
        '#o#...............#...#o#',
        '#.#######.###.###.#.#.#.#',
        '#.#.....#.#.#...#...#...#',
        '#.#.###.#.#.###.#######.#',
        '#.#.#...#...#...#...#...#',
        '#.#.#.#####.#.###.#.#####',
        '#...#.#...#.#.....#.....#',
        '#####.#.#.#.###########.#',
        '#...#.#.#.#.#.....#...#.#',
        'T.......................T',
        '#.#.#.#...........#.#...#',
        '###.#.##.GGG.GGG..#.###.#',
        '#...#....GGGGGGG..#.#...#',
        '#.#.###..GGGGGGG..#.#.###',
        '#.#...#...........#.#.#.#',
        '#.#####.#.#.#####.#.#.#.#',
        '#.......#...P...#.#.#...#',
        '#.#######.###.#.#.#.#####',
        '#.#.......#...#...#.....#',
        '#.#######.###.###.#####.#',
        '#.#.....#.....#...#...#.#',
        '#.#.###.#######.###.#.#.#',
        '#.#.#...#.....#...#.#.#.#',
        '#.#.#.###.###.#####.#.#.#',
        '#o..#.....#.........#..o#',
        '#########################',
    ],

    // ── LEVEL 6 ── 25×27 ── Denser walls ──────────────
    [
        '#########################',
        '#o..#.....#.........#..o#',
        '###.###.#.#.#######.#.#.#',
        '#.#...#.#...#.#...#...#.#',
        '#.###.#####.#.#.#.#####.#',
        '#.....#...#...#.#.#.....#',
        '#.#####.#.#####.#.#.###.#',
        '#.#.....#.....#.#...#.#.#',
        '#.#.###.#####.#.#####.#.#',
        '#.#.#...#...#...#.....#.#',
        'T.......................T',
        '#.....#...........#.#...#',
        '#######..GGG.GGG..#.#####',
        '#........GGGGGGG......#.#',
        '#.#.####.GGGGGGG.####.#.#',
        '#.#.................#...#',
        '#.#####.#.#####.###.###.#',
        '#.#...#...#.P.#.#...#...#',
        '#.#.#.#####.#.#.###.#.###',
        '#.#.#.....#.#.#...#.#...#',
        '#.#.###.###.#.###.#####.#',
        '#.#...#.....#...#.....#.#',
        '#.#############.###.###.#',
        '#...#.....#...#...#...#.#',
        '###.#.###.#.#.###.###.#.#',
        '#o....#.....#.......#..o#',
        '#########################',
    ],

    // ── LEVEL 7 ── 27×29 ── Labyrinthine ──────────────
    [
        '###########################',
        '#o..#.......#.........#..o#',
        '###.#.#####.#.#.#######.#.#',
        '#...#...#...#.#.........#.#',
        '#.#######.###.#########.#.#',
        '#.#.......#...#...#...#.#.#',
        '#.#.#####.#.###.#.#.#.#.#.#',
        '#.#.#.....#.#...#.#.#.#.#.#',
        '#.#.#######.#.#####.#.###.#',
        '#.#.........#.#...#.#.....#',
        'T.........................T',
        '#...#...#.......#.#.....#.#',
        '###.###............####.#.#',
        '#.#...#..GGGG.GGGG..#...#.#',
        '#.###.#..GGGGGGGGG.##.###.#',
        '#.#...#..GGGGGGGGG..#.#.#.#',
        '#.#.###.............#.#.#.#',
        '#...#.....#...#...#...#...#',
        '#.##########.P.##.#####.###',
        '#.........#.....#.....#...#',
        '#########.#.###.#.###.###.#',
        '#.#.....#.#.#.#.#...#.#.#.#',
        '#.#.#.#.#.#.#.#.#.###.#.#.#',
        '#.#.#.#.#...#...#.#...#...#',
        '#.#.#.#######.#####.###.###',
        '#.#.#.......#.......#.#.#.#',
        '#.#.#######.#########.#.#.#',
        '#o........#..............o#',
        '###########################',
    ],

    // ── LEVEL 8 ── 27×29 ── Tight corridors ──────────────
    [
        '###########################',
        '#o#.............#...#....o#',
        '#.###.#########.#.#.#.###.#',
        '#...#...#.....#.#.#...#...#',
        '###.###.#.###.#.#.#####.#.#',
        '#...#...#.#.#.#.#...#...#.#',
        '#.#######.#.#.#.###.#.###.#',
        '#.#.....#.#.#.#.....#.#...#',
        '#.###.#.#.#.#.#.#####.#.###',
        '#.#...#...#.#.#.....#.#.#.#',
        'T.........................T',
        '#...#.......#...#.....#.#.#',
        '#####.#............####.#.#',
        '#.....#..GGGG.GGGG....#...#',
        '###.###..GGGGGGGGG..#####.#',
        '#...#....GGGGGGGGG......#.#',
        '#.######...........##.#.#.#',
        '#.........#.#...#.....#.#.#',
        '#.##########.P..#.#######.#',
        '#.#.............#.#.....#.#',
        '#.#####.#.#######.#.###.#.#',
        '#.#...#.#.#...#...#...#...#',
        '#.#.#.#.###.#.#.#.###.#####',
        '#...#.#.....#.#.#...#.....#',
        '#####.#.#####.#.###.#####.#',
        '#.#...#.#...#.#...#.......#',
        '#.#.#####.#.#.###.#########',
        '#o........#...#..........o#',
        '###########################',
    ],

    // ── LEVEL 9 ── 29×31 ── Expert layout ──────────────
    [
        '#############################',
        '#o#.........#.......#......o#',
        '#.###.#####.###.###.#.#####.#',
        '#...#.#...#...#.#...#.....#.#',
        '###.#.#.#####.###.###.#####.#',
        '#.#...#.#.....#...#...#...#.#',
        '#.#####.#.#####.###.###.#.#.#',
        '#.......#.#.......#.#.#.#...#',
        '#.#####.#.###.###.#.#.#.###.#',
        '#.#.....#...#...#.#.#.#...#.#',
        'T...........................T',
        '#...#.#...#.....#...#...#.#.#',
        '#.###.###.#####.###.#.###.#.#',
        '#...#.................#...#.#',
        '#.#.#.##.GGGGG.GGGGG.##.###.#',
        '#.#.#....GGGGGGGGGGG....#...#',
        '#.#.#.##.GGGGGGGGGGG.####.###',
        '#.#.#.#.................#.#.#',
        '#.#.###.#####.#.#######.#.#.#',
        '#.#.....#...#.P...#.....#.#.#',
        '#.#######.#.#.#.#.###.###.#.#',
        '#.#...#...#...#.#.#...#...#.#',
        '#.#.#.#.#.#####.#.#.#.#.###.#',
        '#...#.#.#.#...#.#...#.#.#...#',
        '#####.###.#.#.#.###.###.#.#.#',
        '#...#...#...#.#...#.#...#.#.#',
        '###.###.#####.###.###.#####.#',
        '#.....#.........#.....#.....#',
        '#.#############.#######.###.#',
        '#o......................#..o#',
        '#############################',
    ],

    // ── LEVEL 10 ── 29×31 ── Max difficulty ──────────────
    [
        '#############################',
        '#o#.................#.#....o#',
        '#.#.#########.#####.#.#.#.###',
        '#.#.#.........#.....#...#...#',
        '#.###.#########.#####.#####.#',
        '#.....#.......#...#.#...#.#.#',
        '#######.#####.###.#.###.#.#.#',
        '#.....#...#.#...#.#.......#.#',
        '#.###.###.#.#.###.#########.#',
        '#.#.#.#...#.#.....#.....#...#',
        'T...........................T',
        '#.#...#.....#...#...#.#.#...#',
        '#.#.#######.#.#.###.#.#.#.#.#',
        '#.#...#.................#.#.#',
        '#.###.#..GGGGG.GGGGG..###.#.#',
        '#.#...#..GGGGGGGGGGG..#...#.#',
        '#.######.GGGGGGGGGGG..#####.#',
        '#.#.........................#',
        '#.#.#.#####.#.#.###.#######.#',
        '#...#.#.....#.P.#...#...#...#',
        '#.###.#.#####.#.#.###.#.#.###',
        '#.#.#.#.....#.#.#.....#.#.#.#',
        '#.#.#.#####.#.#.###.###.#.#.#',
        '#.#.#.....#.#.#...#...#...#.#',
        '#.#.###.#.#.#####.###.#####.#',
        '#...#.#.#.#.#...#.#.#.#.....#',
        '###.#.#.###.#.#.#.#.#.###.#.#',
        '#.#...#.....#.#...#.#.....#.#',
        '#.###.#######.#####.#######.#',
        '#o............#............o#',
        '#############################',
    ],

];

// Parse a raw maze string array into the tile grid + metadata
function buildMaze(cols, rows, level) {
    const raw = RAW_MAZES[Math.min(level - 1, 9)];

    // Auto-detect actual dimensions from the raw data
    const R = raw.length;
    const C = raw.reduce((m, row) => Math.max(m, row.length), 0);

    // Pad all rows to same width
    const padded = raw.map(row => row.padEnd(C, '#'));

    // Build grid
    const grid = [];
    let spawn = { x: Math.floor(C / 2), y: Math.floor(R / 2) - 3 };
    const ghostSpawns = [];
    let dotCount = 0;

    for (let y = 0; y < R; y++) {
        grid[y] = [];
        for (let x = 0; x < C; x++) {
            const ch = padded[y][x];
            let tile;
            switch (ch) {
                case '#': tile = T.WALL; break;
                case '.': tile = T.DOT; dotCount++; break;
                case 'o': tile = T.POWER; dotCount++; break;
                case 'G': tile = T.GHOST_HOUSE; break;
                case 'T': tile = T.TUNNEL; break;
                case 'P': tile = T.EMPTY; spawn = { x, y }; break;
                default: tile = T.EMPTY; break;
            }
            grid[y][x] = tile;
        }
    }

    // Find ghost house center for ghost spawns
    const cx = Math.floor(C / 2);
    const cy = Math.floor(R / 2);
    // Place ghosts inside the ghost house
    for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx += 2) {
            const gx = cx + dx, gy = cy + dy;
            if (gx >= 0 && gx < C && gy >= 0 && gy < R && grid[gy][gx] === T.GHOST_HOUSE) {
                ghostSpawns.push({ x: gx, y: gy });
            }
        }
    }
    // Always ensure 4 ghost spawns
    while (ghostSpawns.length < 4) {
        ghostSpawns.push({ x: cx, y: cy });
    }

    // ── Flood-fill safety: remove any unreachable dots ──────────
    const reachable = Array.from({ length: R }, () => Array(C).fill(false));
    const queue = [[spawn.x, spawn.y]];
    reachable[spawn.y][spawn.x] = true;
    const passable = t => t === T.DOT || t === T.POWER || t === T.EMPTY || t === T.TUNNEL;

    while (queue.length) {
        const [qx, qy] = queue.shift();
        for (const [ddx, ddy] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
            let nx = qx + ddx, ny = qy + ddy;
            if (nx < 0) nx = C - 1;
            if (nx >= C) nx = 0;
            if (ny < 0 || ny >= R) continue;
            if (!reachable[ny][nx] && passable(grid[ny][nx])) {
                reachable[ny][nx] = true;
                queue.push([nx, ny]);
            }
        }
    }

    // Remove unreachable dots (make them walls)
    dotCount = 0;
    for (let y = 0; y < R; y++) {
        for (let x = 0; x < C; x++) {
            if ((grid[y][x] === T.DOT || grid[y][x] === T.POWER) && !reachable[y][x]) {
                grid[y][x] = T.WALL;
            } else if (grid[y][x] === T.DOT || grid[y][x] === T.POWER) {
                dotCount++;
            }
        }
    }

    return { grid, cols: C, rows: R, spawn, ghostSpawns, dotCount };
}

// ─── PARTICLE SYSTEM ─────────────────────────────────────────
class ParticleSystem {
    constructor() { this.particles = []; }

    spawn(x, y, color, count = 8, speed = 2, life = 0.6) {
        for (let i = 0; i < count; i++) {
            const angle = (Math.PI * 2 / count) * i + Math.random() * 0.5;
            const spd = speed * (0.5 + Math.random());
            this.particles.push({
                x, y,
                vx: Math.cos(angle) * spd,
                vy: Math.sin(angle) * spd,
                life, maxLife: life,
                color, size: 2 + Math.random() * 3,
                type: Math.random() > 0.5 ? 'circle' : 'square'
            });
        }
    }

    spawnText(x, y, text, color = '#ffff00') {
        this.particles.push({
            x, y, vx: 0, vy: -1.5,
            life: 1.0, maxLife: 1.0,
            color, text, size: 14,
            type: 'text'
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx;
            p.y += p.vy;
            p.vy += 0.05; // gravity
            p.life -= dt;
            if (p.life <= 0) this.particles.splice(i, 1);
        }
    }

    draw(ctx) {
        for (const p of this.particles) {
            const alpha = p.life / p.maxLife;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = p.color;
            if (p.type === 'text') {
                ctx.font = `bold ${p.size}px 'Orbitron', monospace`;
                ctx.fillText(p.text, p.x, p.y);
            } else if (p.type === 'circle') {
                ctx.beginPath();
                ctx.arc(p.x, p.y, p.size * alpha, 0, Math.PI * 2);
                ctx.fill();
            } else {
                ctx.fillRect(p.x - p.size / 2, p.y - p.size / 2, p.size * alpha, p.size * alpha);
            }
            ctx.restore();
        }
    }
}

// ─── HEXMAN (PLAYER) ─────────────────────────────────────────
class HexMan {
    constructor(x, y) {
        this.tileX = x;
        this.tileY = y;
        this.pixelX = x * TILE + TILE / 2;
        this.pixelY = y * TILE + TILE / 2;
        this.dir = DIR.RIGHT;
        this.nextDir = DIR.RIGHT;
        this.speed = 2.5; // px/frame at 60fps equivalent
        this.moving = false;
        this.mouthAngle = 0.3;
        this.mouthDir = 1;
        this.alive = true;
        this.deathAnim = 0; // 0=alive, >0=dying
        // radius is dynamic getter
        this.powerMode = false;
        this.powerTimer = 0;
    }

    get radius() { return TILE * 0.42; }

    setDir(d) { this.nextDir = d; }

    canMove(tileX, tileY, maze) {
        if (tileX < 0) return true; // tunnel
        if (tileX >= maze.cols) return true;
        if (tileY < 0 || tileY >= maze.rows) return false;
        const t = maze.grid[tileY][tileX];
        return t !== T.WALL && t !== T.GHOST_HOUSE;
    }

    update(dt, maze) {
        if (!this.alive) {
            this.deathAnim += dt * 2;
            return;
        }

        // Animate mouth
        this.mouthAngle += this.mouthDir * 0.12;
        if (this.mouthAngle > 0.35) this.mouthDir = -1;
        if (this.mouthAngle < 0.02) this.mouthDir = 1;

        // Power mode timer
        if (this.powerMode) {
            this.powerTimer -= dt;
            if (this.powerTimer <= 0) {
                this.powerMode = false;
                // Reset ghost eat combo so next power pellet starts fresh
                if (Game && Game.ghostEatCombo !== undefined) Game.ghostEatCombo = 0;
            }
        }

        // Center of current tile (target for alignment)
        const targetX = this.tileX * TILE + TILE / 2;
        const targetY = this.tileY * TILE + TILE / 2;

        // How close to center?
        const dx = targetX - this.pixelX;
        const dy = targetY - this.pixelY;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);

        if (distToCenter < this.speed * 1.5) {
            // Snap to center then try new direction
            this.pixelX = targetX;
            this.pixelY = targetY;

            // Tunnel wrap - snap pixel position instantly for true teleportation effect
            if (this.tileX < 0) {
                this.tileX = maze.cols - 1;
                this.pixelX = this.tileX * TILE + TILE / 2;
            }
            if (this.tileX >= maze.cols) {
                this.tileX = 0;
                this.pixelX = TILE / 2;
            }

            // Try next direction first
            const nxt = this.nextDir;
            const ntx = this.tileX + nxt.x;
            const nty = this.tileY + nxt.y;
            if (this.canMove(ntx, nty, maze)) {
                this.dir = this.nextDir;
            }
            // Try current direction
            const ctx2 = this.tileX + this.dir.x;
            const cty = this.tileY + this.dir.y;
            if (this.canMove(ctx2, cty, maze)) {
                this.tileX += this.dir.x;
                this.tileY += this.dir.y;
                // Wrap tunnels and snap pixel position immediately for instant teleportation
                if (this.tileX < 0) {
                    this.tileX = maze.cols - 1;
                    this.pixelX = this.tileX * TILE + TILE / 2;
                }
                if (this.tileX >= maze.cols) {
                    this.tileX = 0;
                    this.pixelX = TILE / 2;
                }
                this.moving = true;
            } else {
                this.moving = false;
            }
        } else {
            // Move towards center
            const speed = this.speed;
            if (Math.abs(dx) > 0.5) this.pixelX += Math.sign(dx) * Math.min(speed, Math.abs(dx));
            if (Math.abs(dy) > 0.5) this.pixelY += Math.sign(dy) * Math.min(speed, Math.abs(dy));
            this.moving = true;
        }
    }

    draw(ctx, screenShake) {
        if (!this.alive && this.deathAnim >= 1.2) return;

        ctx.save();
        ctx.translate(this.pixelX, this.pixelY);

        if (!this.alive) {
            // Death animation: shrink and spin
            const scale = Math.max(0, 1 - this.deathAnim / 1.2);
            const rotation = this.deathAnim * Math.PI * 3;
            ctx.rotate(rotation);
            ctx.scale(scale, scale);
        } else {
            // Face direction
            if (this.dir === DIR.RIGHT) ctx.rotate(0);
            else if (this.dir === DIR.LEFT) ctx.rotate(Math.PI);
            else if (this.dir === DIR.UP) ctx.rotate(-Math.PI / 2);
            else if (this.dir === DIR.DOWN) ctx.rotate(Math.PI / 2);
        }

        const r = this.radius;
        const mouth = this.alive ? this.mouthAngle : 0;

        // Glow
        if (this.powerMode) {
            ctx.shadowBlur = 25;
            ctx.shadowColor = '#ff00ff';
        } else {
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#ffff00';
        }

        // Body
        ctx.fillStyle = this.powerMode ? '#ff88ff' : '#ffff00';
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.arc(0, 0, r, mouth * Math.PI, (2 - mouth) * Math.PI);
        ctx.closePath();
        ctx.fill();

        // Hex detail on body
        ctx.strokeStyle = this.powerMode ? '#dd00dd' : '#cccc00';
        ctx.lineWidth = 1;
        ctx.stroke();

        // Eye
        const eyeR = r * 0.15;
        ctx.fillStyle = '#000';
        ctx.shadowBlur = 0;
        ctx.beginPath();
        ctx.arc(r * 0.25, -r * 0.45, eyeR, 0, Math.PI * 2);
        ctx.fill();

        ctx.restore();
    }
}

// ─── GHOST ───────────────────────────────────────────────────
class Ghost {
    constructor(def, tileX, tileY, exitDelay) {
        this.def = def;
        this.tileX = tileX;
        this.tileY = tileY;
        this.pixelX = tileX * TILE + TILE / 2;
        this.pixelY = tileY * TILE + TILE / 2;
        this.dir = DIR.UP;
        this.speed = 2.0;
        this.state = 'house'; // house, chase, scatter, frightened, eaten
        this.exitDelay = exitDelay; // frames before leaving house
        this.exitTimer = exitDelay;
        this.scatterTimer = 0;
        this.chaseTimer = 0;
        this.frightenTimer = 0;
        this.eatTimer = 0;
        this.ghostScore = 200;
        this.bodyOsc = 0;
        this.alive = true;
        this.exitY = null; // target Y to exit house
    }

    frighten(duration) {
        if (this.state === 'eaten') return;
        this.state = 'frightened';
        this.frightenTimer = duration;
        // Reverse direction
        this.dir = { x: -this.dir.x, y: -this.dir.y };
    }

    eat() {
        this.state = 'eaten';
        this.frightenTimer = 0;
    }

    getTarget(player, ghosts, maze) {
        const px = player.tileX, py = player.tileY;
        const pd = player.dir;

        switch (this.def.name) {
            case 'ALPHA': // Direct chase
                return { x: px, y: py };
            case 'BETA': // Ambush - 4 tiles ahead
                return { x: px + pd.x * 4, y: py + pd.y * 4 };
            case 'GAMMA': { // Flanker - vector from alpha to 2 tiles ahead
                const alpha = ghosts.find(g => g.def.name === 'ALPHA');
                if (!alpha) return { x: px, y: py };
                const midX = px + pd.x * 2, midY = py + pd.y * 2;
                return { x: midX + (midX - alpha.tileX), y: midY + (midY - alpha.tileY) };
            }
            case 'DELTA': { // Shy - chase if far, scatter if close
                const d = Math.abs(px - this.tileX) + Math.abs(py - this.tileY);
                if (d > 8) return { x: px, y: py };
                // Go to scatter corner
                const sc = this.def.scatter;
                return {
                    x: sc.x < 0 ? 0 : (sc.x > 0 ? maze.cols - 1 : Math.floor(maze.cols / 2)),
                    y: sc.y < 0 ? 0 : (sc.y > 0 ? maze.rows - 1 : Math.floor(maze.rows / 2))
                };
            }
            default: return { x: px, y: py };
        }
    }

    chooseDir(target, maze) {
        // Can't reverse unless frightened/eaten
        const reverse = { x: -this.dir.x, y: -this.dir.y };
        let best = null, bestDist = Infinity;
        const validDirs = [];

        // Shuffle DIRS for unbiased random selection
        const shuffled = DIRS.slice().sort(() => Math.random() - 0.5);

        for (const d of shuffled) {
            if (d.x === reverse.x && d.y === reverse.y && this.state !== 'frightened') continue;
            const nx = this.tileX + d.x, ny = this.tileY + d.y;

            // Allow tunnel wrapping (out-of-bounds on X axis for tunnel rows)
            const wrappedX = nx < 0 ? maze.cols - 1 : (nx >= maze.cols ? 0 : nx);
            const wrappedY = ny;

            if (wrappedY < 0 || wrappedY >= maze.rows) continue;
            const t = maze.grid[wrappedY][wrappedX];
            if (t === T.WALL) continue;
            if (t === T.GHOST_HOUSE && this.state !== 'house' && this.state !== 'eaten') continue;

            if (this.state === 'frightened') {
                validDirs.push(d);
            } else {
                const dist = Math.abs(wrappedX - target.x) + Math.abs(wrappedY - target.y);
                if (dist < bestDist) { bestDist = dist; best = d; }
            }
        }

        if (this.state === 'frightened') {
            return validDirs.length > 0 ? validDirs[Math.floor(Math.random() * validDirs.length)] : this.dir;
        }
        return best || this.dir;
    }

    update(dt, maze, player, ghosts, levelCfg) {
        this.bodyOsc += dt * 8;

        const spd = this.speed * levelCfg.ghostSpd;

        // Handle exit from ghost house (exitDelay is in seconds)
        if (this.state === 'house') {
            this.exitTimer -= dt;
            if (this.exitTimer <= 0) {
                this.state = 'scatter';
                this.scatterTimer = 7;
            } else {
                // Bob in house
                this.pixelY = this.tileY * TILE + TILE / 2 + Math.sin(this.bodyOsc) * 4;
                return;
            }
        }

        // State timers
        if (this.state === 'scatter') {
            this.scatterTimer -= dt;
            if (this.scatterTimer <= 0) { this.state = 'chase'; this.chaseTimer = 20; }
        } else if (this.state === 'chase') {
            this.chaseTimer -= dt;
            if (this.chaseTimer <= 0) { this.state = 'scatter'; this.scatterTimer = 7; }
        } else if (this.state === 'frightened') {
            this.frightenTimer -= dt;
            if (this.frightenTimer <= 0) { this.state = 'chase'; this.chaseTimer = 15; }
        } else if (this.state === 'eaten') {
            // Return to ghost house center
            this.eatTimer += dt;
        }

        // Determine target
        let target;
        if (this.state === 'scatter') {
            const sc = this.def.scatter;
            target = {
                x: sc.x < 0 ? 2 : (sc.x > 0 ? maze.cols - 3 : Math.floor(maze.cols / 2)),
                y: sc.y < 0 ? 2 : (sc.y > 0 ? maze.rows - 3 : Math.floor(maze.rows / 2))
            };
        } else if (this.state === 'eaten') {
            target = { x: Math.floor(maze.cols / 2), y: Math.floor(maze.rows / 2) };
        } else {
            target = this.getTarget(player, ghosts, maze);
        }

        // Tile-based movement
        const targetPX = this.tileX * TILE + TILE / 2;
        const targetPY = this.tileY * TILE + TILE / 2;
        const dx = targetPX - this.pixelX;
        const dy = targetPY - this.pixelY;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < spd * 1.5) {
            this.pixelX = targetPX;
            this.pixelY = targetPY;

            // Tunnel wrap - snap pixel instantly
            if (this.tileX <= 0 && this.dir.x < 0) { this.tileX = maze.cols - 1; this.pixelX = this.tileX * TILE + TILE / 2; }
            if (this.tileX >= maze.cols - 1 && this.dir.x > 0) { this.tileX = 0; this.pixelX = TILE / 2; }

            // Choose next direction at tile center
            this.dir = this.chooseDir(target, maze);
            this.tileX += this.dir.x;
            this.tileY += this.dir.y;

            // Wrap Y axis (clamp only, no tunnels vertically)
            this.tileY = Math.max(0, Math.min(maze.rows - 1, this.tileY));
            // Wrap X axis for tunnels
            if (this.tileX < 0) { this.tileX = maze.cols - 1; this.pixelX = this.tileX * TILE + TILE / 2; }
            if (this.tileX >= maze.cols) { this.tileX = 0; this.pixelX = TILE / 2; }

            // Check if eaten ghost returned home
            if (this.state === 'eaten') {
                const centerX = Math.floor(maze.cols / 2);
                const centerY = Math.floor(maze.rows / 2);
                if (Math.abs(this.tileX - centerX) < 2 && Math.abs(this.tileY - centerY) < 2) {
                    this.state = 'scatter'; this.scatterTimer = 5;
                    // Snap to a valid ghost house tile to prevent getting stuck in walls
                    let spawnX = centerX, spawnY = centerY;
                    for (let dy = -2; dy <= 2; dy++) {
                        for (let dx = -2; dx <= 2; dx++) {
                            const tx = centerX + dx, ty = centerY + dy;
                            if (tx >= 0 && tx < maze.cols && ty >= 0 && ty < maze.rows && maze.grid[ty][tx] === T.GHOST_HOUSE) {
                                spawnX = tx; spawnY = ty; break;
                            }
                        }
                        if (maze.grid[spawnY] && maze.grid[spawnY][spawnX] === T.GHOST_HOUSE) break;
                    }
                    this.tileX = spawnX; this.tileY = spawnY;
                    this.pixelX = spawnX * TILE + TILE / 2; this.pixelY = spawnY * TILE + TILE / 2;
                }
            }
        } else {
            const spd2 = this.state === 'frightened' ? spd * 0.6 : (this.state === 'eaten' ? spd * 1.8 : spd);
            this.pixelX += Math.sign(dx) * Math.min(spd2, Math.abs(dx));
            this.pixelY += Math.sign(dy) * Math.min(spd2, Math.abs(dy));
        }
    }

    draw(ctx) {
        ctx.save();
        ctx.translate(this.pixelX, this.pixelY);
        const r = TILE * 0.42;
        const bob = Math.sin(this.bodyOsc) * 1.5;
        const fr = this.state === 'frightened';
        const nearEnd = fr && this.frightenTimer < 2;
        const eaten = this.state === 'eaten';

        // Glow
        ctx.shadowBlur = fr ? 20 : 12;
        ctx.shadowColor = fr ? (nearEnd ? '#ffffff' : '#0044ff') : this.def.color;

        // Body color
        let bodyColor;
        if (eaten) bodyColor = 'transparent';
        else if (fr) bodyColor = nearEnd ? (Math.floor(Date.now() / 200) % 2 === 0 ? '#ffffff' : '#0044ff') : '#2222bb';
        else bodyColor = this.def.color;

        if (!eaten) {
            // Ghost body shape
            ctx.fillStyle = bodyColor;
            ctx.beginPath();
            // Head (semicircle)
            ctx.arc(0, bob - r * 0.2, r, Math.PI, 0);
            // Skirt with wiggly bottom
            const skirtY = bob + r * 0.9;
            ctx.lineTo(r, skirtY);
            // Wiggly bottom
            const waves = 3;
            const waveW = (r * 2) / waves;
            for (let i = 0; i < waves; i++) {
                const wx = r - i * waveW;
                ctx.quadraticCurveTo(wx - waveW * 0.25, skirtY + r * 0.35, wx - waveW * 0.5, skirtY);
                ctx.quadraticCurveTo(wx - waveW * 0.75, skirtY - r * 0.15, wx - waveW, skirtY);
            }
            ctx.lineTo(-r, bob - r * 0.2);
            ctx.closePath();
            ctx.fill();

            // Eyes
            if (!fr) {
                // White part
                ctx.fillStyle = '#fff';
                ctx.shadowBlur = 0;
                ctx.beginPath(); ctx.ellipse(-r * 0.32, bob - r * 0.15, r * 0.25, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(r * 0.32, bob - r * 0.15, r * 0.25, r * 0.3, 0, 0, Math.PI * 2); ctx.fill();
                // Pupils
                ctx.fillStyle = '#0033ff';
                const pupilOffX = this.dir.x * r * 0.1;
                const pupilOffY = this.dir.y * r * 0.1;
                ctx.beginPath(); ctx.ellipse(-r * 0.32 + pupilOffX, bob - r * 0.15 + pupilOffY, r * 0.12, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.ellipse(r * 0.32 + pupilOffX, bob - r * 0.15 + pupilOffY, r * 0.12, r * 0.15, 0, 0, Math.PI * 2); ctx.fill();
            } else {
                // Scared eyes: X or blinking
                ctx.fillStyle = '#fff';
                ctx.font = 'bold 8px monospace';
                ctx.textAlign = 'center';
                ctx.fillText('><', 0, bob - r * 0.1);
            }
        } else {
            // Just eyes when eaten
            ctx.shadowBlur = 0;
            ctx.fillStyle = '#fff';
            ctx.beginPath(); ctx.ellipse(-r * 0.32, bob, r * 0.2, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.32, bob, r * 0.2, r * 0.25, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = '#0033ff';
            ctx.beginPath(); ctx.ellipse(-r * 0.32, bob, r * 0.1, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.ellipse(r * 0.32, bob, r * 0.1, r * 0.12, 0, 0, Math.PI * 2); ctx.fill();
        }

        // Name tag
        ctx.shadowBlur = 0;
        ctx.fillStyle = 'rgba(255,255,255,0.4)';
        ctx.font = '6px monospace';
        ctx.textAlign = 'center';
        ctx.fillText(this.def.name[0], 0, bob + r * 1.6);

        ctx.restore();
    }
}

// ─── MAZE RENDERER ───────────────────────────────────────────
function drawMaze(ctx, maze, frame, levelColor) {
    const { grid, cols, rows } = maze;

    // First pass: fill all non-wall backgrounds
    ctx.fillStyle = '#000811';
    ctx.fillRect(0, 0, cols * TILE, rows * TILE);

    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            const t = grid[y][x];
            const px = x * TILE, py = y * TILE;

            if (t === T.WALL) {
                // Wall fill
                ctx.fillStyle = levelColor + '28';
                ctx.fillRect(px, py, TILE, TILE);
                // Neon border
                ctx.strokeStyle = levelColor;
                ctx.lineWidth = Math.max(1, TILE * 0.07);
                ctx.shadowBlur = 8;
                ctx.shadowColor = levelColor;
                ctx.strokeRect(px + 1, py + 1, TILE - 2, TILE - 2);
                ctx.shadowBlur = 0;

            } else if (t === T.GHOST_HOUSE) {
                ctx.fillStyle = '#110022';
                ctx.fillRect(px, py, TILE, TILE);
                ctx.strokeStyle = '#550088';
                ctx.lineWidth = 1;
                ctx.strokeRect(px, py, TILE, TILE);

            } else if (t === T.DOT) {
                const dotR = Math.max(2, TILE * 0.11);
                ctx.fillStyle = '#ffffffcc';
                ctx.shadowBlur = 5;
                ctx.shadowColor = '#ffffff';
                ctx.beginPath();
                ctx.arc(px + TILE / 2, py + TILE / 2, dotR, 0, Math.PI * 2);
                ctx.fill();
                ctx.shadowBlur = 0;

            } else if (t === T.POWER) {
                const blink = Math.floor(frame / 15) % 2 === 0;
                if (blink) {
                    const pelletR = Math.max(4, TILE * 0.28);
                    ctx.fillStyle = '#ff88ff';
                    ctx.shadowBlur = 18;
                    ctx.shadowColor = '#ff00ff';
                    ctx.beginPath();
                    ctx.arc(px + TILE / 2, py + TILE / 2, pelletR, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.shadowBlur = 0;
                }

            } else if (t === T.TUNNEL) {
                // Draw tunnel as open corridor with directional arrow hints
                ctx.fillStyle = '#000811';
                ctx.fillRect(px, py, TILE, TILE);
                // Horizontal corridor highlight
                ctx.fillStyle = levelColor + '22';
                ctx.fillRect(px, py + TILE * 0.3, TILE, TILE * 0.4);
                // Arrow pointing outward
                ctx.fillStyle = levelColor + '88';
                ctx.shadowBlur = 4;
                ctx.shadowColor = levelColor;
                const arrowDir = x === 0 ? -1 : 1;
                const cx2 = px + TILE / 2, cy2 = py + TILE / 2;
                ctx.beginPath();
                if (arrowDir < 0) {
                    ctx.moveTo(cx2 - TILE * 0.3, cy2);
                    ctx.lineTo(cx2 + TILE * 0.1, cy2 - TILE * 0.2);
                    ctx.lineTo(cx2 + TILE * 0.1, cy2 + TILE * 0.2);
                } else {
                    ctx.moveTo(cx2 + TILE * 0.3, cy2);
                    ctx.lineTo(cx2 - TILE * 0.1, cy2 - TILE * 0.2);
                    ctx.lineTo(cx2 - TILE * 0.1, cy2 + TILE * 0.2);
                }
                ctx.closePath();
                ctx.fill();
                ctx.shadowBlur = 0;

            } else {
                // Empty passage
                ctx.fillStyle = '#000811';
                ctx.fillRect(px, py, TILE, TILE);
            }
        }
    }

    // Subtle grid overlay
    ctx.strokeStyle = 'rgba(0,102,204,0.03)';
    ctx.lineWidth = 0.5;
    for (let y = 0; y < rows; y++) {
        for (let x = 0; x < cols; x++) {
            ctx.strokeRect(x * TILE, y * TILE, TILE, TILE);
        }
    }
}

// ─── SCREEN SHAKE ─────────────────────────────────────────────
class ScreenShake {
    constructor() { this.intensity = 0; this.duration = 0; }
    shake(intensity, duration) { this.intensity = intensity; this.duration = duration; }
    update(dt) { if (this.duration > 0) { this.duration -= dt; if (this.duration < 0) this.duration = 0; } }
    getOffset() {
        if (this.duration <= 0) return { x: 0, y: 0 };
        return {
            x: (Math.random() - 0.5) * this.intensity * 2,
            y: (Math.random() - 0.5) * this.intensity * 2
        };
    }
}

// ─── MAIN GAME STATE ─────────────────────────────────────────
const Game = {
    state: 'menu', // menu, playing, paused, dying, levelcomplete, gameover
    level: 1,
    score: 0,
    highScore: 0,
    lives: 3,
    frame: 0,
    maze: null,
    player: null,
    ghosts: [],
    particles: new ParticleSystem(),
    shake: new ScreenShake(),
    ghostEatCombo: 0, // for 200,400,800,1600 chain
    stateTimer: 0,
    dotCount: 0,

    init() {
        this.score = 0;
        this.lives = 3;
        this.level = 1;
        this.highScore = parseInt(localStorage.getItem('hexman_hi') || '0');
        this.startLevel();
    },

    startLevel() {
        const cfg = LEVEL_CONFIGS[Math.min(this.level - 1, 9)];
        const maze = buildMaze(cfg.cols, cfg.rows, this.level);
        this.maze = maze;
        this.dotCount = maze.dotCount;

        // Compute tile size to fill viewport, then resize canvas
        TILE = computeTile(maze.cols, maze.rows);
        canvas.width = maze.cols * TILE;
        canvas.height = maze.rows * TILE;

        // Resize wrapper to match
        const wrapper = document.getElementById('game-wrapper');
        wrapper.style.width = canvas.width + 'px';

        this.player = new HexMan(maze.spawn.x, maze.spawn.y);
        this.player.speed = 2.5 + (this.level - 1) * 0.08;

        this.ghosts = [];
        const numGhosts = Math.min(4, 1 + Math.floor(this.level / 2));
        for (let i = 0; i < numGhosts; i++) {
            const sp = maze.ghostSpawns[i] || maze.ghostSpawns[0];
            const delay = i * 2.0 + 1.0;  // seconds: 1s, 3s, 5s, 7s
            const g = new Ghost(GHOST_DEFS[i], sp.x, sp.y, delay);
            g.speed = 1.8 + (this.level - 1) * 0.06;
            this.ghosts.push(g);
        }

        this.ghostEatCombo = 0;
        this.particles = new ParticleSystem();

        // Update UI
        this.updateHUD();

        audio.startBgLoop(this.level);
        this.state = 'frozen'; // wait for ENGAGE click
        this.stateTimer = 0;
    },

    restartLevel() {
        // Keep score and lives, restart maze
        const cfg = LEVEL_CONFIGS[Math.min(this.level - 1, 9)];
        const maze = buildMaze(cfg.cols, cfg.rows, this.level);
        this.maze = maze;
        this.dotCount = maze.dotCount;

        TILE = computeTile(maze.cols, maze.rows);
        canvas.width = maze.cols * TILE;
        canvas.height = maze.rows * TILE;
        document.getElementById('game-wrapper').style.width = canvas.width + 'px';

        this.player = new HexMan(maze.spawn.x, maze.spawn.y);
        this.player.speed = 2.5 + (this.level - 1) * 0.08;
        this.ghosts = [];
        const numGhosts = Math.min(4, 1 + Math.floor(this.level / 2));
        for (let i = 0; i < numGhosts; i++) {
            const sp = maze.ghostSpawns[i] || maze.ghostSpawns[0];
            const g = new Ghost(GHOST_DEFS[i], sp.x, sp.y, i * 2.0 + 1.0);
            g.speed = 1.8 + (this.level - 1) * 0.06;
            this.ghosts.push(g);
        }
        this.ghostEatCombo = 0;
        this.state = 'frozen';
        this.stateTimer = 0;
        this.updateHUD();
        this.startCountdown();
    },

    startCountdown() {
        this.state = 'countdown';
        this.countdownValue = 3;
        this.countdownTimer = 0;
        audio.startJingle();
    },

    updateHUD() {
        document.getElementById('score-display').textContent = this.score.toString().padStart(6, '0');
        document.getElementById('level-display').textContent = this.level;
        const lifeStr = '⬡'.repeat(this.lives);
        document.getElementById('lives-display').textContent = lifeStr || '✕';
        document.getElementById('pellets-left').textContent = `DOTS: ${this.dotCount}`;
    },

    addScore(pts) {
        this.score += pts;
        if (this.score > this.highScore) {
            this.highScore = this.score;
            localStorage.setItem('hexman_hi', this.highScore);
        }
        this.updateHUD();
    },

    eatDot(x, y) {
        const cfg = LEVEL_CONFIGS[Math.min(this.level - 1, 9)];
        const pts = Math.round(10 * cfg.dotBonus);
        this.addScore(pts);
        this.dotCount--;
        this.updateHUD();
        audio.eatDot();
        this.particles.spawn(x, y, '#ffffffaa', 4, 1.5, 0.3);
        if (this.dotCount <= 0) this.levelComplete();
    },

    eatPower(x, y) {
        this.addScore(50);
        this.dotCount--;
        this.updateHUD();
        audio.eatPower();
        this.particles.spawn(x, y, '#ff88ff', 12, 3, 0.8);
        this.shake.shake(4, 0.3);
        // Frighten all ghosts
        const dur = Math.max(4, 8 - (this.level - 1) * 0.7);
        for (const g of this.ghosts) g.frighten(dur);
        this.player.powerMode = true;
        this.player.powerTimer = dur;
        this.player.powerDuration = dur; // store max for bar
        this.ghostEatCombo = 0;
        audio.powerMode(true);
        // Show power bar
        const pwBar = document.getElementById('power-bar-wrap');
        const pwFill = document.getElementById('power-bar');
        if (pwBar) { pwBar.style.display = 'block'; pwFill.style.width = '100%'; pwFill.style.background = '#ff00ff'; }
        if (this.dotCount <= 0) this.levelComplete();
    },

    eatGhost(ghost) {
        this.ghostEatCombo++;
        const pts = 200 * Math.pow(2, this.ghostEatCombo - 1);
        this.addScore(pts);
        audio.eatGhost();
        this.particles.spawn(ghost.pixelX, ghost.pixelY, ghost.def.color, 16, 4, 1.0);
        this.particles.spawnText(ghost.pixelX - 20, ghost.pixelY, '+' + pts, '#ffff00');
        this.shake.shake(3, 0.2);
        ghost.eat();
    },

    playerDied() {
        this.stateTimer = 2.5;
        this.player.alive = false;
        audio.death();
        this.particles.spawn(this.player.pixelX, this.player.pixelY, '#ffff00', 20, 5, 1.5);
        this.shake.shake(8, 0.5);
    },

    levelComplete() {
        this.state = 'levelcomplete';
        this.stateTimer = 2.5;
        audio.levelComplete();
        // Celebrate
        for (let i = 0; i < 5; i++) {
            setTimeout(() => {
                this.particles.spawn(
                    Math.random() * canvas.width, Math.random() * canvas.height,
                    ['#ffff00', '#ff00ff', '#00ffff', '#00ff88'][Math.floor(Math.random() * 4)],
                    10, 4, 1.2
                );
            }, i * 200);
        }
        if (this.level >= 10) {
            // Game won
            setTimeout(() => this.showGameWin(), 2600);
        } else {
            setTimeout(() => {
                this.level++;
                // Bonus life on level up, capped at 3
                if (this.lives < 3) this.lives++;
                this.startLevel(); // sets state = 'frozen'
                showOverlay('levelintro');
            }, 2600);
        }
    },

    update(dt) {
        if (this.state === 'countdown') {
            this.countdownTimer += dt;
            if (this.countdownTimer >= 1.0) {
                this.countdownTimer = 0;
                this.countdownValue--;
                if (this.countdownValue < 0) {
                    this.state = 'playing';
                } else {
                    // Beep on each count
                    audio._beep(this.countdownValue === 0 ? 880 : 440, 0.18, 'square', 0.3);
                }
            }
            this.particles.update(dt);
            return;
        }

        if (this.state === 'frozen') {
            // Draw static maze behind overlay
            const cfg2 = LEVEL_CONFIGS[Math.min(this.level - 1, 9)];
            ctx.fillStyle = '#000811';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            drawMaze(ctx, this.maze, 0, cfg2.color);
            if (this.player) this.player.draw(ctx, { x: 0, y: 0 });
            for (const g of this.ghosts) g.draw(ctx);
            return;
        }

        if (this.state === 'playing') {
            this.frame++;
            this.shake.update(dt);
            this.particles.update(dt);

            // Update player
            this.player.update(dt, this.maze);

            // Update power mode bar
            if (this.player.powerMode) {
                const pct = Math.max(0, this.player.powerTimer / (this.player.powerDuration || 8)) * 100;
                const pwFill = document.getElementById('power-bar');
                if (pwFill) {
                    pwFill.style.width = pct + '%';
                    // Flash red when under 2 seconds
                    pwFill.style.background = this.player.powerTimer < 2 ?
                        (Math.floor(Date.now() / 200) % 2 === 0 ? '#ff0000' : '#ff88ff') : '#ff00ff';
                }
            } else {
                const pwBar = document.getElementById('power-bar-wrap');
                if (pwBar) pwBar.style.display = 'none';
            }

            // Check dot/power eating
            const px = this.player.tileX, py = this.player.tileY;
            if (px >= 0 && px < this.maze.cols && py >= 0 && py < this.maze.rows) {
                const tile = this.maze.grid[py][px];
                if (tile === T.DOT) {
                    this.maze.grid[py][px] = T.EMPTY;
                    this.eatDot(this.player.pixelX, this.player.pixelY);
                } else if (tile === T.POWER) {
                    this.maze.grid[py][px] = T.EMPTY;
                    this.eatPower(this.player.pixelX, this.player.pixelY);
                }
            }

            // Update ghosts
            const cfg = LEVEL_CONFIGS[Math.min(this.level - 1, 9)];
            for (const g of this.ghosts) {
                g.update(dt, this.maze, this.player, this.ghosts, cfg);

                // Collision with player
                const dx = g.pixelX - this.player.pixelX;
                const dy = g.pixelY - this.player.pixelY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                if (dist < TILE * 0.75) {
                    if (g.state === 'frightened') {
                        this.eatGhost(g);
                    } else if (g.state !== 'eaten' && this.player.alive && this.state === 'playing') {
                        // Player dies — guard with state check to prevent multi-trigger
                        this.state = 'dying';
                        this.lives--;
                        this.updateHUD();
                        this.playerDied();
                        if (this.lives <= 0) {
                            setTimeout(() => this.gameOver(), 2600);
                        } else {
                            setTimeout(() => this.respawnInLevel(), 2600);
                        }
                    }
                }
            }

        } else if (this.state === 'dying' || this.state === 'levelcomplete') {
            this.particles.update(dt);
            this.shake.update(dt);
            if (!this.player.alive) this.player.update(dt, this.maze);
        }
    },

    draw() {
        // Screen shake
        const offset = this.shake.getOffset();
        ctx.save();
        ctx.translate(offset.x, offset.y);

        // Clear
        ctx.fillStyle = '#000811';
        ctx.fillRect(-10, -10, canvas.width + 20, canvas.height + 20);

        // Draw maze
        const cfg = LEVEL_CONFIGS[Math.min(this.level - 1, 9)];
        drawMaze(ctx, this.maze, this.frame, cfg.color);

        // Draw player
        if (this.player) this.player.draw(ctx, offset);

        // Draw ghosts
        for (const g of this.ghosts) g.draw(ctx);

        // Particles
        this.particles.draw(ctx);

        ctx.restore();

        // Level state overlays (drawn on top without shake)
        if (this.state === 'levelcomplete') {
            ctx.fillStyle = 'rgba(0,8,17,0.5)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = `bold 28px 'Orbitron', sans-serif`;
            ctx.fillStyle = cfg.color;
            ctx.shadowBlur = 20;
            ctx.shadowColor = cfg.color;
            ctx.textAlign = 'center';
            ctx.fillText('LEVEL CLEAR!', canvas.width / 2, canvas.height / 2 - 20);
            ctx.font = `14px 'Orbitron', sans-serif`;
            ctx.fillStyle = '#ffff00';
            ctx.shadowColor = '#ffff00';
            if (this.level < 10) {
                ctx.fillText(`ENTERING ${LEVEL_CONFIGS[this.level].name}`, canvas.width / 2, canvas.height / 2 + 20);
            }
            ctx.shadowBlur = 0;
            ctx.textAlign = 'left';
        }

        if (this.state === 'dying') {
            if (this.lives <= 0) {
                ctx.fillStyle = 'rgba(0,8,17,0.5)';
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.font = `bold 24px 'Orbitron',sans-serif`;
                ctx.fillStyle = '#ff3333';
                ctx.shadowBlur = 20; ctx.shadowColor = '#ff3333';
                ctx.textAlign = 'center';
                ctx.fillText('SYSTEM FAILURE', canvas.width / 2, canvas.height / 2);
                ctx.shadowBlur = 0; ctx.textAlign = 'left';
            }
        }

        // Countdown overlay
        if (this.state === 'countdown') {
            ctx.fillStyle = 'rgba(0,8,17,0.55)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            const label = this.countdownValue === 0 ? 'GO!' : String(this.countdownValue);
            const progress = this.countdownTimer; // 0..1
            const scale = 1 + (1 - progress) * 0.6; // zoom in as time passes
            const alpha = this.countdownValue === 0 ? Math.min(1, progress * 3) : 1;
            const color = this.countdownValue === 0 ? '#00ff88' : '#00ffff';
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(scale, scale);
            ctx.globalAlpha = alpha;
            ctx.font = `bold ${this.countdownValue === 0 ? 56 : 72}px 'Orbitron', sans-serif`;
            ctx.fillStyle = color;
            ctx.shadowBlur = 40;
            ctx.shadowColor = color;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, 0, 0);
            ctx.shadowBlur = 0;
            ctx.restore();
            ctx.globalAlpha = 1;
            ctx.textBaseline = 'alphabetic';
            ctx.textAlign = 'left';
        }

        // Paused
        if (this.state === 'paused') {
            ctx.fillStyle = 'rgba(0,8,17,0.7)';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.font = `bold 28px 'Orbitron',sans-serif`;
            ctx.fillStyle = '#00ffff'; ctx.shadowBlur = 20; ctx.shadowColor = '#00ffff';
            ctx.textAlign = 'center';
            ctx.fillText('PAUSED', canvas.width / 2, canvas.height / 2);
            ctx.font = `11px 'Share Tech Mono',monospace`;
            ctx.fillStyle = 'rgba(0,255,255,0.5)';
            ctx.shadowBlur = 0;
            ctx.fillText('PRESS P TO RESUME', canvas.width / 2, canvas.height / 2 + 30);
            ctx.textAlign = 'left';
        }
    },

    // Respawn player in the SAME level, same maze, same dots remaining
    respawnInLevel() {
        // Reset player to spawn
        this.player = new HexMan(this.maze.spawn.x, this.maze.spawn.y);
        this.player.speed = 2.5 + (this.level - 1) * 0.08;

        // Reset ghosts back to house
        this.ghosts = [];
        const numGhosts = Math.min(4, 1 + Math.floor(this.level / 2));
        for (let i = 0; i < numGhosts; i++) {
            const sp = this.maze.ghostSpawns[i] || this.maze.ghostSpawns[0];
            const g = new Ghost(GHOST_DEFS[i], sp.x, sp.y, i * 2.0 + 1.0);
            g.speed = 1.8 + (this.level - 1) * 0.06;
            this.ghosts.push(g);
        }
        this.ghostEatCombo = 0;
        this.particles = new ParticleSystem();
        this.updateHUD();
        this.startCountdown();
    },

    gameOver() {
        this.state = 'gameover';
        audio.gameOver();
        audio.stopBg();
        showOverlay('gameover');
    },

    showGameWin() {
        this.state = 'gamewon';
        audio.levelComplete();
        audio.stopBg();
        showOverlay('gamewon');
    }
};

// ─── OVERLAY MANAGEMENT ──────────────────────────────────────
function showOverlay(type) {
    overlay.classList.remove('hidden');
    const cfg = LEVEL_CONFIGS[Math.min(Game.level - 1, 9)];
    let html = '';

    if (type === 'menu') {
        html = `
      <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:4px;">
        <img src="data:image/png;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDAAUDBAQEAwUEBAQFBQUGBwwIBwcHBw8LCwkMEQ8SEhEPERETFhwXExQaFRERGCEYGh0dHx8fExciJCIeJBweHx7/2wBDAQUFBQcGBw4ICA4eFBEUHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh4eHh7/wAARCAeMB9ADASIAAhEBAxEB/8QAHQABAAAHAQEAAAAAAAAAAAAAAAIDBAUGBwgJAf/EAFwQAAICAQMCBAQDBAYGBQgAFwABAgMEBQYREiEHEzFBCCJRYRQycRUjgZFCUmJyobEJJDOCwdEWkrLC4RcYQ1Njc5OiozRUg5WzJThVdZTSZaTD8TY3Vld0hNP/xAAaAQEBAQEBAQEAAAAAAAAAAAAAAQIDBAUG/8QAJREBAQEBAAMBAQACAwADAQAAAAERAhIhMQNBBFEFEyIUMmFx/9oADAMBAAIRAxEAPwDjUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA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AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/9k=" alt="HEX-MAN Logo" style="width:72px;height:72px;object-fit:contain;filter:drop-shadow(0 0 12px rgba(0,255,255,0.5));border-radius:8px;" />
        <div>
          <div class="overlay-title cyan" style="margin-bottom:2px;">HEX-MAN</div>
          <div style="font-size:9px;color:rgba(255,0,255,0.7);letter-spacing:3px;font-family:'Share Tech Mono',monospace;">HEXAGONAL MAZE PURSUIT v1.0</div>
        </div>
      </div>
      <div class="ghost-legend" style="margin-top:14px;">
        <span><span class="ghost-dot" style="background:#ff3333"></span>ALPHA: CHASER</span>
        <span><span class="ghost-dot" style="background:#ff88ff"></span>BETA: AMBUSHER</span>
        <span><span class="ghost-dot" style="background:#00ffff"></span>GAMMA: FLANKER</span>
        <span><span class="ghost-dot" style="background:#ffaa00"></span>DELTA: ERRATIC</span>
      </div>
      <div class="controls-grid">
        <div class="ctrl-item"><span class="ctrl-key">↑↓←→</span><span>MOVE</span></div>
        <div class="ctrl-item"><span class="ctrl-key">WASD</span><span>MOVE</span></div>
        <div class="ctrl-item"><span class="ctrl-key">P</span><span>PAUSE</span></div>
        <div class="ctrl-item"><span class="ctrl-key">M</span><span>MUTE</span></div>
      </div>
      <div class="score-list">HIGH SCORE: <span>${Game.highScore.toString().padStart(6, '0')}</span></div>
      <div style="display:flex;justify-content:center;width:100%;margin:4px 0 10px;">
        <button class="overlay-btn" id="btn-start" style="width:220px;text-align:center;">START GAME</button>
      </div>
      <div style="font-size:9px;color:rgba(0,255,255,0.25);letter-spacing:2px;text-align:center;margin-bottom:6px;">
        EAT ALL DOTS · COLLECT POWER PELLETS · CHAIN GHOST KILLS<br>
        10 PROGRESSIVELY HARDER LEVELS
      </div>
      <div style="font-size:9px;color:rgba(255,255,255,0.2);letter-spacing:2px;font-family:'Share Tech Mono',monospace;text-align:center;margin-top:4px;border-top:1px solid rgba(0,255,255,0.08);padding-top:8px;">
        BY SARTHAK RAUTELA
      </div>
    `;
    } else if (type === 'levelintro') {
        const prev = LEVEL_CONFIGS[Math.min(Game.level - 2, 9)];
        html = `
      <div class="level-badge">LEVEL ${Game.level} OF 10</div>
      <div class="overlay-title" style="color:${cfg.color};text-shadow:0 0 20px ${cfg.color};">${cfg.name}</div>
      <div class="level-msg">
        GHOST SPEED: ${Math.round(cfg.ghostSpd * 100)}%<br>
        DOT BONUS: ×${cfg.dotBonus.toFixed(1)}<br>
        ACTIVE GHOSTS: ${Math.min(4, 1 + Math.floor(Game.level / 2))}
      </div>
      <div class="overlay-sub">SCORE: ${Game.score.toString().padStart(6, '0')}</div>
      <div style="font-size:13px;color:var(--neon-magenta);text-shadow:0 0 10px var(--neon-magenta);letter-spacing:3px;margin-bottom:14px;font-family:'Orbitron',sans-serif;">
        ${'⬡'.repeat(Game.lives)}${'○'.repeat(3 - Game.lives)} LIVES
      </div>
      <div style="display:flex;justify-content:center;width:100%;"><button class="overlay-btn" id="btn-go" style="border-color:${cfg.color};color:${cfg.color};width:220px;text-align:center;">ENGAGE</button></div>
    `;
    } else if (type === 'gameover') {
        html = `
      <div class="overlay-title magenta">GAME OVER</div>
      <div class="overlay-sub">
        FINAL SCORE: <span style="color:#ffff00;font-size:20px;">${Game.score.toString().padStart(6, '0')}</span><br>
        HIGH SCORE: ${Game.highScore.toString().padStart(6, '0')}<br>
        REACHED: ${LEVEL_CONFIGS[Math.min(Game.level - 1, 9)].name}
      </div>
      <div style="font-size:9px;color:rgba(255,0,255,0.5);letter-spacing:2px;margin-bottom:16px;">
        ALL LIVES LOST — RESTARTING FROM SECTOR 1
      </div>
      <div style="display:flex;gap:10px;justify-content:center;width:100%;">
        <button class="overlay-btn" id="btn-restart" style="width:180px;text-align:center;">TRY AGAIN</button>
        <button class="overlay-btn secondary" id="btn-menu" style="width:140px;text-align:center;">MENU</button>
      </div>
    `;
    } else if (type === 'gamewon') {
        html = `
      <div class="overlay-title yellow">VICTORY!</div>
      <div class="overlay-sub">
        ALL 10 SECTORS CLEARED<br>
        FINAL SCORE: <span style="color:#ffff00;font-size:22px;">${Game.score.toString().padStart(6, '0')}</span><br>
        HIGH SCORE: ${Game.highScore.toString().padStart(6, '0')}
      </div>
      <div style="margin:12px 0;font-size:10px;color:rgba(0,255,136,0.6);letter-spacing:2px;">
        ⬡ HEX-MAN SUPREME CHAMPION ⬡
      </div>
      <div style="display:flex;gap:10px;">
        <button class="overlay-btn" id="btn-restart">PLAY AGAIN</button>
        <button class="overlay-btn secondary" id="btn-menu">MENU</button>
      </div>
    `;
    }

    overlayContent.innerHTML = html;
    // Ensure all direct children are centered
    overlayContent.querySelectorAll('.overlay-title,.overlay-sub,.level-badge,.level-msg,.ghost-legend,.controls-grid,.score-list').forEach(el => {
        if (!el.style.textAlign) el.style.textAlign = 'center';
        el.style.alignSelf = 'center';
    });

    // Button events
    const btnStart = document.getElementById('btn-start');
    const btnGo = document.getElementById('btn-go');
    const btnRestart = document.getElementById('btn-restart');
    const btnMenu = document.getElementById('btn-menu');

    if (btnStart) btnStart.addEventListener('click', () => {
        audio.init();
        Game.init(); // sets state = 'frozen' via startLevel
        hideOverlay();
        showOverlay('levelintro');
    });
    if (btnGo) btnGo.addEventListener('click', () => {
        hideOverlay();
        Game.startCountdown();
    });
    if (btnRestart) btnRestart.addEventListener('click', () => {
        audio.init();
        Game.init();
        hideOverlay();
        showOverlay('levelintro');
    });
    if (btnMenu) btnMenu.addEventListener('click', () => {
        audio.stopBg();
        showOverlay('menu');
    });
}

function hideOverlay() {
    overlay.classList.add('hidden');
}

// ─── INPUT HANDLING ──────────────────────────────────────────
const keys = {};
document.addEventListener('keydown', e => {
    keys[e.key] = true;

    if (Game.state === 'playing') {
        if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') Game.player.setDir(DIR.UP);
        if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') Game.player.setDir(DIR.DOWN);
        if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') Game.player.setDir(DIR.LEFT);
        if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') Game.player.setDir(DIR.RIGHT);
        if (e.key === 'p' || e.key === 'P') {
            Game.state = 'paused';
        }
    } else if (Game.state === 'paused') {
        if (e.key === 'p' || e.key === 'P') Game.state = 'playing';
    }

    if (e.key === 'm' || e.key === 'M') {
        audio.enabled = !audio.enabled;
        if (audio.enabled) audio.stopBg(); // will restart next update
    }

    // Prevent arrow scroll
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) e.preventDefault();
});

document.addEventListener('keyup', e => { keys[e.key] = false; });

// ─── MOBILE D-PAD ────────────────────────────────────────────
function setupDpad() {
    const map = {
        'dpad-up': DIR.UP,
        'dpad-down': DIR.DOWN,
        'dpad-left': DIR.LEFT,
        'dpad-right': DIR.RIGHT
    };
    for (const [id, dir] of Object.entries(map)) {
        const btn = document.getElementById(id);
        if (!btn) continue;
        const press = (e) => {
            e.preventDefault();
            audio.init();
            if (Game.state === 'playing') Game.player.setDir(dir);
        };
        btn.addEventListener('touchstart', press, { passive: false });
        btn.addEventListener('mousedown', press);
    }
}
setupDpad();

// ─── GAME LOOP ───────────────────────────────────────────────
let lastTime = 0;
function gameLoop(timestamp) {
    const dt = Math.min((timestamp - lastTime) / 1000, 0.05);
    lastTime = timestamp;

    if (Game.state !== 'menu' && Game.state !== 'gameover' && Game.state !== 'gamewon') {
        Game.update(dt);
        Game.draw();
    }

    requestAnimationFrame(gameLoop);
}

// ─── INIT ─────────────────────────────────────────────────────
// Set initial canvas size based on viewport
TILE = computeTile(BASE_COLS, BASE_ROWS);
canvas.width = BASE_COLS * TILE;
canvas.height = BASE_ROWS * TILE;
document.getElementById('game-wrapper').style.width = canvas.width + 'px';

showOverlay('menu');
requestAnimationFrame(gameLoop);
