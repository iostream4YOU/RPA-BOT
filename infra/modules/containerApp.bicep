param name string
param environmentName string
param location string
param image string
param targetPort int = 8000
param registryServer string
param registryUsername string
@secure()
param registryPassword string
param logAnalyticsWorkspaceId string
param logAnalyticsSharedKey string
param cpu float = 1.0
param memory string = '2Gi'
param minReplicas int = 1
param maxReplicas int = 2
param keyVaultName string
param secretEnvVars array = [] // [{ envName, keyVaultSecretName, secretAlias }]
param plainEnvVars array = [] // [{ name, value }]
param tags object = {}

resource env 'Microsoft.App/managedEnvironments@2023-05-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsWorkspaceId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
}

var registrySecretName = 'registry-password'
var kvSecretRefs = [for secret in secretEnvVars: {
  name: secret.secretAlias
  value: format('@Microsoft.KeyVault(VaultName={0};SecretName={1})', keyVaultName, secret.keyVaultSecretName)
}]

resource app 'Microsoft.App/containerApps@2023-05-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    managedEnvironmentId: env.id
    configuration: {
      ingress: {
        external: true
        targetPort: targetPort
        transport: 'auto'
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
          name: '${name}-container'
          image: image
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
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

output managedEnvironmentId string = env.id
output fqdn string = app.properties.configuration.ingress.fqdn
