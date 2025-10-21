/**
 * Password Reset Service - JWT-Based Token Management
 *
 * Handles password reset token generation and verification using JWT
 * Similar pattern to magic link authentication
 */

import * as crypto from 'crypto';
import * as jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:4173';
const PASSWORD_RESET_EXPIRY_MINUTES = 30;

export interface PasswordResetPayload {
  email: string;
  token: string;
  type: 'password-reset';
  iat?: number;
  exp?: number;
}

export class PasswordResetService {
  /**
   * Generate a secure password reset token with JWT
   */
  static async generateResetToken(email: string): Promise<string> {
    // Generate secure random token
    const randomToken = crypto.randomBytes(32).toString('hex');

    // Create JWT payload
    const payload: Omit<PasswordResetPayload, 'iat' | 'exp'> = {
      email: email.toLowerCase().trim(),
      token: randomToken,
      type: 'password-reset',
    };

    // Sign JWT with expiration
    const jwtToken = jwt.sign(payload, JWT_SECRET, {
      expiresIn: `${PASSWORD_RESET_EXPIRY_MINUTES}m`,
      issuer: 'prompt-testing-lab',
      audience: 'password-reset',
    });

    return jwtToken;
  }

  /**
   * Generate password reset link
   */
  static async generateResetLink(email: string): Promise<string> {
    const token = await this.generateResetToken(email);
    const resetLink = `${FRONTEND_URL}/reset-password?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
    return resetLink;
  }

  /**
   * Verify password reset token
   */
  static async verifyResetToken(token: string, email: string): Promise<boolean> {
    try {
      // Verify and decode JWT
      const decoded = jwt.verify(token, JWT_SECRET, {
        issuer: 'prompt-testing-lab',
        audience: 'password-reset',
      }) as PasswordResetPayload;

      // Verify email matches
      const normalizedEmail = email.toLowerCase().trim();
      if (decoded.email !== normalizedEmail) {
        console.warn(`Email mismatch: ${decoded.email} !== ${normalizedEmail}`);
        return false;
      }

      // Verify type
      if (decoded.type !== 'password-reset') {
        console.warn(`Invalid token type: ${decoded.type}`);
        return false;
      }

      // Token is valid
      return true;
    } catch (error: any) {
      if (error.name === 'TokenExpiredError') {
        console.warn('Password reset token expired');
      } else if (error.name === 'JsonWebTokenError') {
        console.warn('Invalid password reset token:', error.message);
      } else {
        console.error('Password reset verification error:', error);
      }
      return false;
    }
  }

  /**
   * Decode password reset token (without verification - for error messages)
   */
  static decodeResetToken(token: string): PasswordResetPayload | null {
    try {
      const decoded = jwt.decode(token) as PasswordResetPayload;
      return decoded;
    } catch (error) {
      return null;
    }
  }

  /**
   * Get expiry time in minutes
   */
  static getExpiryMinutes(): number {
    return PASSWORD_RESET_EXPIRY_MINUTES;
  }

  /**
   * Validate email format
   */
  static validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }
}

export default PasswordResetService;
