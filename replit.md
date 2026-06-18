# K-Space — Personal Knowledge OS

AI-powered second brain: notes (text/voice/image), AI synthesis, flashcards, mind maps, knowledge graph, chat.

## Database: Appwrite (Free, No Billing Required)

## Quick Start (Windows)

### Step 1 — Install Appwrite Desktop
Download from: https://appwrite.io/desktop
Install it → it runs Appwrite locally on your machine (no Docker, no billing)

### Step 2 — Create Project in Appwrite Console
1. Open http://localhost/console in browser
2. Create account → Create project → name it "kspace"
3. Copy the Project ID from Project Settings

### Step 3 — Create API Key
1. Project Settings → API Keys → Create API Key
2. Name: "kspace-server"
3. Scopes: select ALL database scopes
4. Copy the API key

### Step 4 — Setup .env
```cmd
cd artifacts\api-server
copy .env.example .env
```
Open .env and fill in:
- APPWRITE_PROJECT_ID = (from step 2)
- APPWRITE_API_KEY = (from step 3)
- APPWRITE_DATABASE_ID = kspace
- APPWRITE_ENDPOINT = http://localhost/v1

### Step 5 — Install dependencies
```cmd
cd C:\path\to\kspace-project
pnpm install
```

### Step 6 — Create collections automatically
```cmd
node scripts/setup-appwrite.js
```
This creates all 6 collections with correct attributes in one command.

### Step 7 — Run
Terminal 1 (Backend):
```cmd
pnpm --filter @workspace/api-server run dev:win
```

Terminal 2 (Frontend):
```cmd
pnpm --filter @workspace/knowledge-workspace run dev
```

Open http://localhost:5173

## Collections
| Collection      | Purpose                      |
|----------------|------------------------------|
| notes          | All notes                    |
| blocks         | Text/voice/image blocks      |
| blockLinks     | Connections between blocks   |
| flashcardDecks | Flashcard deck metadata      |
| flashcards     | Cards with SM-2 review data  |
| mindMaps       | Mind map trees (JSON)        |

## Environment Variables
| Variable               | Required | Description                    |
|-----------------------|----------|-------------------------------|
| APPWRITE_ENDPOINT     | Yes      | http://localhost/v1           |
| APPWRITE_PROJECT_ID   | Yes      | From Appwrite Console         |
| APPWRITE_API_KEY      | Yes      | From Appwrite API Keys        |
| APPWRITE_DATABASE_ID  | Yes      | kspace (or your choice)       |
| OPENAI_API_KEY        | No       | For AI features               |
| PORT                  | No       | Default: 5000                 |
