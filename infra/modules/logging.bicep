param name string
param location string
param tags object = {}
param retentionInDays int = 30

resource workspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: name
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: retentionInDays
    features: {
      searchVersion: 2
    }
  }
}

output workspaceId string = workspace.properties.customerId
output workspaceResourceId string = workspace.id
output sharedKey string = listKeys(workspace.id, '2020-08-01').primarySharedKey
