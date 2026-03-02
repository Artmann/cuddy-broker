import { Hono } from 'hono'
import invariant from 'tiny-invariant'

import { createBrokerNameFromQueueName } from './queue'

const router = new Hono<{ Bindings: Env }>()

router.get('/', async (context) => {
	const queueName = context.req.param('queueName')

	invariant(queueName, 'The queueName param is required.')

	const brokerName = createBrokerNameFromQueueName(queueName)
	const brokerStub = context.env.JOB_BROKER.getByName(brokerName)

	const jobs = await brokerStub.listJobs()

	const claims = []

	return context.json({ claims })
})

export default router
