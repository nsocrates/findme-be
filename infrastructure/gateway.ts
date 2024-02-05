import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import { PROJECT_NAME } from './constants'

type addIntegratedRouteParams = {
  routeKey: string
  invokeArn: pulumi.Input<string>
  credentialsArn?: pulumi.Input<string>
}

class Gateway {
  name: string
  stack: string
  api: aws.apigatewayv2.Api
  stage: aws.apigatewayv2.Stage | null

  constructor(name: string) {
    const stack = pulumi.getStack()
    const api = new aws.apigatewayv2.Api(name, {
      name,
      protocolType: 'WEBSOCKET',
      routeSelectionExpression: '$request.body.action',
      tags: { Project: PROJECT_NAME },
    })

    this.name = name
    this.stack = stack
    this.api = api
    this.stage = null
  }

  addIntegratedRoute(params: addIntegratedRouteParams) {
    const { routeKey, invokeArn, credentialsArn } = params
    const apiId = this.api.id

    const integration = new aws.apigatewayv2.Integration(routeKey, {
      apiId,
      credentialsArn,
      integrationType: 'AWS_PROXY',
      integrationUri: invokeArn,
      contentHandlingStrategy: 'CONVERT_TO_TEXT',
    })

    const target = pulumi.interpolate`integrations/${integration.id}`
    return new aws.apigatewayv2.Route(routeKey, { routeKey, apiId, target })
  }

  deploy(opts: pulumi.ResourceOptions) {
    const { name, stack, api } = this
    const apiId = api.id
    const deployment = new aws.apigatewayv2.Deployment(name, { apiId }, opts)
    const stage = new aws.apigatewayv2.Stage(name, {
      apiId,
      deploymentId: deployment.id,
      name: stack,
      defaultRouteSettings: {
        loggingLevel: 'OFF',
        throttlingBurstLimit: 50,
        throttlingRateLimit: 25,
      },
      tags: { Project: PROJECT_NAME, Stack: stack },
    })

    this.stage = stage
  }
}

export default Gateway
