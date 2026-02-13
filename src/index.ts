import { Hono } from 'hono'

import { createJobRoute } from './broker/routes'
import { log } from 'tiny-typescript-logger'

export { JobBroker } from './broker/broker'

const app = new Hono<{ Bindings: Env }>()

app.get('/', (c) => {
	return c.json({ message: 'Welcome to the Cuddy job broker.' })
})

app.get('/health', (c) => {
	return c.json({ status: 'ok' })
})

app.post('/jobs', createJobRoute)

app.onError((err, c) => {
	log.error(err)

	return c.json(
		{ error: { message: 'Something went wrong. Please try again.' } },
		500
	)
})

export default app
