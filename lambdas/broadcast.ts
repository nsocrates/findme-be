import 'dotenv/config'
import { putLastCoordinates } from '../libs/db'
import { broadcast } from '../libs/socket'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'

const SECRET_KEY = process.env.SECRET_KEY as string

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  try {
    const { requestContext, body } = event
    const { connectionId } = requestContext
    const { message, secretKey } = JSON.parse(body || '{}')

    if (secretKey !== SECRET_KEY) {
      return { statusCode: 401 }
    }

    if (!message) {
      return { statusCode: 400 }
    }

    await putLastCoordinates(message)
    await broadcast('coords', connectionId)(message)
    return { statusCode: 200 }
  } catch (error) {
    console.error(error)
    return { statusCode: 500 }
  }
}
