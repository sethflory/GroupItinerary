# Group Itinerary - Athens & Bangalore 2026

An interactive group travel itinerary with photo sharing capabilities.

## Branches

- **trunk** - Static HTML version (no server required, share via email)
- **feature/azure-hosted** - Azure-hosted version with photo sharing

## Architecture (Azure-Hosted Version)

```
┌─────────────────────────────────────────────────────┐
│  Azure Static Web Apps                              │
│  - Hosts the HTML/CSS/JS from /src                  │
│  - Built-in CI/CD from GitHub                       │
│  - Custom domain + SSL                              │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Azure Functions (/api)                             │
│  - GET /api/photos → list photos from storage       │
│  - POST /api/photos → upload new photo              │
└─────────────────────────────────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────────┐
│  Azure Blob Storage                                 │
│  - Trip photos uploaded by travelers                │
│  - Public read access for photos                    │
└─────────────────────────────────────────────────────┘
```

## Setup Instructions

### Prerequisites

- Azure CLI installed (`az --version`)
- Node.js 18+ installed
- Azure subscription

### 1. Create Azure Resources

```bash
# Login to Azure
az login

# Set variables
RESOURCE_GROUP="rg-group-itinerary"
LOCATION="eastus"
STORAGE_ACCOUNT="stgroupitinerary$(date +%s)"

# Create resource group
az group create --name $RESOURCE_GROUP --location $LOCATION

# Create storage account for photos
az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --allow-blob-public-access true

# Create blob container
az storage container create \
  --name trip-photos \
  --account-name $STORAGE_ACCOUNT \
  --public-access blob

# Get connection string
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv
```

### 2. Configure Local Development

```bash
# Install API dependencies
cd api
npm install

# Update api/local.settings.json with your connection string
# Replace YOUR_STORAGE_CONNECTION_STRING_HERE with the connection string from step 1
```

### 3. Deploy to Azure Static Web Apps

#### Option A: Via Azure Portal

1. Go to Azure Portal → Create Resource → Static Web App
2. Connect to your GitHub repository
3. Set:
   - App location: `/src`
   - API location: `/api`
   - Output location: (leave empty)
4. Add Application Settings:
   - `AZURE_STORAGE_CONNECTION_STRING` = your connection string
   - `ANTHROPIC_API_KEY` = your Anthropic API key (for AI features)

#### Option B: Via Azure CLI

```bash
# Create Static Web App
az staticwebapp create \
  --name group-itinerary \
  --resource-group $RESOURCE_GROUP \
  --source https://github.com/YOUR_USERNAME/groupItinerary \
  --branch feature/azure-hosted \
  --app-location "/src" \
  --api-location "/api" \
  --login-with-github

# Add application settings
az staticwebapp appsettings set \
  --name group-itinerary \
  --resource-group $RESOURCE_GROUP \
  --setting-names AZURE_STORAGE_CONNECTION_STRING="YOUR_CONNECTION_STRING" \
  ANTHROPIC_API_KEY="YOUR_ANTHROPIC_API_KEY"
```

### 4. Local Development

```bash
# Install Azure Static Web Apps CLI
npm install -g @azure/static-web-apps-cli

# Start local dev server
swa start src --api-location api
```

## Project Structure

```
groupItinerary/
├── src/
│   └── index.html          # Main application
├── api/
│   ├── package.json        # API dependencies
│   ├── host.json           # Azure Functions config
│   ├── local.settings.json # Local dev settings (git-ignored)
│   └── photos/
│       ├── function.json   # Function bindings
│       └── index.js        # Photo API logic
├── staticwebapp.config.json # Azure Static Web Apps config
└── README.md
```

## Features

### Static Version (trunk)
- Single-file HTML, works offline
- Share via email attachment
- All features work without server

### Azure-Hosted Version (feature/azure-hosted)
- Everything from static version, plus:
- **Photo Upload** - Drag & drop photos from any device
- **Dynamic Gallery** - Photos appear for all travelers
- **Photo Lightbox** - Full-screen photo viewing
- Captions and attribution for photos

## Cost Estimate

- **Azure Static Web Apps**: Free tier (100GB bandwidth/month)
- **Azure Functions**: Free tier (1M executions/month)
- **Azure Blob Storage**: ~$0.02/GB/month

For a trip with ~100 photos, expect **< $1/month**.
