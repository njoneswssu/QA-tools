package com.pinball;

import javax.swing.*;
import java.awt.*;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.geom.Rectangle2D;

/**
 * Game panel for rendering the pinball game
 */
public class GamePanel extends JPanel {
    private final GameEngine gameEngine;
    private int hoveredButton = -1; // Track which button is being hovered (-1 = none, 0 = New Game, 1 = Main Menu, 2 = Controls)
    private int clickedButton = -1; // Track which button is being clicked
    private long clickTime = 0; // Time when button was clicked
    
    public GamePanel(GameEngine gameEngine) {
        this.gameEngine = gameEngine;
        setBackground(Color.BLACK); // Glow-in-dark theme
        setDoubleBuffered(true);
        
        // Add mouse listener for clickable buttons
        addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                handleMouseClick(e.getX(), e.getY());
            }
            
            @Override
            public void mousePressed(MouseEvent e) {
                handleMousePressed(e.getX(), e.getY());
            }
            
            @Override
            public void mouseReleased(MouseEvent e) {
                handleMouseReleased(e.getX(), e.getY());
            }
            
            @Override
            public void mouseExited(MouseEvent e) {
                hoveredButton = -1;
                repaint();
            }
        });
        
        // Add mouse motion listener for hover effects
        addMouseMotionListener(new MouseAdapter() {
            @Override
            public void mouseMoved(MouseEvent e) {
                handleMouseHover(e.getX(), e.getY());
            }
        });
    }
    
    @Override
    protected void paintComponent(Graphics g) {
        super.paintComponent(g);
        Graphics2D g2d = (Graphics2D) g.create();
        
        // Enable anti-aliasing
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
        
        // Draw solid black background for glow-in-dark effect
        g2d.setColor(Color.BLACK);
        g2d.fillRect(0, 0, getWidth(), getHeight());
        
        // Draw game elements
        renderWalls(g2d);
        renderLaunchTube(g2d);
        renderTargets(g2d);
        renderBumpers(g2d);
        renderFlippers(g2d);
        renderBall(g2d);
        renderUI(g2d);
        renderGameState(g2d);
        
        g2d.dispose();
    }
    
    private void handleMouseClick(int mouseX, int mouseY) {
        GameEngine.GameState state = gameEngine.getGameState();
        
        if (state == GameEngine.GameState.GAME_OVER) {
            handleGameOverClick(mouseX, mouseY);
        }
    }
    
    private void handleMousePressed(int mouseX, int mouseY) {
        GameEngine.GameState state = gameEngine.getGameState();
        
        if (state == GameEngine.GameState.GAME_OVER) {
            int buttonIndex = getButtonIndex(mouseX, mouseY);
            if (buttonIndex != -1) {
                clickedButton = buttonIndex;
                clickTime = System.currentTimeMillis();
                repaint();
            }
        }
    }
    
    private void handleMouseReleased(int mouseX, int mouseY) {
        clickedButton = -1;
        repaint();
    }
    
    private void handleMouseHover(int mouseX, int mouseY) {
        GameEngine.GameState state = gameEngine.getGameState();
        
        if (state == GameEngine.GameState.GAME_OVER) {
            int oldHovered = hoveredButton;
            hoveredButton = getButtonIndex(mouseX, mouseY);
            
            if (oldHovered != hoveredButton) {
                repaint();
            }
        }
    }
    
    private int getButtonIndex(int mouseX, int mouseY) {
        // Calculate button positions (same as in renderGameOver)
        int panelWidth = 400;
        int panelHeight = 220;
        int x = (getWidth() - panelWidth) / 2;
        int y = (getHeight() - panelHeight) / 2;
        
        // Button dimensions
        int buttonWidth = 100;
        int buttonHeight = 35;
        int buttonY = y + 150;
        
        // Check New Game button (index 0)
        int newGameX = x + 50;
        if (mouseX >= newGameX && mouseX <= newGameX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            return 0;
        }
        
        // Check Main Menu button (index 1)
        int mainMenuX = x + 170;
        if (mouseX >= mainMenuX && mouseX <= mainMenuX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            return 1;
        }
        
        // Check Controls button (index 2)
        int controlsX = x + 290;
        if (mouseX >= controlsX && mouseX <= controlsX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            return 2;
        }
        
        return -1; // No button
    }
    
    private void drawButton(Graphics2D g2d, int buttonIndex, int x, int y, int width, int height, 
                           String text, Color baseColor, Color borderColor) {
        boolean isHovered = (hoveredButton == buttonIndex);
        boolean isClicked = (clickedButton == buttonIndex);
        
        // Calculate visual effects
        Color fillColor = baseColor;
        Color strokeColor = borderColor;
        int strokeWidth = 2;
        int textOffset = 0;
        
        if (isClicked) {
            // Clicked state - darker, pressed down effect
            fillColor = new Color(
                Math.max(0, baseColor.getRed() - 50),
                Math.max(0, baseColor.getGreen() - 50),
                Math.max(0, baseColor.getBlue() - 50),
                Math.min(255, baseColor.getAlpha() + 50)
            );
            strokeColor = strokeColor.darker();
            strokeWidth = 3;
            textOffset = 1; // Pressed down effect
            
            // Add click flash effect
            long timeSinceClick = System.currentTimeMillis() - clickTime;
            if (timeSinceClick < 150) { // Flash for 150ms
                float flashIntensity = 1.0f - (timeSinceClick / 150.0f);
                int flashAlpha = (int)(flashIntensity * 100);
                g2d.setColor(new Color(255, 255, 255, flashAlpha));
                g2d.fillRoundRect(x - 2, y - 2, width + 4, height + 4, 12, 12);
            }
        } else if (isHovered) {
            // Hovered state - brighter, glowing effect
            fillColor = new Color(
                Math.min(255, baseColor.getRed() + 30),
                Math.min(255, baseColor.getGreen() + 30),
                Math.min(255, baseColor.getBlue() + 30),
                Math.min(255, baseColor.getAlpha() + 30)
            );
            strokeColor = strokeColor.brighter();
            strokeWidth = 3;
            
            // Add glow effect
            g2d.setColor(new Color(strokeColor.getRed(), strokeColor.getGreen(), strokeColor.getBlue(), 50));
            g2d.fillRoundRect(x - 3, y - 3, width + 6, height + 6, 13, 13);
        }
        
        // Draw button background
        g2d.setColor(fillColor);
        g2d.fillRoundRect(x, y, width, height, 10, 10);
        
        // Draw button border
        g2d.setColor(strokeColor);
        g2d.setStroke(new BasicStroke(strokeWidth));
        g2d.drawRoundRect(x, y, width, height, 10, 10);
        
        // Draw button text
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.BOLD, 12));
        FontMetrics fm = g2d.getFontMetrics();
        int textWidth = fm.stringWidth(text);
        int textX = x + (width - textWidth) / 2;
        int textY = y + 22 + textOffset;
        
        // Add text shadow for better visibility
        if (isHovered || isClicked) {
            g2d.setColor(new Color(0, 0, 0, 150));
            g2d.drawString(text, textX + 1, textY + 1);
            g2d.setColor(Color.WHITE);
        }
        
        g2d.drawString(text, textX, textY);
    }
    
    private void handleGameOverClick(int mouseX, int mouseY) {
        // Calculate button positions (same as in renderGameOver)
        int panelWidth = 400;
        int panelHeight = 220;
        int x = (getWidth() - panelWidth) / 2;
        int y = (getHeight() - panelHeight) / 2;
        
        // Button dimensions
        int buttonWidth = 100;
        int buttonHeight = 35;
        int buttonY = y + 150;
        
        // New Game button
        int newGameX = x + 50;
        if (mouseX >= newGameX && mouseX <= newGameX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            System.out.println("New Game button clicked!"); // Debug
            // Get parent PinballGame and call newGame
            Container parent = getParent();
            while (parent != null && !(parent instanceof PinballGame)) {
                parent = parent.getParent();
            }
            if (parent instanceof PinballGame) {
                PinballGame game = (PinballGame) parent;
                game.startNewGame();
            }
            return;
        }
        
        // Main Menu button  
        int mainMenuX = x + 170;
        if (mouseX >= mainMenuX && mouseX <= mainMenuX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            System.out.println("Main Menu button clicked!"); // Debug
            Container parent = getParent();
            while (parent != null && !(parent instanceof PinballGame)) {
                parent = parent.getParent();
            }
            if (parent instanceof PinballGame) {
                PinballGame game = (PinballGame) parent;
                game.showMainMenu();
            }
            return;
        }
        
        // Controls button
        int controlsX = x + 290;
        if (mouseX >= controlsX && mouseX <= controlsX + buttonWidth &&
            mouseY >= buttonY && mouseY <= buttonY + buttonHeight) {
            System.out.println("Controls button clicked!"); // Debug
            Container parent = getParent();
            while (parent != null && !(parent instanceof PinballGame)) {
                parent = parent.getParent();
            }
            if (parent instanceof PinballGame) {
                PinballGame game = (PinballGame) parent;
                game.showControls();
            }
            return;
        }
    }
    
    private void renderWalls(Graphics2D g2d) {
        for (Wall wall : gameEngine.getWalls()) {
            wall.render(g2d);
        }
    }
    
    private void renderLaunchTube(Graphics2D g2d) {
        LaunchTube tube = gameEngine.getLaunchTube();
        tube.render(g2d);
        
        // Always show power meter (shows empty tube when not launching) - FIXED: Use correct MAX_LAUNCH_POWER
        tube.renderPowerMeter(g2d, gameEngine.getLaunchPower(), gameEngine.getMaxLaunchPower());
        
        // Always show spring (compresses based on power) - FIXED: Use correct MAX_LAUNCH_POWER  
        tube.renderSpring(g2d, gameEngine.getLaunchPower(), gameEngine.getMaxLaunchPower());
        
        // Show aiming line and power text when launching
        if (gameEngine.isLaunching()) {
            tube.renderAimIndicator(g2d, true); // Show aiming line
            
            // Add power text indicator - positioned in clear area
            g2d.setColor(Color.WHITE);
            g2d.setFont(new Font("Arial", Font.BOLD, 12));
            String powerText = "POWER: " + (int)(gameEngine.getLaunchPower() * 2.5) + "%";
            g2d.drawString(powerText, getWidth() - 150, 50); // Moved to top area
        }
    }
    
    private void renderTargets(Graphics2D g2d) {
        for (Target target : gameEngine.getTargets()) {
            target.render(g2d);
        }
    }
    
    private void renderBumpers(Graphics2D g2d) {
        for (Bumper bumper : gameEngine.getBumpers()) {
            bumper.render(g2d);
        }
    }
    
    private void renderFlippers(Graphics2D g2d) {
        for (Flipper flipper : gameEngine.getFlippers()) {
            flipper.render(g2d);
        }
    }
    
    private void renderBall(Graphics2D g2d) {
        gameEngine.getBall().render(g2d);
    }
    
    private void renderUI(Graphics2D g2d) {
        // Score display positioned in bottom left open space
        g2d.setFont(new Font("Arial", Font.BOLD, 14));
        int leftX = 20; // Left margin
        int bottomY = getHeight() - 80; // Bottom area with margin
        
        // Score with glow effect - positioned in clear bottom-left area
        g2d.setColor(new Color(0, 255, 255, 150)); // Cyan glow
        g2d.drawString("SCORE: " + String.format("%,d", gameEngine.getScore()), leftX + 1, bottomY + 1);
        g2d.drawString("SCORE: " + String.format("%,d", gameEngine.getScore()), leftX - 1, bottomY - 1);
        g2d.setColor(Color.WHITE); // Bright white text
        g2d.drawString("SCORE: " + String.format("%,d", gameEngine.getScore()), leftX, bottomY);
        
        // High score with glow effect - positioned below score
        g2d.setColor(new Color(255, 255, 0, 150)); // Yellow glow
        g2d.drawString("HIGH: " + String.format("%,d", gameEngine.getHighScore()), leftX + 1, bottomY + 21);
        g2d.drawString("HIGH: " + String.format("%,d", gameEngine.getHighScore()), leftX - 1, bottomY + 19);
        g2d.setColor(Color.WHITE); // Bright white text
        g2d.drawString("HIGH: " + String.format("%,d", gameEngine.getHighScore()), leftX, bottomY + 20);
        
        // Balls remaining with glow effect - positioned below high score
        g2d.setColor(new Color(255, 0, 255, 150)); // Magenta glow
        g2d.drawString("BALLS: " + gameEngine.getBalls(), leftX + 1, bottomY + 41);
        g2d.drawString("BALLS: " + gameEngine.getBalls(), leftX - 1, bottomY + 39);
        g2d.setColor(Color.WHITE); // Bright white text
        g2d.drawString("BALLS: " + gameEngine.getBalls(), leftX, bottomY + 40);
        
        // Game status - moved to top right to avoid overlap
        g2d.setFont(new Font("Arial", Font.PLAIN, 12));
        g2d.setColor(Color.WHITE); // Always use white text for visibility
        if (gameEngine.isLaunching()) {
            g2d.drawString("LAUNCHING - Hold SPACE!", getWidth() - 200, 20);
        } else if (gameEngine.getBall().getVelocityY() != 0 || gameEngine.getBall().getVelocityX() != 0) {
            g2d.drawString("Ball in play", getWidth() - 100, 20);
        } else {
            g2d.drawString("Press SPACE to launch", getWidth() - 150, 20);
        }
        
        // Removed controls info - now available via menu
    }
    
    private void renderGameState(Graphics2D g2d) {
        GameEngine.GameState state = gameEngine.getGameState();
        
        if (state == GameEngine.GameState.GAME_OVER) {
            renderGameOver(g2d);
        } else if (state == GameEngine.GameState.WAITING_FOR_NAME) {
            renderNameInput(g2d);
        } else if (state == GameEngine.GameState.PAUSED) {
            renderPaused(g2d);
        }
    }
    
    private void renderPaused(Graphics2D g2d) {
        // Semi-transparent overlay
        g2d.setColor(new Color(0, 0, 0, 100));
        g2d.fillRect(0, 0, getWidth(), getHeight());
        
        // Pause panel
        int panelWidth = 300;
        int panelHeight = 150;
        int x = (getWidth() - panelWidth) / 2;
        int y = (getHeight() - panelHeight) / 2;
        
        // Panel background
        g2d.setColor(new Color(30, 30, 30, 200));
        g2d.fillRoundRect(x, y, panelWidth, panelHeight, 20, 20);
        
        // Panel border
        g2d.setColor(Color.CYAN);
        g2d.setStroke(new BasicStroke(3));
        g2d.drawRoundRect(x, y, panelWidth, panelHeight, 20, 20);
        
        // Title
        g2d.setColor(Color.YELLOW);
        g2d.setFont(new Font("Arial", Font.BOLD, 32));
        String title = "PAUSED";
        FontMetrics titleFm = g2d.getFontMetrics();
        int titleWidth = titleFm.stringWidth(title);
        g2d.drawString(title, x + (panelWidth - titleWidth) / 2, y + 50);
        
        // Instructions
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.PLAIN, 16));
        String[] instructions = {
            "Press ESC to Resume",
            "Press M for Main Menu"
        };
        
        int lineHeight = 25;
        int startY = y + 85;
        for (int i = 0; i < instructions.length; i++) {
            FontMetrics fm = g2d.getFontMetrics();
            int textWidth = fm.stringWidth(instructions[i]);
            g2d.drawString(instructions[i], x + (panelWidth - textWidth) / 2, startY + i * lineHeight);
        }
    }
    
    private void renderGameOver(Graphics2D g2d) {
        // Semi-transparent overlay
        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRect(0, 0, getWidth(), getHeight());
        
        // Game over panel - larger to prevent overlap
        int panelWidth = 400;
        int panelHeight = 220;
        int x = (getWidth() - panelWidth) / 2;
        int y = (getHeight() - panelHeight) / 2;
        
        g2d.setColor(new Color(0, 0, 0, 220));
        g2d.fillRoundRect(x, y, panelWidth, panelHeight, 15, 15);
        g2d.setColor(new Color(255, 215, 0));
        g2d.setStroke(new BasicStroke(3));
        g2d.drawRoundRect(x, y, panelWidth, panelHeight, 15, 15);
        
        // Game over text
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.BOLD, 24));
        FontMetrics fm = g2d.getFontMetrics();
        String gameOverText = "Game Over!";
        int textWidth = fm.stringWidth(gameOverText);
        g2d.drawString(gameOverText, x + (panelWidth - textWidth) / 2, y + 40);
        
        // Final score
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.PLAIN, 16));
        fm = g2d.getFontMetrics();
        String scoreText = "Final Score: " + String.format("%,d", gameEngine.getScore());
        textWidth = fm.stringWidth(scoreText);
        g2d.drawString(scoreText, x + (panelWidth - textWidth) / 2, y + 75);
        
        // Draw clickable buttons (matching handleGameOverClick coordinates)
        int buttonWidth = 100;
        int buttonHeight = 35;
        int buttonY = y + 150;
        
        // New Game button with visual feedback
        int newGameX = x + 50;
        drawButton(g2d, 0, newGameX, buttonY, buttonWidth, buttonHeight, "New Game", 
                  new Color(0, 150, 0, 180), new Color(0, 255, 0));
        
        // Main Menu button with visual feedback
        int mainMenuX = x + 170;
        drawButton(g2d, 1, mainMenuX, buttonY, buttonWidth, buttonHeight, "Main Menu", 
                  new Color(0, 0, 150, 180), new Color(0, 150, 255));
        
        // Controls button with visual feedback
        int controlsX = x + 290;
        drawButton(g2d, 2, controlsX, buttonY, buttonWidth, buttonHeight, "Controls", 
                  new Color(150, 0, 150, 180), new Color(255, 0, 255));
        
        // Instructions
        g2d.setColor(new Color(200, 200, 200));
        g2d.setFont(new Font("Arial", Font.PLAIN, 12));
        fm = g2d.getFontMetrics();
        String instruction = "Click buttons above or use keyboard: N, M, C";
        int instructionWidth = fm.stringWidth(instruction);
        g2d.drawString(instruction, x + (panelWidth - instructionWidth) / 2, y + 200);
    }
    
    private void renderNameInput(Graphics2D g2d) {
        // Semi-transparent overlay
        g2d.setColor(new Color(0, 0, 0, 150));
        g2d.fillRect(0, 0, getWidth(), getHeight());
        
        // Name input panel
        int panelWidth = 350;
        int panelHeight = 120;
        int x = (getWidth() - panelWidth) / 2;
        int y = (getHeight() - panelHeight) / 2;
        
        g2d.setColor(new Color(0, 0, 0, 220));
        g2d.fillRoundRect(x, y, panelWidth, panelHeight, 15, 15);
        g2d.setColor(new Color(255, 215, 0));
        g2d.setStroke(new BasicStroke(3));
        g2d.drawRoundRect(x, y, panelWidth, panelHeight, 15, 15);
        
        // Congratulations text
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.BOLD, 18));
        FontMetrics fm = g2d.getFontMetrics();
        String congrats = "*** Top 10 Score! ***";
        int textWidth = fm.stringWidth(congrats);
        g2d.drawString(congrats, x + (panelWidth - textWidth) / 2, y + 30);
        
        // Score display
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.PLAIN, 16));
        fm = g2d.getFontMetrics();
        String scoreText = "Score: " + String.format("%,d", gameEngine.getScore());
        textWidth = fm.stringWidth(scoreText);
        g2d.drawString(scoreText, x + (panelWidth - textWidth) / 2, y + 55);
        
        // Instructions
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.PLAIN, 14));
        fm = g2d.getFontMetrics();
        String instructText = "Use Game menu to enter your name for high scores";
        textWidth = fm.stringWidth(instructText);
        g2d.drawString(instructText, x + (panelWidth - textWidth) / 2, y + 85);
    }
}
