package com.pinball;

import java.awt.*;

/**
 * Target class for rectangular targets that can be hit
 */
public class Target {
    private final double x, y;
    private final double width, height;
    private final int points;
    private final Color color;
    private boolean hit;
    private long hitTime;
    private static final long RESET_TIME = 1000; // 1 second - much faster reset
    private static final long GLOW_DURATION = 600; // ms - increased duration
    private static final long FLASH_DURATION = 200; // ms - flash effect
    
    public Target(double x, double y, double width, double height, int points, Color color) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.points = points;
        this.color = color;
        this.hit = false;
        this.hitTime = 0;
    }
    
    public boolean checkCollision(Ball ball) {
        // Reset target if enough time has passed
        if (hit && (System.currentTimeMillis() - hitTime) > RESET_TIME) {
            hit = false;
        }
        
        // Enhanced collision detection with ball radius
        double ballX = ball.getX();
        double ballY = ball.getY();
        double ballRadius = ball.getRadius();
        
        // Check if ball overlaps with target rectangle (including radius)
        boolean overlaps = ballX + ballRadius > x && ballX - ballRadius < x + width &&
                          ballY + ballRadius > y && ballY - ballRadius < y + height;
        
        if (!hit && overlaps) {
            hit = true;
            hitTime = System.currentTimeMillis();
            
            // Calculate which side of the target was hit for proper bounce
            double ballCenterX = ballX;
            double ballCenterY = ballY;
            double targetCenterX = x + width / 2;
            double targetCenterY = y + height / 2;
            
            // Determine collision side based on ball position relative to target center
            double deltaX = ballCenterX - targetCenterX;
            double deltaY = ballCenterY - targetCenterY;
            
            // Calculate overlap amounts
            double overlapX = (width / 2 + ballRadius) - Math.abs(deltaX);
            double overlapY = (height / 2 + ballRadius) - Math.abs(deltaY);
            
            // Apply slower, more controlled bounce based on collision side
            double currentVelX = ball.getVelocityX();
            double currentVelY = ball.getVelocityY();
            
            if (overlapX < overlapY) {
                // Horizontal collision (left or right side)
                double newVelX = -currentVelX * 0.8; // Increased bounce factor
                ball.setVelocityX(newVelX);
                
                // Push ball out of collision with more distance
                if (deltaX > 0) {
                    ball.setX(x + width + ballRadius + 3);
                } else {
                    ball.setX(x - ballRadius - 3);
                }
            } else {
                // Vertical collision (top or bottom side)
                double newVelY = -currentVelY * 0.8; // Increased bounce factor
                ball.setVelocityY(newVelY);
                
                // Push ball out of collision with more distance
                if (deltaY > 0) {
                    ball.setY(y + height + ballRadius + 3);
                } else {
                    ball.setY(y - ballRadius - 3);
                }
            }
            
            // Add unique random variations for more interesting gameplay
            double variationX = (Math.random() - 0.5) * 0.8; // Larger X variation
            double variationY = (Math.random() - 0.5) * 0.6; // Larger Y variation
            
            // Add spin effect based on hit position
            double spinEffect = (deltaX / (width / 2)) * 0.4; // Spin based on where ball hits
            
            ball.setVelocityX(ball.getVelocityX() + variationX + spinEffect);
            ball.setVelocityY(ball.getVelocityY() + variationY);
            
            // Ensure minimum velocity to keep ball moving
            if (Math.abs(ball.getVelocityX()) < 1.0) {
                ball.setVelocityX(ball.getVelocityX() > 0 ? 1.0 : -1.0);
            }
            if (Math.abs(ball.getVelocityY()) < 1.0) {
                ball.setVelocityY(ball.getVelocityY() > 0 ? 1.0 : -1.0);
            }
            
            return true;
        }
        return false;
    }
    
    public void render(Graphics2D g2d) {
        long timeSinceHit = System.currentTimeMillis() - hitTime;
        boolean isGlowing = timeSinceHit < GLOW_DURATION;
        boolean isFlashing = timeSinceHit < FLASH_DURATION;
        
        // Calculate glow intensity
        float glowIntensity = 0f;
        if (isGlowing) {
            glowIntensity = 1f - ((float)timeSinceHit / GLOW_DURATION);
        }
        
        // Add ambient pulsing effect during gameplay
        long currentTime = System.currentTimeMillis();
        double ambientPulse = 0.4 + 0.3 * Math.sin(currentTime * 0.004 + x * 0.02); // Unique phase per target
        float ambientIntensity = (float)ambientPulse;
        
        // Draw ambient pulsing glow (always present) - more visible
        Color ambientGlowColor = new Color(
            Math.min(255, color.getRed() + 80),
            Math.min(255, color.getGreen() + 80),
            Math.min(255, color.getBlue() + 80),
            (int)(ambientIntensity * 100) // More visible ambient glow
        );
        g2d.setColor(ambientGlowColor);
        g2d.fillRect((int)(x - 4), (int)(y - 4), (int)(width + 8), (int)(height + 8));
        
        // Draw glow effects for targets (show effects even when hit)
        if (isGlowing) {
            // Outer glow layers - more intense
            for (int i = 3; i >= 1; i--) {
                float alpha = glowIntensity * 0.7f / i; // More intense
                int expand = i * 6; // Larger glow
                Color glowColor = new Color(
                    Math.min(255, color.getRed() + 150),
                    Math.min(255, color.getGreen() + 150),
                    Math.min(255, color.getBlue() + 150),
                    Math.max(0, Math.min(255, (int)(alpha * 255)))
                );
                g2d.setColor(glowColor);
                g2d.fillRect((int)(x - expand), (int)(y - expand), 
                           (int)(width + expand * 2), (int)(height + expand * 2));
            }
        }
        
        // Main target color with ambient pulsing
        Color renderColor;
        if (hit) {
            // Hit targets with subtle pulsing
            int pulseBoost = (int)(ambientIntensity * 20);
            renderColor = new Color(
                Math.min(255, 100 + pulseBoost), 
                Math.min(255, 100 + pulseBoost), 
                Math.min(255, 100 + pulseBoost)
            );
        } else if (isFlashing) {
            // Bright flash effect
            float flashIntensity = 1f - ((float)timeSinceHit / FLASH_DURATION);
            int brighten = (int)(flashIntensity * 180);
            renderColor = new Color(
                Math.min(255, color.getRed() + brighten),
                Math.min(255, color.getGreen() + brighten),
                Math.min(255, color.getBlue() + brighten)
            );
        } else {
            // Normal color with more visible ambient pulsing
            int pulseBoost = (int)(ambientIntensity * 40); // Increased pulse visibility
            renderColor = new Color(
                Math.min(255, color.getRed() + pulseBoost),
                Math.min(255, color.getGreen() + pulseBoost),
                Math.min(255, color.getBlue() + pulseBoost)
            );
        }
        
        // Draw main target
        g2d.setColor(renderColor);
        g2d.fillRect((int)x, (int)y, (int)width, (int)height);
        
        // Add bright center flash for immediate feedback
        if (!hit && isFlashing) {
            float flashAlpha = 1f - ((float)timeSinceHit / FLASH_DURATION);
            g2d.setColor(new Color(255, 255, 255, (int)(flashAlpha * 180)));
            g2d.fillRect((int)(x + width * 0.1), (int)(y + height * 0.1), 
                        (int)(width * 0.8), (int)(height * 0.8));
        }
        
        // Enhanced outline for active targets
        if (!hit) {
            Color outlineColor = isGlowing ? Color.WHITE : color.brighter();
            g2d.setColor(outlineColor);
            g2d.setStroke(new BasicStroke(isGlowing ? 3 : 2));
            g2d.drawRect((int)x, (int)y, (int)width, (int)height);
            
            // Additional bright outline when glowing
            if (isGlowing) {
                g2d.setColor(new Color(255, 255, 255, (int)(glowIntensity * 150)));
                g2d.setStroke(new BasicStroke(1));
                g2d.drawRect((int)(x - 1), (int)(y - 1), (int)(width + 2), (int)(height + 2));
            }
        }
        
        // Show points when hit with fade-out effect
        if (isGlowing) {
            float textAlpha = glowIntensity;
            g2d.setFont(new Font("Arial", Font.BOLD, 12));
            
            String pointsText = "+" + points;
            FontMetrics fm = g2d.getFontMetrics();
            int textWidth = fm.stringWidth(pointsText);
            int textHeight = fm.getHeight();
            
            // Center the text in the target
            int textX = (int)(x + width/2 - textWidth/2);
            int textY = (int)(y + height/2 + textHeight/4);
            
            // Add text shadow for better visibility
            g2d.setColor(new Color(0, 0, 0, (int)(textAlpha * 150)));
            g2d.drawString(pointsText, textX + 1, textY + 1);
            
            // Draw main text
            g2d.setColor(new Color(255, 255, 255, (int)(textAlpha * 255)));
            g2d.drawString(pointsText, textX, textY);
        }
    }
    
    public int getPoints() {
        return points;
    }
}
