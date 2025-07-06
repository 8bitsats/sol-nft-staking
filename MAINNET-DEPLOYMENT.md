# 🚀 Terminal Staking System - Mainnet Deployment Guide

This guide will walk you through deploying the Terminal NFT Staking System to Solana Mainnet.

## 📋 Prerequisites

- Solana CLI installed and configured
- Anchor CLI (0.30.1)
- Node.js (v18+)
- Mainnet wallet with sufficient SOL (minimum 0.1 SOL for deployment)

## 🔑 Wallet Configuration

Your mainnet wallet has been configured with the following details:
- **Wallet Address**: `2VyiD3yEMG5jry5R3KrmggT4jq52LtvdTFNXpyr26SHB`
- **Private Key**: Already set in environment variables
- **Wallet File**: `./mainnet-wallet.json` (created automatically)

## 🚀 Deployment Steps

### Step 1: Verify Environment Setup

```bash
# Check your wallet balance
node scripts/deploy-mainnet.js
```

### Step 2: Build and Deploy (Option A - Automated)

```bash
# Run the complete deployment script
node scripts/deploy-mainnet.js
```

### Step 3: Manual Deployment (Option B - Step by Step)

If you prefer manual control over each step:

```bash
# 1. Build the program
anchor build

# 2. Deploy to mainnet
anchor deploy --provider.cluster mainnet

# 3. Initialize IDL
anchor idl init --filepath target/idl/terminal_staking.json Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7 --provider.cluster mainnet
```

## 📊 Program Information

- **Program ID**: `Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7`
- **Network**: Solana Mainnet
- **RPC Endpoint**: `https://mainnet.helius-rpc.com/?api-key=6b52d42b-5d24-4841-a093-02b0d2cc9fc0`

## 🔧 Frontend Configuration

After successful deployment, update your frontend configuration:

```javascript
// config/constants.js
export const PROGRAM_ID = new PublicKey('Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7');
export const NETWORK = 'mainnet';
export const RPC_ENDPOINT = 'https://mainnet.helius-rpc.com/?api-key=6b52d42b-5d24-4841-a093-02b0d2cc9fc0';
```

## 🏊‍♂️ Pool Initialization

After deployment, you'll need to initialize staking pools for your collections:

```javascript
// Example: Initialize a staking pool
const initializePool = async () => {
  const tx = await program.methods
    .initializePool(
      new BN(REWARD_RATE_PER_SECOND), // 1 token per hour
      MAX_TERMINALS // Maximum terminals that can be staked
    )
    .accounts({
      authority: wallet.publicKey,
      stakingPool: stakingPoolPDA,
      collection: collectionPubkey,
      rewardMint: rewardMintPubkey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
};
```

## 🪙 Token Setup

### Create Reward Token (if needed)

```bash
# Create a new SPL token for rewards
spl-token create-token --decimals 6

# Create token account for the pool
spl-token create-account <TOKEN_MINT>

# Mint initial supply to the pool
spl-token mint <TOKEN_MINT> 1000000 <POOL_TOKEN_ACCOUNT>
```

## 🔍 Verification

### Verify Program Deployment

```bash
# Check if program exists on mainnet
solana program show Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7 --url mainnet-beta
```

### Test Basic Functionality

```javascript
// Test connection to deployed program
const connection = new Connection('https://mainnet.helius-rpc.com/?api-key=6b52d42b-5d24-4841-a093-02b0d2cc9fc0');
const program = new Program(IDL, PROGRAM_ID, provider);

// Verify program exists
const programAccount = await connection.getAccountInfo(PROGRAM_ID);
console.log('Program deployed:', !!programAccount);
```

## 🛡️ Security Considerations

1. **Private Key Security**
   - Never commit `mainnet-wallet.json` to version control
   - Store private keys securely in production
   - Consider using hardware wallets for production deployments

2. **Program Authority**
   - Verify program upgrade authority is set correctly
   - Consider using a multisig for production upgrades

3. **Testing**
   - Test thoroughly on devnet before mainnet deployment
   - Start with small amounts and limited functionality

## 📈 Monitoring

### Key Metrics to Monitor

1. **Program Health**
   - Transaction success rate
   - Average transaction fees
   - Error rates

2. **Staking Metrics**
   - Total staked terminals
   - Total rewards distributed
   - Active users

3. **Financial Metrics**
   - SOL balance in authority wallet
   - Reward token distribution
   - Pool utilization

### Monitoring Tools

- **Solana Beach**: https://solanabeach.io/address/Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7
- **Solscan**: https://solscan.io/account/Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7
- **Custom Dashboard**: Use the provided backend monitoring system

## 🚨 Troubleshooting

### Common Issues

1. **Insufficient Balance**
   ```bash
   # Add SOL to deployment wallet
   solana transfer <AMOUNT> 2VyiD3yEMG5jry5R3KrmggT4jq52LtvdTFNXpyr26SHB --url mainnet-beta
   ```

2. **Program Authority Issues**
   ```bash
   # Check current program authority
   solana program show Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7 --url mainnet-beta
   ```

3. **IDL Upload Failures**
   ```bash
   # Manually upload IDL
   anchor idl upgrade target/idl/terminal_staking.json --provider.cluster mainnet
   ```

## 📞 Support

If you encounter issues during deployment:

1. Check the Anchor documentation: https://book.anchor-lang.com/
2. Review Solana program deployment guide: https://docs.solana.com/
3. Verify wallet balance and permissions
4. Check network status at https://status.solana.com/

## 🎉 Post-Deployment Checklist

- [ ] Program successfully deployed to mainnet
- [ ] IDL uploaded and accessible
- [ ] Frontend configured with mainnet program ID
- [ ] Staking pools initialized
- [ ] Reward tokens configured
- [ ] Basic functionality tested
- [ ] Monitoring systems active
- [ ] Security audit completed (recommended)

---

**⚠️ Important**: Always test thoroughly on devnet before mainnet deployment. Mainnet transactions involve real SOL and cannot be reversed.

**🔐 Security**: Keep your private keys secure and never share them publicly.
