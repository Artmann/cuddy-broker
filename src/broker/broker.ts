import { DurableObject } from 'cloudflare:workers'
import { drizzle, DrizzleSqliteDODatabase } from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'

import { jobs } from './schema'
import journal from '../../drizzle/meta/_journal.json'
import m0000 from '../../drizzle/0000_needy_darwin.sql'

interface Job {
	createdAt: number
	id: string
	payload: Record<string, unknown>
	status: 'pending' | 'in-progress' | 'completed' | 'failed'
	type: string
}

export class JobBroker extends DurableObject<Env> {
	private readonly db: DrizzleSqliteDODatabase

	constructor(ctx: DurableObjectState, env: Env) {
		super(ctx, env)
		this.db = drizzle(ctx.storage, { logger: false })
		ctx.blockConcurrencyWhile(async () => {
			migrate(this.db, {
				journal,
				migrations: {
					m0000,
				},
			})
		})
	}

	async createJob(
		type: string,
		payload: Record<string, unknown>
	): Promise<Job> {
		const id = crypto.randomUUID()
		const createdAt = Date.now()

		this.db.insert(jobs).values({
			id,
			type,
			payload,
			status: 'pending',
			createdAt,
		}).run()

		return { id, type, payload, createdAt, status: 'pending' }
	}

	async listJobs(): Promise<Job[]> {
		const rows = this.db.select().from(jobs).all()

		return rows.map((row) => ({
			id: row.id,
			type: row.type,
			payload: row.payload as Record<string, unknown>,
			status: row.status as Job['status'],
			createdAt: row.createdAt,
		}))
	}
}
