param name string
param location string
param tags object = {}
param enableHierarchicalNamespace bool = false

resource account 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    accessTier: 'Hot'
    minimumTlsVersion: 'TLS1_2'
    allowBlobPublicAccess: false
    supportsHttpsTrafficOnly: true
    isHnsEnabled: enableHierarchicalNamespace
  }
}

output storageAccountName string = account.name
output primaryKey string = listKeys(account.id, '2022-09-01').keys[0].value
output blobEndpoint string = account.properties.primaryEndpoints.blob
