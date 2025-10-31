package com.tetris;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Random;

public class TetrisGame extends JPanel implements ActionListener, KeyListener {
    private static final int BOARD_WIDTH = 10;
    private static final int BOARD_HEIGHT = 17; // Reduced from 20 to 17 (3 lines removed)
    private static final int BLOCK_SIZE = 30;
    private static final int GAME_SPEED = 500; // milliseconds
    
    private Timer gameTimer;
    private Color[][] board;
    private TetrisPiece currentPiece;
    private TetrisPiece nextPiece;
    private Random random;
    private List<Integer> pieceBag;
    private int bagIndex;
    private int score;
    private int lines;
    private int level;
    private boolean gameOver;
    private boolean paused;
    private HighScoreManager highScoreManager;
    
    // Visual effects
    private List<LineEffect> lineEffects;
    private int flashTimer;
    private boolean showFlash;
    private Color flashColor;
    
    // Lock delay for pieces touching other pieces
    private boolean inLockDelay;
    private int lockDelayTimer;
    private static final int LOCK_DELAY_DURATION = 8; // ~0.13 seconds at 60 FPS
    private boolean showLockDelayPiece;
    
    // Double down arrow detection
    private long lastDownKeyTime;
    private static final long DOUBLE_CLICK_INTERVAL = 300; // 300ms for double click
    
    // Dark glowing theme colors
    private static final Color BACKGROUND_COLOR = new Color(5, 5, 15);
    private static final Color GRID_COLOR = new Color(80, 80, 120);
    private static final Color GRID_HIGHLIGHT_COLOR = new Color(120, 120, 180);
    private static final Color TEXT_COLOR = new Color(0, 255, 255);
    
    public TetrisGame() {
        setPreferredSize(new Dimension(BOARD_WIDTH * BLOCK_SIZE + 200, BOARD_HEIGHT * BLOCK_SIZE + 100));
        setBackground(BACKGROUND_COLOR);
        setFocusable(true);
        addKeyListener(this);
        
        board = new Color[BOARD_HEIGHT][BOARD_WIDTH];
        random = new Random();
        highScoreManager = new HighScoreManager();
        lineEffects = new ArrayList<>();
        pieceBag = new ArrayList<>();
        bagIndex = 0;
        
        initGame();
        
        gameTimer = new Timer(GAME_SPEED, this);
        gameTimer.start();
    }
    
    private void initGame() {
        // Clear board
        for (int row = 0; row < BOARD_HEIGHT; row++) {
            for (int col = 0; col < BOARD_WIDTH; col++) {
                board[row][col] = null;
            }
        }
        
        initializePieceBag();
        currentPiece = new TetrisPiece(getNextPieceType());
        nextPiece = new TetrisPiece(getNextPieceType());
        score = 0;
        lines = 0;
        level = 1;
        gameOver = false;
        paused = false;
        lineEffects.clear();
        flashTimer = 0;
        showFlash = false;
        inLockDelay = false;
        lockDelayTimer = 0;
        showLockDelayPiece = true;
        lastDownKeyTime = 0;
    }
    
    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g;
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        drawBoard(g2d);
        drawCurrentPiece(g2d);
        drawLineEffects(g2d);
        drawFlashEffect(g2d);
        drawUI(g2d);
        
        if (paused) {
            drawPauseScreen(g2d);
        } else if (gameOver) {
            drawGameOver(g2d);
        }
    }
    
    private void drawBoard(Graphics2D g2d) {
        // Draw enhanced grid with better visibility
        g2d.setStroke(new BasicStroke(2.0f));
        
        // Draw main grid lines
        g2d.setColor(GRID_COLOR);
        for (int row = 0; row <= BOARD_HEIGHT; row++) {
            g2d.drawLine(0, row * BLOCK_SIZE, BOARD_WIDTH * BLOCK_SIZE, row * BLOCK_SIZE);
        }
        for (int col = 0; col <= BOARD_WIDTH; col++) {
            g2d.drawLine(col * BLOCK_SIZE, 0, col * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
        }
        
        // Add subtle grid cell backgrounds for better visibility
        g2d.setColor(new Color(15, 15, 25, 50));
        for (int row = 0; row < BOARD_HEIGHT; row++) {
            for (int col = 0; col < BOARD_WIDTH; col++) {
                if (board[row][col] == null) {
                    g2d.fillRect(col * BLOCK_SIZE + 1, row * BLOCK_SIZE + 1, 
                               BLOCK_SIZE - 2, BLOCK_SIZE - 2);
                }
            }
        }
        
        // Draw border with highlight
        g2d.setStroke(new BasicStroke(3.0f));
        g2d.setColor(GRID_HIGHLIGHT_COLOR);
        g2d.drawRect(0, 0, BOARD_WIDTH * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
        
        // Reset stroke
        g2d.setStroke(new BasicStroke(1.0f));
        
        // Draw placed blocks with enhanced glow effect
        for (int row = 0; row < BOARD_HEIGHT; row++) {
            for (int col = 0; col < BOARD_WIDTH; col++) {
                if (board[row][col] != null) {
                    drawEnhancedGlowingBlock(g2d, col * BLOCK_SIZE, row * BLOCK_SIZE, board[row][col]);
                }
            }
        }
    }
    
    private void drawCurrentPiece(Graphics2D g2d) {
        if (currentPiece != null) {
            // Don't draw piece during lock delay blink when it should be hidden
            if (inLockDelay && !showLockDelayPiece) {
                return;
            }
            
            Color pieceColor = currentPiece.getColor();
            int[][] shape = currentPiece.getShape();
            int x = currentPiece.getX();
            int y = currentPiece.getY();
            
            for (int row = 0; row < shape.length; row++) {
                for (int col = 0; col < shape[row].length; col++) {
                    if (shape[row][col] == 1) {
                        int blockX = (x + col) * BLOCK_SIZE;
                        int blockY = (y + row) * BLOCK_SIZE;
                        drawEnhancedGlowingBlock(g2d, blockX, blockY, pieceColor);
                    }
                }
            }
        }
    }
    
    private void drawEnhancedGlowingBlock(Graphics2D g2d, int x, int y, Color color) {
        // Create stronger outer glow effect
        for (int i = 8; i > 0; i--) {
            float alpha = 0.15f * i / 8f;
            Color glowColor = new Color(color.getRed(), color.getGreen(), color.getBlue(), (int)(255 * alpha));
            g2d.setColor(glowColor);
            g2d.fillRect(x - i, y - i, BLOCK_SIZE + 2 * i, BLOCK_SIZE + 2 * i);
        }
        
        // Draw dark border for definition
        g2d.setColor(new Color(0, 0, 0, 180));
        g2d.setStroke(new BasicStroke(2.0f));
        g2d.drawRect(x, y, BLOCK_SIZE, BLOCK_SIZE);
        
        // Draw main block with gradient effect
        GradientPaint gradient = new GradientPaint(
            x, y, color,
            x + BLOCK_SIZE, y + BLOCK_SIZE, color.darker()
        );
        g2d.setPaint(gradient);
        g2d.fillRect(x + 2, y + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        
        // Add bright center highlight for extra visibility
        Color brightColor = new Color(
            Math.min(255, color.getRed() + 120),
            Math.min(255, color.getGreen() + 120),
            Math.min(255, color.getBlue() + 120)
        );
        g2d.setColor(brightColor);
        g2d.fillRect(x + 6, y + 6, BLOCK_SIZE - 12, BLOCK_SIZE - 12);
        
        // Add inner bright edge for definition
        g2d.setColor(new Color(255, 255, 255, 100));
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.drawRect(x + 3, y + 3, BLOCK_SIZE - 6, BLOCK_SIZE - 6);
        
        // Reset paint and stroke
        g2d.setPaint(null);
        g2d.setStroke(new BasicStroke(1.0f));
    }
    
    private void drawLineEffects(Graphics2D g2d) {
        for (int i = lineEffects.size() - 1; i >= 0; i--) {
            LineEffect effect = lineEffects.get(i);
            effect.update();
            effect.draw(g2d);
            
            if (effect.isFinished()) {
                lineEffects.remove(i);
            }
        }
    }
    
    private void drawFlashEffect(Graphics2D g2d) {
        if (showFlash && flashTimer > 0) {
            g2d.setColor(new Color(flashColor.getRed(), flashColor.getGreen(), flashColor.getBlue(), 
                                 Math.max(0, flashTimer * 15)));
            g2d.fillRect(0, 0, BOARD_WIDTH * BLOCK_SIZE, BOARD_HEIGHT * BLOCK_SIZE);
            
            flashTimer--;
            if (flashTimer <= 0) {
                showFlash = false;
            }
        }
    }
    
    private void drawUI(Graphics2D g2d) {
        g2d.setColor(TEXT_COLOR);
        g2d.setFont(new Font("Arial", Font.BOLD, 16));
        
        int uiX = BOARD_WIDTH * BLOCK_SIZE + 20;
        int uiY = 30;
        
        g2d.drawString("Score: " + score, uiX, uiY);
        g2d.drawString("Lines: " + lines, uiX, uiY + 25);
        g2d.drawString("Level: " + level, uiX, uiY + 50);
        
        // Draw next piece
        g2d.drawString("Next:", uiX, uiY + 100);
        if (nextPiece != null) {
            int[][] nextShape = nextPiece.getShape();
            Color nextColor = nextPiece.getColor();
            for (int row = 0; row < nextShape.length; row++) {
                for (int col = 0; col < nextShape[row].length; col++) {
                    if (nextShape[row][col] == 1) {
                        int blockX = uiX + col * 20;
                        int blockY = uiY + 120 + row * 20;
                        g2d.setColor(nextColor);
                        g2d.fillRect(blockX, blockY, 18, 18);
                    }
                }
            }
        }
        
        // Draw controls
        g2d.setFont(new Font("Arial", Font.BOLD, 12));
        g2d.drawString("Controls:", uiX, uiY + 200);
        g2d.drawString("SPACE - Pause", uiX, uiY + 220);
        g2d.drawString("N - New Game", uiX, uiY + 235);
        g2d.drawString("ESC/Q - Quit", uiX, uiY + 250);
        g2d.drawString("Arrows - Move/Rotate", uiX, uiY + 265);
        g2d.drawString("Double Down - Force Lock", uiX, uiY + 280);
        
        // Draw high scores
        g2d.setFont(new Font("Arial", Font.BOLD, 16));
        g2d.drawString("High Scores:", uiX, uiY + 310);
        List<Integer> highScores = highScoreManager.getHighScores();
        for (int i = 0; i < Math.min(5, highScores.size()); i++) {
            g2d.drawString((i + 1) + ". " + highScores.get(i), uiX, uiY + 335 + i * 20);
        }
    }
    
    private void drawGameOver(Graphics2D g2d) {
        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRect(0, 0, getWidth(), getHeight());
        
        g2d.setColor(TEXT_COLOR);
        g2d.setFont(new Font("Arial", Font.BOLD, 32));
        FontMetrics fm = g2d.getFontMetrics();
        String gameOverText = "GAME OVER";
        int x = (BOARD_WIDTH * BLOCK_SIZE - fm.stringWidth(gameOverText)) / 2;
        int y = BOARD_HEIGHT * BLOCK_SIZE / 2;
        g2d.drawString(gameOverText, x, y);
        
        g2d.setFont(new Font("Arial", Font.BOLD, 16));
        fm = g2d.getFontMetrics();
        String restartText = "Press R to restart";
        x = (BOARD_WIDTH * BLOCK_SIZE - fm.stringWidth(restartText)) / 2;
        g2d.drawString(restartText, x, y + 40);
    }
    
    private void drawPauseScreen(Graphics2D g2d) {
        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRect(0, 0, getWidth(), getHeight());
        
        g2d.setColor(TEXT_COLOR);
        g2d.setFont(new Font("Arial", Font.BOLD, 32));
        FontMetrics fm = g2d.getFontMetrics();
        String pauseText = "PAUSED";
        int x = (BOARD_WIDTH * BLOCK_SIZE - fm.stringWidth(pauseText)) / 2;
        int y = BOARD_HEIGHT * BLOCK_SIZE / 2;
        g2d.drawString(pauseText, x, y);
        
        g2d.setFont(new Font("Arial", Font.BOLD, 16));
        fm = g2d.getFontMetrics();
        String resumeText = "Press SPACE to resume";
        x = (BOARD_WIDTH * BLOCK_SIZE - fm.stringWidth(resumeText)) / 2;
        g2d.drawString(resumeText, x, y + 40);
    }
    
    @Override
    public void actionPerformed(ActionEvent e) {
        if (!gameOver && !paused) {
            if (inLockDelay) {
                // Handle lock delay
                lockDelayTimer++;
                
                // Blink every 2 frames (very fast blinking for urgency)
                if (lockDelayTimer % 2 == 0) {
                    showLockDelayPiece = !showLockDelayPiece;
                }
                
                // Check if piece can still move down (delay might be cancelled)
                if (canMovePiece(currentPiece, 0, 1)) {
                    // Piece can move again, cancel lock delay
                    inLockDelay = false;
                    lockDelayTimer = 0;
                    showLockDelayPiece = true;
                    currentPiece.moveDown();
                } else if (lockDelayTimer >= LOCK_DELAY_DURATION) {
                    // Lock delay finished, place the piece
                    inLockDelay = false;
                    showLockDelayPiece = true;
                    placePiece();
                    clearLines();
                    spawnNewPiece();
                    
                    if (!canMovePiece(currentPiece, 0, 0)) {
                        gameOver = true;
                        highScoreManager.addScore(score);
                    }
                }
            } else {
                if (canMovePiece(currentPiece, 0, 1)) {
                    currentPiece.moveDown();
                } else {
                    // Piece can't move down - check if touching another piece
                    if (isPieceTouchingAnotherPiece()) {
                        // Start lock delay when touching another piece
                        inLockDelay = true;
                        lockDelayTimer = 0;
                        showLockDelayPiece = true;
                    } else {
                        // Hit bottom - lock immediately
                        placePiece();
                        clearLines();
                        spawnNewPiece();
                        
                        if (!canMovePiece(currentPiece, 0, 0)) {
                            gameOver = true;
                            highScoreManager.addScore(score);
                        }
                    }
                }
            }
        }
        
        // Update flash effect (even when paused for visual continuity)
        if (showFlash) {
            repaint();
        }
        
        // Update line effects (even when paused)
        if (!lineEffects.isEmpty()) {
            repaint();
        } else if (!gameOver || paused || inLockDelay) {
            repaint();
        }
    }
    
    private boolean canMovePiece(TetrisPiece piece, int deltaX, int deltaY) {
        int[][] shape = piece.getShape();
        int newX = piece.getX() + deltaX;
        int newY = piece.getY() + deltaY;
        
        for (int row = 0; row < shape.length; row++) {
            for (int col = 0; col < shape[row].length; col++) {
                if (shape[row][col] == 1) {
                    int boardX = newX + col;
                    int boardY = newY + row;
                    
                    if (boardX < 0 || boardX >= BOARD_WIDTH || 
                        boardY >= BOARD_HEIGHT || 
                        (boardY >= 0 && board[boardY][boardX] != null)) {
                        return false;
                    }
                }
            }
        }
        return true;
    }
    
    private void placePiece() {
        if (currentPiece == null) return;
        
        int[][] shape = currentPiece.getShape();
        int x = currentPiece.getX();
        int y = currentPiece.getY();
        Color color = currentPiece.getColor();
        
        for (int row = 0; row < shape.length; row++) {
            for (int col = 0; col < shape[row].length; col++) {
                if (shape[row][col] == 1) {
                    int boardX = x + col;
                    int boardY = y + row;
                    if (boardY >= 0 && boardY < BOARD_HEIGHT && boardX >= 0 && boardX < BOARD_WIDTH) {
                        board[boardY][boardX] = color;
                    }
                }
            }
        }
    }
    
    private void clearLines() {
        int linesCleared = 0;
        List<Integer> clearedRows = new ArrayList<>();
        
        for (int row = BOARD_HEIGHT - 1; row >= 0; row--) {
            boolean fullLine = true;
            for (int col = 0; col < BOARD_WIDTH; col++) {
                if (board[row][col] == null) {
                    fullLine = false;
                    break;
                }
            }
            
            if (fullLine) {
                clearedRows.add(row);
                linesCleared++;
            }
        }
        
        if (linesCleared > 0) {
            // Clear the lines IMMEDIATELY
            for (int row : clearedRows) {
                // Remove the line
                for (int moveRow = row; moveRow > 0; moveRow--) {
                    for (int col = 0; col < BOARD_WIDTH; col++) {
                        board[moveRow][col] = board[moveRow - 1][col];
                    }
                }
                // Clear top line
                for (int col = 0; col < BOARD_WIDTH; col++) {
                    board[0][col] = null;
                }
            }
            
            // Add visual effects AFTER clearing lines (so they don't delay gameplay)
            addLineEffects(clearedRows, linesCleared);
            
            lines += linesCleared;
            
            // Scoring with bonus for multiple lines
            int baseScore = linesCleared * 100 * level;
            if (linesCleared >= 4) {
                baseScore *= 2; // Tetris bonus
            }
            if (linesCleared >= 5) {
                baseScore *= 3; // Super bonus for 5+ lines
            }
            score += baseScore;
            
            level = lines / 10 + 1;
            
            // Increase speed with extra boost for multiple lines
            int speedBoost = linesCleared >= 5 ? 100 : (linesCleared >= 4 ? 50 : 0);
            int newDelay = Math.max(30, GAME_SPEED - (level - 1) * 50 - speedBoost);
            gameTimer.setDelay(newDelay);
        }
    }
    
    private void addLineEffects(List<Integer> clearedRows, int linesCleared) {
        // Add line clear effects
        for (int row : clearedRows) {
            lineEffects.add(new LineEffect(row, BOARD_WIDTH, BLOCK_SIZE));
        }
        
        // Add flash effect for multiple lines
        if (linesCleared >= 4) {
            showFlash = true;
            flashTimer = linesCleared >= 5 ? 5 : 4; // Reduced from 8/6 to 5/4
            flashColor = linesCleared >= 5 ? new Color(255, 215, 0) : new Color(255, 255, 255); // Gold for 5+, white for 4
        }
    }
    
    private boolean isPieceTouchingAnotherPiece() {
        if (currentPiece == null) return false;
        
        int[][] shape = currentPiece.getShape();
        int x = currentPiece.getX();
        int y = currentPiece.getY();
        
        for (int row = 0; row < shape.length; row++) {
            for (int col = 0; col < shape[row].length; col++) {
                if (shape[row][col] == 1) {
                    int boardX = x + col;
                    int boardY = y + row;
                    
                    // Check if this block is touching another piece below it
                    if (boardY + 1 < BOARD_HEIGHT && boardY + 1 >= 0 && board[boardY + 1][boardX] != null) {
                        return true;
                    }
                }
            }
        }
        
        return false;
    }
    
    private void forceLockPiece() {
        // Immediately lock the piece regardless of delay
        inLockDelay = false;
        showLockDelayPiece = true;
        placePiece();
        clearLines();
        spawnNewPiece();
        
        if (!canMovePiece(currentPiece, 0, 0)) {
            gameOver = true;
            highScoreManager.addScore(score);
        }
    }
    
    private void checkLockDelayCancel() {
        // If we're in lock delay and piece is no longer touching another piece, cancel delay
        if (inLockDelay && !isPieceTouchingAnotherPiece()) {
            inLockDelay = false;
            lockDelayTimer = 0;
            showLockDelayPiece = true;
        }
    }
    
    private void initializePieceBag() {
        pieceBag.clear();
        // Add all 7 piece types to the bag
        for (int i = 0; i < 7; i++) {
            pieceBag.add(i);
        }
        // Shuffle the bag for random order
        Collections.shuffle(pieceBag, random);
        bagIndex = 0;
    }
    
    private int getNextPieceType() {
        // If we've used all pieces in the bag, create a new shuffled bag
        if (bagIndex >= pieceBag.size()) {
            initializePieceBag();
        }
        
        int pieceType = pieceBag.get(bagIndex);
        bagIndex++;
        return pieceType;
    }
    
    private void spawnNewPiece() {
        currentPiece = nextPiece;
        nextPiece = new TetrisPiece(getNextPieceType());
        currentPiece.setPosition(BOARD_WIDTH / 2 - 1, 0);
        
        // Reset any lock delay state for the new piece
        inLockDelay = false;
        lockDelayTimer = 0;
        showLockDelayPiece = true;
    }
    
    @Override
    public void keyPressed(KeyEvent e) {
        if (gameOver) {
            if (e.getKeyCode() == KeyEvent.VK_R) {
                initGame();
                gameTimer.restart();
            }
            return;
        }
        
        // Handle pause/unpause
        if (e.getKeyCode() == KeyEvent.VK_SPACE) {
            paused = !paused;
            repaint();
            return;
        }
        
        // Handle quit game
        if (e.getKeyCode() == KeyEvent.VK_ESCAPE || e.getKeyCode() == KeyEvent.VK_Q) {
            System.exit(0);
            return;
        }
        
        // Handle new game
        if (e.getKeyCode() == KeyEvent.VK_N) {
            initGame();
            gameTimer.restart();
            repaint();
            return;
        }
        
        // Don't process game controls when paused
        if (paused) {
            return;
        }
        
        switch (e.getKeyCode()) {
            case KeyEvent.VK_LEFT:
                if (canMovePiece(currentPiece, -1, 0)) {
                    currentPiece.moveLeft();
                    checkLockDelayCancel();
                }
                break;
            case KeyEvent.VK_RIGHT:
                if (canMovePiece(currentPiece, 1, 0)) {
                    currentPiece.moveRight();
                    checkLockDelayCancel();
                }
                break;
            case KeyEvent.VK_DOWN:
                long currentTime = System.currentTimeMillis();
                
                // Check for double click during lock delay
                if (inLockDelay && (currentTime - lastDownKeyTime) <= DOUBLE_CLICK_INTERVAL) {
                    // Double down arrow during blinking - force lock piece
                    forceLockPiece();
                } else if (canMovePiece(currentPiece, 0, 1)) {
                    currentPiece.moveDown();
                    score += 1; // Bonus for soft drop
                    checkLockDelayCancel();
                }
                
                lastDownKeyTime = currentTime;
                break;
            case KeyEvent.VK_UP:
                TetrisPiece rotatedPiece = currentPiece.getRotatedCopy();
                if (canMovePiece(rotatedPiece, 0, 0)) {
                    currentPiece.rotate();
                    // Allow rotation during blinking phase - check if we can cancel lock delay
                    checkLockDelayCancel();
                }
                break;
        }
        repaint();
    }
    
    @Override
    public void keyTyped(KeyEvent e) {}
    
    @Override
    public void keyReleased(KeyEvent e) {}
    
    public static void main(String[] args) {
        JFrame frame = new JFrame("Tetris - Glowing Dark Theme");
        TetrisGame game = new TetrisGame();
        
        frame.add(game);
        frame.setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        frame.setResizable(false);
        frame.pack();
        frame.setLocationRelativeTo(null);
        frame.setVisible(true);
        
        game.requestFocus();
    }
    
    // Inner class for line clear visual effects
    private static class LineEffect {
        private int row;
        private int width;
        private int blockSize;
        private int timer;
        private int maxTimer;
        private Color[] colors;
        private int colorIndex;
        
        public LineEffect(int row, int width, int blockSize) {
            this.row = row;
            this.width = width;
            this.blockSize = blockSize;
            this.timer = 0;
            this.maxTimer = 6; // Reduced from 10 to 6 for much faster effects
            this.colorIndex = 0;
            
            // Rainbow colors for line clear effect
            this.colors = new Color[] {
                new Color(255, 0, 0),     // Red
                new Color(255, 127, 0),   // Orange
                new Color(255, 255, 0),   // Yellow
                new Color(0, 255, 0),     // Green
                new Color(0, 0, 255),     // Blue
                new Color(75, 0, 130),    // Indigo
                new Color(148, 0, 211)    // Violet
            };
        }
        
        public void update() {
            timer++;
            colorIndex = (timer / 2) % colors.length; // Faster color cycling (was /3, now /2)
        }
        
        public void draw(Graphics2D g2d) {
            if (timer < maxTimer) {
                float alpha = 1.0f - (float)timer / maxTimer;
                Color currentColor = colors[colorIndex];
                
                // Draw expanding line effect
                int expansion = timer * 2;
                g2d.setColor(new Color(currentColor.getRed(), currentColor.getGreen(), 
                                     currentColor.getBlue(), (int)(255 * alpha)));
                
                // Draw main line
                g2d.fillRect(-expansion, row * blockSize, width * blockSize + 2 * expansion, blockSize);
                
                // Draw glow effect
                for (int i = 1; i <= 5; i++) {
                    float glowAlpha = alpha * 0.3f / i;
                    g2d.setColor(new Color(currentColor.getRed(), currentColor.getGreen(), 
                                         currentColor.getBlue(), (int)(255 * glowAlpha)));
                    g2d.fillRect(-expansion - i, row * blockSize - i, 
                               width * blockSize + 2 * expansion + 2 * i, blockSize + 2 * i);
                }
                
                // Draw sparkle effects
                if (timer % 4 == 0) {
                    g2d.setColor(new Color(255, 255, 255, (int)(255 * alpha)));
                    for (int i = 0; i < width; i++) {
                        if (Math.random() < 0.3) {
                            int sparkleX = i * blockSize + (int)(Math.random() * blockSize);
                            int sparkleY = row * blockSize + (int)(Math.random() * blockSize);
                            g2d.fillOval(sparkleX - 2, sparkleY - 2, 4, 4);
                        }
                    }
                }
            }
        }
        
        public boolean isFinished() {
            return timer >= maxTimer;
        }
    }
}
