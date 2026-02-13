import type { ContentfulStatusCode } from 'hono/utils/http-status'
import type { ZodIssue } from 'zod'

export class BackendError extends Error {
	constructor(
		message: string,
		public statusCode: ContentfulStatusCode = 500
	) {
		super(message)
	}
}

export class ValidationError extends BackendError {
	public details: { path: PropertyKey[]; message: string }[]

	constructor(issues: ZodIssue[]) {
		super('Validation failed.', 422)
		this.details = issues.map((issue) => ({
			path: issue.path,
			message: issue.message
		}))
	}
}
