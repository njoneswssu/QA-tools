package com.pinball;

import javax.swing.*;
import java.awt.*;
import java.awt.event.KeyEvent;
import java.awt.event.KeyListener;
import java.util.ArrayList;
import java.util.List;

/**
 * Main Pinball Game class - Entry point and main game window
 */
public class PinballGame extends JFrame implements KeyListener {
    private static final int WINDOW_WIDTH = 600;
    private static final int WINDOW_HEIGHT = 700;
    
    private GamePanel gamePanel;
    private GameEngine gameEngine;
    private HighScoreManager highScoreManager;
    private MainMenuPanel mainMenuPanel;
    private boolean isFullscreen = false;
    private boolean highScoreDialogShown = false;
    private boolean inMainMenu = true;
    
    // Key state tracking for continuous input
    private boolean downKeyPressed = false;
    
    public PinballGame() {
        initializeGame();
        setupWindow();
        startGame();
    }
    
    private void initializeGame() {
        highScoreManager = new HighScoreManager();
        gameEngine = new GameEngine(WINDOW_WIDTH - 50, WINDOW_HEIGHT - 100, highScoreManager);
        gamePanel = new GamePanel(gameEngine);
        mainMenuPanel = new MainMenuPanel(this);
    }
    
    private void setupWindow() {
        setTitle("Java Pinball Game - Top 10 High Scores");
        setSize(WINDOW_WIDTH, WINDOW_HEIGHT);
        setDefaultCloseOperation(JFrame.EXIT_ON_CLOSE);
        setLocationRelativeTo(null);
        setResizable(false);
        
        // Set dark theme
        getContentPane().setBackground(new Color(26, 26, 46));
        
        // Start with main menu
        add(mainMenuPanel);
        addKeyListener(this);
        setFocusable(true);
        
        // Add menu bar
        setupMenuBar();
    }
    
    private void setupMenuBar() {
        JMenuBar menuBar = new JMenuBar();
        menuBar.setBackground(new Color(255, 215, 0));
        
        JMenu gameMenu = new JMenu("Game");
        JMenuItem newGame = new JMenuItem("New Game");
        JMenuItem controls = new JMenuItem("Controls (C)");
        JMenuItem highScores = new JMenuItem("High Scores");
        JMenuItem fullscreen = new JMenuItem("Toggle Fullscreen (F11)");
        JMenuItem exit = new JMenuItem("Exit");
        
        newGame.addActionListener(e -> gameEngine.newGame());
        controls.addActionListener(e -> showControls());
        highScores.addActionListener(e -> showHighScores());
        fullscreen.addActionListener(e -> toggleFullscreen());
        exit.addActionListener(e -> System.exit(0));
        
        gameMenu.add(newGame);
        gameMenu.addSeparator();
        gameMenu.add(controls);
        gameMenu.add(highScores);
        gameMenu.addSeparator();
        gameMenu.add(fullscreen);
        gameMenu.addSeparator();
        gameMenu.add(exit);
        
        menuBar.add(gameMenu);
        setJMenuBar(menuBar);
    }
    
    public void showHighScores() {
        HighScoreDialog dialog = new HighScoreDialog(this, highScoreManager);
        dialog.setVisible(true);
    }
    
    public void showControls() {
        ControlsDialog dialog = new ControlsDialog(this);
        dialog.setVisible(true);
    }
    
    public void startNewGame() {
        System.out.println("Starting new game - switching to game panel..."); // Debug
        inMainMenu = false;
        
        // Reset key states when starting new game
        downKeyPressed = false;
        
        if (isFullscreen) {
            setupFullscreenLayout();
        } else {
            getContentPane().removeAll();
            getContentPane().add(gamePanel);
        }
        
        // Ensure proper focus for key events
        SwingUtilities.invokeLater(() -> {
            gamePanel.requestFocusInWindow();
            setFocusable(true);
            requestFocus();
            System.out.println("Focus set to game panel"); // Debug
        });
        
        gameEngine.newGame();
        revalidate();
        repaint();
        System.out.println("Game started successfully!"); // Debug
    }
    
    public void showMainMenu() {
        System.out.println("Showing main menu..."); // Debug
        inMainMenu = true;
        
        if (isFullscreen) {
            setupFullscreenLayout();
        } else {
            getContentPane().removeAll();
            getContentPane().add(mainMenuPanel);
        }
        
        revalidate();
        repaint();
        
        // Ensure focus is properly set
        SwingUtilities.invokeLater(() -> {
            mainMenuPanel.requestFocusInWindow();
            setFocusable(true);
            requestFocus();
        });
    }
    
    private void showHighScoreEntry() {
        String playerName = JOptionPane.showInputDialog(
            this,
            "*** Congratulations! You made it to the Top 10! ***\n\n" +
            "Your Score: " + String.format("%,d", gameEngine.getScore()) + "\n\n" +
            "Enter your name:",
            "High Score!",
            JOptionPane.PLAIN_MESSAGE
        );
        
        if (playerName != null && !playerName.trim().isEmpty()) {
            gameEngine.submitHighScore(playerName.trim());
        } else {
            // If no name entered, use "Anonymous"
            gameEngine.submitHighScore("Anonymous");
        }
        
        // Request focus back to the game
        requestFocus();
    }
    
    private void toggleFullscreen() {
        GraphicsDevice device = GraphicsEnvironment.getLocalGraphicsEnvironment().getDefaultScreenDevice();
        
        if (isFullscreen) {
            // Exit fullscreen
            device.setFullScreenWindow(null);
            setExtendedState(JFrame.NORMAL);
            setResizable(false);
            setUndecorated(false);
            isFullscreen = false;
            
            // Reset to normal layout
            getContentPane().setLayout(new BorderLayout());
            if (!inMainMenu) {
                getContentPane().removeAll();
                getContentPane().add(gamePanel, BorderLayout.CENTER);
            } else {
                getContentPane().removeAll();
                getContentPane().add(mainMenuPanel, BorderLayout.CENTER);
            }
        } else {
            // Enter fullscreen
            if (device.isFullScreenSupported()) {
                setExtendedState(JFrame.MAXIMIZED_BOTH);
                setUndecorated(true);
                device.setFullScreenWindow(this);
                isFullscreen = true;
                
                // Center the game panel in fullscreen
                setupFullscreenLayout();
            }
        }
        
        revalidate();
        repaint();
        
        // Request focus back to the game
        SwingUtilities.invokeLater(() -> {
            requestFocus();
            if (!inMainMenu) {
                gamePanel.requestFocusInWindow();
            } else {
                mainMenuPanel.requestFocusInWindow();
            }
        });
    }
    
    private void setupFullscreenLayout() {
        // Get screen dimensions
        Dimension screenSize = Toolkit.getDefaultToolkit().getScreenSize();
        
        // Game panel dimensions (fixed size)
        int gameWidth = WINDOW_WIDTH;
        int gameHeight = WINDOW_HEIGHT;
        
        // Calculate centering offsets
        int offsetX = (screenSize.width - gameWidth) / 2;
        int offsetY = (screenSize.height - gameHeight) / 2;
        
        // Create a container panel with black background
        JPanel fullscreenContainer = new JPanel();
        fullscreenContainer.setLayout(null); // Absolute positioning
        fullscreenContainer.setBackground(Color.BLACK);
        fullscreenContainer.setPreferredSize(screenSize);
        
        // Position the game panel in the center
        if (!inMainMenu) {
            gamePanel.setBounds(offsetX, offsetY, gameWidth, gameHeight);
            fullscreenContainer.add(gamePanel);
        } else {
            mainMenuPanel.setBounds(offsetX, offsetY, gameWidth, gameHeight);
            fullscreenContainer.add(mainMenuPanel);
        }
        
        // Set the container as the content pane
        getContentPane().removeAll();
        getContentPane().setLayout(new BorderLayout());
        getContentPane().add(fullscreenContainer, BorderLayout.CENTER);
    }
    
    private void startGame() {
        Timer gameTimer = new Timer(16, e -> {
            // Handle continuous key input
            if (downKeyPressed && gameEngine.isLaunching()) {
                gameEngine.aimTubeDown(); // Continuously aim tube down while key is held
                // System.out.println("Continuous down key - aiming tube down"); // Debug (commented to avoid spam)
            }
            
            gameEngine.update();
            gamePanel.repaint();
            
            // Check if we need to show high score entry dialog
            if (gameEngine.getGameState() == GameEngine.GameState.WAITING_FOR_NAME && !highScoreDialogShown) {
                showHighScoreEntry();
                highScoreDialogShown = true;
            }
            
            // Reset dialog flag when game state changes
            if (gameEngine.getGameState() != GameEngine.GameState.WAITING_FOR_NAME) {
                highScoreDialogShown = false;
            }
        });
        gameTimer.start();
    }
    
    @Override
    public void keyPressed(KeyEvent e) {
        System.out.println("=== KEY PRESSED: " + e.getKeyCode() + " (" + KeyEvent.getKeyText(e.getKeyCode()) + ") ==="); // Debug
        System.out.println("inMainMenu: " + inMainMenu + ", focus owner: " + KeyboardFocusManager.getCurrentKeyboardFocusManager().getFocusOwner()); // Debug
        
        // If in main menu, delegate to main menu panel
        if (inMainMenu) {
            mainMenuPanel.keyPressed(e);
            return;
        }
        
        // Otherwise handle game controls
        switch (e.getKeyCode()) {
            case KeyEvent.VK_SPACE:
                gameEngine.handleSpacePressed();
                break;
            case KeyEvent.VK_A:
                if (gameEngine.isLaunching()) {
                    // Do nothing - A doesn't control tube aiming
                } else {
                    gameEngine.activateLeftFlipper();
                }
                break;
            case KeyEvent.VK_LEFT:
                if (gameEngine.isLaunching()) {
                    gameEngine.aimTubeLeft(); // Aim tube left when launching
                } else {
                    gameEngine.activateLeftFlipper(); // Normal flipper control
                }
                break;
            case KeyEvent.VK_D:
                if (gameEngine.isLaunching()) {
                    // Do nothing - D doesn't control tube aiming
                } else {
                    gameEngine.activateRightFlipper();
                }
                break;
            case KeyEvent.VK_RIGHT:
                if (gameEngine.isLaunching()) {
                    gameEngine.aimTubeRight(); // Aim tube right when launching
                } else {
                    gameEngine.activateRightFlipper(); // Normal flipper control
                }
                break;
            case KeyEvent.VK_DOWN:
                System.out.println("DOWN key pressed - isLaunching: " + gameEngine.isLaunching()); // Debug
                if (gameEngine.isLaunching()) {
                    downKeyPressed = true; // Track that down key is being held
                    gameEngine.aimTubeDown(); // Aim tube down when launching
                    System.out.println("Down key activated - aiming tube down"); // Debug
                } else {
                    System.out.println("Down key ignored - not launching"); // Debug
                }
                // Down arrow does nothing when not launching
                break;
            case KeyEvent.VK_N:
                gameEngine.newGame();
                break;
            case KeyEvent.VK_F11:
                toggleFullscreen();
                break;
            case KeyEvent.VK_C:
                showControls();
                break;
            case KeyEvent.VK_M:
                showMainMenu();
                break;
            case KeyEvent.VK_ESCAPE:
                gameEngine.handleEscPressed();
                break;
            case KeyEvent.VK_R:
                gameEngine.resetBallManually();
                break;
        }
    }
    
    @Override
    public void keyReleased(KeyEvent e) {
        switch (e.getKeyCode()) {
            case KeyEvent.VK_SPACE:
                gameEngine.handleSpaceReleased();
                break;
            case KeyEvent.VK_A:
                // Only deactivate flipper if not launching (A doesn't affect tube)
                if (!gameEngine.isLaunching()) {
                    gameEngine.deactivateLeftFlipper();
                }
                break;
            case KeyEvent.VK_LEFT:
                // Only deactivate flipper if not launching (arrow keys control tube when launching)
                if (!gameEngine.isLaunching()) {
                    gameEngine.deactivateLeftFlipper();
                }
                break;
            case KeyEvent.VK_D:
                // Only deactivate flipper if not launching (D doesn't affect tube)
                if (!gameEngine.isLaunching()) {
                    gameEngine.deactivateRightFlipper();
                }
                break;
            case KeyEvent.VK_RIGHT:
                // Only deactivate flipper if not launching (arrow keys control tube when launching)
                if (!gameEngine.isLaunching()) {
                    gameEngine.deactivateRightFlipper();
                }
                break;
            case KeyEvent.VK_DOWN:
                downKeyPressed = false; // Stop tracking down key
                break;
        }
    }
    
    @Override
    public void keyTyped(KeyEvent e) {
        // Not used
    }
    
    public static void main(String[] args) {
        SwingUtilities.invokeLater(() -> {
            try {
                UIManager.setLookAndFeel(UIManager.getSystemLookAndFeelClassName());
            } catch (Exception e) {
                e.printStackTrace();
            }
            
            new PinballGame().setVisible(true);
        });
    }
}
