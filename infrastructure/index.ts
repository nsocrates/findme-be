import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import path from 'node:path'
import Gateway from './gateway'
import lambdaFactory from './lambdaFactory'
import build from '../build'

async function main() {
  const config = new pulumi.Config()
  const PROJECT_NAME = config.require('PROJECT_NAME')

  const db = new aws.dynamodb.Table('db', {
    name: PROJECT_NAME,
    attributes: [
      { name: 'PK', type: 'S' },
      { name: 'SK', type: 'S' },
    ],
    hashKey: 'PK',
    rangeKey: 'SK',
    billingMode: 'PROVISIONED',
    tableClass: 'STANDARD',
    writeCapacity: 10,
    readCapacity: 10,
  })

  const serviceRole = new aws.iam.Role('serviceRole', {
    name: 'ServiceRole',
    managedPolicyArns: [
      aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
      aws.iam.ManagedPolicies.AmazonDynamoDBFullAccess,
      aws.iam.ManagedPolicies.AmazonAPIGatewayInvokeFullAccess,
    ],
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: ['lambda.amazonaws.com', 'apigateway.amazonaws.com'],
    }),
  })

  const cloudwatchRole = new aws.iam.Role('cloudwatchRole', {
    name: 'CloudwatchRole',
    managedPolicyArns: [aws.iam.ManagedPolicies.CloudWatchLogsFullAccess],
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: 'apigateway.amazonaws.com',
    }),
  })

  new aws.apigateway.Account(PROJECT_NAME, {
    cloudwatchRoleArn: cloudwatchRole.arn,
  })

  const gateway = new Gateway(PROJECT_NAME)
  const lambdaPaths = await build()
  const dependencies: pulumi.Resource[] = []

  lambdaPaths.forEach(lambdaPath => {
    const basename = path.basename(lambdaPath, '.js')
    const routeKey = basename.replace(/^(connect|disconnect|default)$/, '$$$1')
    const factoryParams = {
      name: basename,
      fileAssetPath: lambdaPath,
      roleArn: serviceRole.arn,
      variables: {
        TABLE_NAME: db.name,
        DOMAIN_NAME: gateway.api.apiEndpoint.apply(endpoint => {
          return new URL(endpoint).hostname
        }),
        STAGE: gateway.stack,
      },
    }

    const lambda = lambdaFactory(factoryParams)
    const { invokeArn } = lambda

    new aws.lambda.Permission(`${basename}GatewayInvokePermission`, {
      action: 'lambda:InvokeFunction',
      function: lambda,
      principal: 'apigateway.amazonaws.com',
      sourceArn: pulumi.interpolate`${gateway.api.executionArn}*`,
    })

    const route = gateway.addIntegratedRoute({ invokeArn, routeKey })
    dependencies.push(lambda, route)
  })

  gateway.deploy({ dependsOn: dependencies })

  return {
    apiEndpoint: gateway.api.apiEndpoint,
    invokeUrl: gateway.stage?.invokeUrl,
  }
}

export default main()
