param environmentName string = 'prod'
param location string = resourceGroup().location
param containerAppName string
param containerAppsEnvironmentName string
param schedulerJobName string = '${containerAppName}-batch'
param containerImage string
param containerRegistryServer string
param containerRegistryUsername string
@secure()
param containerRegistryPassword string
param logAnalyticsWorkspaceName string
param storageAccountName string
param storageEnableHns bool = false
param keyVaultName string
param administratorObjectId string
param postgresServerName string
param postgresAdministratorLogin string = 'auditoradmin'
@secure()
param postgresAdministratorPassword string
param postgresDatabaseName string = 'auditor'
param auditApiKeySecretName string = 'auditor-api-key'
param alertWebhookSecretName string = 'auditor-alert-webhook'
param summaryWebhookSecretName string = 'auditor-summary-webhook'
param emailPasswordSecretName string = 'auditor-email-password'
param googleCredentialsSecretName string = 'auditor-google-credentials'
param databaseConnectionSecretName string = 'auditor-db-url'
param storageAccountKeySecretName string = 'auditor-storage-key'
@secure()
param auditApiKey string
@secure()
param alertWebhookUrl string
@secure()
param summaryWebhookUrl string = ''
@secure()
param emailPassword string = ''
@secure()
param googleCredentialsJson string = ''
param appEnvironment string = 'production'
param appLogLevel string = 'INFO'
param jobCronExpression string = '0 9 * * *'
param tags object = {}

var baseTags = union(
  {
    Project: 'rpa-auditor-bot'
    Environment: environmentName
  },
  tags
)

module logAnalytics './modules/logging.bicep' = {
  name: 'logAnalytics'
  params: {
    name: logAnalyticsWorkspaceName
    location: location
    tags: baseTags
  }
}

module storage './modules/storage.bicep' = {
  name: 'storage'
  params: {
    name: storageAccountName
    location: location
    tags: baseTags
    enableHierarchicalNamespace: storageEnableHns
  }
}

module postgres './modules/postgres.bicep' = {
  name: 'postgres'
  params: {
    name: postgresServerName
    location: location
    administratorLogin: postgresAdministratorLogin
    administratorPassword: postgresAdministratorPassword
    databaseName: postgresDatabaseName
    tags: baseTags
  }
}

var secretPayload = [
  {
    name: auditApiKeySecretName
    value: auditApiKey
  }
  {
    name: alertWebhookSecretName
    value: alertWebhookUrl
  }
  {
    name: summaryWebhookSecretName
    value: summaryWebhookUrl
  }
  {
    name: emailPasswordSecretName
    value: emailPassword
  }
  {
    name: googleCredentialsSecretName
    value: googleCredentialsJson
  }
  {
    name: databaseConnectionSecretName
    value: postgres.outputs.connectionString
  }
  {
    name: storageAccountKeySecretName
    value: storage.outputs.primaryKey
  }
]

module keyVault './modules/keyvault.bicep' = {
  name: 'keyvault'
  params: {
    name: keyVaultName
    location: location
    administratorObjectId: administratorObjectId
    tags: baseTags
    secrets: secretPayload
  }
}

var secretEnvMap = [
  {
    envName: 'AUDIT_API_KEY'
    keyVaultSecretName: auditApiKeySecretName
    secretAlias: 'auditor-api-key'
  }
  {
    envName: 'ALERT_WEBHOOK_URL'
    keyVaultSecretName: alertWebhookSecretName
    secretAlias: 'auditor-alert-webhook'
  }
  {
    envName: 'SUMMARY_WEBHOOK_URL'
    keyVaultSecretName: summaryWebhookSecretName
    secretAlias: 'auditor-summary-webhook'
  }
  {
    envName: 'AUDIT_EMAIL_PASSWORD'
    keyVaultSecretName: emailPasswordSecretName
    secretAlias: 'auditor-email-password'
  }
  {
    envName: 'GOOGLE_APPLICATION_CREDENTIALS_JSON'
    keyVaultSecretName: googleCredentialsSecretName
    secretAlias: 'auditor-google-credentials'
  }
  {
    envName: 'DATABASE_URL'
    keyVaultSecretName: databaseConnectionSecretName
    secretAlias: 'auditor-db-url'
  }
  {
    envName: 'STORAGE_ACCOUNT_KEY'
    keyVaultSecretName: storageAccountKeySecretName
    secretAlias: 'auditor-storage-key'
  }
]

var plainEnv = [
  {
    name: 'APP_ENV'
    value: appEnvironment
  }
  {
    name: 'LOG_LEVEL'
    value: appLogLevel
  }
  {
    name: 'STORAGE_ACCOUNT_NAME'
    value: storageAccountName
  }
  {
    name: 'AZURE_REGION'
    value: location
  }
]

module containerApp './modules/containerapp.bicep' = {
  name: 'containerApp'
  params: {
    name: containerAppName
    environmentName: containerAppsEnvironmentName
    location: location
    image: containerImage
    registryServer: containerRegistryServer
    registryUsername: containerRegistryUsername
    registryPassword: containerRegistryPassword
    logAnalyticsWorkspaceId: logAnalytics.outputs.workspaceId
    logAnalyticsSharedKey: logAnalytics.outputs.sharedKey
    keyVaultName: keyVaultName
    secretEnvVars: secretEnvMap
    plainEnvVars: plainEnv
    tags: baseTags
  }
}

module containerJob './modules/containerappjob.bicep' = {
  name: 'containerJob'
  params: {
    name: schedulerJobName
    location: location
    managedEnvironmentId: containerApp.outputs.managedEnvironmentId
    image: containerImage
    cronExpression: jobCronExpression
    registryServer: containerRegistryServer
    registryUsername: containerRegistryUsername
    registryPassword: containerRegistryPassword
    keyVaultName: keyVaultName
    secretEnvVars: secretEnvMap
    plainEnvVars: concat(plainEnv, [
      {
        name: 'JOB_MODE'
        value: 'batch'
      }
    ])
    tags: baseTags
  }
}

output containerAppUrl string = containerApp.outputs.fqdn
output keyVaultUri string = keyVault.outputs.vaultUri
output postgresFqdn string = postgres.outputs.fullyQualifiedDomainName
