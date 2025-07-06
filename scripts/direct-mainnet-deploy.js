const { execSync } = require('child_process');
const fs = require('fs');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

console.log('🚀 Direct Mainnet Deployment - Bypassing Anchor CLI Issues...\n');

// Configuration
const MAINNET_RPC = 'https://mainnet.helius-rpc.com/?api-key=6b52d42b-5d24-4841-a093-02b0d2cc9fc0';
const WALLET_PATH = './mainnet-wallet.json';
const PROGRAM_SO_PATH = './target/deploy/terminal_staking.so';
const PROGRAM_ID = 'Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7';

async function checkPrerequisites() {
    console.log('🔍 Checking deployment prerequisites...\n');
    
    // Check if wallet exists
    if (!fs.existsSync(WALLET_PATH)) {
        console.error('❌ Mainnet wallet not found. Run: node scripts/create-mainnet-wallet.js');
        process.exit(1);
    }
    
    // Check if compiled program exists
    if (!fs.existsSync(PROGRAM_SO_PATH)) {
        console.error('❌ Compiled program not found. Need to build first.');
        console.log('💡 Try running: cargo build-sbf --manifest-path=programs/terminal-staking/Cargo.toml --sbf-out-dir=target/deploy');
        process.exit(1);
    }
    
    console.log('✅ Wallet file found');
    console.log('✅ Compiled program found');
    
    const stats = fs.statSync(PROGRAM_SO_PATH);
    console.log(`📊 Program size: ${(stats.size / 1024).toFixed(2)} KB`);
}

async function checkWalletBalance() {
    try {
        const connection = new Connection(MAINNET_RPC, 'confirmed');
        const walletData = JSON.parse(fs.readFileSync(WALLET_PATH));
        const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        
        const balance = await connection.getBalance(wallet.publicKey);
        const solBalance = balance / 1e9;
        
        console.log(`\n💰 Deployment Wallet: ${wallet.publicKey.toString()}`);
        console.log(`💰 Current Balance: ${solBalance} SOL`);
        
        const requiredSOL = 3.0; // Conservative estimate
        if (solBalance < requiredSOL) {
            console.error(`❌ Insufficient balance. Need at least ${requiredSOL} SOL for deployment.`);
            console.log('\n💡 Add SOL to your wallet:');
            console.log(`   solana transfer ${requiredSOL} ${wallet.publicKey.toString()} --url mainnet-beta`);
            process.exit(1);
        }
        
        console.log('✅ Sufficient balance for deployment');
        return wallet;
    } catch (error) {
        console.error('❌ Error checking wallet balance:', error.message);
        process.exit(1);
    }
}

async function configureSolanaCLI() {
    console.log('\n⚙️  Configuring Solana CLI for mainnet...');
    
    try {
        // Set mainnet RPC
        execSync('solana config set --url mainnet-beta', { stdio: 'inherit' });
        
        // Set deployer keypair
        execSync(`solana config set --keypair ${WALLET_PATH}`, { stdio: 'inherit' });
        
        // Verify configuration
        console.log('\n📋 Current Solana CLI configuration:');
        execSync('solana config get', { stdio: 'inherit' });
        
        console.log('\n✅ Solana CLI configured for mainnet deployment');
    } catch (error) {
        console.error('❌ Error configuring Solana CLI:', error.message);
        process.exit(1);
    }
}

async function deployProgram() {
    console.log('\n🚀 Deploying program to Solana Mainnet...');
    console.log('⏳ This may take several minutes...\n');
    
    try {
        // Deploy using Solana CLI directly
        const deployCommand = `solana program deploy ${PROGRAM_SO_PATH} --program-id ${PROGRAM_ID}`;
        console.log(`Executing: ${deployCommand}\n`);
        
        execSync(deployCommand, { stdio: 'inherit' });
        
        console.log('\n✅ Program deployed successfully!');
        return true;
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        
        // Provide troubleshooting info
        console.log('\n🔧 Troubleshooting:');
        console.log('1. Ensure you have enough SOL (3+ SOL recommended)');
        console.log('2. Check network connectivity');
        console.log('3. Verify the program ID is correct');
        console.log('\n💡 Alternative: Try deploying without specifying program ID:');
        console.log(`   solana program deploy ${PROGRAM_SO_PATH}`);
        
        return false;
    }
}

async function verifyDeployment() {
    console.log('\n🔍 Verifying deployment...');
    
    try {
        const connection = new Connection(MAINNET_RPC, 'confirmed');
        const programId = new PublicKey(PROGRAM_ID);
        
        console.log(`Checking program: ${PROGRAM_ID}`);
        
        const accountInfo = await connection.getAccountInfo(programId);
        if (accountInfo) {
            console.log('✅ Program successfully deployed and verified on mainnet!');
            console.log(`📊 Program data length: ${accountInfo.data.length} bytes`);
            console.log(`👤 Program owner: ${accountInfo.owner.toString()}`);
            console.log(`💸 Rent epoch: ${accountInfo.rentEpoch}`);
            return true;
        } else {
            console.error('❌ Program not found on mainnet after deployment');
            return false;
        }
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

async function checkProgramUsingCLI() {
    console.log('\n🔍 Double-checking with Solana CLI...');
    
    try {
        execSync(`solana program show ${PROGRAM_ID}`, { stdio: 'inherit' });
        return true;
    } catch (error) {
        console.log('⚠️  Could not retrieve program info via CLI');
        return false;
    }
}

async function printDeploymentSummary(wallet) {
    console.log('\n' + '='.repeat(70));
    console.log('🎉 MAINNET DEPLOYMENT SUCCESSFUL!');
    console.log('='.repeat(70));
    console.log(`📍 Program ID: ${PROGRAM_ID}`);
    console.log(`💼 Deployer Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🌐 Network: Solana Mainnet-Beta`);
    console.log(`🔗 RPC Endpoint: ${MAINNET_RPC}`);
    console.log(`📦 Program Size: ${(fs.statSync(PROGRAM_SO_PATH).size / 1024).toFixed(2)} KB`);
    
    console.log('\n🔗 Explorer Links:');
    console.log(`Solscan: https://solscan.io/account/${PROGRAM_ID}`);
    console.log(`Solana Beach: https://solanabeach.io/address/${PROGRAM_ID}`);
    console.log(`Solana Explorer: https://explorer.solana.com/address/${PROGRAM_ID}`);
    
    console.log('\n📋 Next Steps:');
    console.log('1. ✅ Update frontend configuration with deployed program ID');
    console.log('2. 🏊‍♂️ Initialize staking pools for your NFT collections');
    console.log('3. 🪙 Configure reward token minting');
    console.log('4. 🧪 Test staking functionality with small amounts');
    console.log('5. 📊 Set up monitoring and analytics');
    
    console.log('\n🔧 Frontend Configuration Update:');
    console.log('Replace in your frontend config:');
    console.log(`   PROGRAM_ID: "${PROGRAM_ID}"`);
    console.log(`   NETWORK: "mainnet-beta"`);
    console.log(`   RPC_ENDPOINT: "${MAINNET_RPC}"`);
    
    console.log('\n🎯 System Status: READY FOR PRODUCTION!');
    console.log('='.repeat(70));
}

// Main deployment function
async function main() {
    try {
        console.log('🌟 Terminal NFT Staking System - Direct Mainnet Deployment\n');
        
        // Step 1: Check prerequisites
        await checkPrerequisites();
        
        // Step 2: Check wallet balance
        const wallet = await checkWalletBalance();
        
        // Step 3: Configure Solana CLI
        await configureSolanaCLI();
        
        // Step 4: Deploy program
        const deploySuccess = await deployProgram();
        
        if (!deploySuccess) {
            console.log('\n❌ Deployment failed. Please check the errors above and try again.');
            process.exit(1);
        }
        
        // Step 5: Verify deployment
        const verifySuccess = await verifyDeployment();
        
        // Step 6: CLI verification
        await checkProgramUsingCLI();
        
        // Step 7: Print summary
        if (verifySuccess) {
            await printDeploymentSummary(wallet);
        } else {
            console.log('\n⚠️  Deployment completed but verification had issues.');
            console.log('The program may still be successfully deployed.');
            console.log('Check the explorer links manually to confirm.');
        }
        
    } catch (error) {
        console.error('\n💥 Unexpected error during deployment:', error.message);
        console.log('\n🆘 If you need help, please:');
        console.log('1. Check your SOL balance is sufficient');
        console.log('2. Verify network connectivity');
        console.log('3. Ensure Solana CLI is properly installed');
        process.exit(1);
    }
}

// Run deployment
main();
