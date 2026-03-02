import { Hono } from 'hono'

const router = new Hono<{ Bindings: Env }>()

export default router
