import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const jobs = sqliteTable('jobs', {
	id: text('id').primaryKey(),
	type: text('type').notNull(),
	payload: text('payload', { mode: 'json' }).notNull().default({}),
	status: text('status').notNull().default('pending'),
	createdAt: integer('created_at').notNull(),
})
