/**
 * Auth Routes Integration Tests
 * 
 * Tests authentication API endpoints including registration, login,
 * token verification, and password management.
 */

import { jest, describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import request from 'supertest';
import { Express } from 'express';
import { createTestApp } from '@tests/helpers/app';
import { mockPrismaClient } from '@tests/setup';
import { userFactory } from '@tests/fixtures';
import { TEST_PASSWORDS, TEST_HASHED_PASSWORDS } from '@tests/constants/test-credentials';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';

describe('Auth Routes', () => {
  let app: Express;

  beforeEach(async () => {
    app = await createTestApp();
    jest.clearAllMocks();
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        email: 'test@example.com',
        password: TEST_PASSWORDS.VALID_TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User'
      };

      const createdUser = userFactory.create(userData);
      mockPrismaClient.user.create.mockResolvedValue(createdUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: createdUser.id,
            email: createdUser.email,
            firstName: createdUser.firstName,
            lastName: createdUser.lastName
          },
          token: expect.any(String)
        }
      });

      // Verify password is not returned
      expect(response.body.data.user.password).toBeUndefined();
      expect(response.body.data.user.hashedPassword).toBeUndefined();
    });

    it('should return validation error for invalid email', async () => {
      const userData = {
        email: 'invalid-email',
        password: TEST_PASSWORDS.VALID_TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('email')
      });
    });

    it('should return validation error for weak password', async () => {
      const userData = {
        email: 'test@example.com',
        password: '123', // Too short
        firstName: 'Test',
        lastName: 'User'
      };

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('password')
      });
    });

    it('should return error for duplicate email', async () => {
      const userData = {
        email: 'existing@example.com',
        password: TEST_PASSWORDS.VALID_TEST_PASSWORD,
        firstName: 'Test',
        lastName: 'User'
      };

      mockPrismaClient.user.create.mockRejectedValue(
        new Error('Unique constraint failed on the fields: (`email`)')
      );

      const response = await request(app)
        .post('/api/auth/register')
        .send(userData)
        .expect(409);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Email already exists'
      });
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login successfully with valid credentials', async () => {
      const user = userFactory.create();
      const password = TEST_PASSWORDS.VALID_TEST_PASSWORD;

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          },
          token: expect.any(String)
        }
      });
    });

    it('should return error for invalid email', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: TEST_PASSWORDS.VALID_TEST_PASSWORD
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should return error for invalid password', async () => {
      const user = userFactory.create();

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: user.email,
          password: 'wrong-password'
        })
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid credentials'
      });
    });

    it('should return validation error for missing fields', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'test@example.com'
          // missing password
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: expect.stringContaining('password')
      });
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return user profile with valid token', async () => {
      const user = userFactory.create();
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        data: {
          user: {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
            lastName: user.lastName
          }
        }
      });
    });

    it('should return error for missing token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'No token provided'
      });
    });

    it('should return error for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Invalid token'
      });
    });

    it('should return error for expired token', async () => {
      const user = userFactory.create();
      const expiredToken = jwt.sign(
        { userId: user.id }, 
        process.env.JWT_SECRET!,
        { expiresIn: '-1h' } // Expired 1 hour ago
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`)
        .expect(401);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Token expired'
      });
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should change password successfully', async () => {
      const user = userFactory.create();
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);
      const currentPassword = TEST_PASSWORDS.OLD_TEST_PASSWORD;
      const newPassword = TEST_PASSWORDS.NEW_TEST_PASSWORD;

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(true as never);
      jest.spyOn(bcrypt, 'hash').mockResolvedValue(TEST_HASHED_PASSWORDS.NEW_HASH as never);
      mockPrismaClient.user.update.mockResolvedValue({
        ...user,
        hashedPassword: TEST_HASHED_PASSWORDS.NEW_HASH
      });

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword,
          newPassword
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password changed successfully'
      });
    });

    it('should return error for incorrect current password', async () => {
      const user = userFactory.create();
      const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET!);

      mockPrismaClient.user.findUnique.mockResolvedValue(user);
      jest.spyOn(bcrypt, 'compare').mockResolvedValue(false as never);

      const response = await request(app)
        .post('/api/auth/change-password')
        .set('Authorization', `Bearer ${token}`)
        .send({
          currentPassword: 'wrong-password',
          newPassword: 'new-password'
        })
        .expect(400);

      expect(response.body).toMatchObject({
        success: false,
        error: 'Current password is incorrect'
      });
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should generate password reset token for valid email', async () => {
      const user = userFactory.create();

      mockPrismaClient.user.findUnique.mockResolvedValue(user);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: user.email
        })
        .expect(200);

      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset token sent to email'
      });
    });

    it('should return success even for non-existent email (security)', async () => {
      mockPrismaClient.user.findUnique.mockResolvedValue(null);

      const response = await request(app)
        .post('/api/auth/forgot-password')
        .send({
          email: 'nonexistent@example.com'
        })
        .expect(200);

      // Should return success to prevent email enumeration
      expect(response.body).toMatchObject({
        success: true,
        message: 'Password reset token sent to email'
      });
    });
  });
});