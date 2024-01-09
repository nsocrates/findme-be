import 'dotenv/config'
import { putLastCoordinates } from '../libs/db'
import { broadcast } from '../libs/socket'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  try {
    const { requestContext, body } = event
    const { connectionId } = requestContext
    const { message } = JSON.parse(body || '{}')
    await putLastCoordinates(message)
    await broadcast('coords', connectionId)(message)
    return { statusCode: 200 }
  } catch (error) {
    console.error(error)
    return { statusCode: 500 }
  }
}
