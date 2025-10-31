package com.pinball;

import java.awt.*;

/**
 * Bumper class for circular and triangular bumpers that bounce the ball
 */
public class Bumper {
    public enum Shape {
        CIRCLE, TRIANGLE
    }
    
    private final double x, y;
    private final double radius;
    private final int points;
    private final Color color;
    private final Shape shape;
    private final double rotation; // Rotation angle in degrees
    private long lastHitTime;
    private static final long GLOW_DURATION = 400; // ms - increased duration
    private static final long FLASH_DURATION = 150; // ms - flash effect
    
    // Constructor for circular bumpers (backward compatibility)
    public Bumper(double x, double y, double radius, int points, Color color) {
        this(x, y, radius, points, color, Shape.CIRCLE, 0);
    }
    
    // Constructor with shape specification
    public Bumper(double x, double y, double radius, int points, Color color, Shape shape) {
        this(x, y, radius, points, color, shape, 0);
    }
    
    // Constructor with shape and rotation specification
    public Bumper(double x, double y, double radius, int points, Color color, Shape shape, double rotation) {
        this.x = x;
        this.y = y;
        this.radius = radius;
        this.points = points;
        this.color = color;
        this.shape = shape;
        this.rotation = rotation;
        this.lastHitTime = 0;
    }
    
    public boolean checkCollision(Ball ball) {
        boolean collision = false;
        
        if (shape == Shape.CIRCLE) {
            double distance = ball.getDistanceTo(x, y);
            collision = distance < ball.getRadius() + radius;
        } else if (shape == Shape.TRIANGLE) {
            // Triangle collision detection - approximate with circle for now, but could be enhanced
            double distance = ball.getDistanceTo(x, y);
            collision = distance < ball.getRadius() + radius;
        }
        
        if (collision) {
            // Calculate collision response
            double dx = ball.getX() - x;
            double dy = ball.getY() - y;
            double distance = Math.sqrt(dx * dx + dy * dy); // Recalculate distance for push
            double angle = Math.atan2(dy, dx);
            double force = 6.0;
            
            ball.setVelocityX(Math.cos(angle) * force);
            ball.setVelocityY(Math.sin(angle) * force);
            
            // Move ball away from bumper
            double pushDistance = ball.getRadius() + radius - distance + 1;
            ball.setX(ball.getX() + Math.cos(angle) * pushDistance);
            ball.setY(ball.getY() + Math.sin(angle) * pushDistance);
            
            lastHitTime = System.currentTimeMillis();
            return true;
        }
        return false;
    }
    
    public void render(Graphics2D g2d) {
        long timeSinceHit = System.currentTimeMillis() - lastHitTime;
        boolean isGlowing = timeSinceHit < GLOW_DURATION;
        boolean isFlashing = timeSinceHit < FLASH_DURATION;
        
        // Calculate glow intensity based on time since hit
        float glowIntensity = 0f;
        if (isGlowing) {
            glowIntensity = 1f - ((float)timeSinceHit / GLOW_DURATION);
        }
        
        // Add ambient pulsing effect during gameplay
        long currentTime = System.currentTimeMillis();
        double ambientPulse = 0.3 + 0.2 * Math.sin(currentTime * 0.003 + x * 0.01); // Unique phase per bumper
        float ambientIntensity = (float)ambientPulse;
        
        // Draw ambient pulsing glow (always present) - shape-aware
        int ambientGlowRadius = (int)(radius * 1.4);
        Color ambientGlowColor = new Color(
            Math.min(255, color.getRed() + 80),
            Math.min(255, color.getGreen() + 80),
            Math.min(255, color.getBlue() + 80),
            (int)(ambientIntensity * 120) // More visible ambient glow
        );
        g2d.setColor(ambientGlowColor);
        
        if (shape == Shape.CIRCLE) {
            g2d.fillOval((int)(x - ambientGlowRadius), (int)(y - ambientGlowRadius), 
                       ambientGlowRadius * 2, ambientGlowRadius * 2);
        } else if (shape == Shape.TRIANGLE) {
            // Draw ambient glow as larger triangle
            double radians = Math.toRadians(rotation);
            double cos = Math.cos(radians);
            double sin = Math.sin(radians);
            
            // Larger triangle for glow effect
            double glowRadius = ambientGlowRadius;
            double[] origX = {0, -glowRadius, glowRadius};
            double[] origY = {-glowRadius, glowRadius * 0.5, glowRadius * 0.5};
            
            int[] xPoints = new int[3];
            int[] yPoints = new int[3];
            for (int i = 0; i < 3; i++) {
                double rotatedX = origX[i] * cos - origY[i] * sin;
                double rotatedY = origX[i] * sin + origY[i] * cos;
                xPoints[i] = (int)(x + rotatedX);
                yPoints[i] = (int)(y + rotatedY);
            }
            g2d.fillPolygon(xPoints, yPoints, 3);
        }
        
        // Draw outer glow rings for dramatic effect when hit - shape-aware
        if (isGlowing) {
            for (int i = 3; i >= 1; i--) {
                float alpha = glowIntensity * 0.6f / i; // Even more intense
                double glowRadius = radius * (1.4 + i * 0.4); // Larger glow
                Color glowColor = new Color(
                    Math.min(255, color.getRed() + 150),
                    Math.min(255, color.getGreen() + 150), 
                    Math.min(255, color.getBlue() + 150),
                    Math.max(0, Math.min(255, (int)(alpha * 255)))
                );
                g2d.setColor(glowColor);
                
                if (shape == Shape.CIRCLE) {
                    g2d.fillOval((int)(x - glowRadius), (int)(y - glowRadius), 
                               (int)(glowRadius * 2), (int)(glowRadius * 2));
                } else if (shape == Shape.TRIANGLE) {
                    // Draw hit glow as larger triangle
                    double radians = Math.toRadians(rotation);
                    double cos = Math.cos(radians);
                    double sin = Math.sin(radians);
                    
                    double[] origX = {0, -glowRadius, glowRadius};
                    double[] origY = {-glowRadius, glowRadius * 0.5, glowRadius * 0.5};
                    
                    int[] xPoints = new int[3];
                    int[] yPoints = new int[3];
                    for (int j = 0; j < 3; j++) {
                        double rotatedX = origX[j] * cos - origY[j] * sin;
                        double rotatedY = origX[j] * sin + origY[j] * cos;
                        xPoints[j] = (int)(x + rotatedX);
                        yPoints[j] = (int)(y + rotatedY);
                    }
                    g2d.fillPolygon(xPoints, yPoints, 3);
                }
            }
        }
        
        // Main bumper color with flash effect and ambient pulsing
        Color bumperColor;
        if (isFlashing) {
            // Create bright flash effect
            float flashIntensity = 1f - ((float)timeSinceHit / FLASH_DURATION);
            int brighten = (int)(flashIntensity * 150);
            bumperColor = new Color(
                Math.min(255, color.getRed() + brighten),
                Math.min(255, color.getGreen() + brighten),
                Math.min(255, color.getBlue() + brighten)
            );
        } else {
            // Normal color with subtle ambient pulsing
            int pulseBoost = (int)(ambientIntensity * 30);
            bumperColor = new Color(
                Math.min(255, color.getRed() + pulseBoost),
                Math.min(255, color.getGreen() + pulseBoost),
                Math.min(255, color.getBlue() + pulseBoost)
            );
        }
        
        // Draw main bumper based on shape
        g2d.setColor(bumperColor);
        
        if (shape == Shape.CIRCLE) {
            g2d.fillOval((int)(x - radius), (int)(y - radius), 
                         (int)(radius * 2), (int)(radius * 2));
        } else if (shape == Shape.TRIANGLE) {
            // Draw rotated triangle
            double radians = Math.toRadians(rotation);
            double cos = Math.cos(radians);
            double sin = Math.sin(radians);
            
            // Original triangle points (before rotation)
            double[] origX = {0, -radius, radius}; // Top, bottom left, bottom right
            double[] origY = {-radius, radius * 0.5, radius * 0.5};
            
            // Rotate and translate points
            int[] xPoints = new int[3];
            int[] yPoints = new int[3];
            for (int i = 0; i < 3; i++) {
                double rotatedX = origX[i] * cos - origY[i] * sin;
                double rotatedY = origX[i] * sin + origY[i] * cos;
                xPoints[i] = (int)(x + rotatedX);
                yPoints[i] = (int)(y + rotatedY);
            }
            g2d.fillPolygon(xPoints, yPoints, 3);
        }
        
        // Add bright white center flash for immediate hit feedback
        if (isFlashing) {
            float flashAlpha = 1f - ((float)timeSinceHit / FLASH_DURATION);
            g2d.setColor(new Color(255, 255, 255, (int)(flashAlpha * 200)));
            
            if (shape == Shape.CIRCLE) {
                g2d.fillOval((int)(x - radius * 0.6), (int)(y - radius * 0.6), 
                            (int)(radius * 1.2), (int)(radius * 1.2));
            } else if (shape == Shape.TRIANGLE) {
                // Flash triangle (smaller, rotated)
                double radians = Math.toRadians(rotation);
                double cos = Math.cos(radians);
                double sin = Math.sin(radians);
                
                // Original flash triangle points (smaller)
                double[] origX = {0, -radius * 0.6, radius * 0.6};
                double[] origY = {-radius * 0.6, radius * 0.3, radius * 0.3};
                
                // Rotate and translate points
                int[] xPoints = new int[3];
                int[] yPoints = new int[3];
                for (int i = 0; i < 3; i++) {
                    double rotatedX = origX[i] * cos - origY[i] * sin;
                    double rotatedY = origX[i] * sin + origY[i] * cos;
                    xPoints[i] = (int)(x + rotatedX);
                    yPoints[i] = (int)(y + rotatedY);
                }
                g2d.fillPolygon(xPoints, yPoints, 3);
            }
        }
        
        // Enhanced outline
        Color outlineColor = isGlowing ? Color.WHITE : color.brighter();
        g2d.setColor(outlineColor);
        g2d.setStroke(new BasicStroke(isGlowing ? 3 : 2));
        
        if (shape == Shape.CIRCLE) {
            g2d.drawOval((int)(x - radius), (int)(y - radius), 
                         (int)(radius * 2), (int)(radius * 2));
        } else if (shape == Shape.TRIANGLE) {
            // Draw rotated triangle outline
            double radians = Math.toRadians(rotation);
            double cos = Math.cos(radians);
            double sin = Math.sin(radians);
            
            // Original triangle points (before rotation)
            double[] origX = {0, -radius, radius};
            double[] origY = {-radius, radius * 0.5, radius * 0.5};
            
            // Rotate and translate points
            int[] xPoints = new int[3];
            int[] yPoints = new int[3];
            for (int i = 0; i < 3; i++) {
                double rotatedX = origX[i] * cos - origY[i] * sin;
                double rotatedY = origX[i] * sin + origY[i] * cos;
                xPoints[i] = (int)(x + rotatedX);
                yPoints[i] = (int)(y + rotatedY);
            }
            g2d.drawPolygon(xPoints, yPoints, 3);
        }
        
        // Show points when hit with fade-out effect
        if (isGlowing) {
            float textAlpha = glowIntensity;
            g2d.setColor(new Color(255, 255, 255, (int)(textAlpha * 255))); // White text with fade
            g2d.setFont(new Font("Arial", Font.BOLD, 14));
            
            String pointsText = "+" + points;
            FontMetrics fm = g2d.getFontMetrics();
            int textWidth = fm.stringWidth(pointsText);
            int textHeight = fm.getHeight();
            
            // Center the text in the bumper
            int textX = (int)(x - textWidth / 2);
            int textY = (int)(y + textHeight / 4);
            
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
