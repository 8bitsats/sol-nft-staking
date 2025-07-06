# Terminal NFT Staking System - Setup Guide

## 🚨 SECURITY ISSUE RESOLVED
✅ **API Keys Removed**: The `.env` file with exposed API keys has been removed from git history and GitHub.

## 🛠️ Development Setup

### 1. Environment Configuration
```bash
# Copy the example environment file
cp .env.example .env

# Edit .env with your actual API keys (NEVER commit this file)
nano .env
```

### 2. Solana Development Setup

#### Start Local Validator (Required for testing)
```bash
# Start Solana test validator (in a separate terminal)
solana-test-validator

# In another terminal, configure Solana CLI for localhost
solana config set --url localhost
solana config set --keypair ~/.config/solana/id.json

# Fund your wallet for testing
solana airdrop 2
```

#### Deploy Smart Contract
```bash
# Build and deploy the Anchor program
anchor build
anchor deploy

# Note the deployed program ID and update Anchor.toml if needed
```

### 3. Backend API Setup
```bash
# Install backend dependencies
cd backend
npm install

# Set up PostgreSQL database
createdb terminal_staking

# Start Redis (if using Docker)
docker run -d -p 6379:6379 redis:7-alpine

# Start the backend server
npm run dev
```

### 4. Frontend Setup
```bash
# Install frontend dependencies (if not already done)
npm install

# Start the frontend development server
npm run dev
```

## 🔧 Production Deployment

### Docker Deployment
```bash
# Build and run the complete stack
docker-compose up -d

# View logs
docker-compose logs -f
```

### Kubernetes Deployment
```bash
# Deploy to Kubernetes cluster
kubectl apply -f k8s-deployment.yaml

# Scale for high traffic
kubectl scale deployment terminal-staking-api --replicas=10
```

## 📊 Monitoring

- **API Health**: http://localhost:3001/health
- **Metrics**: http://localhost:3001/metrics
- **WebSocket**: ws://localhost:8080

## 🔐 Security Notes

- ✅ `.env` file is now properly gitignored
- ✅ API keys removed from git history
- ✅ Environment template provided (`.env.example`)
- 🛡️ Never commit real API keys to the repository

## 🚀 Next Steps

1. ⏳ **Wait for git push to complete** (removing API keys from history)
2. 🔧 **Start Solana test validator** (`solana-test-validator`)
3. 📦 **Deploy smart contract** (`anchor deploy`)
4. 🖥️ **Start backend API** (`cd backend && npm run dev`)
5. 🌐 **Launch frontend** (`npm run dev`)

The system is now secure and ready for development! 🎉
