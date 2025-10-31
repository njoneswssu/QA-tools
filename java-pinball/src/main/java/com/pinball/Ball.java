package com.pinball;

import java.awt.*;
import java.awt.geom.Point2D;

/**
 * Ball class representing the pinball
 */
public class Ball {
    private double x, y;
    private double velocityX, velocityY;
    private final double radius;
    private final Color color;
    
    public Ball(double x, double y, double radius) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.velocityX = 0;
        this.velocityY = 0;
        this.color = new Color(192, 192, 192); // Silver base color for polished pinball
    }
    
    public void updatePosition() {
        x += velocityX;
        y += velocityY;
    }
    
    public void applyGravity(double gravity) {
        velocityY += gravity;
    }
    
    public void applyFriction(double friction) {
        velocityX *= friction;
        velocityY *= friction;
    }
    
    public void render(Graphics2D g2d) {
        // Enable antialiasing for smooth metallic appearance
        g2d.setRenderingHint(RenderingHints.KEY_ANTIALIASING, RenderingHints.VALUE_ANTIALIAS_ON);
        
        int ballX = (int)(x - radius);
        int ballY = (int)(y - radius);
        int ballSize = (int)(radius * 2);
        
        // Create radial gradient for metallic silver effect
        RadialGradientPaint silverGradient = new RadialGradientPaint(
            (float)(x - radius * 0.3), (float)(y - radius * 0.3), // Light source from upper left
            (float)(radius * 1.2),
            new float[]{0.0f, 0.4f, 0.7f, 1.0f},
            new Color[]{
                new Color(255, 255, 255, 220), // Bright highlight
                new Color(220, 220, 220, 200), // Light silver
                new Color(160, 160, 160, 180), // Medium silver
                new Color(100, 100, 100, 160)  // Dark silver shadow
            }
        );
        
        // Draw main silver ball with gradient
        g2d.setPaint(silverGradient);
        g2d.fillOval(ballX, ballY, ballSize, ballSize);
        
        // Add metallic rim/edge highlight
        g2d.setColor(new Color(80, 80, 80, 180)); // Dark rim
        g2d.setStroke(new BasicStroke(1.5f));
        g2d.drawOval(ballX, ballY, ballSize, ballSize);
        
        // Add bright specular highlight (like light reflection)
        g2d.setColor(new Color(255, 255, 255, 180));
        int highlightSize = (int)(radius * 0.6);
        g2d.fillOval((int)(x - radius * 0.4), (int)(y - radius * 0.5), 
                     highlightSize, highlightSize);
        
        // Add smaller, brighter specular highlight
        g2d.setColor(new Color(255, 255, 255, 220));
        int smallHighlightSize = (int)(radius * 0.3);
        g2d.fillOval((int)(x - radius * 0.3), (int)(y - radius * 0.4), 
                     smallHighlightSize, smallHighlightSize);
        
        // Add subtle reflection streak
        g2d.setColor(new Color(255, 255, 255, 100));
        g2d.setStroke(new BasicStroke(1.0f));
        g2d.drawLine((int)(x - radius * 0.6), (int)(y - radius * 0.2),
                     (int)(x + radius * 0.2), (int)(y + radius * 0.4));
    }
    
    // Getters and setters
    public double getX() { return x; }
    public double getY() { return y; }
    public double getVelocityX() { return velocityX; }
    public double getVelocityY() { return velocityY; }
    public double getRadius() { return radius; }
    
    public void setX(double x) { this.x = x; }
    public void setY(double y) { this.y = y; }
    public void setVelocityX(double vx) { this.velocityX = vx; }
    public void setVelocityY(double vy) { this.velocityY = vy; }
    
    public void setPosition(double x, double y) {
        this.x = x;
        this.y = y;
    }
    
    public void setVelocity(double vx, double vy) {
        this.velocityX = vx;
        this.velocityY = vy;
    }
    
    public double getDistanceTo(double px, double py) {
        double dx = x - px;
        double dy = y - py;
        return Math.sqrt(dx * dx + dy * dy);
    }
}
