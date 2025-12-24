param name string
param location string
param administratorLogin string
@secure()
param administratorPassword string
param databaseName string
param skuTier string = 'GeneralPurpose'
param skuName string = 'Standard_D2s_v3'
param skuCapacity int = 2
param storageSizeGB int = 64
param backupRetentionDays int = 7
param tags object = {}

resource server 'Microsoft.DBforPostgreSQL/flexibleServers@2022-12-01' = {
  name: name
  location: location
  tags: tags
  sku: {
    tier: skuTier
    name: skuName
    capacity: skuCapacity
  }
  properties: {
    version: '15'
    administratorLogin: administratorLogin
    administratorLoginPassword: administratorPassword
    storage: {
      storageSizeGB: storageSizeGB
      tier: 'P6'
    }
    backup: {
      backupRetentionDays: backupRetentionDays
      geoRedundantBackup: 'Disabled'
    }
    highAvailability: {
      mode: 'Disabled'
    }
    network: {
      publicNetworkAccess: 'Enabled'
    }
    availabilityZone: '1'
  }
}

resource database 'Microsoft.DBforPostgreSQL/flexibleServers/databases@2022-12-01' = {
  name: '${name}/${databaseName}'
  properties: {}
}

var fqdn = format('{0}.postgres.database.azure.com', name)
var connectionString = format('postgresql://{0}:{1}@{2}:5432/{3}', administratorLogin, administratorPassword, fqdn, databaseName)

output fullyQualifiedDomainName string = fqdn
output databaseNameOut string = database.name
output connectionString string = connectionString
