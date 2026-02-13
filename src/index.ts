import { DurableObject } from 'cloudflare:workers'

import { Router } from './router'
import { json } from './responses'
import { createJobRoute } from './broker/routes'

export class JobBroker extends DurableObject<Env> {}

export default {
	/**
	 * This is the standard fetch handler for a Cloudflare Worker
	 *
	 * @param request - The request submitted to the Worker from the client
	 * @param env - The interface to reference bindings declared in wrangler.jsonc
	 * @param ctx - The execution context of the Worker
	 * @returns The response to be sent back to the client
	 */
	async fetch(request, env, ctx): Promise<Response> {
		const router = new Router(env)

		router.get('/', async (req) => {
			const greeting = `Welcome to the Cuddy job broker.`

			return json({ message: greeting })
		})

		router.get('/health', async (req) => {
			return json({ status: 'ok' })
		})

		router.post('/jobs', createJobRoute)

		const response = await router.handle(request)

		return response
	}
} satisfies ExportedHandler<Env>
