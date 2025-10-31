package com.tetris;

import java.awt.Color;
import java.util.Random;

public class TetrisPiece {
    private int[][][] shapes;
    private Color color;
    private int currentRotation;
    private int x, y;
    private int pieceType;
    
    // Distinctly different glowing neon colors for better visibility
    private static final Color[] PIECE_COLORS = {
        new Color(0, 255, 255),     // Bright Cyan - I piece
        new Color(255, 255, 0),     // Pure Yellow - O piece  
        new Color(255, 0, 255),     // Bright Magenta - T piece
        new Color(0, 255, 0),       // Pure Green - S piece
        new Color(255, 0, 0),       // Pure Red - Z piece
        new Color(0, 100, 255),     // Deep Blue - J piece
        new Color(255, 140, 0)      // Dark Orange - L piece
    };
    
    // All Tetris piece shapes in all rotations
    private static final int[][][][] ALL_PIECES = {
        // I piece
        {
            {{0,0,0,0}, {1,1,1,1}, {0,0,0,0}, {0,0,0,0}},
            {{0,0,1,0}, {0,0,1,0}, {0,0,1,0}, {0,0,1,0}},
            {{0,0,0,0}, {0,0,0,0}, {1,1,1,1}, {0,0,0,0}},
            {{0,1,0,0}, {0,1,0,0}, {0,1,0,0}, {0,1,0,0}}
        },
        // O piece
        {
            {{1,1}, {1,1}},
            {{1,1}, {1,1}},
            {{1,1}, {1,1}},
            {{1,1}, {1,1}}
        },
        // T piece
        {
            {{0,1,0}, {1,1,1}, {0,0,0}},
            {{0,1,0}, {0,1,1}, {0,1,0}},
            {{0,0,0}, {1,1,1}, {0,1,0}},
            {{0,1,0}, {1,1,0}, {0,1,0}}
        },
        // S piece
        {
            {{0,1,1}, {1,1,0}, {0,0,0}},
            {{0,1,0}, {0,1,1}, {0,0,1}},
            {{0,0,0}, {0,1,1}, {1,1,0}},
            {{1,0,0}, {1,1,0}, {0,1,0}}
        },
        // Z piece
        {
            {{1,1,0}, {0,1,1}, {0,0,0}},
            {{0,0,1}, {0,1,1}, {0,1,0}},
            {{0,0,0}, {1,1,0}, {0,1,1}},
            {{0,1,0}, {1,1,0}, {1,0,0}}
        },
        // J piece
        {
            {{1,0,0}, {1,1,1}, {0,0,0}},
            {{0,1,1}, {0,1,0}, {0,1,0}},
            {{0,0,0}, {1,1,1}, {0,0,1}},
            {{0,1,0}, {0,1,0}, {1,1,0}}
        },
        // L piece
        {
            {{0,0,1}, {1,1,1}, {0,0,0}},
            {{0,1,0}, {0,1,0}, {0,1,1}},
            {{0,0,0}, {1,1,1}, {1,0,0}},
            {{1,1,0}, {0,1,0}, {0,1,0}}
        }
    };
    
    public TetrisPiece(Random random) {
        pieceType = random.nextInt(7);
        shapes = ALL_PIECES[pieceType];
        color = PIECE_COLORS[pieceType];
        currentRotation = 0;
        x = 0;
        y = 0;
    }
    
    public TetrisPiece(int pieceType) {
        this.pieceType = pieceType;
        shapes = ALL_PIECES[pieceType];
        color = PIECE_COLORS[pieceType];
        currentRotation = 0;
        x = 0;
        y = 0;
    }
    
    // Copy constructor for rotation testing
    public TetrisPiece(TetrisPiece other) {
        this.pieceType = other.pieceType;
        this.shapes = other.shapes;
        this.color = other.color;
        this.currentRotation = other.currentRotation;
        this.x = other.x;
        this.y = other.y;
    }
    
    public int[][] getShape() {
        return shapes[currentRotation];
    }
    
    public Color getColor() {
        return color;
    }
    
    public int getX() {
        return x;
    }
    
    public int getY() {
        return y;
    }
    
    public void setPosition(int x, int y) {
        this.x = x;
        this.y = y;
    }
    
    public void moveLeft() {
        x--;
    }
    
    public void moveRight() {
        x++;
    }
    
    public void moveDown() {
        y++;
    }
    
    public void rotate() {
        currentRotation = (currentRotation + 1) % 4;
    }
    
    public TetrisPiece getRotatedCopy() {
        TetrisPiece copy = new TetrisPiece(this);
        copy.rotate();
        return copy;
    }
    
    public int getPieceType() {
        return pieceType;
    }
}
