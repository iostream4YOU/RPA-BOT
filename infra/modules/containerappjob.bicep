param name string
param location string
param managedEnvironmentId string
param image string
param cronExpression string
param registryServer string
param registryUsername string
@secure()
param registryPassword string
param keyVaultName string
param secretEnvVars array = [] // [{ envName, keyVaultSecretName, secretAlias }]
param plainEnvVars array = []
param cpu float = 0.5
param memory string = '1Gi'
param parallelism int = 1
param replicaTimeout int = 1800
param tags object = {}

var registrySecretName = 'job-registry-password'
var kvSecretRefs = [for secret in secretEnvVars: {
  name: secret.secretAlias
  value: format('@Microsoft.KeyVault(VaultName={0};SecretName={1})', keyVaultName, secret.keyVaultSecretName)
}]

resource job 'Microsoft.App/jobs@2023-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: managedEnvironmentId
    configuration: {
      triggerType: 'Schedule'
      scheduleTriggerConfig: {
        cronExpression: cronExpression
        parallelism: parallelism
        replicaCompletionCount: 1
        replicaTimeout: replicaTimeout
      }
      registries: [
        {
          server: registryServer
          username: registryUsername
          passwordSecretRef: registrySecretName
        }
      ]
      secrets: concat(
        [
          {
            name: registrySecretName
            value: registryPassword
          }
        ],
        kvSecretRefs
      )
    }
    template: {
      containers: [
        {
          image: image
          name: '${name}-worker'
          resources: {
            cpu: cpu
            memory: memory
          }
          env: concat(
            [for envVar in plainEnvVars: {
              name: envVar.name
              value: envVar.value
            }],
            [for secret in secretEnvVars: {
              name: secret.envName
              secretRef: secret.secretAlias
            }]
          )
        }
      ]
    }
  }
}
