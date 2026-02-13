import { json } from '../responses'

export async function createJobRoute(
	request: Request,
	environment: Env
): Promise<Response> {
	return json({
		foo: 'bar'
	})
}
