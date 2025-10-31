package com.pinball;

import java.awt.*;
import java.awt.geom.Point2D;
import java.util.ArrayList;
import java.util.List;
import java.util.Random;

/**
 * Core game engine handling physics, game state, and game logic
 */
public class GameEngine {
    private final int width;
    private final int height;
    private final Random random = new Random();
    
    // Game state
    private int score;
    private int balls;
    private boolean gameRunning;
    private boolean launching;
    private double launchPower;
    private GameState gameState;
    
    // Game objects
    private Ball ball;
    private List<Flipper> flippers;
    private List<Bumper> bumpers;
    private List<Target> targets;
    private List<Wall> walls;
    private LaunchTube launchTube;
    
    // Managers
    private HighScoreManager highScoreManager;
    
    // REBUILT PHYSICS - Clean, simple, reliable pinball physics
    private static final double GRAVITY = 0.3; // Real pinball gravity
    private static final double FRICTION = 0.99; // Minimal friction for smooth flow
    private static final double BOUNCE = 0.8; // Energetic but controlled bounces
    private static final double MAX_VELOCITY = 100.0; // Much higher max speed for 800% power launches
    private static final double MIN_VELOCITY = 0.1; // Minimum before stopping
    private static final double MAX_LAUNCH_POWER = 680.0; // 800% launch power (was 85 originally)
    
    // Simple boundary reset system - Only reset when ball goes completely out of play area
    
    public enum GameState {
        PLAYING, GAME_OVER, WAITING_FOR_NAME, PAUSED
    }
    
    public GameEngine(int width, int height, HighScoreManager highScoreManager) {
        this.width = width;
        this.height = height;
        this.highScoreManager = highScoreManager;
        
        initializeGame();
    }
    
    private void initializeGame() {
        score = 0;
        balls = 3;
        gameState = GameState.PLAYING;
        gameRunning = false;
        launching = false;
        launchPower = 0;
        
        // Initialize game objects
        ball = new Ball(width - 60, height - 15, 8); // Start at center of smaller launch tube
        flippers = createFlippers();
        bumpers = createBumpers();
        targets = createTargets();
        walls = createWalls();
        launchTube = new LaunchTube(width - 70, height - 100, 20, 100); // Much smaller launch tube
        
        // Set initial ball state
        ball.setVelocity(0, 0);
        System.out.println("Game initialized - ready for launch!"); // Debug
    }
    
    private List<Flipper> createFlippers() {
        List<Flipper> flipperList = new ArrayList<>();
        // Space flippers properly for better gameplay
        flipperList.add(new Flipper(200, height - 80, 100, true)); // Left flipper (longer and closer to center)
        flipperList.add(new Flipper(width - 200, height - 80, 100, false)); // Right flipper (longer and closer to center)
        return flipperList;
    }
    
    private List<Bumper> createBumpers() {
        List<Bumper> bumperList = new ArrayList<>();
        
        // SYMMETRIC LAYOUT WITH VARIED SHAPES
        
        // Top area - Large triangular bumpers (left side only, clear launch tube)
        bumperList.add(new Bumper(120, 80, 30, 500, new Color(255, 100, 0), Bumper.Shape.TRIANGLE)); // Left large triangle
        // Removed right triangle to clear launch tube area
        
        // Upper center - Large circular target (moved left to create more space on right side)
        bumperList.add(new Bumper(250, 60, 35, 800, new Color(255, 255, 0))); // Center large circle moved left for better spacing
        
        // Mid-upper area - Cylindrical bumpers (left side only, clear launch tube)
        bumperList.add(new Bumper(150, 160, 20, 300, new Color(0, 255, 0))); // Left cylinder
        // Removed right cylinder to clear launch tube area
        
        // Center formation - Large star/diamond shape (moved down and left for better spacing)
        bumperList.add(new Bumper(280, 280, 28, 600, new Color(255, 0, 0))); // Red circle moved down and left for spacing
        
        // Additional rotated triangle near red circle - increased spacing to prevent overlap
        bumperList.add(new Bumper(200, 150, 22, 400, new Color(255, 165, 0), Bumper.Shape.TRIANGLE, -45)); // Orange triangle moved further left and up 
        
        // Sideways triangle positioned with increased spacing from other objects
        bumperList.add(new Bumper(380, 190, 25, 500, new Color(0, 255, 255), Bumper.Shape.TRIANGLE, 45)); // Cyan triangle moved down to create bounce pattern from upper barriers
        
        // Medium square object positioned with adequate spacing
        bumperList.add(new Bumper(420, 240, 20, 300, new Color(255, 128, 0))); // Orange square moved right and down for better spacing
        
        // Side circles - Medium circular bumpers with better spacing
        bumperList.add(new Bumper(80, 320, 25, 250, new Color(0, 255, 255))); // Left circle moved up and left for better spacing
        bumperList.add(new Bumper(180, 260, 25, 250, new Color(0, 255, 255))); // Right circle moved left and up for better spacing
        
        // Middle-right area - Diamond bumper to fill empty space (moved right to fix overlap)
        bumperList.add(new Bumper(430, 300, 22, 350, new Color(255, 0, 150), Bumper.Shape.TRIANGLE, 45)); // Pink diamond moved 50 pixels right
        
        // Lower left ball saver near score area - positioned away from flipper area
        bumperList.add(new Bumper(60, height - 200, 18, 250, new Color(0, 255, 255), Bumper.Shape.TRIANGLE, 45)); // Cyan triangle angled to bounce ball back into board
        
        // REMOVED: Upper right deflector - was blocking smooth launch path near cyan triangle
        
        // Triangle positioned well above right flipper to avoid blocking ball flow
        bumperList.add(new Bumper(width - 180, height - 280, 20, 400, new Color(255, 255, 0), Bumper.Shape.TRIANGLE, 0)); // Yellow triangle moved higher to clear ball path
        
        // REMOVED: Top launch tube collision object was causing ball to bounce back into tube immediately
        
        return bumperList;
    }
    
    private List<Target> createTargets() {
        List<Target> targetList = new ArrayList<>();
        
        // PERFECTLY SYMMETRIC TARGETS WITH VARIED SHAPES
        
        // Upper lane targets - left side only to clear launch tube
        targetList.add(new Target(80, 120, 12, 18, 150, new Color(0, 255, 0))); // Left upper triangle
        // Removed right upper triangle to clear launch tube area
        
        // Removed white rectangular ramp as requested
        
        // Center area bonus targets - keep left yellow square, remove right one (part of triangle formation)
        targetList.add(new Target(220, 320, 20, 12, 50, new Color(255, 255, 0))); // Left center bonus (kept)
        
        // Side lane multipliers - left side only to clear launch tube
        targetList.add(new Target(60, 350, 15, 15, 250, new Color(255, 0, 255))); // Left side multiplier
        // Removed right side multiplier to clear launch tube area
        
        // Lower area bonus targets - symmetric on both sides
        targetList.add(new Target(140, 420, 18, 8, 400, new Color(0, 255, 255))); // Left lower bonus
        targetList.add(new Target(width - 170, 420, 18, 8, 400, new Color(0, 255, 255))); // Right lower bonus (symmetric)
        
        // Removed red special targets by flippers as requested
        
        return targetList;
    }
    
    private List<Wall> createWalls() {
        List<Wall> wallList = new ArrayList<>();
        
        // PERFECTLY SYMMETRIC WALLS WITH VARIED SHAPES
        
        // Main boundary walls - improved collision detection
        wallList.add(new Wall(15, 0, 15, height - 50)); // Left wall (thicker boundary)
        wallList.add(new Wall(width - 15, 0, width - 15, height - 50)); // Right wall (thicker boundary)
        wallList.add(new Wall(100, 0, width - 80, 0)); // Top wall with opening on left (100px gap) and right (launch tube)
        
        // Additional boundary reinforcement to prevent ball escape
        wallList.add(new Wall(0, 0, 0, height)); // Far left boundary
        wallList.add(new Wall(width, 0, width, height)); // Far right boundary
        
        // LAUNCH TUBE WALLS COMPLETELY REMOVED - They were blocking ball launch path
        // The LaunchTube object itself handles collision when closed, walls not needed
        
        // PROPER PINBALL BALL GUIDES - Real pinball layout with better spacing
        
        // Top launch area deflector - positioned away from objects to guide ball naturally
        wallList.add(new Wall(width - 140, 60, width - 100, 100)); // Angled guide from launch area (moved further left)
        
        // Upper playfield orbit guides - REMOVED problematic right guide causing ball to get stuck
        // wallList.add(new Wall(370, 70, 410, 90)); // REMOVED - was causing ball to get stuck around (410, 75)
        wallList.add(new Wall(190, 90, 230, 70)); // Left upper guide - spaced from orange triangle
        
        // Mid-playfield lane guides - positioned between objects for natural channeling
        wallList.add(new Wall(100, 180, 120, 230)); // Left inlane guide - away from bumpers
        wallList.add(new Wall(480, 180, 500, 230)); // Right inlane guide - away from bumpers
        
        // Flipper return guides - ensure ball returns to flippers naturally
        wallList.add(new Wall(160, 350, 180, 390)); // Left return guide - proper spacing
        wallList.add(new Wall(420, 350, 440, 390)); // Right return guide - proper spacing
        
        // REMOVED: Side lane walls - were creating invisible barriers in middle area
        // wallList.add(new Wall(40, 200, 40, 400)); // REMOVED - Left side lane
        // wallList.add(new Wall(560, 200, 560, 400)); // REMOVED - Right side lane (symmetric)
        
        // REMOVED: Funnel walls were blocking ball path to flippers
        // The angled walls were positioned ABOVE the flipper level and preventing ball flow
        // wallList.add(new Wall(80, height - 120, 160, height - 90)); // REMOVED - blocking path to flippers
        // wallList.add(new Wall(width - 80, height - 120, width - 160, height - 90)); // REMOVED - blocking path to flippers
        
        // REMOVED: Guide wall between purple triangle and launch tube - was creating invisible barrier
        // wallList.add(new Wall(430, 100, 480, 180)); // REMOVED - invisible collision in middle of board
        
        // REMOVED: All flipper area walls - these were preventing ball from reaching flippers
        // wallList.add(new Wall(100, height - 40, 250, height - 20)); // REMOVED - blocking ball access to flippers
        // wallList.add(new Wall(width - 100, height - 40, width - 250, height - 20)); // REMOVED - blocking ball access to flippers
        // wallList.add(new Wall(250, height - 20, width - 250, height - 20)); // REMOVED - blocking ball flow
        
        // SAFETY COLLISION BOUNDARIES - Repositioned to be more effective at returning ball to play
        wallList.add(new Wall(0, height + 150, width, height + 150)); // Bottom safety net (closer, more energetic)
        wallList.add(new Wall(width + 150, 0, width + 150, height + 200)); // Right safety net 
        wallList.add(new Wall(-150, 0, -150, height + 200)); // Left safety net
        
        return wallList;
    }
    
    public void update() {
        if (gameState != GameState.PLAYING && gameState != GameState.PAUSED) return;
        
        // Skip physics updates when paused, but allow rendering
        if (gameState == GameState.PAUSED) return;
        
        updateFlippers();
        updateWalls();
        updateBall();
        updateLaunchPower();
    }
    
    private void updateWalls() {
        for (Wall wall : walls) {
            wall.update();
        }
    }
    
    private void updateFlippers() {
        for (Flipper flipper : flippers) {
            flipper.update();
        }
    }
    
    private void updateBall() {
        if (!gameRunning) {
            // Ensure ball stays still in launch tube when not running
            ball.setVelocity(0, 0);
            return;
        }
        
        // Apply physics
        ball.applyGravity(GRAVITY);
        ball.applyFriction(FRICTION);
        
        // Realistic physics - allow for rolling and controlled movement
        double velX = ball.getVelocityX();
        double velY = ball.getVelocityY();
        double totalVel = Math.sqrt(velX * velX + velY * velY);
        
        // CLEAN VELOCITY MANAGEMENT - Simple and effective
        // Stop ball if moving too slowly
        if (totalVel < MIN_VELOCITY) {
            ball.setVelocity(0, 0);
        }
        
        // Cap maximum velocity
        if (totalVel > MAX_VELOCITY) {
            double scale = MAX_VELOCITY / totalVel;
            ball.setVelocity(velX * scale, velY * scale);
        }
        
        ball.updatePosition();
        
        // Update launch tube animation
        launchTube.update();
        
        // Check collisions
        checkWallCollisions();
        checkFlipperCollisions();
        checkBumperCollisions();
        checkTargetCollisions();
        checkLaunchTubeCollision(); // Re-enabled but will modify to only work during launch
        
        // DEBUG: Periodic status check
        if (System.currentTimeMillis() % 2000 < 50) { // Every 2 seconds
            System.out.println("Game status: Ball at (" + Math.round(ball.getX()) + ", " + Math.round(ball.getY()) + 
                "), gameRunning=" + gameRunning + ", launching=" + launching);
        }
        
        // SIMPLE BOUNDARY CHECK - Only reset when truly out of bounds
        checkSimpleBoundary();
        
        // DEBUG: Monitor for unexpected ball position changes - DISABLED (was stopping gameplay)
        // debugBallMovement(); // DISABLED - was incorrectly stopping game when ball launched properly
    }
    
    private void updateLaunchPower() {
        if (launching) {
            // CLEAN POWER BUILDUP - Simple and responsive
            launchPower = Math.min(launchPower + 2.5, MAX_LAUNCH_POWER);
        }
    }
    
    private void checkWallCollisions() {
        double currentVelX = ball.getVelocityX();
        double currentVelY = ball.getVelocityY();
        
        // Check collision with all walls using proper line collision detection
        for (Wall wall : walls) {
            Wall.CollisionInfo collision = wall.checkCollision(ball);
            
            if (collision.hasCollision) {
                // DEBUG: Log wall collision to identify hidden barriers  
                System.out.println("WALL COLLISION at ball position (" + Math.round(ball.getX()) + ", " + Math.round(ball.getY()) + ")");
                
                
                // Trigger wall impact animation
                wall.triggerImpact();
                
                // Calculate reflection vector using proper physics
                double dotProduct = currentVelX * collision.normalX + currentVelY * collision.normalY;
                
                // Reflect velocity with enhanced bounce and angle variation
                double reflectedVelX = currentVelX - 2 * dotProduct * collision.normalX;
                double reflectedVelY = currentVelY - 2 * dotProduct * collision.normalY;
                
                // IMPROVED BOUNCE PHYSICS - Prevents sticking
                reflectedVelX *= BOUNCE;
                reflectedVelY *= BOUNCE;
                
                // Add small random variation to prevent perfect collision loops
                double randomX = (Math.random() - 0.5) * 0.8;
                double randomY = (Math.random() - 0.5) * 0.8;
                reflectedVelX += randomX;
                reflectedVelY += randomY;
                
                // Ensure minimum velocity to prevent ball from getting stuck
                double newSpeed = Math.sqrt(reflectedVelX * reflectedVelX + reflectedVelY * reflectedVelY);
                if (newSpeed < 3.0) {
                    double scale = 3.0 / newSpeed;
                    reflectedVelX *= scale;
                    reflectedVelY *= scale;
                }
                
                // Apply new velocity
                ball.setVelocity(reflectedVelX, reflectedVelY);
                
                // Enhanced collision separation to prevent sticking
                double pushDistance = ball.getRadius() + 2.0; // Increased push distance to prevent re-collision
                ball.setPosition(
                    ball.getX() + collision.normalX * pushDistance,
                    ball.getY() + collision.normalY * pushDistance
                );
                
                // Only process one collision per frame to avoid conflicts
                break;
            }
        }
        
        // Re-enabled boundary checks with fixes to prevent clipping
        checkBoundaryCollisions();
    }
    
    private void checkBoundaryCollisions() {
        double currentVelX = ball.getVelocityX();
        double currentVelY = ball.getVelocityY();
        boolean wallHit = false;
        
        // FIXED: Strong left boundary - prevent clipping
        if (ball.getX() - ball.getRadius() <= 15) {
            ball.setX(15 + ball.getRadius() + 2); // Extra padding to prevent clipping
            ball.setVelocityX(Math.abs(currentVelX) * BOUNCE);
            wallHit = true;
            System.out.println("Left boundary collision prevented clipping at: " + ball.getX() + ", " + ball.getY());
        }
        
        // FIXED: Strong right boundary - prevent clipping (avoid launch tube area)
        if (ball.getX() + ball.getRadius() >= width - 15 && ball.getY() < height - 120) {
            ball.setX(width - 15 - ball.getRadius() - 2); // Extra padding to prevent clipping
            ball.setVelocityX(-Math.abs(currentVelX) * BOUNCE);
            wallHit = true;
            System.out.println("Right boundary collision prevented clipping at: " + ball.getX() + ", " + ball.getY());
        }
        
        // Top boundary - keep the hole for ball drop
        if (ball.getY() - ball.getRadius() <= 0 && ball.getX() > width - 90) {
            ball.setY(ball.getRadius());
            ball.setVelocityY(Math.abs(currentVelY) * BOUNCE);
            wallHit = true;
            System.out.println("Top boundary collision at: " + ball.getX() + ", " + ball.getY());
        }
        
        // LAUNCH TUBE WALLS REMOVED - No collision interference with ball launch
        
        // Add angle variation for boundary hits
        if (wallHit) {
            Random rand = new Random();
            double angleVariation = (rand.nextDouble() - 0.5) * 0.5;
            ball.setVelocityY(ball.getVelocityY() + angleVariation);
        }
    }
    
    private void checkFlipperCollisions() {
        for (Flipper flipper : flippers) {
            if (flipper.checkCollision(ball)) {
                // DEBUG: Log flipper collision to track hits
                System.out.println("FLIPPER COLLISION at ball position (" + ball.getX() + ", " + ball.getY() + ")");
                
                
                // Collision handled in flipper
                break;
            }
        }
    }
    
    private void checkBumperCollisions() {
        for (Bumper bumper : bumpers) {
            if (bumper.checkCollision(ball)) {
                // DEBUG: Log bumper collision to identify early hits
                System.out.println("BUMPER HIT at ball position (" + ball.getX() + ", " + ball.getY() + ")");
                
                
                addScore(bumper.getPoints());
                break;
            }
        }
    }
    
    private void checkTargetCollisions() {
        for (Target target : targets) {
            if (target.checkCollision(ball)) {
                // DEBUG: Log target collision to identify early hits
                System.out.println("TARGET HIT at ball position (" + ball.getX() + ", " + ball.getY() + ")");
                
                
                addScore(target.getPoints());
                break;
            }
        }
    }
    
    private void checkLaunchTubeCollision() {
        // MODIFIED: Only allow launch tube collision during launch phase or when tube is open
        // This prevents the tube from repositioning the ball during normal gameplay
        if (launching || launchTube.isOpen()) {
            // Only allow tube interaction during launch or when tube is open
            if (launchTube.checkCollision(ball)) {
                System.out.println("Launch tube collision during launch phase - allowing interaction");
                launchTube.handleCollision(ball);
            }
        } else if (launchTube.isClosed() && launchTube.checkCollision(ball)) {
            // If ball hits closed tube during gameplay, just log it but don't reposition
            System.out.println("Ball hit closed launch tube during gameplay - NOT repositioning ball");
            // NO ball repositioning - just let it bounce naturally off walls
        }
    }
    
    private void checkSimpleBoundary() {
        if (!gameRunning || launching) return;
        
        double ballX = ball.getX();
        double ballY = ball.getY();
        
        // TELEPORT SYSTEM: Ball exits top right, enters top left
        if (ballX > width - 50 && ballY < 50) { // Top right area
            System.out.println("Ball teleporting from top right to top left!");
            ball.setPosition(50, 50); // Drop into top left opening
            ball.setVelocity(ball.getVelocityX() * 0.8, Math.abs(ball.getVelocityY()) * 0.5); // Reduce speed, downward motion
            return; // Don't check for out of bounds after teleport
        }
        
        // Only reset if ball goes WAY off screen (other areas)
        boolean outOfBounds = false;
        
        if (ballY > height + 100) { // 100 pixels below screen
            outOfBounds = true;
            System.out.println("Ball fell below screen at Y=" + ballY);
        }
        
        if (ballX < -50) { // Left side (but not top left teleport area)
            outOfBounds = true;
            System.out.println("Ball went off left side at X=" + ballX);
        }
        
        if (ballX > width + 50 && ballY > 100) { // Right side (but not top right teleport area)
            outOfBounds = true;
            System.out.println("Ball went off right side at X=" + ballX);
        }
        
        if (outOfBounds) {
            ballLost();
        }
    }
    
    private void ballLost() {
        // Ball has gone out of bounds - reset for new launch
        System.out.println("Ball lost! Resetting for new launch");
        resetBall();
        
        // Optional: Decrease ball count for actual gameplay
        // balls--;
        // if (balls <= 0) {
        //     gameOver();
        // }
    }
    
    private void checkBoundaryReset() {
        // Only reset when ball goes completely out of the playfield boundaries
        if (!gameRunning || launching) {
            return;
        }
        
        double ballX = ball.getX();
        double ballY = ball.getY();
        
        // Define playfield boundaries - EXTREMELY generous to allow natural gameplay
        boolean outOfBounds = false;
        String reason = "";
        
        // DEBUG: Log ball position when it gets far from normal play area
        if (ballY > height + 50) {
            System.out.println("DEBUG: Ball getting far below screen - Y=" + Math.round(ballY) + 
                ", screen height=" + height + ", flippers at Y=" + (height - 80));
        }
        
        // Bottom boundary - ball must go EXTREMELY far below screen to reset
        if (ballY > height + 400) { // 400 pixels below screen (ball was at ~790, so this gives plenty of room)
            outOfBounds = true;
            reason = "fell extremely far below screen (Y=" + Math.round(ballY) + ", limit=" + (height + 400) + 
                ", screen height=" + height + ")";
        }
        
        // Left boundary - ball goes way off left side
        if (ballX < -200) { // 200 pixels off left (was 100)
            outOfBounds = true;
            reason = "went extremely far off left side (X=" + Math.round(ballX) + ")";
        }
        
        // Right boundary - ball goes way off right side
        if (ballX > width + 200) { // 200 pixels off right (was 100)
            outOfBounds = true;
            reason = "went extremely far off right side (X=" + Math.round(ballX) + ", screen width=" + width + ")";
        }
        
        // Re-enabled with much more generous boundaries
        if (outOfBounds) {
            System.out.println("*** BALL OUT OF BOUNDS *** " + reason);
            ballLost();
        }
    }
    
    
    
    
    private void debugBallMovement() {
        // Track when ball gets moved to launch tube area unexpectedly
        double ballX = ball.getX();
        double ballY = ball.getY();
        double launchTubeX = width - 75; // Launch tube X position
        double launchTubeY = height - 20; // Launch tube Y position
        
        // Check if ball is anywhere in the launch tube area when it shouldn't be
        if (gameRunning && !launching) {
            boolean inLaunchArea = (ballX > width - 100) && (ballY > height - 100);
            double distanceToLaunchPos = Math.sqrt(Math.pow(ballX - launchTubeX, 2) + Math.pow(ballY - launchTubeY, 2));
            
            // If ball is in launch area or very close to launch position during gameplay
            if (inLaunchArea || distanceToLaunchPos < 20) {
                System.out.println("*** BALL IN LAUNCH AREA DURING GAMEPLAY ***");
                System.out.println("Ball position: (" + Math.round(ballX) + ", " + Math.round(ballY) + ")");
                System.out.println("Launch position: (" + launchTubeX + ", " + launchTubeY + ")");
                System.out.println("Distance to launch: " + Math.round(distanceToLaunchPos));
                System.out.println("gameRunning=" + gameRunning + ", launching=" + launching);
                System.out.println("Ball velocity: (" + Math.round(ball.getVelocityX()*100)/100.0 + ", " + Math.round(ball.getVelocityY()*100)/100.0 + ")");
                
                // Stop the spam after first detection
                gameRunning = false;
                System.out.println("*** STOPPING GAME TO INVESTIGATE ***");
            }
        }
    }
    
    private void resetBall() {
        System.out.println("Resetting ball for next launch");
        // Position ball at launch tube position
        ball.setPosition(width - 60, height - 15);
        ball.setVelocity(0, 0);
        gameRunning = false; // Ball waits for launch
        launching = false;
        launchPower = 0;
        
        
        // Open the tube for new ball
        launchTube.forceOpen();
        
        // Ensure game state allows for new launch
        if (gameState != GameState.GAME_OVER) {
            gameState = GameState.PLAYING;
        }
    }
    
    public void resetBallManually() {
        System.out.println("Manual ball reset (R key pressed)");
        resetBall();
    }
    
    private void gameOver() {
        gameState = GameState.GAME_OVER;
        
        if (highScoreManager.isTopTenScore(score)) {
            gameState = GameState.WAITING_FOR_NAME;
        }
    }
    
    public void submitHighScore(String playerName) {
        if (gameState == GameState.WAITING_FOR_NAME) {
            highScoreManager.addScore(playerName, score);
            gameState = GameState.GAME_OVER;
        }
    }
    
    public void newGame() {
        System.out.println("=== STARTING NEW GAME ==="); // Debug
        initializeGame();
        // Ensure proper state for immediate gameplay
        gameState = GameState.PLAYING;
        gameRunning = false; // Ball at rest, ready to launch
        launching = false;
        launchPower = 0;
        // Ensure tube is open for new game
        launchTube.forceOpen();
        System.out.println("=== NEW GAME READY ===");
        System.out.println("  gameState: " + gameState);
        System.out.println("  gameRunning: " + gameRunning);
        System.out.println("  launching: " + launching);
        System.out.println("  tubeOpen: " + launchTube.isOpen());
        System.out.println("  balls: " + balls);
        System.out.println("Ready for space bar launch!"); // Debug
    }
    
    private void addScore(int points) {
        score += points;
    }
    
    // Input handling methods
    public void handleSpacePressed() {
        System.out.println("=== SPACE PRESSED ==="); // Debug
        System.out.println("gameState: " + gameState + ", gameRunning: " + gameRunning + ", launching: " + launching + ", balls: " + balls); // Debug
        
        // If game is over (including waiting for name), start a new game
        if (gameState == GameState.GAME_OVER || gameState == GameState.WAITING_FOR_NAME) {
            System.out.println("Game is over, starting new game..."); // Debug
            newGame();
            return;
        }
        
        // DETAILED LAUNCH DEBUGGING
        boolean tubeOpen = launchTube.isOpen();
        System.out.println("=== LAUNCH CONDITIONS CHECK ===");
        System.out.println("  launching: " + launching + " (should be false)");
        System.out.println("  balls: " + balls + " (should be > 0)");
        System.out.println("  gameState: " + gameState + " (should be PLAYING)");
        System.out.println("  tubeOpen: " + tubeOpen + " (should be true)");
        System.out.println("  gameRunning: " + gameRunning + " (should be false)");
        System.out.println("  tubeState: " + launchTube.getState());
        System.out.println("  ballPosition: (" + ball.getX() + ", " + ball.getY() + ")");
        System.out.println("  ballVelocity: (" + ball.getVelocityX() + ", " + ball.getVelocityY() + ")");
        
        // Simplified launch logic - remove gameRunning restriction for testing
        if (!launching && balls > 0 && gameState == GameState.PLAYING) {
            // Force tube open if it's not already
            if (!tubeOpen) {
                System.out.println("Tube not open - forcing open!");
                launchTube.forceOpen();
                tubeOpen = launchTube.isOpen();
            }
            
            if (tubeOpen) {
                launching = true;
                launchPower = 0;
                gameRunning = false; // Ensure ball is at rest for launch
                System.out.println("*** LAUNCH STARTED! *** All conditions met!"); // Debug
            } else {
                System.out.println("*** LAUNCH FAILED! *** Tube still not open after force!");
            }
        } else {
            System.out.println("*** LAUNCH FAILED! *** Conditions not met:");
            if (launching) System.out.println("  - Already launching!");
            if (balls <= 0) System.out.println("  - No balls left!");
            if (gameState != GameState.PLAYING) System.out.println("  - Game not in PLAYING state!");
        }
    }
    
    public void handleSpaceReleased() {
        if (launching) {
            launchBall();
        }
    }
    
    
    private void launchBall() {
        // CLEAN LAUNCH PHYSICS - Simple and effective
        double power = Math.max(launchPower, 50.0); // Minimum launch power
        System.out.println("Launching ball with power: " + power);
        
        // Simple launch calculation - straight up like real pinball machines
        double powerRatio = power / MAX_LAUNCH_POWER;
        
        // Calculate launch velocity - straight up with MASSIVE 800% power
        double velocityX = 0.0; // No horizontal movement - straight up
        double velocityY = -20.0 - (powerRatio * 60.0); // -20 to -80 upward (EXTREME power)
        
        System.out.println("Launch velocity: (" + velocityX + ", " + velocityY + ")");
        
        ball.setVelocityX(velocityX);
        ball.setVelocityY(velocityY);
        
        gameRunning = true;
        launching = false;
        launchPower = 0;
        
        System.out.println("*** BALL LAUNCHED! ***");
        System.out.println("Final velocity: (" + velocityX + ", " + velocityY + ")");
        
        
        launchTube.resetAim(); // Reset aim after launch
        
        // Start closing animation after ball is launched
        System.out.println("*** STARTING TUBE CLOSING ANIMATION ***"); // Debug
        launchTube.startClosing();
        System.out.println("Tube state after startClosing: " + launchTube.getState()); // Debug
    }
    
    public void activateLeftFlipper() {
        System.out.println("Activating LEFT flipper");
        flippers.get(0).activate();
    }
    
    public void deactivateLeftFlipper() {
        System.out.println("Deactivating LEFT flipper");
        flippers.get(0).deactivate();
    }
    
    public void activateRightFlipper() {
        System.out.println("Activating RIGHT flipper");
        flippers.get(1).activate();
    }
    
    public void deactivateRightFlipper() {
        System.out.println("Deactivating RIGHT flipper");
        flippers.get(1).deactivate();
    }
    
    // Tube aiming methods (only work when launching)
    public void aimTubeLeft() {
        if (launching) {
            launchTube.aimLeft();
        }
    }
    
    public void aimTubeRight() {
        if (launching) {
            launchTube.aimRight();
        }
    }
    
    public void aimTubeDown() {
        if (launching) {
            launchTube.aimDown();
        }
    }
    
    public void handleEscPressed() {
        System.out.println("=== ESC PRESSED ==="); // Debug
        
        // Toggle pause state when ESC is pressed during gameplay
        if (gameState == GameState.PLAYING) {
            gameState = GameState.PAUSED;
            System.out.println("Game paused"); // Debug
        } else if (gameState == GameState.PAUSED) {
            gameState = GameState.PLAYING;
            System.out.println("Game unpaused"); // Debug
        }
        // ESC does nothing in other states (game over, waiting for name)
    }
    
    
    // Getters for rendering
    public Ball getBall() { return ball; }
    public List<Flipper> getFlippers() { return flippers; }
    public List<Bumper> getBumpers() { return bumpers; }
    public List<Target> getTargets() { return targets; }
    public List<Wall> getWalls() { return walls; }
    public LaunchTube getLaunchTube() { return launchTube; }
    
    public int getScore() { return score; }
    public int getBalls() { return balls; }
    public boolean isLaunching() { return launching; }
    public double getLaunchPower() { return launchPower; }
    public double getMaxLaunchPower() { return MAX_LAUNCH_POWER; }
    public GameState getGameState() { return gameState; }
    public int getHighScore() { return highScoreManager.getHighScore(); }
} 