import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

export const hasDatabase = !!process.env.DATABASE_URL;

const pool = hasDatabase
  ? new pg.Pool({ connectionString: process.env.DATABASE_URL })
  : null;

export const db = pool ? drizzle(pool, { schema }) : null as any;
