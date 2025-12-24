# Azure IaC for RPA Auditor Bot

This folder contains a modular Bicep solution that provisions the cloud footprint required to run the Auditor Bot in Azure. The design targets Azure Container Apps for compute, a Flexible Server for PostgreSQL, Azure Storage for artifact retention, Azure Key Vault for secrets, and Log Analytics for observability. The modules can be reused independently, but `main.bicep` stitches them together into a single deployment.

## Topology

| Component | Description |
| --- | --- |
| `modules/logging.bicep` | Creates a Log Analytics workspace that backs Container Apps diagnostics. |
| `modules/storage.bicep` | Provisions a secure Storage Account for reports and exports. |
| `modules/postgres.bicep` | Deploys an Azure Database for PostgreSQL Flexible Server plus the primary database. |
| `modules/keyvault.bicep` | Creates an Azure Key Vault and seeds the secrets required by the app, including API keys and connection strings. |
| `modules/containerapp.bicep` | Builds the Container Apps managed environment and the primary FastAPI container. |
| `modules/containerappjob.bicep` | Adds a scheduled Container Apps Job that calls the batch-audit workflow on a cron interval. |

## Parameters

The main template accepts parameters for environment metadata, image registry details, cron schedule, and all required secret values. See `parameters.example.json` for a fully-populated sample. All sensitive parameters are marked as `secure()` so they can be supplied safely at deployment time (for example through Azure DevOps or GitHub Actions secrets).

Key secret inputs:

- `auditApiKey`, `alertWebhookUrl`, `summaryWebhookUrl`
- `postgresAdministratorPassword`
- `emailPassword`
- `googleCredentialsJson` (base64 or raw JSON string for the service account)
- `containerRegistryPassword`

## Deploying

1. Copy `parameters.example.json` to `parameters.prod.json` (or similar) and fill in real values and unique resource names.
2. Deploy into a resource group:

   ```bash
   az deployment group create \
     --resource-group <rg-name> \
     --template-file infra/main.bicep \
     --parameters @infra/parameters.prod.json
   ```

3. After deployment, note the outputs:
   - `containerAppUrl`: DNS name for the FastAPI service.
   - `keyVaultUri`: Endpoint where secrets are hosted.
   - `postgresFqdn`: Server address for manual administration.

## Recommended Workflow Integration

- Add an Azure Service Principal with permissions on the target resource group.
- Store all secure parameter values as GitHub Secrets or Azure Key Vault references.
- Invoke the deployment from CI/CD (e.g., `az deployment group create`) after the Docker image publish completes.

This IaC layout keeps the app, batch job, secrets, and data plane resources in lockstep so recreating an environment only requires a single Bicep deployment and an image reference.
