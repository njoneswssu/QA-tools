package com.tetris;

import java.io.*;
import java.util.*;

public class HighScoreManager {
    private static final String HIGH_SCORE_FILE = "tetris_high_scores.txt";
    private static final int MAX_HIGH_SCORES = 10;
    private List<Integer> highScores;
    
    public HighScoreManager() {
        highScores = new ArrayList<>();
        loadHighScores();
    }
    
    public void addScore(int score) {
        highScores.add(score);
        Collections.sort(highScores, Collections.reverseOrder());
        
        // Keep only top 10 scores
        if (highScores.size() > MAX_HIGH_SCORES) {
            highScores = highScores.subList(0, MAX_HIGH_SCORES);
        }
        
        saveHighScores();
    }
    
    public List<Integer> getHighScores() {
        return new ArrayList<>(highScores);
    }
    
    public boolean isHighScore(int score) {
        return highScores.size() < MAX_HIGH_SCORES || score > highScores.get(highScores.size() - 1);
    }
    
    private void loadHighScores() {
        try {
            File file = new File(HIGH_SCORE_FILE);
            if (file.exists()) {
                BufferedReader reader = new BufferedReader(new FileReader(file));
                String line;
                while ((line = reader.readLine()) != null) {
                    try {
                        int score = Integer.parseInt(line.trim());
                        highScores.add(score);
                    } catch (NumberFormatException e) {
                        // Skip invalid lines
                    }
                }
                reader.close();
                
                // Sort scores in descending order
                Collections.sort(highScores, Collections.reverseOrder());
                
                // Keep only top 10
                if (highScores.size() > MAX_HIGH_SCORES) {
                    highScores = highScores.subList(0, MAX_HIGH_SCORES);
                }
            }
        } catch (IOException e) {
            System.err.println("Error loading high scores: " + e.getMessage());
            // Initialize with empty list if file can't be read
            highScores = new ArrayList<>();
        }
    }
    
    private void saveHighScores() {
        try {
            BufferedWriter writer = new BufferedWriter(new FileWriter(HIGH_SCORE_FILE));
            for (int score : highScores) {
                writer.write(String.valueOf(score));
                writer.newLine();
            }
            writer.close();
        } catch (IOException e) {
            System.err.println("Error saving high scores: " + e.getMessage());
        }
    }
    
    public void resetHighScores() {
        highScores.clear();
        saveHighScores();
    }
    
    public int getHighestScore() {
        return highScores.isEmpty() ? 0 : highScores.get(0);
    }
    
    public int getRank(int score) {
        for (int i = 0; i < highScores.size(); i++) {
            if (score >= highScores.get(i)) {
                return i + 1;
            }
        }
        return highScores.size() + 1;
    }
}
