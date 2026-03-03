import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import invariant from 'tiny-invariant'
import z from 'zod'

import type { Job } from './broker'
import { createBrokerNameFromQueueName } from './queue'
import { ValidationError } from '../errors'

type BrokerBindings = {
	JOB_BROKER: DurableObjectNamespace
}

type JobBrokerStub = {
	listClaimedJobs: () => Promise<Job[]>
	claimJob: (claimeeId: string) => Promise<Job | null>
}

const router = new Hono<{ Bindings: BrokerBindings }>()

router.get('/', async (context) => {
	const queueName = context.req.param('queueName')

	invariant(queueName, 'The queueName param is required.')

	const brokerName = createBrokerNameFromQueueName(queueName)
	const brokerStub = context.env.JOB_BROKER.getByName(
		brokerName
	) as unknown as JobBrokerStub

	const jobs = await brokerStub.listClaimedJobs()

	return context.json({ claims: jobs })
})

const CreateClaimSchema = z.object({
	claimeeId: z.string().min(1).max(255)
})

router.post(
	'/',
	zValidator('json', CreateClaimSchema, (result) => {
		if (!result.success) {
			throw new ValidationError(result.error.issues)
		}
	}),
	async (context) => {
		const queueName = context.req.param('queueName')

		invariant(queueName, 'The queueName param is required.')

		const brokerName = createBrokerNameFromQueueName(queueName)
		const brokerStub = context.env.JOB_BROKER.getByName(
			brokerName
		) as unknown as JobBrokerStub

		const input = context.req.valid('json')

		const claimedJob = await brokerStub.claimJob(input.claimeeId)

		if (claimedJob) {
			return context.json({ job: claimedJob }, 201)
		}

		return context.json({ job: null })
	}
)

export default router
