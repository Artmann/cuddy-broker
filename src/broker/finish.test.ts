import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

interface Job {
	id: string
	type: string
	payload: Record<string, unknown>
	status: string
	createdAt: number
	claimedBy: string | null
	claimedAt: number | null
	leaseExpiresAt: number | null
	leaseToken: string | null
	error: string | null
}

interface JobResponse {
	job: Job
}

interface ClaimResponse {
	job: Job | null
}

interface ErrorResponse {
	error: {
		message: string
		details?: { path: PropertyKey[]; message: string }[]
	}
}

async function createAndClaimJob(queue: string): Promise<Job> {
	await SELF.fetch(`http://localhost/queues/${queue}/jobs`, {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ type: 'test-job' })
	})

	const claimResponse = await SELF.fetch(
		`http://localhost/queues/${queue}/claims`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ claimeeId: 'worker-1' })
		}
	)

	const body = (await claimResponse.json()) as ClaimResponse

	return body.job!
}

async function finishJob(
	queue: string,
	jobId: string,
	payload: Record<string, unknown>
): Promise<Response> {
	return SELF.fetch(
		`http://localhost/queues/${queue}/jobs/${jobId}/finish`,
		{
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload)
		}
	)
}

describe('POST /queues/:queueName/jobs/:jobId/finish', () => {
	it('marks a job as completed and clears claim fields', async () => {
		const job = await createAndClaimJob('finish-complete-queue')

		const response = await finishJob('finish-complete-queue', job.id, {
			status: 'completed',
			leaseToken: job.leaseToken
		})

		expect(response.status).toEqual(200)

		const body = (await response.json()) as JobResponse

		expect(body.job.id).toEqual(job.id)
		expect(body.job.status).toEqual('completed')
		expect(body.job.error).toBeNull()
		expect(body.job.claimedBy).toBeNull()
		expect(body.job.claimedAt).toBeNull()
		expect(body.job.leaseExpiresAt).toBeNull()
		expect(body.job.leaseToken).toBeNull()
	})

	it('marks a job as failed with an error message', async () => {
		const job = await createAndClaimJob('finish-fail-queue')

		const response = await finishJob('finish-fail-queue', job.id, {
			status: 'failed',
			leaseToken: job.leaseToken,
			error: 'Connection timed out.'
		})

		expect(response.status).toEqual(200)

		const body = (await response.json()) as JobResponse

		expect(body.job.status).toEqual('failed')
		expect(body.job.error).toEqual('Connection timed out.')
		expect(body.job.claimedBy).toBeNull()
		expect(body.job.leaseToken).toBeNull()
	})

	it('returns 404 for an unknown job id', async () => {
		const response = await finishJob('finish-404-queue', 'non-existent-id', {
			status: 'completed',
			leaseToken: 'any-token'
		})

		expect(response.status).toEqual(404)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.message).toBeDefined()
	})

	it('returns 409 when the job has already been finished', async () => {
		const job = await createAndClaimJob('finish-already-done-queue')

		await finishJob('finish-already-done-queue', job.id, {
			status: 'completed',
			leaseToken: job.leaseToken
		})

		const response = await finishJob('finish-already-done-queue', job.id, {
			status: 'completed',
			leaseToken: job.leaseToken
		})

		expect(response.status).toEqual(409)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.message).toBeDefined()
	})

	it('returns 409 when the lease token does not match', async () => {
		const job = await createAndClaimJob('finish-409-queue')

		const response = await finishJob('finish-409-queue', job.id, {
			status: 'completed',
			leaseToken: 'wrong-token'
		})

		expect(response.status).toEqual(409)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.message).toBeDefined()
	})

	it('returns 422 when leaseToken is missing', async () => {
		const response = await finishJob('finish-validation-queue', 'some-id', {
			status: 'completed'
		})

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.details).toBeDefined()
	})

	it('returns 422 when status is failed but error is missing', async () => {
		const response = await finishJob(
			'finish-validation-queue-2',
			'some-id',
			{
				status: 'failed',
				leaseToken: 'some-token'
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.details).toBeDefined()
	})

	it('returns 422 when status is invalid', async () => {
		const response = await finishJob(
			'finish-validation-queue-3',
			'some-id',
			{
				status: 'in-progress',
				leaseToken: 'some-token'
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error).toBeDefined()
	})

	it('returns 422 when leaseToken is an empty string', async () => {
		const response = await finishJob(
			'finish-validation-queue-4',
			'some-id',
			{
				status: 'completed',
				leaseToken: ''
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.details).toBeDefined()
	})
})
