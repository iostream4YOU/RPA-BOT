param name string
param location string
param tags object = {}
param tenantId string = subscription().tenantId
param administratorObjectId string
@secure()
param secrets array = []

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    tenantId: tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: [
      {
        tenantId: tenantId
        objectId: administratorObjectId
        permissions: {
          secrets: [
            'get'
            'list'
            'set'
            'delete'
          ]
        }
      }
    ]
    enabledForTemplateDeployment: true
    enabledForDeployment: true
    enabledForDiskEncryption: false
  }
}

resource vaultSecrets 'Microsoft.KeyVault/vaults/secrets@2023-02-01' = [for secret in secrets: if !empty(secret.value) {
  name: '${name}/${secret.name}'
  properties: {
    value: secret.value
  }
}]

output vaultName string = vault.name
output vaultUri string = vault.properties.vaultUri
