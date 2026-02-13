import invariant from 'tiny-invariant'
import { log } from 'tiny-typescript-logger'

import { json } from './responses'

type RouteHandler = (request: Request, env: Env) => Promise<Response>

interface Route {
	handler: RouteHandler
	method: string
	pattern: string
}

export class Router {
	private readonly environment: Env
	private readonly routes: Route[] = []

	constructor(environment: Env) {
		this.environment = environment
	}

	get(pattern: string, handler: RouteHandler): Router {
		this.routes.push({
			handler,
			method: 'get',
			pattern
		})

		return this
	}

	async handle(request: Request): Promise<Response> {
		const url = new URL(request.url)

		try {
			for (const route of this.routes) {
				invariant(route, 'The route must exist.')
				invariant(route.handler, 'The route must have a handler.')

				if (route.method.toLowerCase() !== request.method.toLowerCase()) {
					continue
				}

				if (url.pathname.toLowerCase() === route.pattern.toLowerCase()) {
					const response = await route.handler(request, this.environment)

					return response
				}
			}
		} catch (error) {
			log.error(error)

			return json({
				error: {
					message: 'Something went wrong. Please try again'
				}
			})
		}

		return json(
			{
				error: {
					message: 'Path not found'
				}
			},
			404
		)
	}

	post(pattern: string, handler: RouteHandler): Router {
		this.routes.push({
			handler,
			method: 'post',
			pattern
		})

		return this
	}
}
