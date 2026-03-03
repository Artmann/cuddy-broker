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

export default router
