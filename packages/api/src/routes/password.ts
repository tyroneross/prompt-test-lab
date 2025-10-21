/**
 * Password Management Routes
 *
 * Handles password changes and password reset functionality
 */

import { Router, Request, Response, NextFunction } from 'express';
import { authMiddleware } from '../middleware/auth';
import { AuthService } from '../services/auth.service';
import { PasswordResetService } from '../services/password-reset.service';
import { EmailService } from '../services/email.service';
import { PrismaClient } from '../generated/client';
import { ValidationError, AuthenticationError } from '@prompt-lab/shared';
import * as bcrypt from 'bcrypt';

const router: Router = Router();
const prisma = new PrismaClient();

// Simple in-memory rate limiter for password reset
// Map<email, timestamp[]>
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3;

/**
 * Simple rate limiter middleware for password reset requests
 */
function passwordResetRateLimiter(req: Request, res: Response, next: NextFunction) {
  const email = req.body.email?.toLowerCase().trim();

  if (!email) {
    return next();
  }

  const now = Date.now();
  const timestamps = rateLimitMap.get(email) || [];

  // Remove old timestamps outside the window
  const recentTimestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS);

  // Check if rate limit exceeded
  if (recentTimestamps.length >= RATE_LIMIT_MAX_REQUESTS) {
    const oldestTimestamp = recentTimestamps[0];
    const retryAfterMs = RATE_LIMIT_WINDOW_MS - (now - oldestTimestamp);
    const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);

    return res.status(429).json({
      success: false,
      error: 'Too many requests',
      message: `You can only request ${RATE_LIMIT_MAX_REQUESTS} password resets per hour. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      retryAfter: retryAfterSeconds,
    });
  }

  // Add current timestamp
  recentTimestamps.push(now);
  rateLimitMap.set(email, recentTimestamps);

  next();
}

/**
 * POST /auth/change-password
 * Change password for authenticated user
 */
router.post('/change-password', authMiddleware, async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      throw new AuthenticationError('User not authenticated');
    }

    const { currentPassword, newPassword } = req.body;

    // Validate input
    if (!currentPassword) {
      throw new ValidationError('Current password is required');
    }

    if (!newPassword) {
      throw new ValidationError('New password is required');
    }

    if (currentPassword === newPassword) {
      throw new ValidationError('New password must be different from current password');
    }

    // Get user from database
    const user = await prisma.user.findUnique({
      where: { id: req.user.sub },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Change password using AuthService
    await AuthService.changePassword(req.user.sub, currentPassword, newPassword);

    // Send confirmation email
    try {
      await EmailService.sendPasswordChangeConfirmation(user.email);
      console.log(`Password change confirmation email sent to: ${user.email}`);
    } catch (emailError: any) {
      console.error('Failed to send password change confirmation email:', emailError);
      // Don't fail the request if email fails - password was already changed
    }

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/reset-password
 * Request password reset - sends reset link via email
 */
router.post('/reset-password', passwordResetRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    // Validate email presence
    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Validate email format
    if (!PasswordResetService.validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // For security, don't reveal whether email exists
    // Always return success but only send email if user exists
    if (user) {
      // Generate reset link with JWT token
      const resetLink = await PasswordResetService.generateResetLink(normalizedEmail);
      const expiryMinutes = PasswordResetService.getExpiryMinutes();

      // Send email via Resend
      try {
        await EmailService.sendPasswordReset(normalizedEmail, resetLink, expiryMinutes);
        console.log(`Password reset email sent to: ${normalizedEmail}`);
      } catch (emailError: any) {
        console.error('Failed to send password reset email:', emailError);

        // FOR DEVELOPMENT: Return reset link in response if email fails
        // REMOVE THIS IN PRODUCTION!
        if (process.env.NODE_ENV === 'development') {
          console.warn('⚠️  DEV MODE: Returning reset link directly (email service unavailable)');
          return res.json({
            success: true,
            message: `Development mode: Email service unavailable. Use link below.`,
            expiresInMinutes: expiryMinutes,
            devResetLink: resetLink, // Only in dev mode
          });
        }

        throw new Error('Failed to send password reset email. Please try again later.');
      }
    } else {
      console.log(`Password reset requested for non-existent email: ${normalizedEmail}`);
    }

    // Always return success for security (don't reveal if email exists)
    res.json({
      success: true,
      message: `If an account exists with ${normalizedEmail}, you will receive a password reset email shortly.`,
      expiresInMinutes: PasswordResetService.getExpiryMinutes(),
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /auth/reset-password/confirm
 * Complete password reset with token
 */
router.post('/reset-password/confirm', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, newPassword, email } = req.body;

    // Validate parameters
    if (!token) {
      throw new ValidationError('Reset token is required');
    }

    if (!email) {
      throw new ValidationError('Email is required');
    }

    if (!newPassword) {
      throw new ValidationError('New password is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!PasswordResetService.validateEmail(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }

    // Verify reset token
    const isValid = await PasswordResetService.verifyResetToken(token, normalizedEmail);

    if (!isValid) {
      // Try to decode token for better error message
      const decoded = PasswordResetService.decodeResetToken(token);

      if (decoded) {
        // Check if expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
          throw new AuthenticationError('Password reset link has expired. Please request a new one.');
        }

        // Email mismatch
        if (decoded.email !== normalizedEmail) {
          throw new AuthenticationError('Invalid email address for this reset link.');
        }
      }

      throw new AuthenticationError('Invalid or expired password reset link.');
    }

    // Find user
    const user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    if (!user) {
      throw new AuthenticationError('User not found');
    }

    // Validate new password (using same validation as registration)
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;
    if (newPassword.length < 8) {
      throw new ValidationError('Password must be at least 8 characters long');
    }
    if (!passwordRegex.test(newPassword)) {
      throw new ValidationError('Password must contain at least one lowercase letter, one uppercase letter, and one number');
    }

    // Hash new password
    const SALT_ROUNDS = 12;
    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);

    // Update password in database
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    });

    console.log(`Password reset completed for: ${normalizedEmail}`);

    // Send confirmation email
    try {
      await EmailService.sendPasswordChangeConfirmation(normalizedEmail);
      console.log(`Password reset confirmation email sent to: ${normalizedEmail}`);
    } catch (emailError: any) {
      console.error('Failed to send password reset confirmation email:', emailError);
      // Don't fail the request if email fails - password was already reset
    }

    res.json({
      success: true,
      message: 'Password reset successfully. You can now sign in with your new password.',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
