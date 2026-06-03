# 🎨 Visual Whiteboard — Executable Architecture Platform

A real-time collaborative visual whiteboard that transcends simple drawing to become a full-fledged architectural design tool.

## 🚀 Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React.js + Fabric.js |
| Real-time | WebSockets (Socket.io) |
| Backend | Node.js + Express |
| State Sync | Redis |
| Styling | Tailwind CSS |

## ✨ Key Features

### 1. 🧹 Mass Clean Up
One-click auto-alignment of all elements on the board into a clean, structured layout.

### 2. 🤖 Architecture Assist
AI-powered suggestions for APIs, DBMS choices, missing components, scalability improvements, and performance tips.

### 3. 📎 Context Layer
Attach notes, links, code snippets, and files to any element — making the whiteboard a fully executable architecture document.

### 4. 🤝 Real-Time Collaboration
Multiple users can draw, edit, and annotate simultaneously with live state sync via WebSockets + Redis.

## 📁 Project Structure

```
visual-whiteboard/
├── frontend/          # React app
│   ├── src/
│   │   ├── components/
│   │   │   ├── Whiteboard.jsx       # Main canvas component
│   │   │   ├── Toolbar.jsx          # Tools sidebar
│   │   │   ├── ContextPanel.jsx     # Context layer panel
│   │   │   ├── ArchitectAssist.jsx  # AI suggestions modal
│   │   │   └── CollabCursors.jsx    # Live user cursors
│   │   ├── hooks/
│   │   │   ├── useSocket.js         # WebSocket hook
│   │   │   └── useFabric.js         # Fabric.js canvas hook
│   │   ├── store/
│   │   │   └── whiteboardStore.js   # Zustand state store
│   │   └── utils/
│   │       ├── cleanup.js           # Mass cleanup algorithm
│   │       └── fabricHelpers.js     # Canvas utilities
│   └── package.json
├── backend/           # Node.js API
│   ├── src/
│   │   ├── index.js                 # Entry point
│   │   ├── socket/
│   │   │   └── socketHandler.js     # WebSocket events
│   │   ├── routes/
│   │   │   ├── board.js             # Board CRUD routes
│   │   │   └── assist.js            # Architecture Assist route
│   │   └── middleware/
│   │       └── redis.js             # Redis client + helpers
│   └── package.json
└── docker-compose.yml # Redis + app containers
```

## 🛠️ Getting Started (Windows — No Docker, No Redis needed!)

### Prerequisites
- [Node.js 18+](https://nodejs.org/) — that's it!

### Step 1 — Setup Backend
```cmd
cd backend
copy .env.example .env
npm install
npm run dev
```
You'll see:
```
[Storage] ✅ App will work fine! Using in-memory store.
🚀 Visual Whiteboard backend running on port 3001
```

### Step 2 — Setup Frontend
Open a **second terminal window**, then:
```cmd
cd frontend
npm install
npm run dev
```

### Step 3 — Open the app
Visit 👉 [http://localhost:5173](http://localhost:5173)

---

### Want Redis for production? (Optional)
Redis is only needed when deploying to a server with multiple instances.
For local dev and interviews, in-memory mode works perfectly.

If you ever want Redis on Windows:
- Download installer from: https://github.com/microsoftarchive/redis/releases
- Install `Redis-x64-3.0.504.msi` (~5 MB)
- It runs as a Windows service automatically
- Then set `REDIS_URL=redis://localhost:6379` in your `.env`

## 🎯 Why This Project Stands Out

- **Not just a CRUD app** — real-time multi-user state management
- **AI integration** — Architecture Assist adds genuine intelligence
- **Production patterns** — Redis pub/sub, WebSocket rooms, Fabric.js canvas management
- **Portfolio-ready** — demonstrates frontend, backend, DevOps, and AI integration skills
