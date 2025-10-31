package com.pinball;

import com.google.gson.Gson;
import com.google.gson.reflect.TypeToken;

import java.io.*;
import java.lang.reflect.Type;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Collections;
import java.util.List;

/**
 * Manages high scores with persistence
 */
public class HighScoreManager {
    private static final String HIGH_SCORES_FILE = "pinball_high_scores.json";
    private static final int MAX_HIGH_SCORES = 10;
    
    private List<HighScoreEntry> highScores;
    private Gson gson;
    
    public HighScoreManager() {
        gson = new Gson();
        highScores = new ArrayList<>();
        loadHighScores();
    }
    
    public static class HighScoreEntry {
        private String name;
        private int score;
        private String date;
        
        public HighScoreEntry(String name, int score, String date) {
            this.name = name;
            this.score = score;
            this.date = date;
        }
        
        // Getters
        public String getName() { return name; }
        public int getScore() { return score; }
        public String getDate() { return date; }
    }
    
    public void addScore(String playerName, int score) {
        if (playerName == null || playerName.trim().isEmpty()) {
            playerName = "Anonymous";
        }
        
        String currentDate = LocalDate.now().format(DateTimeFormatter.ofPattern("MM/dd/yyyy"));
        HighScoreEntry newEntry = new HighScoreEntry(playerName.trim(), score, currentDate);
        
        highScores.add(newEntry);
        Collections.sort(highScores, (a, b) -> Integer.compare(b.getScore(), a.getScore()));
        
        // Keep only top 10
        if (highScores.size() > MAX_HIGH_SCORES) {
            highScores = highScores.subList(0, MAX_HIGH_SCORES);
        }
        
        saveHighScores();
    }
    
    public boolean isTopTenScore(int score) {
        if (score <= 0) return false;
        return highScores.size() < MAX_HIGH_SCORES || 
               score > highScores.get(highScores.size() - 1).getScore();
    }
    
    public int getHighScore() {
        return highScores.isEmpty() ? 0 : highScores.get(0).getScore();
    }
    
    public List<HighScoreEntry> getHighScores() {
        return new ArrayList<>(highScores);
    }
    
    public void clearHighScores() {
        highScores.clear();
        saveHighScores();
    }
    
    private void loadHighScores() {
        try {
            File file = new File(HIGH_SCORES_FILE);
            if (file.exists()) {
                try (FileReader reader = new FileReader(file)) {
                    Type listType = new TypeToken<List<HighScoreEntry>>(){}.getType();
                    List<HighScoreEntry> loaded = gson.fromJson(reader, listType);
                    if (loaded != null) {
                        highScores = loaded;
                    }
                }
            }
        } catch (IOException e) {
            System.err.println("Error loading high scores: " + e.getMessage());
        }
    }
    
    private void saveHighScores() {
        try (FileWriter writer = new FileWriter(HIGH_SCORES_FILE)) {
            gson.toJson(highScores, writer);
        } catch (IOException e) {
            System.err.println("Error saving high scores: " + e.getMessage());
        }
    }
}
