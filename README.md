# E85 Sync - Rhythm Game

A polished, beginner-friendly 2-lane rhythm game based on the song **sincerely lue - E85**.

## Setup Instructions

### 1. Audio Setup
The game expects an audio file in the following location:
- `./assets/audio/song.mp3` or `./assets/audio/song.wav`

If the file is missing, the game will automatically switch to **Silent Mode**, allowing you to preview the chart and test sync logic without audio.

### 2. Chart Data
The game uses `VisiPiano.json` as the source of truth. This file is parsed and simplified at runtime into a 2-lane gameplay format.

## Controls

### Keyboard
- **Left Arrow**: Left Lane
- **Right Arrow**: Right Lane
- **ESC**: Pause Game

### Mouse / Touch
- **Click/Tap Left Half**: Left Lane
- **Click/Tap Right Half**: Right Lane
- **Multi-touch**: Supported for simultaneous hits on mobile/tablets.

## Chart Simplification Logic
To make the game beginner-friendly, the raw MIDI/JSON data is processed:
1. **Lane Mapping**: MIDI pitch < 60 (Middle C) maps to the Left lane; MIDI pitch >= 60 maps to the Right lane.
2. **Merging**: Notes occurring within 80ms (configurable) of each other are merged to avoid dense clusters.
3. **Hold Notes**: Any note with a duration > 0.3s (configurable) is converted into a hold note.
4. **Forgiving Windows**: The game uses generous hit windows for Perfect, Great, and Good judgments.

## Debug & Tuning Panel
Click the **DEBUG** button in the bottom right corner to open the live tuning panel. Changes here apply in real-time or after clicking **RESTART CHART**.

- **BPM**: Manually override the song tempo.
- **OFFSET**: Adjust for audio latency in milliseconds.
- **NOTE SPEED**: Change how fast notes travel down the screen.
- **SIMPLIFY**: Adjust the time window for merging dense notes.
- **AUTOPLAY**: Test the chart visually without input.

## Technical Details
- Built with Vanilla HTML5, CSS3, and JavaScript.
- Uses `requestAnimationFrame` for smooth 60fps rendering.
- Synchronizes gameplay against `audio.currentTime` for sub-millisecond precision.
- Fallback internal timer for Silent Mode.
