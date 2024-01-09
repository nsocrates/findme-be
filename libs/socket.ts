import {
  ApiGatewayManagementApiClient,
  PostToConnectionCommand,
} from '@aws-sdk/client-apigatewaymanagementapi'
import { getConnections, batchDestroyConnections } from './db'
import type { BlobPayloadInputTypes } from '@smithy/types'

const DOMAIN_NAME = process.env.DOMAIN_NAME as string
const STAGE = process.env.STAGE as string
const ENDPOINT = `https://${DOMAIN_NAME}/${STAGE}`

const client = new ApiGatewayManagementApiClient({
  apiVersion: '2018-11-29',
  endpoint: ENDPOINT,
})

export function emit(action: string) {
  return async function (connId: string, message: BlobPayloadInputTypes) {
    const data = JSON.stringify({ action, message })
    const params = { ConnectionId: connId, Data: data }
    const command = new PostToConnectionCommand(params)
    await client.send(command)
  }
}

export function broadcast(action: string, myId?: string) {
  return async function (message: BlobPayloadInputTypes) {
    const data = JSON.stringify({ action, message })
    const connIds = (await getConnections()).filter(id => id !== myId)
    const rejects: string[] = []
    const promises = connIds.map(id => {
      const params = { ConnectionId: id, Data: data }
      const command = new PostToConnectionCommand(params)
      return client.send(command).catch(() => rejects.push(id))
    })

    await Promise.all(promises)
    await batchDestroyConnections(rejects)
  }
}
