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
}

interface ClaimResponse {
	job: Job | null
}

interface ClaimListResponse {
	claims: Job[]
}

interface ErrorResponse {
	error: {
		message: string
		details?: { path: PropertyKey[]; message: string }[]
	}
}

describe('POST /queues/:queueName/claims', () => {
	it('claims a pending job and sets lease fields', async () => {
		await SELF.fetch('http://localhost/queues/claim-queue/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'send-email' })
		})

		const response = await SELF.fetch(
			'http://localhost/queues/claim-queue/claims',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ claimeeId: 'worker-1' })
			}
		)

		expect(response.status).toEqual(201)

		const body = (await response.json()) as ClaimResponse

		expect(body.job).not.toBeNull()
		expect(body.job?.claimedBy).toEqual('worker-1')
		expect(body.job?.claimedAt).toEqual(expect.any(Number))
		expect(body.job?.leaseExpiresAt).toEqual(expect.any(Number))
		expect(body.job?.leaseToken).toEqual(expect.any(String))
		if (body.job?.claimedAt && body.job?.leaseExpiresAt) {
			expect(body.job.leaseExpiresAt).toBeGreaterThan(body.job.claimedAt)
		}
	})

	it('returns null when no pending jobs exist', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/empty-claim-queue/claims',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ claimeeId: 'worker-2' })
			}
		)

		expect(response.status).toEqual(200)

		const body = (await response.json()) as ClaimResponse

		expect(body).toEqual({ job: null })
	})

	it('returns 422 when claimeeId is missing', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/claim-missing/claims',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({})
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error).toBeDefined()
		expect(body.error.details).toBeDefined()
	})
})

describe('GET /queues/:queueName/claims', () => {
	it('returns an empty list for a new queue', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/claims-empty/claims'
		)

		expect(response.status).toEqual(200)

		const body = (await response.json()) as ClaimListResponse

		expect(body).toEqual({ claims: [] })
	})

	it('returns claimed jobs', async () => {
		await SELF.fetch('http://localhost/queues/claims-filled/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'cleanup' })
		})

		const claimResponse = await SELF.fetch(
			'http://localhost/queues/claims-filled/claims',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ claimeeId: 'worker-3' })
			}
		)

		expect(claimResponse.status).toEqual(201)

		const claimBody = (await claimResponse.json()) as ClaimResponse

		expect(claimBody.job).not.toBeNull()

		const response = await SELF.fetch(
			'http://localhost/queues/claims-filled/claims'
		)

		expect(response.status).toEqual(200)

		const body = (await response.json()) as ClaimListResponse

		expect(body.claims).toHaveLength(1)
		expect(body.claims[0].id).toEqual(claimBody.job?.id)
		expect(body.claims[0].claimedBy).toEqual('worker-3')
	})
})
