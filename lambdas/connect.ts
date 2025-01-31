import 'dotenv/config'
import { putConnection } from '../libs/db'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  try {
    const { requestContext } = event
    const { connectionId } = requestContext
    await putConnection(connectionId)
    return { statusCode: 200 }
  } catch (error) {
    console.error(error)
    return { statusCode: 500 }
  }
}
