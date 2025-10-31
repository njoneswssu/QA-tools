package com.pinball;

import java.awt.*;

/**
 * Wall class for drawing game boundaries
 */
public class Wall {
    private final double x1, y1, x2, y2;
    private boolean isGlowing = false;
    private int glowTimer = 0;
    
    public Wall(double x1, double y1, double x2, double y2) {
        this.x1 = x1;
        this.y1 = y1;
        this.x2 = x2;
        this.y2 = y2;
    }
    
    public double getX1() { return x1; }
    public double getY1() { return y1; }
    public double getX2() { return x2; }
    public double getY2() { return y2; }
    
    public void triggerImpact() {
        isGlowing = true;
        glowTimer = 20; // Glow for 20 frames
    }
    
    public void update() {
        if (glowTimer > 0) {
            glowTimer--;
            if (glowTimer == 0) {
                isGlowing = false;
            }
        }
    }
    
    // Check collision with ball and return collision info
    public CollisionInfo checkCollision(Ball ball) {
        double ballX = ball.getX();
        double ballY = ball.getY();
        double ballRadius = ball.getRadius();
        
        // Calculate distance from ball center to line segment
        double A = ballX - x1;
        double B = ballY - y1;
        double C = x2 - x1;
        double D = y2 - y1;
        
        double dot = A * C + B * D;
        double lenSq = C * C + D * D;
        double param = (lenSq != 0) ? dot / lenSq : -1;
        
        double xx, yy;
        
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        double dx = ballX - xx;
        double dy = ballY - yy;
        double distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance <= ballRadius) {
            // Calculate normal vector for bounce
            double normalX = dx / distance;
            double normalY = dy / distance;
            
            return new CollisionInfo(true, normalX, normalY, xx, yy);
        }
        
        return new CollisionInfo(false, 0, 0, 0, 0);
    }
    
    // Inner class for collision information
    public static class CollisionInfo {
        public final boolean hasCollision;
        public final double normalX, normalY;
        public final double contactX, contactY;
        
        public CollisionInfo(boolean hasCollision, double normalX, double normalY, double contactX, double contactY) {
            this.hasCollision = hasCollision;
            this.normalX = normalX;
            this.normalY = normalY;
            this.contactX = contactX;
            this.contactY = contactY;
        }
    }
    
    public void render(Graphics2D g2d) {
        if (isGlowing) {
            // Impact animation - bright white flash with expanding glow
            int intensity = (glowTimer * 255) / 20; // Fade from bright to normal
            
            // Bright impact flash
            g2d.setColor(new Color(255, 255, 255, intensity)); // White flash
            g2d.setStroke(new BasicStroke(8 + glowTimer));
            g2d.drawLine((int)x1, (int)y1, (int)x2, (int)y2);
            
            // Expanding impact glow
            g2d.setColor(new Color(255, 255, 0, intensity / 2)); // Yellow glow
            g2d.setStroke(new BasicStroke(12 + glowTimer * 2));
            g2d.drawLine((int)x1, (int)y1, (int)x2, (int)y2);
        }
        
        // Normal wall appearance
        g2d.setColor(new Color(0, 255, 255)); // Bright cyan
        g2d.setStroke(new BasicStroke(4));
        g2d.drawLine((int)x1, (int)y1, (int)x2, (int)y2);
        
        // Add normal glow effect
        g2d.setColor(new Color(0, 255, 255, 100)); // Semi-transparent cyan glow
        g2d.setStroke(new BasicStroke(8));
        g2d.drawLine((int)x1, (int)y1, (int)x2, (int)y2);
    }
}
