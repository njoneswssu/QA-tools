package com.pinball;

import javax.swing.*;
import java.awt.*;
import java.awt.event.ActionEvent;
import java.awt.event.ActionListener;

/**
 * Dialog for displaying game controls and instructions
 */
public class ControlsDialog extends JDialog {
    
    public ControlsDialog(JFrame parent) {
        super(parent, "Game Controls", true);
        setupDialog();
    }
    
    private void setupDialog() {
        setSize(500, 400);
        setLocationRelativeTo(getParent());
        setDefaultCloseOperation(DISPOSE_ON_CLOSE);
        
        // Set dark theme
        getContentPane().setBackground(new Color(26, 26, 46));
        
        setLayout(new BorderLayout());
        
        // Title
        JLabel titleLabel = new JLabel("🎮 Game Controls 🎮", JLabel.CENTER);
        titleLabel.setFont(new Font("Arial", Font.BOLD, 24));
        titleLabel.setForeground(new Color(255, 215, 0));
        titleLabel.setBorder(BorderFactory.createEmptyBorder(20, 0, 20, 0));
        add(titleLabel, BorderLayout.NORTH);
        
        // Controls panel
        JPanel controlsPanel = new JPanel();
        controlsPanel.setLayout(new BoxLayout(controlsPanel, BoxLayout.Y_AXIS));
        controlsPanel.setBackground(new Color(26, 26, 46));
        controlsPanel.setBorder(BorderFactory.createEmptyBorder(10, 30, 10, 30));
        
        // Add control sections
        addControlSection(controlsPanel, "🚀 Ball Launch", new String[]{
            "SPACE - Hold to build power, release to launch",
            "Power meter shows launch strength",
            "Aim for skill shot targets for bonus points"
        });
        
        addControlSection(controlsPanel, "🎯 Flippers", new String[]{
            "A or ← (Left Arrow) - Left flipper",
            "D or → (Right Arrow) - Right flipper",
            "Time your flips to control the ball direction"
        });
        
        addControlSection(controlsPanel, "🎮 Game Controls", new String[]{
            "N - New Game (anytime)",
            "F11 - Toggle Fullscreen",
            "ESC - Exit Fullscreen"
        });
        
        addControlSection(controlsPanel, "🏆 Scoring Guide", new String[]{
            "JACKPOT Target: 1000 points",
            "Skill Shot Targets: 300-500 points",
            "Bumpers: 75-400 points",
            "Regular Targets: 75-200 points"
        });
        
        addControlSection(controlsPanel, "💡 Tips", new String[]{
            "• Use skill shots for high-value targets",
            "• Chain bumper hits for combo points",
            "• Control ball with flipper timing",
            "• Aim for JACKPOT target when possible"
        });
        
        JScrollPane scrollPane = new JScrollPane(controlsPanel);
        scrollPane.setBorder(BorderFactory.createEmptyBorder());
        scrollPane.getViewport().setBackground(new Color(26, 26, 46));
        add(scrollPane, BorderLayout.CENTER);
        
        // Close button
        JPanel buttonPanel = new JPanel(new FlowLayout());
        buttonPanel.setBackground(new Color(26, 26, 46));
        
        JButton closeButton = createStyledButton("Close");
        closeButton.addActionListener(e -> dispose());
        
        buttonPanel.add(closeButton);
        add(buttonPanel, BorderLayout.SOUTH);
    }
    
    private void addControlSection(JPanel parent, String title, String[] items) {
        // Section title
        JLabel sectionTitle = new JLabel(title);
        sectionTitle.setFont(new Font("Arial", Font.BOLD, 16));
        sectionTitle.setForeground(new Color(255, 215, 0));
        sectionTitle.setAlignmentX(Component.LEFT_ALIGNMENT);
        sectionTitle.setBorder(BorderFactory.createEmptyBorder(15, 0, 8, 0));
        parent.add(sectionTitle);
        
        // Section items
        for (String item : items) {
            JLabel itemLabel = new JLabel(item);
            itemLabel.setFont(new Font("Arial", Font.PLAIN, 14));
            itemLabel.setForeground(Color.WHITE);
            itemLabel.setAlignmentX(Component.LEFT_ALIGNMENT);
            itemLabel.setBorder(BorderFactory.createEmptyBorder(3, 20, 3, 0));
            parent.add(itemLabel);
        }
        
        // Add spacing
        parent.add(Box.createVerticalStrut(5));
    }
    
    private JButton createStyledButton(String text) {
        JButton button = new JButton(text);
        button.setFont(new Font("Arial", Font.BOLD, 14));
        button.setBackground(new Color(255, 215, 0));
        button.setForeground(Color.BLACK);
        button.setBorder(BorderFactory.createRaisedBevelBorder());
        button.setFocusPainted(false);
        button.setPreferredSize(new Dimension(100, 35));
        
        button.addMouseListener(new java.awt.event.MouseAdapter() {
            @Override
            public void mouseEntered(java.awt.event.MouseEvent evt) {
                button.setBackground(new Color(255, 235, 59));
            }
            
            @Override
            public void mouseExited(java.awt.event.MouseEvent evt) {
                button.setBackground(new Color(255, 215, 0));
            }
        });
        
        return button;
    }
}
