import { WebSocketServer, WebSocket } from 'ws';
import { Server } from 'http';
import jwt from 'jsonwebtoken';
import { AuthToken } from './auth.service';

interface AuthenticatedWebSocket extends WebSocket {
  user?: AuthToken;
  subscriptions?: Set<string>;
}

interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: number;
}

export class WebSocketService {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, AuthenticatedWebSocket> = new Map();

  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocketServer({ server, path: '/ws' });
    
    this.wss.on('connection', (ws: AuthenticatedWebSocket, request) => {
      this.handleConnection(ws, request);
    });

    console.log('WebSocket server initialized');
  }

  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: AuthenticatedWebSocket, request: any): void {
    ws.subscriptions = new Set();

    // Handle authentication
    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleMessage(ws, message);
      } catch (error) {
        this.sendError(ws, 'Invalid message format');
      }
    });

    ws.on('close', () => {
      if (ws.user) {
        this.clients.delete(ws.user.sub);
      }
    });

    ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Send welcome message
    this.sendMessage(ws, {
      type: 'connected',
      data: { message: 'Connected to Prompt Testing Lab WebSocket' },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle incoming WebSocket messages
   */
  private handleMessage(ws: AuthenticatedWebSocket, message: any): void {
    switch (message.type) {
      case 'authenticate':
        this.handleAuthentication(ws, message.data);
        break;
      
      case 'subscribe':
        this.handleSubscription(ws, message.data);
        break;
      
      case 'unsubscribe':
        this.handleUnsubscription(ws, message.data);
        break;
      
      case 'ping':
        this.sendMessage(ws, {
          type: 'pong',
          data: { timestamp: message.data?.timestamp },
          timestamp: Date.now(),
        });
        break;
      
      default:
        this.sendError(ws, `Unknown message type: ${message.type}`);
    }
  }

  /**
   * Handle WebSocket authentication
   */
  private handleAuthentication(ws: AuthenticatedWebSocket, data: any): void {
    try {
      const { token } = data;
      
      if (!token) {
        this.sendError(ws, 'Token required for authentication');
        return;
      }

      const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-here';
      const decoded = jwt.verify(token, JWT_SECRET) as AuthToken;
      
      ws.user = decoded;
      this.clients.set(decoded.sub, ws);
      
      this.sendMessage(ws, {
        type: 'authenticated',
        data: {
          userId: decoded.sub,
          email: decoded.email,
          name: decoded.name,
        },
        timestamp: Date.now(),
      });

    } catch (error) {
      this.sendError(ws, 'Invalid authentication token');
    }
  }

  /**
   * Handle subscription to channels
   */
  private handleSubscription(ws: AuthenticatedWebSocket, data: any): void {
    if (!ws.user) {
      this.sendError(ws, 'Authentication required');
      return;
    }

    const { channels } = data;
    
    if (!Array.isArray(channels)) {
      this.sendError(ws, 'Channels must be an array');
      return;
    }

    for (const channel of channels) {
      if (this.canSubscribeToChannel(ws.user, channel)) {
        ws.subscriptions?.add(channel);
      }
    }

    this.sendMessage(ws, {
      type: 'subscribed',
      data: {
        channels: Array.from(ws.subscriptions || []),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Handle unsubscription from channels
   */
  private handleUnsubscription(ws: AuthenticatedWebSocket, data: any): void {
    const { channels } = data;
    
    if (!Array.isArray(channels)) {
      this.sendError(ws, 'Channels must be an array');
      return;
    }

    for (const channel of channels) {
      ws.subscriptions?.delete(channel);
    }

    this.sendMessage(ws, {
      type: 'unsubscribed',
      data: {
        channels: Array.from(ws.subscriptions || []),
      },
      timestamp: Date.now(),
    });
  }

  /**
   * Check if user can subscribe to a channel
   */
  private canSubscribeToChannel(user: AuthToken, channel: string): boolean {
    // Channel format: type:resource_id
    // Examples: test_run:123, project:456, user:789
    
    const [type, resourceId] = channel.split(':');
    
    switch (type) {
      case 'user':
        // Users can only subscribe to their own user channel
        return resourceId === user.sub;
      
      case 'test_run':
        // In a real app, you'd check if the user has access to this test run
        // For now, allow all authenticated users
        return true;
      
      case 'project':
        // In a real app, you'd check if the user is a member of this project
        // For now, allow all authenticated users
        return true;
      
      default:
        return false;
    }
  }

  /**
   * Send message to WebSocket
   */
  private sendMessage(ws: WebSocket, message: WebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  /**
   * Send error message to WebSocket
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      data: { error },
      timestamp: Date.now(),
    });
  }

  /**
   * Broadcast test run progress update
   */
  broadcastTestProgress(testRunId: string, progress: any): void {
    const channel = `test_run:${testRunId}`;
    const message: WebSocketMessage = {
      type: 'test_progress',
      data: {
        testRunId,
        ...progress,
      },
      timestamp: Date.now(),
    };

    this.broadcastToChannel(channel, message);
  }

  /**
   * Broadcast test run status change
   */
  broadcastTestStatusChange(testRunId: string, status: string, metadata?: any): void {
    const channel = `test_run:${testRunId}`;
    const message: WebSocketMessage = {
      type: 'test_status',
      data: {
        testRunId,
        status,
        metadata,
      },
      timestamp: Date.now(),
    };

    this.broadcastToChannel(channel, message);
  }

  /**
   * Broadcast project update
   */
  broadcastProjectUpdate(projectId: string, update: any): void {
    const channel = `project:${projectId}`;
    const message: WebSocketMessage = {
      type: 'project_update',
      data: {
        projectId,
        ...update,
      },
      timestamp: Date.now(),
    };

    this.broadcastToChannel(channel, message);
  }

  /**
   * Send notification to specific user
   */
  sendUserNotification(userId: string, notification: any): void {
    const ws = this.clients.get(userId);
    if (ws) {
      this.sendMessage(ws, {
        type: 'notification',
        data: notification,
        timestamp: Date.now(),
      });
    }
  }

  /**
   * Broadcast message to all subscribers of a channel
   */
  private broadcastToChannel(channel: string, message: WebSocketMessage): void {
    for (const ws of this.clients.values()) {
      if (ws.subscriptions?.has(channel)) {
        this.sendMessage(ws, message);
      }
    }
  }

  /**
   * Get connected clients count
   */
  getConnectedClientsCount(): number {
    return this.clients.size;
  }

  /**
   * Get channels with subscriber counts
   */
  getChannelStats(): Record<string, number> {
    const channelCounts: Record<string, number> = {};
    
    for (const ws of this.clients.values()) {
      if (ws.subscriptions) {
        for (const channel of ws.subscriptions) {
          channelCounts[channel] = (channelCounts[channel] || 0) + 1;
        }
      }
    }
    
    return channelCounts;
  }

  /**
   * Close all connections
   */
  close(): void {
    if (this.wss) {
      this.wss.close();
      this.clients.clear();
    }
  }
}

// Export singleton instance
export const websocketService = new WebSocketService();