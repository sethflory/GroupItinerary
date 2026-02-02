# Azure Infrastructure Setup Instructions

## Overview

Group Itinerary app with:
- Static HTML/CSS/JS frontend
- Azure Functions API for photo storage
- Azure Functions API for AI proxy (Anthropic Claude)

## Required Azure Resources

### 1. Azure Storage Account
- **Purpose**: Store trip photos
- **SKU**: Standard_LRS (cheapest)
- **Settings**:
  - Allow blob public access: Yes
  - Create container: `trip-photos` with public blob access

### 2. Azure Static Web App
- **Purpose**: Host frontend + managed functions
- **SKU**: Free tier is fine
- **CRITICAL**: Must have managed functions enabled (happens automatically when you specify api_location during creation)

### 3. Environment Variables (set in Azure Static Web App)
| Variable | Purpose | Required |
|----------|---------|----------|
| `AZURE_STORAGE_CONNECTION_STRING` | Connection string for storage account (for photos API) | Yes |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude (required for trivia game) | Yes |

## GitHub Repository Structure

```
groupItinerary/
├── src/
│   └── index.html          # Main app (HTML/CSS/JS)
├── api/
│   ├── host.json           # Azure Functions config
│   ├── package.json        # API dependencies
│   ├── photos/
│   │   ├── function.json   # HTTP trigger config
│   │   └── index.js        # Photo CRUD logic
│   └── ai/
│       ├── function.json   # HTTP trigger config
│       └── index.js        # Anthropic proxy logic
├── staticwebapp.config.json
└── .github/workflows/azure-static-web-apps.yml
```

## Known Issues & Solutions

### Issue: Node.js Version Mismatch
- Azure managed functions support: Node 12, 14, 16, 18, 20 (preview)
- Oryx build system may use Node 22 which is NOT supported
- **Solution**: May need to specify `platform.apiRuntime` in staticwebapp.config.json:
  ```json
  {
    "platform": {
      "apiRuntime": "node:18"
    }
  }
  ```

### Issue: Dependencies Not Installing
- Oryx may fail to detect Node.js platform
- **Solution**: Add `api_build_command: "npm install"` to workflow

### Issue: Functions Return 500 with Empty Body
- Could indicate runtime version mismatch
- Could indicate missing environment variables
- **Solution**: Test with minimal function first (no dependencies)

## Step-by-Step Setup

### 1. Create Storage Account
```bash
az login
RESOURCE_GROUP="rg-group-itinerary"
LOCATION="eastus"
STORAGE_ACCOUNT="stgroupitinerary$(date +%s)"

az group create --name $RESOURCE_GROUP --location $LOCATION

az storage account create \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --location $LOCATION \
  --sku Standard_LRS \
  --allow-blob-public-access true

az storage container create \
  --name trip-photos \
  --account-name $STORAGE_ACCOUNT \
  --public-access blob

# Get connection string (save this!)
az storage account show-connection-string \
  --name $STORAGE_ACCOUNT \
  --resource-group $RESOURCE_GROUP \
  --query connectionString -o tsv
```

### 2. Create Static Web App via Azure Portal
1. Go to Azure Portal → Create Resource → Static Web App
2. Connect to GitHub repository
3. **Important settings**:
   - App location: `src`
   - API location: `api`
   - Output location: (leave empty)
4. Wait for GitHub Action to deploy

### 3. Configure Environment Variables
1. Go to Static Web App → Environment Variables
2. Add (both required):
   - `AZURE_STORAGE_CONNECTION_STRING` = (connection string from step 1)
   - `ANTHROPIC_API_KEY` = (your Anthropic API key from https://console.anthropic.com/)
3. Save

**Important**: The trivia game feature requires `ANTHROPIC_API_KEY` to be configured. Without it, the trivia functionality will not work.

### 4. Test
1. Visit your Static Web App URL
2. Test API: `https://YOUR-APP.azurestaticapps.net/api/photos`
3. Should return: `{"photos":[],"count":0,...}`

## Verification Checklist

- [ ] Static site loads at root URL
- [ ] `/api/test` returns "Test function works!" (if test function exists)
- [ ] `/api/photos` returns JSON (not 500 error)
- [ ] Photo upload works
- [ ] AI chat works (if AI function deployed)

## Fallback: Direct Anthropic API

If managed functions continue to fail, the app can call Anthropic directly from the browser:
- Requires `anthropic-dangerous-direct-browser-access: true` header
- Each user enters their own API key via Settings UI
- Key stored in localStorage (never committed to git)

## Resources

- [Azure Static Web Apps docs](https://docs.microsoft.com/en-us/azure/static-web-apps/)
- [Managed Functions in SWA](https://docs.microsoft.com/en-us/azure/static-web-apps/apis-functions)
- [Anthropic API docs](https://docs.anthropic.com/)
