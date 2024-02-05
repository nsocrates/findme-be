import * as pulumi from '@pulumi/pulumi'
import * as aws from '@pulumi/aws'

type lambdaFactoryParams = {
  name: string
  roleArn: string | pulumi.Input<string>
  fileAssetPath: string
  variables?: { [key: string]: any }
  [key: string]: any
}

function lambdaFactory(params: lambdaFactoryParams) {
  const { name, roleArn, variables, fileAssetPath, ...rest } = params
  const code = new pulumi.asset.AssetArchive({
    'index.js': new pulumi.asset.FileAsset(fileAssetPath),
    'package.json': new pulumi.asset.StringAsset(JSON.stringify({
      name,
      version: '0.0.1',
      main: 'index.js',
    })),
  })

  return new aws.lambda.Function(name, {
    name,
    code,
    role: roleArn,
    runtime: aws.lambda.Runtime.NodeJS18dX,
    handler: 'index.handler',
    environment: { variables },
    ...rest,
  })
}

export default lambdaFactory
