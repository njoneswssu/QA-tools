package com.pinball;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.awt.event.MouseAdapter;
import java.awt.event.MouseEvent;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import javax.swing.Timer;

/**
 * Main menu panel for the pinball game
 */
public class MainMenuPanel extends JPanel implements KeyListener {
    private PinballGame parentGame;
    private int selectedOption = 0;
    private int hoveredOption = -1; // Track which option is being hovered
    private String[] menuOptions = {"Start Game", "High Scores", "Controls", "Exit"};
    
    public MainMenuPanel(PinballGame parentGame) {
        this.parentGame = parentGame;
        setBackground(Color.BLACK);
        setFocusable(true);
        addKeyListener(this);
        
        // Add mouse listener for clickable menu options
        addMouseListener(new MouseAdapter() {
            @Override
            public void mouseClicked(MouseEvent e) {
                handleMouseClick(e.getX(), e.getY());
            }
            
            @Override
            public void mouseExited(MouseEvent e) {
                hoveredOption = -1;
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
        
        // Start animation timer for star effects
        Timer animationTimer = new Timer(50, new ActionListener() { // 20 FPS for smooth animation
            @Override
            public void actionPerformed(ActionEvent e) {
                repaint();
            }
        });
        animationTimer.start();
    }
    
    @Override
    protected void paintComponent(Graphics g) {
        try {
            super.paintComponent(g);
            Graphics2D g2d = (Graphics2D) g.create();
            
            // Enable anti-aliasing
            g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
            g2d.setRenderingHint(RenderingHints.KEY_RENDERING, RenderingHints.VALUE_RENDER_QUALITY);
            
            // Draw background
            g2d.setColor(Color.BLACK);
            g2d.fillRect(0, 0, getWidth(), getHeight());
            
            // Draw animated background stars
            drawBackgroundStars(g2d);
        
        // Draw title
        g2d.setColor(new Color(255, 215, 0));
        g2d.setFont(new Font("Arial", Font.BOLD, 48));
        FontMetrics fm = g2d.getFontMetrics();
        String title = "PINBALL GAME";
        int titleWidth = fm.stringWidth(title);
        g2d.drawString(title, (getWidth() - titleWidth) / 2, 150);
        
        // Draw subtitle
        g2d.setColor(Color.WHITE);
        g2d.setFont(new Font("Arial", Font.PLAIN, 18));
        fm = g2d.getFontMetrics();
        String subtitle = "Classic Arcade Pinball Experience";
        int subtitleWidth = fm.stringWidth(subtitle);
        g2d.drawString(subtitle, (getWidth() - subtitleWidth) / 2, 190);
        
        // Draw menu options
        g2d.setFont(new Font("Arial", Font.BOLD, 24));
        fm = g2d.getFontMetrics();
        
        int startY = 280;
        int spacing = 60;
        
        for (int i = 0; i < menuOptions.length; i++) {
            int y = startY + (i * spacing);
            
            // Highlight selected option (keyboard)
            if (i == selectedOption) {
                // Draw selection background
                g2d.setColor(new Color(255, 215, 0, 100));
                g2d.fillRoundRect((getWidth() - 300) / 2, y - 30, 300, 45, 15, 15);
                
                // Draw selection border
                g2d.setColor(new Color(255, 215, 0));
                g2d.setStroke(new BasicStroke(3));
                g2d.drawRoundRect((getWidth() - 300) / 2, y - 30, 300, 45, 15, 15);
                
                // Selected text color
                g2d.setColor(Color.WHITE);
            }
            // Highlight hovered option (mouse)
            else if (i == hoveredOption) {
                // Draw hover background
                g2d.setColor(new Color(0, 255, 255, 80));
                g2d.fillRoundRect((getWidth() - 300) / 2, y - 30, 300, 45, 15, 15);
                
                // Draw hover border
                g2d.setColor(new Color(0, 255, 255));
                g2d.setStroke(new BasicStroke(2));
                g2d.drawRoundRect((getWidth() - 300) / 2, y - 30, 300, 45, 15, 15);
                
                // Hovered text color
                g2d.setColor(Color.WHITE);
            } else {
                // Normal text color
                g2d.setColor(new Color(200, 200, 200));
            }
            
            // Add glow effect for selected/hovered options
            String option = menuOptions[i];
            int textWidth = fm.stringWidth(option);
            int textX = (getWidth() - textWidth) / 2;
            
            if (i == selectedOption || i == hoveredOption) {
                // Draw glow effect
                g2d.setColor(new Color(255, 255, 255, 100));
                g2d.drawString(option, textX + 1, y + 1);
                g2d.drawString(option, textX - 1, y - 1);
                
                // Reset color for main text
                g2d.setColor(Color.WHITE);
            }
            
            // Draw menu option text
            g2d.drawString(option, textX, y);
        }
        
        // Draw instructions
        g2d.setColor(new Color(150, 150, 150));
        g2d.setFont(new Font("Arial", Font.PLAIN, 14));
        fm = g2d.getFontMetrics();
        
        String instructions = "Use UP/DOWN arrows to navigate, ENTER to select";
        int instrWidth = fm.stringWidth(instructions);
        g2d.drawString(instructions, (getWidth() - instrWidth) / 2, getHeight() - 50);
        
        g2d.dispose();
        } catch (Exception e) {
            System.err.println("Error in MainMenuPanel paintComponent: " + e.getMessage());
            e.printStackTrace();
            
            // Fallback rendering
            Graphics2D g2d = (Graphics2D) g;
            g2d.setColor(Color.BLACK);
            g2d.fillRect(0, 0, getWidth(), getHeight());
            g2d.setColor(Color.WHITE);
            g2d.drawString("Main Menu Loading...", 50, 50);
        }
    }
    
    @Override
    public void keyPressed(KeyEvent e) {
        System.out.println("MainMenuPanel received key: " + e.getKeyCode()); // Debug
        switch (e.getKeyCode()) {
            case KeyEvent.VK_UP:
                selectedOption = (selectedOption - 1 + menuOptions.length) % menuOptions.length;
                repaint();
                break;
            case KeyEvent.VK_DOWN:
                selectedOption = (selectedOption + 1) % menuOptions.length;
                repaint();
                break;
            case KeyEvent.VK_ENTER:
                selectOption();
                break;
            case KeyEvent.VK_ESCAPE:
                System.exit(0);
                break;
        }
    }
    
    private void selectOption() {
        System.out.println("Selecting option: " + selectedOption + " (" + menuOptions[selectedOption] + ")"); // Debug
        switch (selectedOption) {
            case 0: // Start Game
                System.out.println("Starting new game..."); // Debug
                parentGame.startNewGame();
                break;
            case 1: // High Scores
                System.out.println("Showing high scores..."); // Debug
                parentGame.showHighScores();
                break;
            case 2: // Controls
                System.out.println("Showing controls..."); // Debug
                parentGame.showControls();
                break;
            case 3: // Exit
                System.out.println("Exiting game..."); // Debug
                System.exit(0);
                break;
        }
    }
    
    @Override
    public void keyReleased(KeyEvent e) {}
    
    @Override
    public void keyTyped(KeyEvent e) {}
    
    private void handleMouseClick(int mouseX, int mouseY) {
        // Calculate menu option positions (same as in paintComponent)
        int startY = 280;
        int spacing = 60;
        
        for (int i = 0; i < menuOptions.length; i++) {
            int optionY = startY + (i * spacing);
            
            // Check if click is within this option's area (larger clickable area)
            if (mouseY >= optionY - 30 && mouseY <= optionY + 15) {
                selectedOption = i;
                selectOption();
                repaint();
                break;
            }
        }
    }
    
    private void handleMouseHover(int mouseX, int mouseY) {
        // Calculate menu option positions (same as in paintComponent)
        int startY = 280;
        int spacing = 60;
        int oldHovered = hoveredOption;
        hoveredOption = -1;
        
        for (int i = 0; i < menuOptions.length; i++) {
            int optionY = startY + (i * spacing);
            
            // Check if mouse is within this option's area
            if (mouseY >= optionY - 30 && mouseY <= optionY + 15) {
                hoveredOption = i;
                break;
            }
        }
        
        // Repaint only if hover state changed
        if (oldHovered != hoveredOption) {
            repaint();
        }
    }
    
    private void drawBackgroundStars(Graphics2D g2d) {
        // Create glowing yellow star outlines scattered across the background
        g2d.setColor(new Color(255, 255, 0, 150)); // Semi-transparent yellow
        
        // Define star positions (optimized number for performance with more bottom stars)
        int[][] starPositions = {
            {100, 80}, {200, 120}, {350, 60}, {450, 100}, {550, 90},
            {80, 200}, {180, 250}, {320, 180}, {480, 220}, {580, 160},
            {120, 350}, {250, 380}, {380, 320}, {520, 360}, {150, 450},
            {300, 480}, {420, 440}, {50, 300}, {600, 280}, {70, 500},
            {400, 50}, {280, 140}, {500, 180}, {160, 280}, {340, 260},
            {40, 120}, {140, 40}, {240, 80}, {540, 40}, {620, 120},
            {30, 400}, {90, 460}, {190, 420}, {290, 390}, {490, 410},
            {590, 450}, {60, 550}, {160, 520}, {260, 540}, {360, 510},
            // Additional bottom stars for better coverage
            {110, 580}, {210, 560}, {310, 590}, {410, 570}, {510, 580},
            {80, 620}, {180, 600}, {280, 630}, {380, 610}, {480, 620},
            {35, 580}, {135, 640}, {235, 620}, {335, 650}, {435, 630},
            {535, 640}, {585, 600}, {120, 660}, {320, 670}, {520, 650}
        };
        
        int[] starSizes = {
            8, 12, 10, 14, 9, 11, 13, 8, 10, 12, 9, 11, 8, 10, 12, 9, 11, 13, 8, 10,
            12, 9, 11, 8, 10, 9, 11, 8, 13, 10, 12, 9, 14, 8, 11, 10, 12, 9, 8, 11,
            // Additional star sizes for bottom stars
            10, 8, 12, 9, 11, 13, 8, 10, 9, 12, 11, 8, 10, 9, 13, 11, 8, 12, 10, 9
        };
        
        // Animate stars with pulsing glow effect
        long time = System.currentTimeMillis();
        
        for (int i = 0; i < starPositions.length; i++) {
            int x = starPositions[i][0];
            int y = starPositions[i][1];
            int size = starSizes[i];
            
            // Create pulsing effect with different phases for each star
            double pulsePhase = (time + i * 200) * 0.003;
            double pulse = 0.7 + 0.3 * Math.sin(pulsePhase);
            int glowAlpha = (int)(100 * pulse);
            
            // Draw outer glow
            g2d.setColor(new Color(255, 255, 0, glowAlpha / 2));
            g2d.setStroke(new BasicStroke(4));
            drawStar(g2d, x, y, (int)(size * 1.3));
            
            // Draw main star outline
            g2d.setColor(new Color(255, 255, 0, (int)(200 * pulse)));
            g2d.setStroke(new BasicStroke(2));
            drawStar(g2d, x, y, size);
            
            // Draw inner bright core
            g2d.setColor(new Color(255, 255, 255, (int)(150 * pulse)));
            g2d.setStroke(new BasicStroke(1));
            drawStar(g2d, x, y, (int)(size * 0.6));
        }
        
        // Animation is handled by timer, no need to trigger repaint here
    }
    
    private void drawStar(Graphics2D g2d, int centerX, int centerY, int size) {
        // Create a 5-pointed star outline
        int[] xPoints = new int[10];
        int[] yPoints = new int[10];
        
        double angle = -Math.PI / 2; // Start at top
        double angleStep = Math.PI / 5; // 36 degrees between points
        
        for (int i = 0; i < 10; i++) {
            double radius = (i % 2 == 0) ? size : size * 0.4; // Alternate between outer and inner points
            xPoints[i] = centerX + (int)(radius * Math.cos(angle));
            yPoints[i] = centerY + (int)(radius * Math.sin(angle));
            angle += angleStep;
        }
        
        // Draw star outline only (no fill)
        g2d.drawPolygon(xPoints, yPoints, 10);
    }
}
