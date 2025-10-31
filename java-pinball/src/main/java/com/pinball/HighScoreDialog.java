package com.pinball;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;
import java.util.List;

/**
 * Dialog for displaying and managing high scores
 */
public class HighScoreDialog extends JDialog {
    private HighScoreManager highScoreManager;
    private JPanel scoresPanel;
    private JTextField nameField;
    private JButton submitButton;
    private boolean isNameEntry;
    
    public HighScoreDialog(JFrame parent, HighScoreManager highScoreManager) {
        super(parent, "High Scores", true);
        this.highScoreManager = highScoreManager;
        this.isNameEntry = false;
        
        setupDialog();
        displayHighScores();
    }
    
    public HighScoreDialog(JFrame parent, HighScoreManager highScoreManager, 
                          String playerName, int score) {
        super(parent, "Enter Your Name", true);
        this.highScoreManager = highScoreManager;
        this.isNameEntry = true;
        
        setupNameEntryDialog(playerName, score);
    }
    
    private void setupDialog() {
        setSize(450, 500); // Increased width to prevent title cutoff
        setLocationRelativeTo(getParent());
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        
        // Set dark theme
        getContentPane().setBackground(new Color(26, 26, 46));
        
        setLayout(new BorderLayout());
        
        // Title
        JLabel titleLabel = new JLabel("*** High Scores ***", JLabel.CENTER);
        titleLabel.setFont(new Font("Arial", Font.BOLD, 24));
        titleLabel.setForeground(Color.WHITE); // Changed to white for better visibility
        titleLabel.setBorder(BorderFactory.createEmptyBorder(20, 0, 20, 0));
        add(titleLabel, BorderLayout.NORTH);
        
        // Scores panel
        scoresPanel = new JPanel();
        scoresPanel.setLayout(new BoxLayout(scoresPanel, BoxLayout.Y_AXIS));
        scoresPanel.setBackground(new Color(26, 26, 46));
        
        JScrollPane scrollPane = new JScrollPane(scoresPanel);
        scrollPane.setPreferredSize(new Dimension(380, 350));
        scrollPane.setBorder(BorderFactory.createEmptyBorder());
        scrollPane.getViewport().setBackground(new Color(26, 26, 46));
        add(scrollPane, BorderLayout.CENTER);
        
        // Buttons panel with better spacing
        JPanel buttonPanel = new JPanel(new FlowLayout(FlowLayout.CENTER, 20, 15));
        buttonPanel.setBackground(new Color(26, 26, 46));
        buttonPanel.setBorder(BorderFactory.createEmptyBorder(10, 0, 10, 0)); // Add padding
        
        JButton clearButton = createStyledButton("Clear Scores");
        clearButton.addActionListener(e -> clearScores());
        
        JButton closeButton = createStyledButton("Close");
        closeButton.addActionListener(e -> dispose());
        
        buttonPanel.add(clearButton);
        buttonPanel.add(closeButton);
        add(buttonPanel, BorderLayout.SOUTH);
    }
    
    private void setupNameEntryDialog(String defaultName, int score) {
        setSize(400, 220); // Increased size for better text visibility
        setLocationRelativeTo(getParent());
        setDefaultCloseOperation(DO_NOTHING_ON_CLOSE);
        
        getContentPane().setBackground(new Color(26, 26, 46));
        setLayout(new BorderLayout());
        
        // Title
        JLabel titleLabel = new JLabel("*** Top 10 Score! ***", JLabel.CENTER);
        titleLabel.setFont(new Font("Arial", Font.BOLD, 20));
        titleLabel.setForeground(new Color(255, 215, 0));
        titleLabel.setBorder(BorderFactory.createEmptyBorder(20, 0, 10, 0));
        add(titleLabel, BorderLayout.NORTH);
        
        // Center panel
        JPanel centerPanel = new JPanel(new GridBagLayout());
        centerPanel.setBackground(new Color(26, 26, 46));
        GridBagConstraints gbc = new GridBagConstraints();
        
        // Score display
        JLabel scoreLabel = new JLabel("Score: " + String.format("%,d", score));
        scoreLabel.setFont(new Font("Arial", Font.BOLD, 16));
        scoreLabel.setForeground(Color.WHITE);
        gbc.gridx = 0; gbc.gridy = 0; gbc.gridwidth = 2;
        gbc.insets = new Insets(0, 0, 15, 0);
        centerPanel.add(scoreLabel, gbc);
        
        // Name label
        JLabel nameLabel = new JLabel("Enter your name:");
        nameLabel.setFont(new Font("Arial", Font.PLAIN, 14));
        nameLabel.setForeground(Color.WHITE);
        gbc.gridx = 0; gbc.gridy = 1; gbc.gridwidth = 1;
        gbc.insets = new Insets(0, 0, 10, 10);
        centerPanel.add(nameLabel, gbc);
        
        // Name field with better visibility
        nameField = new JTextField(defaultName != null ? defaultName : "", 15);
        nameField.setFont(new Font("Arial", Font.PLAIN, 14));
        nameField.setBackground(Color.WHITE); // White background
        nameField.setForeground(Color.BLACK); // Black text
        nameField.setCaretColor(Color.BLACK); // Black cursor
        gbc.gridx = 1; gbc.gridy = 1;
        gbc.insets = new Insets(0, 0, 10, 0);
        centerPanel.add(nameField, gbc);
        
        add(centerPanel, BorderLayout.CENTER);
        
        // Button panel
        JPanel buttonPanel = new JPanel(new FlowLayout());
        buttonPanel.setBackground(new Color(26, 26, 46));
        
        submitButton = createStyledButton("Submit Score");
        submitButton.addActionListener(e -> {
            String playerName = nameField.getText().trim();
            if (playerName.isEmpty()) {
                playerName = "Anonymous";
            }
            highScoreManager.addScore(playerName, score);
            dispose();
        });
        
        buttonPanel.add(submitButton);
        add(buttonPanel, BorderLayout.SOUTH);
        
        // Enter key support
        nameField.addActionListener(e -> submitButton.doClick());
        nameField.selectAll();
        nameField.requestFocus();
    }
    
    private void displayHighScores() {
        scoresPanel.removeAll();
        
        List<HighScoreManager.HighScoreEntry> scores = highScoreManager.getHighScores();
        
        if (scores.isEmpty()) {
            JLabel noScoresLabel = new JLabel("No high scores yet!", JLabel.CENTER);
            noScoresLabel.setFont(new Font("Arial", Font.ITALIC, 16));
            noScoresLabel.setForeground(Color.WHITE);
            scoresPanel.add(noScoresLabel);
        } else {
            for (int i = 0; i < scores.size(); i++) {
                HighScoreManager.HighScoreEntry entry = scores.get(i);
                JPanel entryPanel = createScoreEntry(i + 1, entry);
                scoresPanel.add(entryPanel);
                scoresPanel.add(Box.createVerticalStrut(5));
            }
        }
        
        scoresPanel.revalidate();
        scoresPanel.repaint();
    }
    
    private JPanel createScoreEntry(int rank, HighScoreManager.HighScoreEntry entry) {
        JPanel panel = new JPanel(new BorderLayout());
        panel.setBackground(new Color(255, 215, 0, 25));
        panel.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(255, 215, 0, 100), 1),
            BorderFactory.createEmptyBorder(10, 15, 10, 15)
        ));
        panel.setMaximumSize(new Dimension(Integer.MAX_VALUE, 55)); // Increased height to prevent overlap
        
        // Left side (rank and name)
        JPanel leftPanel = new JPanel(new FlowLayout(FlowLayout.LEFT, 0, 0));
        leftPanel.setBackground(new Color(255, 215, 0, 25));
        
        JLabel rankLabel = new JLabel(rank + ". ");
        rankLabel.setFont(new Font("Arial", Font.BOLD, 14));
        rankLabel.setForeground(new Color(255, 215, 0));
        
        JLabel nameLabel = new JLabel(entry.getName());
        nameLabel.setFont(new Font("Arial", Font.PLAIN, 14));
        nameLabel.setForeground(Color.WHITE);
        
        leftPanel.add(rankLabel);
        leftPanel.add(nameLabel);
        
        // Right side (score and date) - Fixed spacing
        JPanel rightPanel = new JPanel();
        rightPanel.setLayout(new BoxLayout(rightPanel, BoxLayout.Y_AXIS));
        rightPanel.setBackground(new Color(255, 215, 0, 25));
        rightPanel.setBorder(BorderFactory.createEmptyBorder(2, 0, 2, 0)); // Add padding
        
        JLabel scoreLabel = new JLabel(String.format("%,d", entry.getScore()));
        scoreLabel.setFont(new Font("Arial", Font.BOLD, 14));
        scoreLabel.setForeground(new Color(78, 205, 196));
        scoreLabel.setAlignmentX(Component.RIGHT_ALIGNMENT);
        
        // Add spacing between score and date
        rightPanel.add(scoreLabel);
        rightPanel.add(Box.createVerticalStrut(3)); // Add 3px spacing
        
        JLabel dateLabel = new JLabel(entry.getDate());
        dateLabel.setFont(new Font("Arial", Font.PLAIN, 10));
        dateLabel.setForeground(Color.LIGHT_GRAY); // Changed to LIGHT_GRAY for better visibility
        dateLabel.setAlignmentX(Component.RIGHT_ALIGNMENT);
        
        rightPanel.add(dateLabel);
        
        panel.add(leftPanel, BorderLayout.WEST);
        panel.add(rightPanel, BorderLayout.EAST);
        
        return panel;
    }
    
    private JButton createStyledButton(String text) {
        JButton button = new JButton(text);
        button.setFont(new Font("Arial", Font.BOLD, 14)); // Larger font
        button.setBackground(new Color(255, 215, 0)); // Gold background
        button.setForeground(Color.BLACK); // Black text
        button.setBorder(BorderFactory.createCompoundBorder(
            BorderFactory.createLineBorder(new Color(255, 255, 255), 2), // White border
            BorderFactory.createEmptyBorder(8, 16, 8, 16) // Padding
        ));
        button.setFocusPainted(false);
        button.setOpaque(true); // Ensure background is painted
        button.setPreferredSize(new Dimension(120, 35)); // Fixed size
        
        // Enhanced hover effects
        button.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseEntered(java.awt.event.MouseEvent evt) {
                button.setBackground(new Color(255, 235, 59)); // Brighter gold
                button.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(Color.WHITE, 3), // Thicker white border
                    BorderFactory.createEmptyBorder(7, 15, 7, 15)
                ));
            }
            
            @Override
            public void mouseExited(java.awt.event.MouseEvent evt) {
                button.setBackground(new Color(255, 215, 0)); // Original gold
                button.setBorder(BorderFactory.createCompoundBorder(
                    BorderFactory.createLineBorder(Color.WHITE, 2), // Original border
                    BorderFactory.createEmptyBorder(8, 16, 8, 16)
                ));
            }
        });
        
        return button;
    }
    
    private void clearScores() {
        int result = JOptionPane.showConfirmDialog(
            this,
            "Are you sure you want to clear all high scores?",
            "Clear High Scores",
            JOptionPane.YES_NO_OPTION,
            JOptionPane.WARNING_MESSAGE
        );
        
        if (result == JOptionPane.YES_OPTION) {
            highScoreManager.clearHighScores();
            displayHighScores();
        }
    }
}
