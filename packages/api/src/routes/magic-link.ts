/**
 * Magic Link Authentication Routes
 *
 * Handles passwordless authentication via magic links sent to email
 */

import { Router, Request, Response, NextFunction } from 'express';
import { MagicLinkService } from '../services/magic-link.service';
import { EmailService } from '../services/email.service';
import { AuthService } from '../services/auth.service';
import { PrismaClient } from '../generated/client';
import { ValidationError, AuthenticationError } from '@prompt-lab/shared';

const router: Router = Router();
const prisma = new PrismaClient();

// Simple in-memory rate limiter for magic links
// Map<email, timestamp[]>
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW_MS = 60 * 60 * 1000; // 1 hour
const RATE_LIMIT_MAX_REQUESTS = 3;

/**
 * Simple rate limiter middleware for magic links
 */
function magicLinkRateLimiter(req: Request, res: Response, next: NextFunction) {
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
      message: `You can only request ${RATE_LIMIT_MAX_REQUESTS} magic links per hour. Please try again in ${Math.ceil(retryAfterSeconds / 60)} minutes.`,
      retryAfter: retryAfterSeconds,
    });
  }

  // Add current timestamp
  recentTimestamps.push(now);
  rateLimitMap.set(email, recentTimestamps);

  next();
}

/**
 * POST /api/auth/magic-link/send
 * Send magic link to user's email
 */
router.post('/send', magicLinkRateLimiter, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email } = req.body;

    // Validate email presence
    if (!email) {
      throw new ValidationError('Email is required');
    }

    // Validate email format
    if (!MagicLinkService.validateEmail(email)) {
      throw new ValidationError('Invalid email format');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Generate magic link with JWT token
    const magicLink = await MagicLinkService.generateMagicLink(normalizedEmail);
    const expiryMinutes = MagicLinkService.getExpiryMinutes();

    // Send email via Resend
    try {
      await EmailService.sendMagicLink(normalizedEmail, magicLink, expiryMinutes);

      console.log(`✅ Magic link sent to: ${normalizedEmail}`);

      res.json({
        success: true,
        message: `Magic link sent to ${normalizedEmail}`,
        expiresInMinutes: expiryMinutes,
      });
    } catch (emailError: any) {
      console.error('Failed to send magic link email:', emailError);

      // FOR DEVELOPMENT: Return magic link in response if email fails
      // REMOVE THIS IN PRODUCTION!
      if (process.env.NODE_ENV === 'development') {
        console.warn('⚠️  DEV MODE: Returning magic link directly (email service unavailable)');
        return res.json({
          success: true,
          message: `Development mode: Email service unavailable. Use link below.`,
          expiresInMinutes: expiryMinutes,
          devMagicLink: magicLink, // Only in dev mode
        });
      }

      throw new Error('Failed to send magic link. Please try again later.');
    }
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/auth/magic-link/verify?token=xxx&email=xxx
 * Verify magic link and create user session
 */
router.get('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, email } = req.query;

    // Validate parameters
    if (!token || typeof token !== 'string') {
      throw new ValidationError('Token is required');
    }

    if (!email || typeof email !== 'string') {
      throw new ValidationError('Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!MagicLinkService.validateEmail(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }

    // Verify magic link token
    const isValid = await MagicLinkService.verifyMagicLink(token, normalizedEmail);

    if (!isValid) {
      // Try to decode token for better error message
      const decoded = MagicLinkService.decodeMagicLink(token);

      if (decoded) {
        // Check if expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
          throw new AuthenticationError('Magic link has expired. Please request a new one.');
        }

        // Email mismatch
        if (decoded.email !== normalizedEmail) {
          throw new AuthenticationError('Invalid email address for this magic link.');
        }
      }

      throw new AuthenticationError('Invalid or expired magic link.');
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Auto-registration: Create user if doesn't exist
    if (!user) {
      console.log(`🆕 Auto-registering new user: ${normalizedEmail}`);

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0], // Use email prefix as default name
          passwordHash: null, // No password for magic link users
        },
      });
    }

    // Generate auth JWT token using AuthService
    const authToken = AuthService['generateToken'](user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log(`✅ User authenticated via magic link: ${normalizedEmail}`);

    res.json({
      success: true,
      data: {
        token: authToken,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
          avatar: user.avatar || undefined,
        },
      },
      message: 'Authentication successful',
    });
  } catch (error) {
    next(error);
  }
});

/**
 * POST /api/auth/magic-link/verify
 * Alternative verify endpoint for POST requests (for better security)
 */
router.post('/verify', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { token, email } = req.body;

    // Validate parameters
    if (!token) {
      throw new ValidationError('Token is required');
    }

    if (!email) {
      throw new ValidationError('Email is required');
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Validate email format
    if (!MagicLinkService.validateEmail(normalizedEmail)) {
      throw new ValidationError('Invalid email format');
    }

    // Verify magic link token
    const isValid = await MagicLinkService.verifyMagicLink(token, normalizedEmail);

    if (!isValid) {
      // Try to decode token for better error message
      const decoded = MagicLinkService.decodeMagicLink(token);

      if (decoded) {
        // Check if expired
        const now = Math.floor(Date.now() / 1000);
        if (decoded.exp && decoded.exp < now) {
          throw new AuthenticationError('Magic link has expired. Please request a new one.');
        }

        // Email mismatch
        if (decoded.email !== normalizedEmail) {
          throw new AuthenticationError('Invalid email address for this magic link.');
        }
      }

      throw new AuthenticationError('Invalid or expired magic link.');
    }

    // Check if user exists
    let user = await prisma.user.findUnique({
      where: { email: normalizedEmail },
    });

    // Auto-registration: Create user if doesn't exist
    if (!user) {
      console.log(`🆕 Auto-registering new user: ${normalizedEmail}`);

      user = await prisma.user.create({
        data: {
          email: normalizedEmail,
          name: normalizedEmail.split('@')[0], // Use email prefix as default name
          passwordHash: null, // No password for magic link users
        },
      });
    }

    // Generate auth JWT token using AuthService
    const authToken = AuthService['generateToken'](user);
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    console.log(`✅ User authenticated via magic link: ${normalizedEmail}`);

    res.json({
      success: true,
      data: {
        token: authToken,
        expiresAt,
        user: {
          id: user.id,
          email: user.email,
          name: user.name || '',
          avatar: user.avatar || undefined,
        },
      },
      message: 'Authentication successful',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
