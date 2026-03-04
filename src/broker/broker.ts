import { DurableObject } from 'cloudflare:workers'
import { and, eq, isNotNull, isNull } from 'drizzle-orm'
import {
	drizzle,
	type DrizzleSqliteDODatabase
} from 'drizzle-orm/durable-sqlite'
import { migrate } from 'drizzle-orm/durable-sqlite/migrator'
import invariant from 'tiny-invariant'
import { log } from 'tiny-typescript-logger'

import { jobs } from './schema'
import journal from '../../drizzle/meta/_journal.json'
import m0000 from '../../drizzle/0000_needy_darwin.sql'
import m0001 from '../../drizzle/0001_job_claiming.sql'
import m0002 from '../../drizzle/0002_job_lease_tokens.sql'
import m0003 from '../../drizzle/0003_job_error.sql'

export type JobPayloadValue = string | number | boolean | null
export type JobPayload = Record<string, JobPayloadValue>

export interface Job {
	claimedAt: number | null
	claimedBy: string | null
	createdAt: number
	error: string | null
	id: string
	leaseExpiresAt: number | null
	leaseToken: string | null
	payload: JobPayload
	status: 'pending' | 'in-progress' | 'completed' | 'failed'
	type: string
}

type JobRow = typeof jobs.$inferSelect

interface JobBrokerEnv {
	leaseDurationInSeconds?: number
}

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
					m0002,
					m0003
				}
			})
		})
	}

	async claimJob(claimeeId: string): Promise<Job | null> {
		log.info(`Attempting to claim a job for claimeeId: ${claimeeId}`)

		const leaseToken = crypto.randomUUID()
		const now = Date.now()
		const configuredLeaseSeconds =
			typeof this.env.leaseDurationInSeconds === 'number'
				? this.env.leaseDurationInSeconds
				: Number(this.env.leaseDurationInSeconds ?? 60)
		const leaseDurationInSeconds =
			Number.isFinite(configuredLeaseSeconds) && configuredLeaseSeconds > 0
				? configuredLeaseSeconds
				: 60
		const leaseDuration = leaseDurationInSeconds * 1000
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
			error: null,
			status: 'pending',
			claimedBy: null,
			claimedAt: null,
			leaseExpiresAt: null,
			leaseToken: null
		}
	}

	async finishJob(
		jobId: string,
		status: 'completed' | 'failed',
		leaseToken: string,
		error?: string
	): Promise<
		| { type: 'ok'; job: Job }
		| { type: 'not_found' }
		| { type: 'already_finished'; status: 'completed' | 'failed' }
		| { type: 'lease_mismatch' }
	> {
		const row = this.db.select().from(jobs).where(eq(jobs.id, jobId)).get()

		if (!row) {
			return { type: 'not_found' }
		}

		if (row.status === 'completed' || row.status === 'failed') {
			return { type: 'already_finished', status: row.status }
		}

		if (row.leaseToken !== leaseToken) {
			return { type: 'lease_mismatch' }
		}

		this.db
			.update(jobs)
			.set({
				status,
				error: error ?? null,
				claimedBy: null,
				claimedAt: null,
				leaseExpiresAt: null,
				leaseToken: null
			})
			.where(eq(jobs.id, jobId))
			.run()

		const updatedRow = this.db
			.select()
			.from(jobs)
			.where(eq(jobs.id, jobId))
			.get()

		invariant(updatedRow, 'The job should exist after updating its status.')

		return { type: 'ok', job: this.transformJob(updatedRow) }
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
			error: row.error ?? null,
			id: row.id,
			leaseExpiresAt: row.leaseExpiresAt,
			leaseToken: row.leaseToken,
			payload: row.payload as JobPayload,
			status: row.status as Job['status'],
			type: row.type
		}
	}
}
