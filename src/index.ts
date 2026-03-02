import { Hono } from 'hono'
import { log } from 'tiny-typescript-logger'

import claimRoutes from './broker/claims'
import jobRoutes from './broker/jobs'
import { BackendError, ValidationError } from './errors'

export { JobBroker } from './broker/broker'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
	return c.json({ message: 'Welcome to the Cuddy job broker.' })
})

app.get('/health', (c) => {
	return c.json({ status: 'ok' })
})

app.route('/queues/:queueName/jobs', jobRoutes)
app.route('/queues/:queueName/claims', claimRoutes)

app.onError((err, c) => {
	log.error(err)

	if (err instanceof ValidationError) {
		return c.json(
			{ error: { message: err.message, details: err.details } },
			err.statusCode
		)
	}

	if (err instanceof BackendError) {
		return c.json({ error: { message: err.message } }, err.statusCode)
	}

	return c.json(
		{ error: { message: 'Something went wrong. Please try again.' } },
		500
	)
})

export default app
