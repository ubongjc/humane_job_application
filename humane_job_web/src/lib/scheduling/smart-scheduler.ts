import { addHours, addDays, startOfDay, setHours, setMinutes, isWeekend, nextMonday } from "date-fns";

export interface SmartScheduleRecommendation {
  recommendedTime: Date;
  reason: string;
  confidence: "high" | "medium" | "low";
  alternatives: Array<{
    time: Date;
    reason: string;
  }>;
}

/**
 * Smart Scheduler - Recommends best time to send rejection letters
 * Based on research and best practices:
 * - Avoid Mondays (people are stressed)
 * - Avoid Fridays (ruins weekend)
 * - Mid-week is best (Tuesday-Thursday)
 * - Morning hours (9-11 AM) or early afternoon (2-3 PM)
 * - Avoid end of business day
 * - Respect time zones
 */
export class SmartScheduler {
  private timeZone: string;

  constructor(timeZone: string = "America/New_York") {
    this.timeZone = timeZone;
  }

  /**
   * Get the optimal time to send a rejection letter
   */
  getRecommendedTime(
    candidateTimezone?: string,
    urgency: "low" | "medium" | "high" = "medium"
  ): SmartScheduleRecommendation {
    const now = new Date();
    const targetTimezone = candidateTimezone || this.timeZone;

    // High urgency - send within next few hours
    if (urgency === "high") {
      const recommendedTime = this.getNextBusinessHour(now, 2);
      return {
        recommendedTime,
        reason: "High urgency - sending during next available business hours",
        confidence: "high",
        alternatives: [
          {
            time: this.getNextBusinessHour(now, 4),
            reason: "Slightly later in business day",
          },
        ],
      };
    }

    // Find next optimal day (Tuesday-Thursday)
    let recommendedDay = this.getNextOptimalDay(now);
    let recommendedTime = this.setOptimalTime(recommendedDay);

    // If we're already on a good day and it's early enough, suggest today
    if (this.isOptimalDay(now) && now.getHours() < 14) {
      recommendedTime = this.getNextBusinessHour(now, 1);
      return {
        recommendedTime,
        reason: "Today during mid-morning - optimal time for professional communication",
        confidence: "high",
        alternatives: [
          {
            time: this.setOptimalTime(this.getNextOptimalDay(addDays(now, 1))),
            reason: "Tomorrow mid-morning for less urgency",
          },
          {
            time: addHours(recommendedTime, 3),
            reason: "This afternoon - still professional",
          },
        ],
      };
    }

    // Default recommendation - next optimal day
    return {
      recommendedTime,
      reason: `${this.getDayName(recommendedTime)} morning - statistically best time for candidate communication`,
      confidence: "high",
      alternatives: [
        {
          time: this.setOptimalTime(recommendedDay, 14), // 2 PM
          reason: "Early afternoon - alternative option",
        },
        {
          time: this.setOptimalTime(this.getNextOptimalDay(addDays(recommendedDay, 1))),
          reason: "Next optimal day if not urgent",
        },
      ],
    };
  }

  /**
   * Check if a time is considered optimal
   */
  isOptimalTime(date: Date): {
    isOptimal: boolean;
    score: number;
    reasons: string[];
  } {
    const reasons: string[] = [];
    let score = 0;

    // Check day of week
    const day = date.getDay();
    if (day === 0 || day === 6) {
      reasons.push("Weekend - avoid sending rejection letters");
      score -= 30;
    } else if (day === 1) {
      reasons.push("Monday - people are often stressed");
      score -= 15;
    } else if (day === 5) {
      reasons.push("Friday - may ruin candidate's weekend");
      score -= 20;
    } else {
      reasons.push("Mid-week - optimal day");
      score += 30;
    }

    // Check time of day
    const hour = date.getHours();
    if (hour >= 9 && hour <= 11) {
      reasons.push("Mid-morning - ideal time");
      score += 30;
    } else if (hour >= 14 && hour <= 15) {
      reasons.push("Early afternoon - good alternative");
      score += 20;
    } else if (hour >= 16 && hour <= 17) {
      reasons.push("Late afternoon - acceptable but not ideal");
      score += 10;
    } else if (hour < 9) {
      reasons.push("Too early - may seem impersonal");
      score -= 20;
    } else {
      reasons.push("End of day - may seem rushed");
      score -= 15;
    }

    // Bonus for Tuesday-Wednesday
    if (day === 2 || day === 3) {
      score += 10;
      reasons.push("Tuesday/Wednesday - statistically best days");
    }

    return {
      isOptimal: score >= 40,
      score,
      reasons,
    };
  }

  /**
   * Get bulk sending schedule for multiple candidates
   * Spreads sends across optimal times to avoid overwhelming
   */
  getBulkSchedule(count: number, startDate?: Date): Date[] {
    const start = startDate || new Date();
    const schedule: Date[] = [];

    let currentDay = this.getNextOptimalDay(start);
    let currentTime = this.setOptimalTime(currentDay);

    // Send in batches across multiple days
    const maxPerDay = 50; // Don't overwhelm with too many in one day
    let sentToday = 0;

    for (let i = 0; i < count; i++) {
      schedule.push(new Date(currentTime));

      sentToday++;

      // Move to next optimal time slot
      if (sentToday < maxPerDay) {
        // Add 2 minutes between sends
        currentTime = addHours(currentTime, 0);
        currentTime.setMinutes(currentTime.getMinutes() + 2);

        // If we've passed optimal hours, move to next day
        if (currentTime.getHours() >= 16) {
          currentDay = this.getNextOptimalDay(addDays(currentDay, 1));
          currentTime = this.setOptimalTime(currentDay);
          sentToday = 0;
        }
      } else {
        // Move to next day
        currentDay = this.getNextOptimalDay(addDays(currentDay, 1));
        currentTime = this.setOptimalTime(currentDay);
        sentToday = 0;
      }
    }

    return schedule;
  }

  // Private helper methods

  private isOptimalDay(date: Date): boolean {
    const day = date.getDay();
    return day >= 2 && day <= 4; // Tuesday-Thursday
  }

  private getNextOptimalDay(from: Date): Date {
    let current = startOfDay(addDays(from, 1));

    // Skip to next optimal day
    while (!this.isOptimalDay(current)) {
      if (isWeekend(current)) {
        current = nextMonday(current);
      } else {
        current = addDays(current, 1);
      }
    }

    return current;
  }

  private setOptimalTime(date: Date, hour: number = 10): Date {
    let result = setHours(date, hour);
    result = setMinutes(result, 0);
    return result;
  }

  private getNextBusinessHour(from: Date, hoursAhead: number): Date {
    let result = addHours(from, hoursAhead);

    // Adjust to business hours
    if (result.getHours() < 9) {
      result = setHours(result, 9);
    } else if (result.getHours() >= 17) {
      result = addDays(result, 1);
      result = setHours(result, 9);
    }

    // Skip weekends
    if (isWeekend(result)) {
      result = nextMonday(result);
      result = setHours(result, 9);
    }

    return result;
  }

  private getDayName(date: Date): string {
    const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    return days[date.getDay()];
  }
}

// Global instance
export const smartScheduler = new SmartScheduler();
