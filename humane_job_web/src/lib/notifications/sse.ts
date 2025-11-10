// Server-Sent Events for real-time notifications

export interface Notification {
  id: string;
  type: "letter_generated" | "letter_sent" | "decision_created" | "job_created" | "system";
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  metadata?: Record<string, any>;
}

class NotificationManager {
  private connections: Map<string, ReadableStreamDefaultController> = new Map();

  addConnection(userId: string, controller: ReadableStreamDefaultController) {
    this.connections.set(userId, controller);
  }

  removeConnection(userId: string) {
    this.connections.delete(userId);
  }

  async sendNotification(userId: string, notification: Notification) {
    const controller = this.connections.get(userId);
    if (controller) {
      const encoder = new TextEncoder();
      const data = `data: ${JSON.stringify(notification)}\n\n`;
      try {
        controller.enqueue(encoder.encode(data));
      } catch (error) {
        console.error("Error sending notification:", error);
        this.removeConnection(userId);
      }
    }
  }

  broadcastToCompany(companyId: string, notification: Notification) {
    // In a real implementation, we'd track company memberships
    // For now, this is a simplified version
    this.connections.forEach((controller, userId) => {
      this.sendNotification(userId, notification);
    });
  }
}

export const notificationManager = new NotificationManager();
