import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

interface Job {
	id: string
	type: string
	payload: Record<string, unknown>
	status: string
	createdAt: number
}

interface JobResponse {
	job: Job
}

interface JobListResponse {
	jobs: Job[]
}

interface ErrorResponse {
	error: {
		message: string
		details?: { path: PropertyKey[]; message: string }[]
	}
}

describe('POST /queues/:queueName/jobs', () => {
	it('creates a job with type and payload', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					type: 'send-email',
					payload: { to: 'user@example.com' }
				})
			}
		)

		expect(response.status).toEqual(201)

		const body = (await response.json()) as JobResponse

		expect(body.job).toMatchObject({
			type: 'send-email',
			payload: { to: 'user@example.com' },
			status: 'pending'
		})
		expect(body.job.id).toBeDefined()
		expect(body.job.createdAt).toBeDefined()
	})

	it('creates a job with type only, payload defaults to {}', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'cleanup' })
			}
		)

		expect(response.status).toEqual(201)

		const body = (await response.json()) as JobResponse

		expect(body.job.type).toEqual('cleanup')
		expect(body.job.payload).toEqual({})
	})

	it('returns 422 when type is missing', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ payload: { foo: 'bar' } })
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error).toBeDefined()
		expect(body.error.details).toBeDefined()
	})

	it('returns 422 when type is an empty string', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: '' })
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error).toBeDefined()
	})

	it('returns 422 when type exceeds 255 characters', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: 'a'.repeat(256) })
			}
		)

		expect(response.status).toEqual(422)

		const body = (await response.json()) as ErrorResponse

		expect(body.error).toBeDefined()
	})

	it('returns 400 when type is whitespace only', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ type: '   ' })
			}
		)

		expect(response.status).toEqual(400)

		const body = (await response.json()) as ErrorResponse

		expect(body.error.message).toEqual('Job type cannot be empty.')
	})

	it('returns an error for invalid JSON body', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'not json'
			}
		)

		expect(response.status).toBeGreaterThanOrEqual(400)
	})

	it('returns an error when no body is provided', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/test-queue/jobs',
			{
				method: 'POST',
				headers: { 'Content-Type': 'application/json' }
			}
		)

		expect(response.status).toBeGreaterThanOrEqual(400)
	})
})

describe('GET /queues/:queueName/jobs', () => {
	it('returns an empty list for a new queue', async () => {
		const response = await SELF.fetch(
			'http://localhost/queues/empty-queue/jobs'
		)

		expect(response.status).toEqual(200)

		const body = (await response.json()) as JobListResponse

		expect(body).toEqual({ jobs: [] })
	})

	it('returns created jobs', async () => {
		await SELF.fetch('http://localhost/queues/my-queue/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'job-a' })
		})
		await SELF.fetch('http://localhost/queues/my-queue/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'job-b' })
		})

		const response = await SELF.fetch('http://localhost/queues/my-queue/jobs')

		expect(response.status).toEqual(200)

		const body = (await response.json()) as JobListResponse

		expect(body.jobs).toHaveLength(2)
		expect(body.jobs[0].type).toEqual('job-a')
		expect(body.jobs[1].type).toEqual('job-b')
	})

	it('isolates jobs between different queues', async () => {
		await SELF.fetch('http://localhost/queues/queue-alpha/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'alpha-job' })
		})
		await SELF.fetch('http://localhost/queues/queue-beta/jobs', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ type: 'beta-job' })
		})

		const alphaResponse = await SELF.fetch(
			'http://localhost/queues/queue-alpha/jobs'
		)
		const betaResponse = await SELF.fetch(
			'http://localhost/queues/queue-beta/jobs'
		)

		const alphaBody = (await alphaResponse.json()) as JobListResponse
		const betaBody = (await betaResponse.json()) as JobListResponse

		expect(alphaBody.jobs).toHaveLength(1)
		expect(alphaBody.jobs[0].type).toEqual('alpha-job')
		expect(betaBody.jobs).toHaveLength(1)
		expect(betaBody.jobs[0].type).toEqual('beta-job')
	})
})
