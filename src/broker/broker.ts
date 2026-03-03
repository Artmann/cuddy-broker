import { DurableObject } from 'cloudflare:workers'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import {
	drizzle,
	type DrizzleSqliteDODatabase
} from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import { log } from 'tiny-typescript-logger'

import { jobs } from './schema'
import journal from '../../drizzle/meta/_journal.json'
import m0000 from '../../drizzle/0000_needy_darwin.sql'
import m0001 from '../../drizzle/0001_job_claiming.sql'
import m0002 from '../../drizzle/0002_job_lease_tokens.sql'

export type JobPayload = Record<string, any>

export interface Job {
	claimedAt: number | null
	claimedBy: string | null
	createdAt: number
	id: string
	leaseExpiresAt: number | null
	leaseToken: string | null
	payload: JobPayload
	status: 'pending' | 'in-progress' | 'completed' | 'failed'
	type: string
}

type JobRow = typeof jobs.$inferSelect

interface JobBrokerEnv {}

export class JobBroker extends DurableObject<JobBrokerEnv> {
	private readonly db: DrizzleSqliteDODatabase

	constructor(ctx: DurableObjectState, env: JobBrokerEnv) {
		super(ctx, env)
		this.db = drizzle(ctx.storage, { logger: false })
		ctx.blockConcurrencyWhile(async () => {
			migrate(this.db, {
				journal,
				migrations: {
					m0000,
					m0001,
					m0002
				}
			})
		})
	}

	async claimJob(claimeeId: string): Promise<Job | null> {
		log.info(`Attempting to claim a job for claimeeId: ${claimeeId}`)

		const leaseToken = crypto.randomUUID()
		const now = Date.now()
		const leaseDuration = 5 * 60 * 1000 // 5 minutes
		const leaseExpiresAt = now + leaseDuration

		const claimedJob = this.db.transaction((tx) => {
			const row = tx
				.select()
				.from(jobs)
				.where(
					and(
						eq(jobs.status, 'pending'),
						isNull(jobs.claimedBy),
						isNull(jobs.claimedAt)
					)
				)
				.orderBy(jobs.createdAt)
				.limit(1)
				.get()

			if (!row) {
				return null
			}

			tx.update(jobs)
				.set({
					claimedBy: claimeeId,
					claimedAt: now,
					leaseExpiresAt,
					leaseToken
				})
				.where(eq(jobs.id, row.id))
				.run()

			return this.transformJob({
				...row,
				claimedBy: claimeeId,
				claimedAt: now,
				leaseExpiresAt,
				leaseToken
			})
		})

		return claimedJob
	}

	async createJob(type: string, payload: JobPayload): Promise<Job> {
		const id = crypto.randomUUID()
		const createdAt = Date.now()

		this.db
			.insert(jobs)
			.values({
				id,
				type,
				payload,
				status: 'pending',
				createdAt
			})
			.run()

		return {
			id,
			type,
			payload,
			createdAt,
			status: 'pending',
			claimedBy: null,
			claimedAt: null,
			leaseExpiresAt: null,
			leaseToken: null
		}
	}

	async listClaimedJobs(): Promise<Job[]> {
		const rows = this.db
			.select()
			.from(jobs)
			.where(and(isNotNull(jobs.claimedBy), isNotNull(jobs.claimedAt)))
			.orderBy(jobs.claimedAt)
			.all()

		return rows.map((row) => this.transformJob(row))
	}

	async listJobs(): Promise<Job[]> {
		const rows = this.db.select().from(jobs).all()

		return rows.map((row) => this.transformJob(row))
	}

	private transformJob(row: JobRow): Job {
		return {
			claimedAt: row.claimedAt,
			claimedBy: row.claimedBy,
			createdAt: row.createdAt,
			id: row.id,
			leaseExpiresAt: row.leaseExpiresAt,
			leaseToken: row.leaseToken,
			payload: row.payload as JobPayload,
			status: row.status as Job['status'],
			type: row.type
		}
	}
}
