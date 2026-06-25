/**
 * Kuhula Finance — Schema Drizzle ORM
 *
 * Este ficheiro é a fonte de verdade para todas as tabelas.
 * Para gerar uma nova migration após alterar este ficheiro:
 *   npx drizzle-kit generate
 *
 * As migrations correm automaticamente no arranque via
 * src/db/migrate.ts chamado em instrumentation.ts
 */

import {
  pgTable, uuid, text, numeric, boolean,
  smallint, date, timestamp, bigserial, index, uniqueIndex,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// ── profiles ──────────────────────────────────────────────────
export const profiles = pgTable("profiles", {
  id:          uuid("id").primaryKey(),
  displayName: text("display_name"),
  currency:    text("currency").notNull().default("MT"),
  locale:      text("locale").notNull().default("pt-MZ"),
  createdAt:   timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
  updatedAt:   timestamp({ withTimezone: true })("updated_at").notNull().default(sql`now()`),
});

// ── accounts ──────────────────────────────────────────────────
export const accounts = pgTable("accounts", {
  id:        uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:    uuid("user_id").notNull(),
  name:      text("name").notNull(),
  balance:   numeric("balance", { precision: 14, scale: 2 }).notNull().default("0"),
  type:      text("type").notNull().default("bank"),
  createdAt: timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
  updatedAt: timestamp({ withTimezone: true })("updated_at").notNull().default(sql`now()`),
}, (t) => [
  uniqueIndex("accounts_user_name_idx").on(t.userId, t.name),
]);

// ── transactions ──────────────────────────────────────────────
export const transactions = pgTable("transactions", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:      uuid("user_id").notNull(),
  accountId:   uuid("account_id"),
  accountName: text("account_name").notNull(),
  description: text("description").notNull(),
  amount:      numeric("amount", { precision: 14, scale: 2 }).notNull(),
  type:        text("type").notNull(),
  category:    text("category").notNull().default("Outros"),
  isRecurring: boolean("is_recurring").notNull().default(false),
  dayOfMonth:  smallint("day_of_month"),
  date:        date("date").notNull().default(sql`current_date`),
  createdAt:   timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("idx_transactions_user_date").on(t.userId, t.date),
  index("idx_transactions_user_type").on(t.userId, t.type),
]);

// ── goals ────────────────────────────────────────────────────
export const goals = pgTable("goals", {
  id:            uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:        uuid("user_id").notNull(),
  title:         text("title").notNull(),
  targetAmount:  numeric("target_amount", { precision: 14, scale: 2 }).notNull(),
  currentAmount: numeric("current_amount", { precision: 14, scale: 2 }).notNull().default("0"),
  deadline:      date("deadline"),
  createdAt:     timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
  updatedAt:     timestamp({ withTimezone: true })("updated_at").notNull().default(sql`now()`),
}, (t) => [
  uniqueIndex("goals_user_title_idx").on(t.userId, t.title),
]);

// ── budget_limits ─────────────────────────────────────────────
export const budgetLimits = pgTable("budget_limits", {
  id:          uuid("id").primaryKey().default(sql`gen_random_uuid()`),
  userId:      uuid("user_id").notNull(),
  category:    text("category").notNull(),
  limitAmount: numeric("limit_amount", { precision: 14, scale: 2 }).notNull(),
  createdAt:   timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
  updatedAt:   timestamp({ withTimezone: true })("updated_at").notNull().default(sql`now()`),
}, (t) => [
  uniqueIndex("budget_limits_user_category_idx").on(t.userId, t.category),
]);

// ── strategies ────────────────────────────────────────────────
export const strategies = pgTable("strategies", {
  id:          text("id").notNull(),
  userId:      uuid("user_id").notNull(),
  title:       text("title").notNull(),
  description: text("description").notNull(),
  type:        text("type").notNull().default("info"),
  actionLabel: text("action_label"),
  frequency:   text("frequency"),
  createdAt:   timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
  updatedAt:   timestamp({ withTimezone: true })("updated_at").notNull().default(sql`now()`),
}, (t) => [
  uniqueIndex("strategies_user_id_idx").on(t.userId, t.id),
]);

// ── chat_messages ─────────────────────────────────────────────
export const chatMessages = pgTable("chat_messages", {
  id:        bigserial("id", { mode: "number" }).primaryKey(),
  userId:    uuid("user_id").notNull(),
  role:      text("role").notNull(),
  content:   text("content").notNull(),
  createdAt: timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
}, (t) => [
  index("idx_chat_messages_user").on(t.userId, t.createdAt),
]);

// ── ai_providers ──────────────────────────────────────────────
export const aiProviders = pgTable("ai_providers", {
  userId:           uuid("user_id").primaryKey(),
  provider:         text("provider").notNull().default("gemini"),
  model:            text("model").notNull().default("gemini-2.5-flash"),
  apiKeyEncrypted:  text("api_key_encrypted"),
  submitOnEnter:    boolean("submit_on_enter").notNull().default(true),
  createdAt:        timestamp({ withTimezone: true })("created_at").notNull().default(sql`now()`),
  updatedAt:        timestamp({ withTimezone: true })("updated_at").notNull().default(sql`now()`),
});
