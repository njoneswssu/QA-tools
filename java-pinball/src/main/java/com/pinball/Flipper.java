package com.pinball;

import java.awt.*;
import java.awt.geom.AffineTransform;

/**
 * Flipper class for pinball flippers
 */
public class Flipper {
    private final double x, y;
    private final double width;
    private final boolean isLeft;
    private double angle;
    private double targetAngle;
    private boolean active;
    
    // Animation properties for ball collision feedback
    private boolean hitAnimation;
    private long hitTime;
    private static final long HIT_ANIMATION_DURATION = 200; // 200ms animation
    
    private static final double INACTIVE_ANGLE_LEFT = -0.4;  // Rest position (down) - increased range
    private static final double ACTIVE_ANGLE_LEFT = 0.5;    // Active position (up for hitting) - harder swing
    private static final double INACTIVE_ANGLE_RIGHT = 0.4;  // Rest position (down) - increased range
    private static final double ACTIVE_ANGLE_RIGHT = -0.5;   // Active position (up for hitting) - harder swing
    private static final double ANGLE_SPEED = 0.4;          // Faster flipper movement
    private static final double FLIPPER_FORCE = 12.0;       // Increased base force
    
    public Flipper(double x, double y, double width, boolean isLeft) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.isLeft = isLeft;
        this.active = false;
        
        if (isLeft) {
            this.angle = INACTIVE_ANGLE_LEFT;
            this.targetAngle = INACTIVE_ANGLE_LEFT;
        } else {
            this.angle = INACTIVE_ANGLE_RIGHT;
            this.targetAngle = INACTIVE_ANGLE_RIGHT;
        }
    }
    
    public void update() {
        // Smooth angle transition
        double diff = targetAngle - angle;
        angle += diff * ANGLE_SPEED;
        
        // Update hit animation
        if (hitAnimation && System.currentTimeMillis() - hitTime > HIT_ANIMATION_DURATION) {
            hitAnimation = false;
        }
    }
    
    public void activate() {
        active = true;
        targetAngle = isLeft ? ACTIVE_ANGLE_LEFT : ACTIVE_ANGLE_RIGHT;
    }
    
    public void deactivate() {
        active = false;
        targetAngle = isLeft ? INACTIVE_ANGLE_LEFT : INACTIVE_ANGLE_RIGHT;
    }
    
    public boolean checkCollision(Ball ball) {
        double dx = ball.getX() - x;
        double dy = ball.getY() - y;
        double distance = Math.sqrt(dx * dx + dy * dy);
        
        // SIMPLIFIED COLLISION DETECTION - Use generous circular collision area
        double flipperLength = width;
        double ballRadius = ball.getRadius();
        double collisionRadius = flipperLength/2 + ballRadius + 10; // Extra generous collision area
        
        // Debug: Always log when ball is near flippers
        if (Math.abs(dy) < 30 && Math.abs(dx) < 150) {
            System.out.println("FLIPPER DEBUG: Ball near flipper (" + (isLeft ? "LEFT" : "RIGHT") + ") - Ball: (" + 
                ball.getX() + ", " + ball.getY() + "), Flipper: (" + x + ", " + y + "), Distance: " + distance + 
                ", CollisionRadius: " + collisionRadius + ", WillCollide: " + (distance < collisionRadius) + ", Active: " + active);
        }
        
        // Simple distance-based collision - much more reliable
        if (distance < collisionRadius) {
            // Trigger hit animation
            triggerHitAnimation();
            
            // Calculate collision response with enhanced physics
            double force = active ? FLIPPER_FORCE * 1.5 : FLIPPER_FORCE;
            double direction = isLeft ? 1 : -1;
            
            // Realistic flipper physics - consider ball position and flipper movement
            double ballRelativeX = ball.getX() - x; // Ball position relative to flipper center
            double contactPoint = ballRelativeX / (width/2); // -1 to 1, where ball contacts flipper
            
            // Calculate flipper velocity based on angle and swing speed
            double flipperVelocity = active ? (targetAngle - angle) * 20 : 0; // Flipper swing speed
            
            // Ball velocity depends on contact point and flipper movement
            double baseVelocityX = Math.cos(angle) * force * direction;
            double baseVelocityY = Math.sin(angle) * force - 4; // Strong upward force
            
            // Add flipper swing momentum to ball
            if (active && Math.abs(flipperVelocity) > 0.01) {
                // Ball gets extra velocity from flipper swing
                baseVelocityX += flipperVelocity * Math.cos(angle) * 2;
                baseVelocityY += flipperVelocity * Math.sin(angle) * 2 - 3; // Extra upward force from swing
            }
            
            // Contact point affects trajectory (tip of flipper hits harder)
            double contactMultiplier = 1.0 + Math.abs(contactPoint) * 0.8; // Tip hits 80% harder
            baseVelocityX *= contactMultiplier;
            baseVelocityY *= contactMultiplier;
            
            // Reduce excessive randomness for more predictable control
            double velocityX = baseVelocityX + (Math.random() - 0.5) * 1.5; // Reduced randomness
            double velocityY = baseVelocityY + (Math.random() - 0.5) * 1.0;
            
            ball.setVelocityX(velocityX);
            ball.setVelocityY(velocityY);
            
            // Add slight randomness for variation
            ball.setVelocityX(ball.getVelocityX() + (Math.random() - 0.5) * 3);
            ball.setVelocityY(ball.getVelocityY() + (Math.random() - 0.5) * 2);
            
            // Push ball away from flipper to prevent sticking
            double pushDistance = ball.getRadius() + 5;
            double pushX = dx > 0 ? pushDistance : -pushDistance;
            ball.setX(ball.getX() + pushX);
            ball.setY(ball.getY() - 2); // Slight upward push
            
            System.out.println("FLIPPER HIT! Force: " + force + ", Active: " + active + ", Angle: " + angle);
            
            return true;
        }
        return false;
    }
    
    private void triggerHitAnimation() {
        hitAnimation = true;
        hitTime = System.currentTimeMillis();
    }
    
    public void render(Graphics2D g2d) {
        AffineTransform oldTransform = g2d.getTransform();
        
        g2d.translate(x, y);
        g2d.rotate(angle);
        
        // Calculate hit animation intensity
        double hitIntensity = 0;
        if (hitAnimation) {
            long elapsed = System.currentTimeMillis() - hitTime;
            hitIntensity = Math.max(0, 1.0 - (double)elapsed / HIT_ANIMATION_DURATION);
        }
        
        // Set colors based on activation and hit animation
        Color baseColor;
        if (hitAnimation && hitIntensity > 0) {
            // Flash bright white/cyan when hit
            int intensity = (int)(255 * hitIntensity);
            baseColor = new Color(255, 255, 255, intensity);
        } else if (active) {
            baseColor = new Color(255, 255, 0); // Bright yellow when active
        } else {
            baseColor = new Color(255, 100, 0); // Bright orange when inactive
        }
        
        // Draw hit animation explosion effect
        if (hitAnimation && hitIntensity > 0) {
            // Outer explosion ring
            int explosionSize = (int)(30 * hitIntensity);
            g2d.setColor(new Color(255, 255, 255, (int)(100 * hitIntensity)));
            g2d.fillOval(-explosionSize/2, -explosionSize/2, explosionSize, explosionSize);
            
            // Inner bright flash
            int flashSize = (int)(20 * hitIntensity);
            g2d.setColor(new Color(0, 255, 255, (int)(150 * hitIntensity))); // Cyan flash
            g2d.fillOval(-flashSize/2, -flashSize/2, flashSize, flashSize);
        }
        
        // Draw flipper with enhanced glow during hit
        g2d.setColor(baseColor);
        g2d.fillRoundRect((int)(-width/2), -8, (int)width, 16, 8, 8);
        
        // Add enhanced glow when active or hit
        if (active || hitAnimation) {
            // Outer glow (enhanced during hit)
            int glowAlpha = active ? 150 : 0;
            if (hitAnimation) glowAlpha += (int)(200 * hitIntensity);
            glowAlpha = Math.min(255, glowAlpha);
            
            g2d.setColor(new Color(255, 255, 255, glowAlpha));
            g2d.fillRoundRect((int)(-width/2 - 3), -11, (int)width + 6, 22, 11, 11);
            
            // Inner bright highlight (enhanced during hit)
            int highlightAlpha = active ? 200 : 0;
            if (hitAnimation) highlightAlpha += (int)(255 * hitIntensity);
            highlightAlpha = Math.min(255, highlightAlpha);
            
            g2d.setColor(new Color(255, 255, 255, highlightAlpha));
            g2d.fillRoundRect((int)(-width/2), -6, (int)width, 12, 6, 6);
        }
        
        g2d.setTransform(oldTransform);
    }
}
