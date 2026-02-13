import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

describe('GET /', () => {
	it('returns a welcome message', async () => {
		const response = await SELF.fetch('http://localhost/')

		expect(response.status).toEqual(200)

		const body = (await response.json()) as { message: string }

		expect(body).toEqual({ message: 'Welcome to the Cuddy job broker.' })
	})
})

describe('GET /health', () => {
	it('returns ok status', async () => {
		const response = await SELF.fetch('http://localhost/health')

		expect(response.status).toEqual(200)

		const body = (await response.json()) as { status: string }

		expect(body).toEqual({ status: 'ok' })
	})
})

describe('Unknown routes', () => {
	it('returns 404 for unknown paths', async () => {
		const response = await SELF.fetch('http://localhost/unknown')
		expect(response.status).toEqual(404)
	})
})
