/**
 * E85 Sync - Rhythm Game Core
 */

class Game {
    constructor() {
        this.config = {
            bpm: 120,
            offset: 0, // ms
            speed: 1.0,
            leadTime: 2.0, // seconds
            holdThreshold: 0.3, // seconds
            simplifyWindow: 0.08, // seconds
            quantize: 0.1, // quantization strength
            hitWindows: {
                perfect: 0.05,
                great: 0.1,
                good: 0.15,
                miss: 0.25
            },
            volume: 0.5,
            autoplay: false,
            silentMode: false
        };

        this.state = {
            isPlaying: false,
            currentTime: 0,
            lastFrameTime: 0,
            score: 0,
            combo: 0,
            maxCombo: 0,
            perfects: 0,
            greats: 0,
            goods: 0,
            misses: 0,
            accuracy: 100,
            sourceChart: null,
            runtimeChart: [],
            activeNotes: [],
            pressedKeys: new Set(),
            isPaused: false
        };

        this.elements = {
            audio: document.getElementById('game-audio'),
            score: document.getElementById('score'),
            combo: document.getElementById('combo'),
            accuracy: document.getElementById('accuracy'),
            timeDisplay: document.getElementById('time-display'),
            syncStatus: document.getElementById('sync-status'),
            progressFill: document.getElementById('progress-fill'),
            notesLayer: document.getElementById('notes-layer'),
            judgment: document.getElementById('judgment-display'),
            screens: {
                start: document.getElementById('start-screen'),
                game: document.getElementById('game-screen'),
                results: document.getElementById('results-screen')
            },
            debug: {
                panel: document.getElementById('debug-panel'),
                inputs: {
                    bpm: document.getElementById('input-bpm'),
                    offset: document.getElementById('input-offset'),
                    speed: document.getElementById('input-speed'),
                    lead: document.getElementById('input-lead'),
                    simplify: document.getElementById('input-simplify'),
                    quantize: document.getElementById('input-quantize'),
                    hold: document.getElementById('input-hold'),
                    vol: document.getElementById('input-vol'),
                    perfect: document.getElementById('input-perfect'),
                    miss: document.getElementById('input-miss')
                },
                vals: {
                    bpm: document.getElementById('val-bpm'),
                    offset: document.getElementById('val-offset'),
                    speed: document.getElementById('val-speed'),
                    lead: document.getElementById('val-lead'),
                    simplify: document.getElementById('val-simplify'),
                    quantize: document.getElementById('val-quantize'),
                    hold: document.getElementById('val-hold'),
                    vol: document.getElementById('val-vol'),
                    perfect: document.getElementById('val-perfect'),
                    miss: document.getElementById('val-miss')
                },
                autoplayBtn: document.getElementById('toggle-autoplay'),
                silentBtn: document.getElementById('toggle-silent')
            }
        };

        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadChart();
        this.setupAudio();
        this.updateDebugUI();
    }

    setupEventListeners() {
        // UI Buttons
        document.getElementById('start-btn').addEventListener('click', () => this.startGame());
        document.getElementById('restart-btn').addEventListener('click', () => this.restartGame());
        document.getElementById('open-debug').addEventListener('click', () => this.toggleDebug(true));
        document.getElementById('close-debug').addEventListener('click', () => this.toggleDebug(false));
        document.getElementById('apply-debug').addEventListener('click', () => this.applyDebug());

        // Keyboard
        window.addEventListener('keydown', (e) => this.handleKeyDown(e));
        window.addEventListener('keyup', (e) => this.handleKeyUp(e));

        // Mouse/Touch
        const regionLeft = document.getElementById('region-left');
        const regionRight = document.getElementById('region-right');

        const handleInput = (lane, active) => {
            if (active) this.lanePress(lane);
            else this.laneRelease(lane);
        };

        regionLeft.addEventListener('pointerdown', (e) => { e.preventDefault(); handleInput(0, true); });
        regionLeft.addEventListener('pointerup', (e) => { e.preventDefault(); handleInput(0, false); });
        regionRight.addEventListener('pointerdown', (e) => { e.preventDefault(); handleInput(1, true); });
        regionRight.addEventListener('pointerup', (e) => { e.preventDefault(); handleInput(1, false); });

        // Debug inputs
        Object.keys(this.elements.debug.inputs).forEach(key => {
            this.elements.debug.inputs[key].addEventListener('input', (e) => {
                const val = e.target.value;
                this.elements.debug.vals[key].textContent = val;
                
                if (key === 'perfect' || key === 'miss') {
                    this.config.hitWindows[key] = parseFloat(val);
                    // Dynamically scale Great/Good based on Perfect/Miss
                    this.config.hitWindows.great = this.config.hitWindows.perfect + (this.config.hitWindows.miss - this.config.hitWindows.perfect) * 0.3;
                    this.config.hitWindows.good = this.config.hitWindows.perfect + (this.config.hitWindows.miss - this.config.hitWindows.perfect) * 0.6;
                } else {
                    this.config[key] = parseFloat(val);
                }
                
                if (key === 'vol') this.elements.audio.volume = val;
            });
        });

        this.elements.debug.autoplayBtn.addEventListener('click', () => {
            this.config.autoplay = !this.config.autoplay;
            this.elements.debug.autoplayBtn.textContent = `AUTOPLAY: ${this.config.autoplay ? 'ON' : 'OFF'}`;
        });

        this.elements.debug.silentBtn.addEventListener('click', () => {
            this.config.silentMode = !this.config.silentMode;
            this.elements.debug.silentBtn.textContent = `SILENT MODE: ${this.config.silentMode ? 'ON' : 'OFF'}`;
            this.elements.syncStatus.textContent = this.config.silentMode ? "SILENT MODE" : "LIVE AUDIO SYNC";
            this.elements.syncStatus.style.color = this.config.silentMode ? "#ffcc00" : "#00f2ff";
            
            if (this.config.silentMode) this.elements.audio.pause();
            else if (this.state.isPlaying) this.elements.audio.play();
        });

        const chartInput = document.getElementById('input-chart');
        const loadBtn = document.getElementById('load-chart-btn');

        loadBtn.addEventListener('click', () => chartInput.click());
        chartInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const data = JSON.parse(event.target.result);
                    this.state.sourceChart = data;
                    this.config.bpm = data.header.bpm || 120;
                    this.elements.debug.inputs.bpm.value = this.config.bpm;
                    this.elements.debug.vals.bpm.textContent = this.config.bpm;
                    alert("Chart loaded successfully!");
                } catch (err) {
                    console.error("Failed to parse chart:", err);
                    alert("Failed to parse chart JSON.");
                }
            };
            reader.readAsText(file);
        });
    }

    setupAudio() {
        this.elements.audio.addEventListener('error', () => {
            console.warn("Audio file not found or failed to load. Falling back to silent mode.");
            document.getElementById('file-status').textContent = "Audio file not found. Running in silent chart preview mode.";
            this.config.silentMode = true;
            this.elements.debug.silentBtn.textContent = `SILENT MODE: ON (FORCED)`;
        });

        this.elements.audio.volume = this.config.volume;
    }

    async loadChart() {
        try {
            const response = await fetch('VisiPiano.json');
            const data = await response.json();
            this.state.sourceChart = data;
            this.config.bpm = data.header.bpm || 120;
            this.elements.debug.inputs.bpm.value = this.config.bpm;
            this.elements.debug.vals.bpm.textContent = this.config.bpm;
            console.log("Chart loaded successfully");
        } catch (error) {
            console.error("Failed to load chart:", error);
            document.getElementById('file-status').textContent = "Failed to load VisiPiano.json. Please check file path.";
        }
    }

    simplifyChart() {
        if (!this.state.sourceChart) return;

        // Get notes from track 1 (as seen in analysis)
        let rawNotes = [];
        this.state.sourceChart.tracks.forEach(track => {
            if (track.notes && track.notes.length > 0) {
                rawNotes = rawNotes.concat(track.notes);
            }
        });

        // Sort by time
        rawNotes.sort((a, b) => a.time - b.time);

        const runtime = [];
        let lastNoteTime = -1;

        rawNotes.forEach(note => {
            // Quantization: Align to nearest 1/4 or 1/8 beat if desired
            // For beginners, 1/4 beat alignment is often more readable
            const secondsPerBeat = 60 / this.config.bpm;
            const quantizedTime = Math.round(note.time / (secondsPerBeat / 4)) * (secondsPerBeat / 4);
            
            // Use quantized time if close enough (strength controlled)
            const finalTime = Math.abs(quantizedTime - note.time) < this.config.quantize ? quantizedTime : note.time;

            // Simplify: Merge notes that are too close
            if (finalTime - lastNoteTime < this.config.simplifyWindow) return;

            // Lane logic: Bias by MIDI pitch
            const lane = note.midi < 60 ? 0 : 1;
            
            const isHold = note.duration > this.config.holdThreshold;

            runtime.push({
                time: finalTime,
                duration: note.duration,
                lane: lane,
                type: isHold ? 'hold' : 'tap',
                hit: false,
                missed: false,
                id: Math.random().toString(36).substr(2, 9)
            });

            lastNoteTime = finalTime;
        });

        this.state.runtimeChart = runtime;
        console.log(`Simplified chart generated: ${runtime.length} notes`);
    }

    startGame() {
        if (!this.state.sourceChart) {
            alert("No chart loaded. Please ensure VisiPiano.json is present.");
            return;
        }

        this.simplifyChart();
        this.resetStats();
        this.switchScreen('game');
        
        this.state.isPlaying = true;
        this.state.currentTime = -this.config.leadTime; // Start with a lead-in
        this.state.lastFrameTime = performance.now();

        if (!this.config.silentMode) {
            // Delay audio start to match lead-in
            setTimeout(() => {
                if (this.state.isPlaying) this.elements.audio.play();
            }, this.config.leadTime * 1000);
        }

        requestAnimationFrame((t) => this.gameLoop(t));
    }

    restartGame() {
        this.elements.audio.pause();
        this.elements.audio.currentTime = 0;
        this.startGame();
    }

    applyDebug() {
        this.restartGame();
    }

    resetStats() {
        this.state.score = 0;
        this.state.combo = 0;
        this.state.maxCombo = 0;
        this.state.perfects = 0;
        this.state.greats = 0;
        this.state.goods = 0;
        this.state.misses = 0;
        this.state.accuracy = 100;
        this.updateHUD();
        this.elements.notesLayer.innerHTML = '';
    }

    gameLoop(timestamp) {
        if (!this.state.isPlaying || this.state.isPaused) return;

        const deltaTime = (timestamp - this.state.lastFrameTime) / 1000;
        this.state.lastFrameTime = timestamp;

        // Sync logic
        if (!this.config.silentMode && !this.elements.audio.paused) {
            this.state.currentTime = this.elements.audio.currentTime + (this.config.offset / 1000);
        } else {
            this.state.currentTime += deltaTime;
        }

        this.updateGameplay();
        this.render();

        if (this.state.currentTime > (this.state.sourceChart.duration + 2)) {
            this.endGame();
        } else {
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    updateGameplay() {
        const { currentTime, runtimeChart, activeNotes } = this.state;

        // Spawn notes
        const spawnThreshold = currentTime + this.config.leadTime;
        runtimeChart.forEach(note => {
            if (!note.spawned && note.time <= spawnThreshold) {
                note.spawned = true;
                const el = this.createNoteElement(note);
                this.state.activeNotes.push({ ...note, el });
            }
        });

        // Autoplay logic
        if (this.config.autoplay) {
            this.state.activeNotes.forEach(note => {
                if (!note.hit && !note.missed && currentTime >= note.time) {
                    this.registerHit(note, 'perfect');
                }
            });
        }

        // Miss logic
        this.state.activeNotes.forEach(note => {
            if (!note.hit && !note.missed && currentTime > note.time + this.config.hitWindows.miss) {
                this.registerMiss(note);
            }
        });

        // Cleanup old notes
        this.state.activeNotes = this.state.activeNotes.filter(note => {
            if (note.missed && currentTime > note.time + 0.5) {
                note.el.remove();
                return false;
            }
            if (note.hit && note.type === 'tap') {
                note.el.remove();
                return false;
            }
            if (note.hit && note.type === 'hold' && currentTime > note.time + note.duration + 0.1) {
                note.el.remove();
                return false;
            }
            return true;
        });
    }

    createNoteElement(note) {
        const el = document.createElement('div');
        el.className = `note lane-${note.lane} ${note.type}`;
        el.id = `note-${note.id}`;
        
        if (note.type === 'hold') {
            const body = document.createElement('div');
            body.className = 'hold-body';
            // Height will be set during render
            el.appendChild(body);
        }

        this.elements.notesLayer.appendChild(el);
        return el;
    }

    render() {
        const { currentTime, activeNotes } = this.state;
        const hitZoneBottom = 100; // px from bottom
        const pixelsPerSecond = (window.innerHeight - hitZoneBottom) / this.config.leadTime * this.config.speed;

        activeNotes.forEach(note => {
            if (note.hit && note.type === 'tap') return;

            const timeDiff = note.time - currentTime;
            // Calculate Y position
            const y = window.innerHeight - hitZoneBottom - (timeDiff * pixelsPerSecond);
            
            note.el.style.top = `${y}px`;

            if (note.type === 'hold') {
                const body = note.el.querySelector('.hold-body');
                const height = note.duration * pixelsPerSecond;
                body.style.height = `${height}px`;
                body.style.top = `-${height}px`;
            }
        });

        // HUD Updates
        this.elements.timeDisplay.textContent = `${this.formatTime(Math.max(0, currentTime))} / ${this.formatTime(this.state.sourceChart.duration)}`;
        const progress = (Math.max(0, currentTime) / this.state.sourceChart.duration) * 100;
        this.elements.progressFill.style.width = `${Math.min(100, progress)}%`;
    }

    formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    handleKeyDown(e) {
        if (e.key === 'ArrowLeft') this.lanePress(0);
        if (e.key === 'ArrowRight') this.lanePress(1);
        if (e.key === 'Escape') this.togglePause();
    }

    handleKeyUp(e) {
        if (e.key === 'ArrowLeft') this.laneRelease(0);
        if (e.key === 'ArrowRight') this.laneRelease(1);
    }

    lanePress(lane) {
        const laneEl = document.getElementById(`lane-${lane === 0 ? 'left' : 'right'}`);
        laneEl.classList.add('active');

        if (this.state.isPlaying && !this.state.isPaused && !this.config.autoplay) {
            this.checkHit(lane);
        }
    }

    laneRelease(lane) {
        const laneEl = document.getElementById(`lane-${lane === 0 ? 'left' : 'right'}`);
        laneEl.classList.remove('active');
    }

    checkHit(lane) {
        const { currentTime, activeNotes } = this.state;
        
        // Find the nearest note in this lane
        const candidates = activeNotes.filter(n => n.lane === lane && !n.hit && !n.missed);
        if (candidates.length === 0) return;

        const note = candidates[0];
        const diff = Math.abs(note.time - currentTime);

        if (diff <= this.config.hitWindows.perfect) this.registerHit(note, 'perfect');
        else if (diff <= this.config.hitWindows.great) this.registerHit(note, 'great');
        else if (diff <= this.config.hitWindows.good) this.registerHit(note, 'good');
    }

    registerHit(note, judgment) {
        note.hit = true;
        this.state.combo++;
        if (this.state.combo > this.state.maxCombo) this.state.maxCombo = this.state.combo;

        let points = 0;
        if (judgment === 'perfect') { this.state.perfects++; points = 1000; }
        else if (judgment === 'great') { this.state.greats++; points = 750; }
        else if (judgment === 'good') { this.state.goods++; points = 500; }

        this.state.score += points + (this.state.combo * 10);
        this.showJudgment(judgment);
        this.updateHUD();
        
        if (note.type === 'tap') {
            note.el.style.opacity = '0';
            note.el.style.transform = 'translateX(-50%) scale(1.5)';
        }
    }

    registerMiss(note) {
        note.missed = true;
        this.state.combo = 0;
        this.state.misses++;
        this.showJudgment('miss');
        this.updateHUD();
        note.el.style.opacity = '0.3';
    }

    showJudgment(type) {
        this.elements.judgment.textContent = type;
        this.elements.judgment.className = `judgment-${type} judgment-animate`;
        
        // Restart animation
        const newEl = this.elements.judgment.cloneNode(true);
        this.elements.judgment.parentNode.replaceChild(newEl, this.elements.judgment);
        this.elements.judgment = newEl;
    }

    updateHUD() {
        this.elements.score.textContent = this.state.score.toString().padStart(6, '0');
        this.elements.combo.textContent = this.state.combo;
        
        const totalNotes = this.state.perfects + this.state.greats + this.state.goods + this.state.misses;
        if (totalNotes > 0) {
            const acc = ((this.state.perfects * 100 + this.state.greats * 75 + this.state.goods * 50) / totalNotes);
            this.state.accuracy = acc;
            this.elements.accuracy.textContent = `${acc.toFixed(2)}%`;
        }
    }

    endGame() {
        this.state.isPlaying = false;
        this.elements.audio.pause();
        
        document.getElementById('final-score').textContent = this.state.score;
        document.getElementById('final-accuracy').textContent = `${this.state.accuracy.toFixed(2)}%`;
        document.getElementById('max-combo').textContent = this.state.maxCombo;
        document.getElementById('count-perfect').textContent = this.state.perfects;
        document.getElementById('count-great').textContent = this.state.greats;
        document.getElementById('count-good').textContent = this.state.goods;
        document.getElementById('count-miss').textContent = this.state.misses;

        this.switchScreen('results');
    }

    switchScreen(screenName) {
        Object.values(this.elements.screens).forEach(s => s.classList.remove('active'));
        this.elements.screens[screenName].classList.add('active');
    }

    togglePause() {
        if (!this.state.isPlaying) return;
        this.state.isPaused = !this.state.isPaused;
        if (this.state.isPaused) {
            this.elements.audio.pause();
        } else {
            this.state.lastFrameTime = performance.now();
            if (!this.config.silentMode) this.elements.audio.play();
            requestAnimationFrame((t) => this.gameLoop(t));
        }
    }

    toggleDebug(open) {
        this.elements.debug.panel.classList.toggle('open', open);
    }

    updateDebugUI() {
        Object.keys(this.elements.debug.inputs).forEach(key => {
            if (this.config[key] !== undefined) {
                this.elements.debug.inputs[key].value = this.config[key];
                this.elements.debug.vals[key].textContent = this.config[key];
            }
        });
    }
}

// Start game on load
window.addEventListener('load', () => {
    window.game = new Game();
});
