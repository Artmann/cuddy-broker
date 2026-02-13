export function json(payload: unknown, statusCode = 200): Response {
	return new Response(JSON.stringify(payload), {
		status: statusCode
	})
}
