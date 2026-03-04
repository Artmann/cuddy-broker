import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import invariant from 'tiny-invariant'
import z from 'zod'

import type { JobBroker } from './broker'
import { BackendError, ValidationError } from '../errors'
import { createBrokerNameFromQueueName } from './queue'

const PayloadValueSchema = z.union([
	z.string(),
	z.number(),
	z.boolean(),
	z.null()
])

const CreateJobSchema = z.object({
	payload: z.record(z.string(), PayloadValueSchema).optional().default({}),
	type: z.string().min(1).max(255)
})

type BrokerBindings = {
	JOB_BROKER: DurableObjectNamespace<JobBroker>
}

const router = new Hono<{ Bindings: BrokerBindings }>()

router.get('/', async (context) => {
	const queueName = context.req.param('queueName')

	invariant(queueName, 'The queueName param is required.')

	const brokerName = createBrokerNameFromQueueName(queueName)
	const brokerStub = context.env.JOB_BROKER.getByName(brokerName)

	const jobs = await brokerStub.listJobs()

	return context.json({ jobs })
})

router.post(
	'/',
	zValidator('json', CreateJobSchema, (result) => {
		if (!result.success) {
			throw new ValidationError(result.error.issues)
		}
	}),
	async (context) => {
		const queueName = context.req.param('queueName')

		invariant(queueName, 'The queueName param is required.')

		const input = context.req.valid('json')

		if (input.type.trim().length === 0) {
			throw new BackendError('Job type cannot be empty.', 400)
		}

		const payload = input.payload || {}

		const brokerName = createBrokerNameFromQueueName(queueName)
		const brokerStub = context.env.JOB_BROKER.getByName(brokerName)

		const job = await brokerStub.createJob(input.type, payload)

		return context.json({ job }, 201)
	}
)

const FinishJobSchema = z.discriminatedUnion('status', [
	z.object({ leaseToken: z.string().min(1), status: z.literal('completed') }),
	z.object({
		error: z.string().min(1),
		leaseToken: z.string().min(1),
		status: z.literal('failed')
	})
])

router.post(
	'/:jobId/finish',
	zValidator('json', FinishJobSchema, (result) => {
		if (!result.success) {
			throw new ValidationError(result.error.issues)
		}
	}),
	async (context) => {
		const queueName = context.req.param('queueName')
		const jobId = context.req.param('jobId')

		invariant(queueName, 'The queueName param is required.')
		invariant(jobId, 'The jobId param is required.')

		const input = context.req.valid('json')

		const brokerName = createBrokerNameFromQueueName(queueName)
		const brokerStub = context.env.JOB_BROKER.getByName(brokerName)

		const error = input.status === 'failed' ? input.error : undefined

		const result = await brokerStub.finishJob(
			jobId,
			input.status,
			input.leaseToken,
			error
		)

		if (result.type === 'not_found') {
			throw new BackendError('Job not found.', 404)
		}

		if (result.type === 'already_finished') {
			throw new BackendError(
				`Job has already finished with the status: "${result.status}"`,
				409
			)
		}

		if (result.type === 'lease_mismatch') {
			throw new BackendError(
				'Lease token mismatch. The job may have been claimed by another worker or the lease may have expired.',
				409
			)
		}

		return context.json({ job: result.job })
	}
)

export default router
