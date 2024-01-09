import { DynamoDBClient } from '@aws-sdk/client-dynamodb'
import {
  DynamoDBDocumentClient,
  PutCommand,
  QueryCommand,
  GetCommand,
  DeleteCommand,
  BatchWriteCommand,
} from '@aws-sdk/lib-dynamodb'

const TABLE_NAME = process.env.TABLE_NAME as string
// const TTL_DELTA = 60 * 60 * 24 * 7

const dynamoClient = new DynamoDBClient()
export const client = DynamoDBDocumentClient.from(dynamoClient)

export async function getConnections() {
  const params = {
    TableName: TABLE_NAME,
    KeyConditionExpression: '#pk = :pk',
    ExpressionAttributeNames: { '#pk': 'PK' },
    ExpressionAttributeValues: { ':pk': 'CONNECTION' },
    ProjectionExpression: 'SK',
  }
  const command = new QueryCommand(params)
  const response = await client.send(command)
  const items = response.Items || []
  const ret: string[] = items.map(item => item.SK)
  return ret
}

export function putConnection(id: string) {
  const ts = Math.floor(Date.now() / 1000)
  const item = { PK: 'CONNECTION', SK: id, ts }
  const putParams = { TableName: TABLE_NAME, Item: item }
  const putCommand = new PutCommand(putParams)
  return client.send(putCommand)
}

export function destroyConnection(id: string) {
  const key = { PK: 'CONNECTION', SK: id }
  const params = { TableName: TABLE_NAME, Key: key }
  const command = new DeleteCommand(params)
  return client.send(command)
}

export async function batchDestroyConnections(ids: string[]) {
  if (!ids.length) {
    return Promise.resolve()
  }

  const requests = ids.map(id => {
    return { DeleteRequest: { Key: { PK: 'CONNECTION', SK: id } } }
  })
  const params = { RequestItems: { [TABLE_NAME]: requests } }
  const command = new BatchWriteCommand(params)
  return client.send(command)
}

export async function getLastCoordinates() {
  const params = {
    TableName: TABLE_NAME,
    Key: { PK: 'LAST_LOCATION', SK: 'SELF' },
    ProjectionExpression: 'coords',
  }
  const command = new GetCommand(params)
  const response = await client.send(command)
  return response.Item?.coords || null
}

export async function putLastCoordinates(coords: any) {
  const ts = Math.floor(Date.now() / 1000)
  const item = { PK: 'LAST_LOCATION', SK: 'SELF', coords, ts }
  const params = { TableName: TABLE_NAME, Item: item }
  const command = new PutCommand(params)
  return client.send(command)
}
