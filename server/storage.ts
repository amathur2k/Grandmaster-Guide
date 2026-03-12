import { eq } from "drizzle-orm";
import { db } from "./db";
import { users, type InsertUser, type User } from "@shared/schema";

export interface IStorage {
  findUserByGoogleId(googleId: string): Promise<User | null>;
  findUserById(id: number): Promise<User | null>;
  upsertUser(data: InsertUser): Promise<User>;
}

export class DatabaseStorage implements IStorage {
  async findUserByGoogleId(googleId: string): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.googleId, googleId)).limit(1);
    return user || null;
  }

  async findUserById(id: number): Promise<User | null> {
    const [user] = await db.select().from(users).where(eq(users.id, id)).limit(1);
    return user || null;
  }

  async upsertUser(data: InsertUser): Promise<User> {
    const existing = await this.findUserByGoogleId(data.googleId);
    if (existing) {
      const [updated] = await db
        .update(users)
        .set({ name: data.name, email: data.email, avatarUrl: data.avatarUrl })
        .where(eq(users.googleId, data.googleId))
        .returning();
      return updated;
    }
    const [created] = await db.insert(users).values(data).returning();
    return created;
  }
}

export const storage = new DatabaseStorage();
