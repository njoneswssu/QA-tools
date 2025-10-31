# Java Pinball Game

A complete pinball game written in Java with Swing, featuring realistic physics, top 10 high scores, and engaging gameplay.

## Features

🎮 **Gameplay**
- Realistic pinball physics with gravity, friction, and bounce mechanics
- Ball launching system with power control
- Left and right flippers with responsive controls
- Multiple balls (3 lives per game)

🎯 **Scoring Elements**
- **Bumpers** (circular) - 100-150 points each, bounce the ball with force
- **Targets** (rectangular) - 50-200 points each, disappear when hit and respawn after 3 seconds
- **Visual feedback** with glow effects when hitting scoring elements

🏆 **High Score System**
- Tracks top 10 highest scores with player names and dates
- Automatic name entry for top 10 scores
- Persistent storage using JSON files
- Clear scores functionality

🎨 **Visual Features**
- Modern dark theme with gradient backgrounds
- Smooth animations and visual effects
- Anti-aliased graphics for crisp rendering
- Intuitive UI with clear scoring information

## System Requirements

- Java 11 or higher
- Any operating system that supports Java (Windows, macOS, Linux)
- Minimum 512MB RAM
- OpenGL-compatible graphics card (recommended)

## Quick Start

### Option 1: Download Pre-built JAR
1. Download `pinball-game.jar` from the releases
2. Double-click the JAR file to run
3. Or run from command line: `java -jar pinball-game.jar`

### Option 2: Build from Source
1. Ensure Java 11+ and Maven are installed
2. Clone or download this project
3. Open terminal/command prompt in the project directory
4. Run: `mvn clean package`
5. Find the executable JAR in `target/pinball-game.jar`
6. Run: `java -jar target/pinball-game.jar`

## How to Play

### Controls
- **SPACE** - Launch ball (hold for more power)
- **A** or **Left Arrow** - Activate left flipper
- **D** or **Right Arrow** - Activate right flipper

### Game Menu
- **Game → New Game** - Start a new game
- **Game → High Scores** - View top 10 scores
- **Game → Exit** - Quit the game

### Gameplay
1. **Launch the Ball**: Hold SPACE to build power, release to launch
2. **Use Flippers**: Press A/D or arrow keys to control flippers
3. **Score Points**: Hit bumpers and targets to increase your score
4. **High Scores**: If you achieve a top 10 score, you'll be prompted to enter your name

## Scoring Guide

| Element | Points | Description |
|---------|--------|-------------|
| Small Bumpers | 150 | Red and yellow circular bumpers |
| Large Bumpers | 100 | Blue, green, and teal circular bumpers |
| Side Targets | 50 | Purple rectangular targets on sides |
| Center Target | 75 | Orange horizontal target |
| Bottom Target | 200 | Blue horizontal target (bonus points) |

## File Structure

```
java-pinball/
├── src/main/java/com/pinball/
│   ├── PinballGame.java      # Main application class
│   ├── GameEngine.java       # Core game logic and physics
│   ├── GamePanel.java        # Rendering and graphics
│   ├── Ball.java             # Ball physics and rendering
│   ├── Flipper.java          # Flipper mechanics
│   ├── Bumper.java           # Circular bumpers
│   ├── Target.java           # Rectangular targets
│   ├── Wall.java             # Game boundaries
│   ├── LaunchTube.java       # Launch tube and power meter
│   ├── HighScoreManager.java # High score persistence
│   └── HighScoreDialog.java  # High score UI
├── pom.xml                   # Maven build configuration
├── README.md                 # This file
└── target/                   # Build output directory
```

## Building and Distribution

### Build Requirements
- Java Development Kit (JDK) 11 or higher
- Apache Maven 3.6+

### Build Commands
```bash
# Clean and compile
mvn clean compile

# Run tests (if any)
mvn test

# Package into executable JAR
mvn clean package

# The executable JAR will be created at:
# target/pinball-game.jar
```

### Distribution
The built JAR file (`pinball-game.jar`) is completely self-contained and can be distributed as a single file. Recipients only need Java 11+ installed to run the game.

## Technical Details

### Architecture
- **MVC Pattern**: Clean separation between game logic, rendering, and input handling
- **Component-based**: Each game element (ball, flippers, bumpers) is a separate class
- **Event-driven**: Uses Swing's event system for input and rendering
- **JSON Persistence**: High scores stored in human-readable JSON format

### Performance
- **60 FPS**: Smooth gameplay with 16ms update intervals
- **Double buffering**: Eliminates screen flickering
- **Anti-aliasing**: Crisp graphics on all screen resolutions
- **Efficient collision detection**: Optimized physics calculations

### Dependencies
- **Gson**: For JSON serialization of high scores
- **Java Swing**: For UI and graphics
- **Java 2D**: For advanced rendering features

## Customization

The game is designed to be easily customizable:

- **Physics**: Modify constants in `GameEngine.java`
- **Scoring**: Adjust point values in bumper/target constructors
- **Visual Theme**: Change colors and fonts in rendering classes
- **Game Elements**: Add new bumpers, targets, or obstacles

## Troubleshooting

### Common Issues

**Game won't start**
- Ensure Java 11+ is installed: `java -version`
- Try running from command line for error messages

**Poor performance**
- Close other applications to free up memory
- Try running with more memory: `java -Xmx1G -jar pinball-game.jar`

**High scores not saving**
- Ensure the application has write permissions in its directory
- Check if `pinball_high_scores.json` is created

### Support
For issues or questions, please check the project repository or create an issue.

## License

This project is open source and available under the MIT License.

## Credits

Created as a demonstration of Java game development using Swing and 2D graphics. Inspired by classic pinball machines and modern game design principles.

Enjoy playing! 🎮
