/**
 * Magic Link Service - JWT-Based Authentication
 *
 * Handles magic link generation and verification using JWT tokens
 * No database storage needed - stateless authentication
 */

import crypto from 'crypto';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const APP_URL = process.env.APP_URL || 'http://localhost:4001';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4173';
const MAGIC_LINK_EXPIRY_MINUTES = 15;

export interface MagicLinkPayload {
  email: string;
  token: string;
  type: 'magic-link';
  iat?: number;
  exp?: number;
}

export class MagicLinkService {
  /**
   * Generate a secure magic link with JWT token
   */
  static async generateMagicLink(email: string): Promise<string> {
    // Generate secure random token
    const randomToken = crypto.randomBytes(32).toString('hex');

    // Create JWT payload
    const payload: Omit<MagicLinkPayload, 'iat' | 'exp'> = {
      email: email.toLowerCase().trim(),
      token: randomToken,
      type: 'magic-link',
    };

    // Sign JWT with expiration
    const jwtToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${MAGIC_LINK_EXPIRY_MINUTES}m`,
      issuer: 'prompt-testing-lab',
      audience: 'magic-link-auth',
    });

    // Construct magic link URL
    const magicLink = `${FRONTEND_URL}/verify?token=${encodeURIComponent(jwtToken)}&email=${encodeURIComponent(email)}`;

    return magicLink;
  }

  /**
   * Verify magic link token
   */
  static async verifyMagicLink(token: string, email: string): Promise<boolean> {
    try {
      // Verify and decode JWT
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'prompt-testing-lab',
        audience: 'magic-link-auth',
      }) as MagicLinkPayload;

      // Verify email matches
      const normalizedEmail = email.toLowerCase().trim();
      if (decoded.email !== normalizedEmail) {
        console.warn(`Email mismatch: ${decoded.email} !== ${normalizedEmail}`);
        return false;
      }

      // Verify type
      if (decoded.type !== 'magic-link') {
        console.warn(`Invalid token type: ${decoded.type}`);
        return false;
      }

      // Token is valid
      return true;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        console.warn('Magic link token expired');
      } else if (error.name === 'JsonWebTokenError') {
        console.warn('Invalid magic link token:', error.message);
      } else {
        console.error('Magic link verification error:', error);
      }
      return false;
    }
  }

  /**
   * Decode magic link token (without verification - for error messages)
   */
  static decodeMagicLink(token: string): MagicLinkPayload | null {
    try {
      const decoded = jwt.decode(token) as MagicLinkPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get expiry time in minutes
   */
  static getExpiryMinutes(): number {
    return MAGIC_LINK_EXPIRY_MINUTES;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default MagicLinkService;
