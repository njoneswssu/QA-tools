# Tetris Game - Glowing Dark Theme

A modern implementation of the classic Tetris game with a stunning glowing dark theme and high score tracking.

## Features

- **Classic Tetris Gameplay**: All 7 standard Tetris pieces (I, O, T, S, Z, J, L)
- **Glowing Dark Theme**: Beautiful neon colors with glow effects for an immersive experience
- **Arrow Key Controls**: Move pieces with directional arrows, rotate with UP arrow
- **High Score System**: Tracks top 10 high scores persistently
- **Progressive Difficulty**: Game speed increases as you level up
- **Line Clearing**: Standard Tetris line clearing mechanics with scoring
- **Game Over & Restart**: Press R to restart when game ends

## Controls

- **Left Arrow**: Move piece left
- **Right Arrow**: Move piece right  
- **Down Arrow**: Soft drop (move piece down faster)
- **Up Arrow**: Rotate piece clockwise
- **R**: Restart game (when game over)

## How to Build and Run

### Prerequisites
- Java 11 or higher
- Maven 3.6 or higher

### Building the Game

**With Maven (if installed):**
```bash
./build.sh    # macOS/Linux
build.bat     # Windows
```

**With javac (no Maven required):**
```bash
./compile.sh  # macOS/Linux
compile.bat   # Windows
```

### Running the Game

**With Maven build:**
```bash
./run.sh      # macOS/Linux
run.bat       # Windows
```

**With javac build:**
```bash
./run-simple.sh  # macOS/Linux
run-simple.bat   # Windows
```

**Or run directly:**
```bash
java -jar target/tetris-game-1.0.0.jar  # Maven build
java -jar target/tetris-game.jar        # javac build
```

## Gameplay

1. Pieces fall from the top of the screen
2. Use arrow keys to position and rotate pieces
3. Complete horizontal lines to clear them and score points
4. Game speeds up every 10 lines cleared
5. Game ends when pieces reach the top
6. Your score is automatically saved to the high score list

## Scoring

- **Line Clear**: 100 points × level × lines cleared
- **Soft Drop**: 1 point per block dropped with down arrow
- **Level Up**: Every 10 lines cleared increases level and speed

## High Scores

- Top 10 scores are automatically saved
- Scores persist between game sessions
- View current high scores in the game UI

## Technical Details

- Built with Java Swing for cross-platform compatibility
- Uses Maven for dependency management and building
- Implements proper Tetris piece rotation system
- Glowing effects created with layered transparent rectangles
- High scores stored in `tetris_high_scores.txt`

Enjoy playing this glowing version of the classic Tetris game!
