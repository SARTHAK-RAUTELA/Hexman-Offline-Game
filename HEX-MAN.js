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

// ghost coloors and personalities
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
    // ── LEVEL 1 ───────────────────────────────────────────────
    ['#####################',
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
        '#####################'],
    // ── LEVEL 2 ───────────────────────────────────────────────
    ['#####################',
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
        '#.###.#.###o###.#####',
        '#...#.#.......#.#...#',
        '#.#.#.###.#####.#.###',
        '#.#...#.#.#.....#...#',
        '#.#####.#.#.#######.#',
        '#o......#..........o#',
        '#####################'],
    // ── LEVEL 3 ───────────────────────────────────────────────
    ['#######################',
        '#o......#............o#',
        '#######.#.#######.#####',
        '#.....#.#.......#.....#',
        '#.#####.###o###.#####.#',
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
        '######o###.P.##.#####.#',
        '#.......#.#...#.#.....#',
        '###.###.#.###.###.###.#',
        '#...#.#...#.#...#...#.#',
        '#.###.###.#.###.###.###',
        '#...#.........#...#...#',
        '#.#.#############.###.#',
        '#o#..................o#',
        '#######################'],

    // ── LEVEL 4 ───────────────────────────────────────────────
    ['#######################',
        '#o....#.....#........o#',
        '#####.#.###.#####.###.#',
        '#...#...#...#...#.#.#.#',
        '#.#.#####.###.#.#.#.#.#',
        '#.#...#...#...#...#...#',
        '#.#####.###.#######.###',
        '#.....#...#.......#...#',
        '#.###.###.#.##o##.###.#',
        '#.#...#.#.#.....#.#.#.#',
        'T.....................T',
        '#.#.#...GGG.GGG...#...#',
        '#.#.###.GGGGGGG.###.###',
        '#.#.#...GGGGGGG.#.#...#',
        '#.#.#.#.........#.###.#',
        '#.#...#.#.#.....#.#...#',
        '#.#####.##.P.####.#.###',
        '#.....#.......#...#.#.#',
        '#####.###o###.#.#.#.#.#',
        '#...#...#...#.#.#...#.#',
        '#.#.###.###.#.#.#####.#',
        '#.#...#.....#.#...#...#',
        '#.#.#######.#.###.###.#',
        '#o#.........#........o#',
        '#######################'],

    // ── LEVEL 5 ───────────────────────────────────────────────
    ['#########################',
        '#o#...............#...#o#',
        '#.#######.###.###.#.#.#.#',
        '#.#.....#.#.#...#...#...#',
        '#.#.###.#.#.###.#######.#',
        '#.#.#...#...#...#...#...#',
        '#.#.#.#####.#.###.#.#####',
        '#...#.#...#.#.....#.....#',
        '#####.#.#.#.###########.#',
        '#...#.#.#.#.#.....#...#.#',
        'T.........o.............T',
        '#.#.#.#...........#.#...#',
        '###.#.##.GGG.GGG..#.###.#',
        '#...#....GGGGGGG..#.#...#',
        '#.#.###..GGGGGGG..#.#.###',
        '#.#...#...........#.#.#.#',
        '#.#####.#.#.###o#.#.#.#.#',
        '#.......#...P...#.#.#...#',
        '#.#######.###.#.#.#.#####',
        '#.#o......#...#...#.....#',
        '#.#######.###.###.#####.#',
        '#.#.....#.....#...#...#.#',
        '#.#.###.#######.###.#.#.#',
        '#.#.#...#.....#...#.#.#.#',
        '#.#.#.###.###.#####.#.#.#',
        '#o..#.....#.........#..o#',
        '#########################'],

    // ── LEVEL 6 ───────────────────────────────────────────────
    ['#########################',
        '#o..#.....#.........#..o#',
        '###.###.#.#.#######.#.#.#',
        '#.#...#o#...#.#...#...#.#',
        '#.###.#####.#.#.#.#####.#',
        '#.....#...#...#.#.#.....#',
        '#.#####.#.#####.#.#.###.#',
        '#.#.....#.....#.#...#.#.#',
        '#.#.###.#####.#.#####.#.#',
        '#.#.#...#...#...#.....#.#',
        'T.......................T',
        '#.....#...........#.#...#',
        '#######..GGGoGGG..#.#####',
        '#........GGGGGGG......#.#',
        '#.#.####.GGGGGGG.####.#.#',
        '#.#.................#...#',
        '#.#####.#.#####.###.###.#',
        '#.#...#...#.P.#.#...#...#',
        '#.#.#.#####o#.#.###.#.###',
        '#.#.#.....#.#.#...#.#...#',
        '#.#.###.###.#.###.#####.#',
        '#.#...#.....#...#.....#.#',
        '#.#############.###.###.#',
        '#...#.....#...#...#...#.#',
        '###.#.###.#.#.###.###.#.#',
        '#o....#.....#.......#..o#',
        '#########################'],

    // ── LEVEL 7 ───────────────────────────────────────────────
    ['###########################',
        '#o..#.......#.........#..o#',
        '###.#.#####.#.#.#######.#.#',
        '#...#...#...#.#.........#.#',
        '#.#######.###.#########.#.#',
        '#.#.......#...#...#...#.#.#',
        '#.#.#####.#.###o#.#.#.#.#.#',
        '#.#.#.....#.#...#.#.#.#.#.#',
        '#.#.#######.#.#####.#.###.#',
        '#.#.........#.#...#.#.....#',
        'T.........................T',
        '#...#...#.......#.#.....#.#',
        '###.###............####.#.#',
        '#.#...#..GGGGoGGGG..#...#.#',
        '#.###.#..GGGGGGGGG.##.###.#',
        '#.#...#..GGGGGGGGG..#.#.#.#',
        '#.#.###.........o...#.#.#.#',
        '#...#.....#...#...#...#...#',
        '#.##########.P.##.#####.###',
        '#.........#.....#.....#...#',
        '#########.#.###.#.###.###.#',
        '#.#.....#.#.#.#.#...#.#.#.#',
        '#.#.#.#.#.#.#.#.#.###.#.#.#',
        '#.#.#o#.#...#...#.#...#...#',
        '#.#.#.#######.#####.###.###',
        '#.#.#.......#.......#.#.#.#',
        '#.#.#######.#########.#.#.#',
        '#o........#..............o#',
        '###########################'],

    // ── LEVEL 8 ───────────────────────────────────────────────
    ['###########################',
        '#o#.............#...#....o#',
        '#.###.#########.#.#.#.###.#',
        '#...#...#.....#.#.#...#...#',
        '###.###.#.###.#.#.#####.#.#',
        '#...#...#.#.#.#.#...#...#.#',
        '#.#######.#.#.#.###.#.###.#',
        '#.#.....#.#.#.#.....#.#...#',
        '#.###.#.#.#.#.#.#####.#.###',
        '#.#...#...#.#.#.....#.#.#.#',
        'T.............o...........T',
        '#...#.......#...#.....#.#.#',
        '#####.#............####.#.#',
        '#.....#..GGGGoGGGG....#...#',
        '###.###..GGGGGGGGG..#####.#',
        '#...#....GGGGGGGGG......#.#',
        '#.######...........##.#.#.#',
        '#.........#.#...#.....#.#.#',
        '#.##########.P..#.#######.#',
        '#.#....o........#.#.....#.#',
        '#.#####.#.#######.#.###.#.#',
        '#.#...#.#.#...#...#...#...#',
        '#.#.#.#.###.#.#.#.###.#####',
        '#...#.#.....#.#.#...#.....#',
        '#####.#.#####.#.###.#####.#',
        '#.#...#.#...#.#...#.......#',
        '#.#.#####.#.#.###.#########',
        '#o........#...#..........o#',
        '###########################'],

    // ── LEVEL 9 ───────────────────────────────────────────────
    ['#############################',
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
        '#############################'],

    // ── LEVEL 10 ─────────────────────────────────────────────
    ['#############################',
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
        '#############################']];

//raw maze string array into the tile grid + metadata
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

    // remove unreachable dots (make them walls)
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
            if (this.powerTimer <= 0) { this.powerMode = false; }
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

            // Tunnel wrap
            if (this.tileX < 0) { this.tileX = maze.cols - 1; this.pixelX = this.tileX * TILE + TILE / 2; }
            if (this.tileX >= maze.cols) { this.tileX = 0; this.pixelX = TILE / 2; }

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
                // Wrap tunnels
                if (this.tileX < 0) this.tileX = maze.cols - 1;
                if (this.tileX >= maze.cols) this.tileX = 0;
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

        for (const d of DIRS) {
            if (d.x === reverse.x && d.y === reverse.y && this.state !== 'frightened') continue;
            const nx = this.tileX + d.x, ny = this.tileY + d.y;
            if (nx < 0 || nx >= maze.cols || ny < 0 || ny >= maze.rows) continue;
            const t = maze.grid[ny][nx];
            if (t === T.WALL) continue;
            if (t === T.GHOST_HOUSE && this.state !== 'house' && this.state !== 'eaten') continue;

            const dist = Math.abs(nx - target.x) + Math.abs(ny - target.y);
            if (this.state === 'frightened') {
                // Random movement
                if (Math.random() < 0.4) { best = d; break; }
            }
            if (dist < bestDist) { bestDist = dist; best = d; }
        }
        return best || this.dir;
    }

    update(dt, maze, player, ghosts, levelCfg) {
        this.bodyOsc += dt * 8;

        const spd = this.speed * levelCfg.ghostSpd;

        // Handle exit from ghost house
        if (this.state === 'house') {
            this.exitTimer -= 1;
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
                x: sc.x < 0 ? 1 : (sc.x > 0 ? maze.cols - 2 : Math.floor(maze.cols / 2)),
                y: sc.y < 0 ? 1 : (sc.y > 0 ? maze.rows - 2 : Math.floor(maze.rows / 2))
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

            // Tunnel wrap
            if (this.tileX <= 0 && this.dir.x < 0) { this.tileX = maze.cols - 1; this.pixelX = this.tileX * TILE + TILE / 2; }
            if (this.tileX >= maze.cols - 1 && this.dir.x > 0) { this.tileX = 0; this.pixelX = TILE / 2; }

            // Choose next direction at tile center
            this.dir = this.chooseDir(target, maze);
            this.tileX += this.dir.x;
            this.tileY += this.dir.y;

            // Clamp
            this.tileX = Math.max(0, Math.min(maze.cols - 1, this.tileX));
            this.tileY = Math.max(0, Math.min(maze.rows - 1, this.tileY));

            // Check if eaten ghost returned home
            if (this.state === 'eaten') {
                const centerX = Math.floor(maze.cols / 2);
                const centerY = Math.floor(maze.rows / 2);
                if (Math.abs(this.tileX - centerX) < 2 && Math.abs(this.tileY - centerY) < 2) {
                    this.state = 'scatter'; this.scatterTimer = 5;
                    this.tileX = centerX; this.tileY = centerY;
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
                // Draw tunnel as open corridor with arrow hint
                ctx.fillStyle = '#000811';
                ctx.fillRect(px, py, TILE, TILE);
                ctx.fillStyle = levelColor + '33';
                ctx.fillRect(px, py + TILE * 0.3, TILE, TILE * 0.4);

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
    this.highScore = parseInt(localStorage.getItem('hexman_hi')||'0');
    this.startLevel();
  },

  startLevel() {
    const cfg = LEVEL_CONFIGS[Math.min(this.level-1, 9)];
    const maze = buildMaze(cfg.cols, cfg.rows, this.level);
    this.maze = maze;
    this.dotCount = maze.dotCount;

    // Compute tile size to fill viewport, then resize canvas
    TILE = computeTile(maze.cols, maze.rows);
    canvas.width  = maze.cols * TILE;
    canvas.height = maze.rows * TILE;

    // Resize wrapper to match
    const wrapper = document.getElementById('game-wrapper');
    wrapper.style.width = canvas.width + 'px';

    this.player = new HexMan(maze.spawn.x, maze.spawn.y);
    this.player.speed = 2.5 + (this.level-1)*0.08;

    this.ghosts = [];
    const numGhosts = Math.min(4, 1 + Math.floor(this.level/2));
    for (let i=0; i<numGhosts; i++) {
      const sp = maze.ghostSpawns[i] || maze.ghostSpawns[0];
      const delay = i * 120 + 60;
      const g = new Ghost(GHOST_DEFS[i], sp.x, sp.y, delay);
      g.speed = 1.8 + (this.level-1)*0.06;
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
    const cfg = LEVEL_CONFIGS[Math.min(this.level-1, 9)];
    const maze = buildMaze(cfg.cols, cfg.rows, this.level);
    this.maze = maze;
    this.dotCount = maze.dotCount;

    TILE = computeTile(maze.cols, maze.rows);
    canvas.width  = maze.cols * TILE;
    canvas.height = maze.rows * TILE;
    document.getElementById('game-wrapper').style.width = canvas.width + 'px';

    this.player = new HexMan(maze.spawn.x, maze.spawn.y);
    this.player.speed = 2.5 + (this.level-1)*0.08;
    this.ghosts = [];
    const numGhosts = Math.min(4, 1 + Math.floor(this.level/2));
    for (let i=0; i<numGhosts; i++) {
      const sp = maze.ghostSpawns[i]||maze.ghostSpawns[0];
      const g = new Ghost(GHOST_DEFS[i], sp.x, sp.y, i*120+60);
      g.speed = 1.8+(this.level-1)*0.06;
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
    document.getElementById('score-display').textContent = this.score.toString().padStart(6,'0');
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
    const cfg = LEVEL_CONFIGS[Math.min(this.level-1,9)];
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
    const dur = Math.max(4, 8 - (this.level-1)*0.7);
    for (const g of this.ghosts) g.frighten(dur);
    this.player.powerMode = true;
    this.player.powerTimer = dur;
    this.ghostEatCombo = 0;
    audio.powerMode(true);
    if (this.dotCount <= 0) this.levelComplete();
  },

  eatGhost(ghost) {
    this.ghostEatCombo++;
    const pts = 200 * Math.pow(2, this.ghostEatCombo-1);
    this.addScore(pts);
    audio.eatGhost();
    this.particles.spawn(ghost.pixelX, ghost.pixelY, ghost.def.color, 16, 4, 1.0);
    this.particles.spawnText(ghost.pixelX-20, ghost.pixelY, '+'+pts, '#ffff00');
    this.shake.shake(3, 0.2);
    ghost.eat();
  },

  playerDied() {
    this.state = 'dying';
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
    for (let i=0; i<5; i++) {
      setTimeout(() => {
        this.particles.spawn(
          Math.random()*canvas.width, Math.random()*canvas.height,
          ['#ffff00','#ff00ff','#00ffff','#00ff88'][Math.floor(Math.random()*4)],
          10, 4, 1.2
        );
      }, i*200);
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
      const cfg2 = LEVEL_CONFIGS[Math.min(this.level-1,9)];
      ctx.fillStyle = '#000811';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      drawMaze(ctx, this.maze, 0, cfg2.color);
      if (this.player) this.player.draw(ctx, {x:0,y:0});
      for (const g of this.ghosts) g.draw(ctx);
      return;
    }

    if (this.state === 'playing') {
      this.frame++;
      this.shake.update(dt);
      this.particles.update(dt);

      // Update player
      this.player.update(dt, this.maze);

      // Check dot/power eating
      const px = this.player.tileX, py = this.player.tileY;
      if (px>=0 && px<this.maze.cols && py>=0 && py<this.maze.rows) {
        const tile = this.maze.grid[py][px];
        if (tile===T.DOT) {
          this.maze.grid[py][px]=T.EMPTY;
          this.eatDot(this.player.pixelX, this.player.pixelY);
        } else if (tile===T.POWER) {
          this.maze.grid[py][px]=T.EMPTY;
          this.eatPower(this.player.pixelX, this.player.pixelY);
        }
      }

      // Update ghosts
      const cfg = LEVEL_CONFIGS[Math.min(this.level-1,9)];
      for (const g of this.ghosts) {
        g.update(dt, this.maze, this.player, this.ghosts, cfg);

        // Collision with player
        const dx = g.pixelX - this.player.pixelX;
        const dy = g.pixelY - this.player.pixelY;
        const dist = Math.sqrt(dx*dx+dy*dy);
        if (dist < TILE*0.75) {
          if (g.state==='frightened') {
            this.eatGhost(g);
          } else if (g.state!=='eaten' && this.player.alive) {
            // Player dies
            this.lives--;
            this.updateHUD();
            this.playerDied();
            if (this.lives <= 0) {
              // No lives left — restart whole game from level 1
              setTimeout(() => this.gameOver(), 2600);
            } else {
              // Still have lives — respawn in same level, same maze
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
    ctx.fillRect(-10, -10, canvas.width+20, canvas.height+20);

    // Draw maze
    const cfg = LEVEL_CONFIGS[Math.min(this.level-1,9)];
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
      ctx.fillText('LEVEL CLEAR!', canvas.width/2, canvas.height/2-20);
      ctx.font = `14px 'Orbitron', sans-serif`;
      ctx.fillStyle = '#ffff00';
      ctx.shadowColor = '#ffff00';
      if (this.level < 10) {
        ctx.fillText(`ENTERING ${LEVEL_CONFIGS[this.level].name}`, canvas.width/2, canvas.height/2+20);
      }
      ctx.shadowBlur = 0;
      ctx.textAlign = 'left';
    }

    if (this.state === 'dying') {
      if (this.lives <= 0) {
        ctx.fillStyle = 'rgba(0,8,17,0.5)';
        ctx.fillRect(0,0,canvas.width,canvas.height);
        ctx.font=`bold 24px 'Orbitron',sans-serif`;
        ctx.fillStyle='#ff3333';
        ctx.shadowBlur=20; ctx.shadowColor='#ff3333';
        ctx.textAlign='center';
        ctx.fillText('SYSTEM FAILURE', canvas.width/2, canvas.height/2);
        ctx.shadowBlur=0; ctx.textAlign='left';
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
      ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.font=`bold 28px 'Orbitron',sans-serif`;
      ctx.fillStyle='#00ffff'; ctx.shadowBlur=20; ctx.shadowColor='#00ffff';
      ctx.textAlign='center';
      ctx.fillText('PAUSED', canvas.width/2, canvas.height/2);
      ctx.font=`11px 'Share Tech Mono',monospace`;
      ctx.fillStyle='rgba(0,255,255,0.5)';
      ctx.shadowBlur=0;
      ctx.fillText('PRESS P TO RESUME', canvas.width/2, canvas.height/2+30);
      ctx.textAlign='left';
    }
  },

  // Respawn player in the SAME level, same maze, same dots remaining
  respawnInLevel() {
    // Reset player to spawn
    this.player = new HexMan(this.maze.spawn.x, this.maze.spawn.y);
    this.player.speed = 2.5 + (this.level-1)*0.08;

    // Reset ghosts back to house
    this.ghosts = [];
    const numGhosts = Math.min(4, 1 + Math.floor(this.level/2));
    for (let i=0; i<numGhosts; i++) {
      const sp = this.maze.ghostSpawns[i] || this.maze.ghostSpawns[0];
      const g = new Ghost(GHOST_DEFS[i], sp.x, sp.y, i*120+60);
      g.speed = 1.8 + (this.level-1)*0.06;
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