package com.pinball;

import java.awt.*;

/**
 * Launch tube with aiming capability
 */
public class LaunchTube {
    private final double x, y;
    private final double width, height;
    private double aimAngle; // Angle for launch direction (-45 to +45 degrees)
    
    // Animation and collision state
    public enum TubeState {
        OPEN,       // Ready for ball launch
        CLOSING,    // Animation: closing after launch
        CLOSED,     // Closed and acts as collision object
        OPENING     // Animation: opening for next ball
    }
    
    private TubeState state;
    private double animationProgress; // 0.0 to 1.0 for animation progress
    private long animationStartTime;
    private static final long ANIMATION_DURATION = 1000; // 1 second for open/close animation
    
    public LaunchTube(double x, double y, double width, double height) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.aimAngle = 0; // Start aiming straight up
        this.state = TubeState.OPEN; // Start open and ready
        this.animationProgress = 0.0;
        this.animationStartTime = 0;
    }
    
    // Aiming methods
    public void aimLeft() {
        aimAngle = Math.max(-45, aimAngle - 5); // Limit to -45 degrees
    }
    
    public void aimRight() {
        aimAngle = Math.min(45, aimAngle + 5); // Limit to +45 degrees
    }
    
    public void aimDown() {
        aimAngle = 0; // Reset to straight up (down arrow resets aim)
    }
    
    public void resetAim() {
        aimAngle = 0; // Reset to straight up
    }
    
    // Tube state management
    public void startClosing() {
        if (state == TubeState.OPEN) {
            state = TubeState.CLOSING;
            animationStartTime = System.currentTimeMillis();
            animationProgress = 0.0;
        }
    }
    
    public void startOpening() {
        if (state == TubeState.CLOSED) {
            state = TubeState.OPENING;
            animationStartTime = System.currentTimeMillis();
            animationProgress = 0.0;
        }
    }
    
    public void forceOpen() {
        state = TubeState.OPEN;
        animationProgress = 0.0;
    }
    
    public void update() {
        // Update animation progress
        if (state == TubeState.CLOSING || state == TubeState.OPENING) {
            long elapsed = System.currentTimeMillis() - animationStartTime;
            animationProgress = Math.min(1.0, (double) elapsed / ANIMATION_DURATION);
            
            // Check if animation is complete
            if (animationProgress >= 1.0) {
                if (state == TubeState.CLOSING) {
                    state = TubeState.CLOSED;
                } else if (state == TubeState.OPENING) {
                    state = TubeState.OPEN;
                }
                animationProgress = 0.0;
            }
        }
    }
    
    // Collision detection for closed tube
    public boolean checkCollision(Ball ball) {
        if (state != TubeState.CLOSED) {
            return false; // No collision when tube is open or animating
        }
        
        // Simple rectangular collision detection
        double ballX = ball.getX();
        double ballY = ball.getY();
        double ballRadius = ball.getRadius();
        
        // Check if ball overlaps with tube area
        return ballX + ballRadius > x && ballX - ballRadius < x + width &&
               ballY + ballRadius > y && ballY - ballRadius < y + height;
    }
    
    public void handleCollision(Ball ball) {
        if (!checkCollision(ball)) return;
        
        // Bounce ball off the closed tube
        double ballX = ball.getX();
        double ballY = ball.getY();
        double tubecenterX = x + width / 2;
        double tubecenterY = y + height / 2;
        
        // Calculate bounce direction based on collision point
        double dx = ballX - tubecenterX;
        double dy = ballY - tubecenterY;
        double distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Normalize direction
            dx /= distance;
            dy /= distance;
            
            // Apply bounce with some randomization for variety (reduced for less aggressive gameplay)
            double bounceForce = 5.0 + Math.random() * 3.0; // 5-8 bounce force (reduced)
            ball.setVelocity(dx * bounceForce, dy * bounceForce);
            
            // Move ball out of collision area
            double pushDistance = ball.getRadius() + 2;
            ball.setPosition(tubecenterX + dx * pushDistance, tubecenterY + dy * pushDistance);
        }
    }
    
    // Getters
    public double getX() { return x; }
    public double getY() { return y; }
    public double getWidth() { return width; }
    public double getHeight() { return height; }
    public double getAimAngle() { return aimAngle; }
    public TubeState getState() { return state; }
    public boolean isOpen() { return state == TubeState.OPEN; }
    public boolean isClosed() { return state == TubeState.CLOSED; }
    
    public void render(Graphics2D g2d) {
        // Calculate animation offset for closing/opening
        double animOffset = 0;
        Color tubeColor = new Color(0, 255, 255); // Default cyan
        
        if (state == TubeState.CLOSING) {
            // Animate closing from top
            animOffset = animationProgress * height * 0.8; // Close 80% of the way
            tubeColor = new Color(255, 165, 0); // Orange while closing
        } else if (state == TubeState.OPENING) {
            // Animate opening from top
            animOffset = (1.0 - animationProgress) * height * 0.8; // Open from closed position
            tubeColor = new Color(255, 255, 0); // Yellow while opening
        } else if (state == TubeState.CLOSED) {
            // Fully closed
            animOffset = height * 0.8;
            tubeColor = new Color(255, 0, 0); // Red when closed
        }
        
        // Draw tube background with neon glow (only visible part)
        double visibleHeight = height - animOffset;
        if (visibleHeight > 0) {
            g2d.setColor(new Color(tubeColor.getRed(), tubeColor.getGreen(), tubeColor.getBlue(), 30));
            g2d.fillRect((int)x, (int)(y + animOffset), (int)width, (int)visibleHeight);
        }
        
        // Draw bright neon tube walls with glow effect
        g2d.setColor(new Color(tubeColor.getRed(), tubeColor.getGreen(), tubeColor.getBlue(), 100));
        g2d.setStroke(new BasicStroke(8));
        
        // Left wall (only visible part)
        if (visibleHeight > 0) {
            g2d.drawLine((int)x, (int)(y + animOffset), (int)x, (int)(y + height));
        }
        // Right wall (only visible part)  
        if (visibleHeight > 0) {
            g2d.drawLine((int)(x + width), (int)(y + animOffset), (int)(x + width), (int)(y + height));
        }
        
        // Draw closing mechanism (animated barrier)
        if (state != TubeState.OPEN) {
            g2d.setColor(tubeColor);
            g2d.setStroke(new BasicStroke(6));
            // Horizontal closing barrier
            g2d.drawLine((int)x, (int)(y + animOffset), (int)(x + width), (int)(y + animOffset));
            
            // Add glow effect to barrier
            g2d.setColor(new Color(tubeColor.getRed(), tubeColor.getGreen(), tubeColor.getBlue(), 150));
            g2d.setStroke(new BasicStroke(10));
            g2d.drawLine((int)x, (int)(y + animOffset), (int)(x + width), (int)(y + animOffset));
        }
        
        // Bright inner lines (only visible part)
        if (visibleHeight > 0) {
            g2d.setColor(tubeColor);
            g2d.setStroke(new BasicStroke(3));
            g2d.drawLine((int)x, (int)(y + animOffset), (int)x, (int)(y + height));
            g2d.drawLine((int)(x + width), (int)(y + animOffset), (int)(x + width), (int)(y + height));
        }
    }
    
    public void renderAimIndicator(Graphics2D g2d, boolean isLaunching) {
        if (!isLaunching) return;
        
        // Draw aiming line from tube center
        double centerX = x + width / 2;
        double centerY = y;
        double lineLength = 100;
        
        // Calculate aim direction (convert degrees to radians)
        double angleRad = Math.toRadians(aimAngle - 90); // -90 to make 0 degrees point up
        double endX = centerX + Math.cos(angleRad) * lineLength;
        double endY = centerY + Math.sin(angleRad) * lineLength;
        
        // Draw aiming line with glow effect
        g2d.setStroke(new BasicStroke(4));
        g2d.setColor(new Color(255, 255, 0, 100)); // Yellow glow
        g2d.drawLine((int)centerX, (int)centerY, (int)endX, (int)endY);
        
        g2d.setStroke(new BasicStroke(2));
        g2d.setColor(new Color(255, 255, 0)); // Bright yellow
        g2d.drawLine((int)centerX, (int)centerY, (int)endX, (int)endY);
        
        // Draw arrow head
        double arrowLength = 10;
        double arrowAngle = Math.PI / 6; // 30 degrees
        
        double arrow1X = endX - arrowLength * Math.cos(angleRad - arrowAngle);
        double arrow1Y = endY - arrowLength * Math.sin(angleRad - arrowAngle);
        double arrow2X = endX - arrowLength * Math.cos(angleRad + arrowAngle);
        double arrow2Y = endY - arrowLength * Math.sin(angleRad + arrowAngle);
        
        g2d.setStroke(new BasicStroke(2));
        g2d.drawLine((int)endX, (int)endY, (int)arrow1X, (int)arrow1Y);
        g2d.drawLine((int)endX, (int)endY, (int)arrow2X, (int)arrow2Y);
    }
    
    public void renderPowerMeter(Graphics2D g2d, double launchPower, double maxPower) {
        // Power meter extends ABOVE and BEYOND the launch tube to show full power range
        double meterHeight = height * 1.8; // Much taller - extends way beyond tube
        double meterWidth = 30; // Wider for better visibility
        double meterX = x + width/2 - meterWidth/2;
        double meterY = y + height - 20; // Start from bottom of tube, extend upward
        
        // Draw power meter background (empty tube)
        g2d.setColor(new Color(50, 50, 50, 150)); // Dark background
        g2d.fillRect((int)meterX, (int)(meterY - meterHeight), (int)meterWidth, (int)meterHeight);
        
        // Draw power meter border with glow effect
        g2d.setColor(new Color(0, 255, 255, 100)); // Cyan glow
        g2d.setStroke(new BasicStroke(4));
        g2d.drawRect((int)meterX - 1, (int)(meterY - meterHeight) - 1, (int)meterWidth + 2, (int)meterHeight + 2);
        
        g2d.setColor(new Color(0, 255, 255)); // Bright cyan border
        g2d.setStroke(new BasicStroke(2));
        g2d.drawRect((int)meterX, (int)(meterY - meterHeight), (int)meterWidth, (int)meterHeight);
        
        // Only draw power fill if there's actual power
        if (launchPower > 0) {
            double powerHeight = (launchPower / maxPower) * meterHeight;
            double powerRatio = launchPower / maxPower;
            
            // Color progression: Red → Yellow → Green with safe color bounds
            Color powerColor;
            if (powerRatio <= 0.5) {
                // Red to Yellow (0% to 50%)
                float ratio = Math.max(0, Math.min(1, (float)(powerRatio * 2))); // Clamp to 0-1
                int green = Math.max(0, Math.min(255, (int)(255 * ratio)));
                powerColor = new Color(255, green, 0); // Red to Yellow
            } else {
                // Yellow to Green (50% to 100%)
                float ratio = Math.max(0, Math.min(1, (float)((powerRatio - 0.5) * 2))); // Clamp to 0-1
                int red = Math.max(0, Math.min(255, (int)(255 * (1 - ratio))));
                powerColor = new Color(red, 255, 0); // Yellow to Green
            }
            
            // Draw power fill with gradient effect using safe color division
            int gradRed = Math.max(0, Math.min(255, powerColor.getRed()/2));
            int gradGreen = Math.max(0, Math.min(255, powerColor.getGreen()/2));
            int gradBlue = Math.max(0, Math.min(255, powerColor.getBlue()/2));
            
            GradientPaint gradient = new GradientPaint(
                (float)meterX, (float)meterY,
                powerColor,
                (float)(meterX + meterWidth), (float)meterY,
                new Color(gradRed, gradGreen, gradBlue)
            );
            g2d.setPaint(gradient);
            
            // Fill from bottom up with enhanced visibility
            g2d.fillRect((int)(meterX + 2), (int)(meterY - powerHeight), (int)(meterWidth - 4), (int)powerHeight);
            
            // Add bright highlight for 3D effect
            g2d.setColor(new Color(255, 255, 255, 200));
            g2d.fillRect((int)(meterX + 3), (int)(meterY - powerHeight), 4, (int)powerHeight);
            
            // Add outer glow effect for the power fill
            g2d.setColor(new Color(powerColor.getRed(), powerColor.getGreen(), powerColor.getBlue(), 80));
            g2d.fillRect((int)(meterX - 1), (int)(meterY - powerHeight), (int)(meterWidth + 2), (int)powerHeight);
            
            // Add pulsing effect at high power (more intense)
            if (powerRatio > 0.7) {
                double pulse = Math.abs(Math.sin(System.currentTimeMillis() * 0.008));
                int pulseAlpha = (int)(150 * pulse);
                g2d.setColor(new Color(255, 255, 255, pulseAlpha));
                g2d.fillRect((int)(meterX + 2), (int)(meterY - powerHeight), (int)(meterWidth - 4), (int)powerHeight);
            }
        }
        
        // Add power level markers on the meter
        g2d.setStroke(new BasicStroke(1));
        g2d.setColor(new Color(255, 255, 255, 100));
        
        // Draw quarter markers
        for (int i = 1; i < 4; i++) {
            int markerY = (int)(meterY - (meterHeight * i / 4));
            g2d.drawLine((int)meterX, markerY, (int)(meterX + meterWidth), markerY);
        }
    }
    
    public void renderSpring(Graphics2D g2d, double launchPower, double maxPower) {
        // Spring dimensions
        double springWidth = width * 0.6;
        double springHeight = 40; // Base spring height
        double springX = x + (width - springWidth) / 2;
        double springY = y + height - 20; // Bottom of tube
        
        // Compress spring based on power (more power = more compression)
        double compressionRatio = launchPower / maxPower;
        double compressedHeight = springHeight * (1 - compressionRatio * 0.7); // Max 70% compression
        
        // Spring coil count and spacing
        int coilCount = 8;
        double coilSpacing = compressedHeight / coilCount;
        
        // Draw spring coils
        g2d.setColor(new Color(200, 200, 200)); // Silver spring color
        g2d.setStroke(new BasicStroke(3));
        
        for (int i = 0; i < coilCount; i++) {
            double coilY = springY - (i * coilSpacing);
            double coilOffset = (i % 2 == 0) ? 0 : springWidth * 0.3; // Alternating coil pattern
            
            // Draw coil as an oval
            g2d.drawOval((int)(springX + coilOffset), (int)(coilY - 3), 
                        (int)(springWidth - coilOffset), 6);
        }
        
        // Draw spring ends (top and bottom plates)
        g2d.setColor(new Color(150, 150, 150)); // Darker gray for plates
        g2d.setStroke(new BasicStroke(4));
        
        // Bottom plate (fixed)
        g2d.drawLine((int)springX, (int)springY, (int)(springX + springWidth), (int)springY);
        
        // Top plate (moves with compression)
        double topPlateY = springY - compressedHeight;
        g2d.drawLine((int)springX, (int)topPlateY, (int)(springX + springWidth), (int)topPlateY);
        
        // Add spring highlight for 3D effect
        g2d.setColor(new Color(255, 255, 255, 100));
        g2d.setStroke(new BasicStroke(1));
        for (int i = 0; i < coilCount; i += 2) {
            double coilY = springY - (i * coilSpacing);
            g2d.drawOval((int)(springX + 2), (int)(coilY - 2), 
                        (int)(springWidth * 0.7), 4);
        }
    }
}
