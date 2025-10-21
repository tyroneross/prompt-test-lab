/**
 * Email Service - Resend Integration
 *
 * Handles sending transactional emails using Resend API
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  from?: string;
}

export class EmailService {
  private static fromAddress = process.env.RESEND_FROM_ADDRESS || 'onboarding@resend.dev';

  /**
   * Send an email using Resend
   */
  static async sendEmail(options: SendEmailOptions): Promise<{ id: string }> {
    try {
      const { data, error } = await resend.emails.send({
        from: options.from || this.fromAddress,
        to: options.to,
        subject: options.subject,
        html: options.html,
        text: options.text,
      });

      if (error) {
        console.error('Resend email error:', error);
        throw new Error(`Failed to send email: ${error.message}`);
      }

      if (!data?.id) {
        throw new Error('Failed to send email: No ID returned');
      }

      console.log(`✉️  Email sent successfully: ${data.id} to ${options.to}`);
      return { id: data.id };
    } catch (error: any) {
      console.error('Email service error:', error);
      throw new Error(`Email delivery failed: ${error.message}`);
    }
  }

  /**
   * Send magic link email
   */
  static async sendMagicLink(to: string, magicLink: string, expiresInMinutes: number = 15): Promise<{ id: string }> {
    const html = this.getMagicLinkEmailHTML(magicLink, expiresInMinutes);
    const text = this.getMagicLinkEmailText(magicLink, expiresInMinutes);

    return this.sendEmail({
      to,
      subject: 'Sign in to Prompt Testing Lab',
      html,
      text,
    });
  }

  /**
   * Generate magic link email HTML
   */
  private static getMagicLinkEmailHTML(magicLink: string, expiresInMinutes: number): string {
    return `
      <!DOCTYPE html>
      <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Sign in to Prompt Testing Lab</title>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #374151;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 32px;
              box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 32px;
            }
            .logo {
              font-size: 24px;
              font-weight: 700;
              color: #2563eb;
              margin-bottom: 8px;
            }
            .title {
              font-size: 20px;
              font-weight: 600;
              color: #111827;
              margin: 0 0 16px 0;
            }
            .message {
              font-size: 16px;
              color: #6b7280;
              margin-bottom: 24px;
            }
            .button-container {
              text-align: center;
              margin: 32px 0;
            }
            .button {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff !important;
              text-decoration: none;
              padding: 12px 32px;
              border-radius: 6px;
              font-weight: 500;
              font-size: 16px;
            }
            .button:hover {
              background-color: #1d4ed8;
            }
            .alternative {
              margin-top: 24px;
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              color: #6b7280;
            }
            .link {
              word-break: break-all;
              color: #2563eb;
              text-decoration: none;
            }
            .footer {
              margin-top: 32px;
              padding-top: 24px;
              border-top: 1px solid #e5e7eb;
              font-size: 14px;
              color: #9ca3af;
              text-align: center;
            }
            .warning {
              margin-top: 24px;
              padding: 12px;
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              border-radius: 4px;
              font-size: 14px;
              color: #92400e;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <div class="logo">🧪 Prompt Testing Lab</div>
            </div>

            <h1 class="title">Sign in to your account</h1>

            <p class="message">
              Click the button below to securely sign in to your Prompt Testing Lab account. This link will expire in ${expiresInMinutes} minutes.
            </p>

            <div class="button-container">
              <a href="${magicLink}" class="button">Sign in to Prompt Testing Lab</a>
            </div>

            <div class="alternative">
              <p><strong>Button not working?</strong> Copy and paste this link into your browser:</p>
              <p><a href="${magicLink}" class="link">${magicLink}</a></p>
            </div>

            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't request this email, you can safely ignore it. The link will expire in ${expiresInMinutes} minutes.
            </div>

            <div class="footer">
              <p>This email was sent to verify your identity for Prompt Testing Lab.</p>
              <p>© ${new Date().getFullYear()} Prompt Testing Lab. All rights reserved.</p>
            </div>
          </div>
        </body>
      </html>
    `;
  }

  /**
   * Generate magic link email plain text
   */
  private static getMagicLinkEmailText(magicLink: string, expiresInMinutes: number): string {
    return `
Sign in to Prompt Testing Lab

Click the link below to sign in to your account:

${magicLink}

This link will expire in ${expiresInMinutes} minutes.

If you didn't request this email, you can safely ignore it.

---
© ${new Date().getFullYear()} Prompt Testing Lab
    `.trim();
  }

  /**
   * Test email configuration
   */
  static async testConnection(): Promise<boolean> {
    try {
      if (!process.env.RESEND_API_KEY) {
        throw new Error('RESEND_API_KEY not configured');
      }
      console.log('✅ Email service configured successfully');
      return true;
    } catch (error: any) {
      console.error('❌ Email service configuration error:', error.message);
      return false;
    }
  }
}

export default EmailService;
