import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'
import path from 'node:path'
import Gateway from './gateway'
import lambdaFactory from './lambdaFactory'
import build from '../build'
import { PROJECT_NAME } from './constants'

async function main() {
  const STACK = pulumi.getStack()
  const config = new pulumi.Config()

  new aws.resourcegroups.Group('resourceGroup', {
    name: PROJECT_NAME + '-' + STACK,
    resourceQuery: {
      type: 'TAG_FILTERS_1_0',
      query: JSON.stringify({
        ResourceTypeFilters: ['AWS::Lambda::Function', 'AWS::DynamoDB::Table'],
        TagFilters: [
          { Key: 'Project', Values: [PROJECT_NAME] },
          { Key: 'Stack', Values: [STACK] },
        ],
      }),
    },
  })

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
    tags: { Project: PROJECT_NAME, Stack: STACK },
  })

  const serviceRole = new aws.iam.Role('serviceRole', {
    name: 'ServiceRole',
    managedPolicyArns: [
      aws.iam.ManagedPolicies.AWSLambdaBasicExecutionRole,
      aws.iam.ManagedPolicies.AmazonDynamoDBFullAccess,
      aws.iam.ManagedPolicies.AmazonAPIGatewayInvokeFullAccess,
    ],
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: [
        'lambda.amazonaws.com',
        'apigateway.amazonaws.com',
        'application-autoscaling.amazonaws.com',
      ],
    }),
    tags: { Project: PROJECT_NAME, Stack: STACK },
  })

  const readScalableTarget = new aws.appautoscaling.Target(
    'readScalableTarget',
    {
      minCapacity: 5,
      maxCapacity: 20,
      resourceId: pulumi.interpolate`table/${db.name}`,
      scalableDimension: 'dynamodb:table:ReadCapacityUnits',
      serviceNamespace: 'dynamodb',
      roleArn: serviceRole.arn,
      tags: { Project: PROJECT_NAME, Stack: STACK },
    }
  )

  const writeScalableTarget = new aws.appautoscaling.Target(
    'writeScalableTarget',
    {
      minCapacity: 5,
      maxCapacity: 20,
      resourceId: pulumi.interpolate`table/${db.name}`,
      scalableDimension: 'dynamodb:table:WriteCapacityUnits',
      serviceNamespace: 'dynamodb',
      roleArn: serviceRole.arn,
      tags: { Project: PROJECT_NAME, Stack: STACK },
    }
  )

  new aws.appautoscaling.Policy('readScalingPolicy', {
    policyType: 'TargetTrackingScaling',
    resourceId: readScalableTarget.resourceId,
    scalableDimension: readScalableTarget.scalableDimension,
    serviceNamespace: readScalableTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      targetValue: 70.0,
      predefinedMetricSpecification: {
        predefinedMetricType: 'DynamoDBReadCapacityUtilization',
      },
      scaleInCooldown: 60,
      scaleOutCooldown: 60,
    },
  })

  new aws.appautoscaling.Policy('writeScalingPolicy', {
    policyType: 'TargetTrackingScaling',
    resourceId: writeScalableTarget.resourceId,
    scalableDimension: writeScalableTarget.scalableDimension,
    serviceNamespace: writeScalableTarget.serviceNamespace,
    targetTrackingScalingPolicyConfiguration: {
      targetValue: 70.0,
      predefinedMetricSpecification: {
        predefinedMetricType: 'DynamoDBWriteCapacityUtilization',
      },
      scaleInCooldown: 60,
      scaleOutCooldown: 60,
    },
  })

  const cloudwatchRole = new aws.iam.Role('cloudwatchRole', {
    name: 'CloudwatchRole',
    managedPolicyArns: [aws.iam.ManagedPolicies.CloudWatchLogsFullAccess],
    assumeRolePolicy: aws.iam.assumeRolePolicyForPrincipal({
      Service: 'apigateway.amazonaws.com',
    }),
    tags: { Project: PROJECT_NAME, Stack: STACK },
  })

  new aws.apigateway.Account(PROJECT_NAME, {
    cloudwatchRoleArn: cloudwatchRole.arn,
  })

  const gateway = new Gateway(PROJECT_NAME)
  const lambdaPaths = await build()
  const dependencies: pulumi.Resource[] = []

  lambdaPaths.forEach(lambdaPath => {
    const basename = path.basename(lambdaPath, '.js')
    const lambdaName = `${PROJECT_NAME}-${basename}`
    const routeKey = basename.replace(/^(connect|disconnect|default)$/, '$$$1')
    const factoryParams = {
      name: lambdaName,
      fileAssetPath: lambdaPath,
      roleArn: serviceRole.arn,
      variables: {
        TABLE_NAME: db.name,
        DOMAIN_NAME: gateway.api.apiEndpoint.apply(endpoint => {
          return new URL(endpoint).hostname
        }),
        STAGE: gateway.stack,
        SECRET_KEY: config.requireSecret("secretKey"),
      },
      tags: { Project: PROJECT_NAME, Stack: STACK },
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
