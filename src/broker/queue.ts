export function createBrokerNameFromQueueName(queueName: string) {
	return `cuddy-broker-${queueName.replace(/[^a-zA-Z0-9_-]/g, '-')}`
}
