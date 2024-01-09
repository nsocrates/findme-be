import 'dotenv/config'
import { getLastCoordinates } from '../libs/db'
import { emit } from '../libs/socket'
import type { APIGatewayProxyWebsocketEventV2 } from 'aws-lambda'

export const handler = async (event: APIGatewayProxyWebsocketEventV2) => {
  try {
    const { requestContext } = event
    const { connectionId } = requestContext
    const coordinates = await getLastCoordinates()
    await emit('coords')(connectionId, coordinates)
    return { statusCode: 200 }
  } catch (error) {
    console.error(error)
    return { statusCode: 500 }
  }
}
