const { execSync } = require('child_process');
const fs = require('fs');
const { Connection, PublicKey, Keypair } = require('@solana/web3.js');

console.log('🚀 Starting Mainnet Deployment of Terminal Staking System...\n');

// Configuration
const MAINNET_RPC = 'https://mainnet.helius-rpc.com/?api-key=6b52d42b-5d24-4841-a093-02b0d2cc9fc0';
const WALLET_PATH = './mainnet-wallet.json';

async function checkWalletBalance() {
    try {
        const connection = new Connection(MAINNET_RPC, 'confirmed');
        const walletData = JSON.parse(fs.readFileSync(WALLET_PATH));
        const wallet = Keypair.fromSecretKey(new Uint8Array(walletData));
        
        const balance = await connection.getBalance(wallet.publicKey);
        const solBalance = balance / 1e9;
        
        console.log(`💰 Wallet Address: ${wallet.publicKey.toString()}`);
        console.log(`💰 Wallet Balance: ${solBalance} SOL`);
        
        if (solBalance < 0.1) {
            console.error('❌ Insufficient balance. Need at least 0.1 SOL for deployment.');
            process.exit(1);
        }
        
        return wallet;
    } catch (error) {
        console.error('❌ Error checking wallet balance:', error.message);
        process.exit(1);
    }
}

async function buildProgram() {
    console.log('\n📦 Building Anchor program...');
    try {
        execSync('anchor build', { stdio: 'inherit' });
        console.log('✅ Program built successfully!');
    } catch (error) {
        console.error('❌ Build failed:', error.message);
        process.exit(1);
    }
}

async function deployProgram() {
    console.log('\n🚀 Deploying to Mainnet...');
    try {
        execSync('anchor deploy --provider.cluster mainnet', { stdio: 'inherit' });
        console.log('✅ Program deployed successfully!');
    } catch (error) {
        console.error('❌ Deployment failed:', error.message);
        console.log('\n💡 Note: If this fails due to program authority, you may need to:');
        console.log('   1. Set the program authority to your wallet');
        console.log('   2. Or deploy with a new program ID');
        process.exit(1);
    }
}

async function verifyDeployment() {
    console.log('\n🔍 Verifying deployment...');
    try {
        const connection = new Connection(MAINNET_RPC, 'confirmed');
        const programId = new PublicKey('Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7');
        
        const accountInfo = await connection.getAccountInfo(programId);
        if (accountInfo) {
            console.log('✅ Program deployed and verified on mainnet!');
            console.log(`📍 Program ID: ${programId.toString()}`);
            return true;
        } else {
            console.error('❌ Program not found on mainnet');
            return false;
        }
    } catch (error) {
        console.error('❌ Verification failed:', error.message);
        return false;
    }
}

async function generateIdl() {
    console.log('\n📄 Generating IDL...');
    try {
        execSync('anchor idl init --filepath target/idl/terminal_staking.json Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7 --provider.cluster mainnet', { stdio: 'inherit' });
        console.log('✅ IDL uploaded to mainnet!');
    } catch (error) {
        console.log('⚠️  IDL upload may have failed, but deployment is complete');
    }
}

async function printDeploymentSummary(wallet) {
    console.log('\n' + '='.repeat(60));
    console.log('🎉 MAINNET DEPLOYMENT COMPLETE!');
    console.log('='.repeat(60));
    console.log(`📍 Program ID: Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7`);
    console.log(`💼 Deployer Wallet: ${wallet.publicKey.toString()}`);
    console.log(`🌐 Network: Solana Mainnet`);
    console.log(`🔗 RPC: ${MAINNET_RPC}`);
    console.log('\n📋 Next Steps:');
    console.log('1. Update frontend with mainnet program ID');
    console.log('2. Initialize staking pools for your collections');
    console.log('3. Configure reward tokens');
    console.log('4. Test staking functionality');
    console.log('\n🔧 Frontend Configuration:');
    console.log('   SOLANA_NETWORK=mainnet');
    console.log('   PROGRAM_ID=Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7');
    console.log('='.repeat(60));
}

// Main deployment function
async function main() {
    try {
        // Step 1: Check wallet balance
        const wallet = await checkWalletBalance();
        
        // Step 2: Build program
        await buildProgram();
        
        // Step 3: Deploy program
        await deployProgram();
        
        // Step 4: Verify deployment
        const verified = await verifyDeployment();
        
        if (verified) {
            // Step 5: Upload IDL
            await generateIdl();
            
            // Step 6: Print summary
            await printDeploymentSummary(wallet);
        }
        
    } catch (error) {
        console.error('\n❌ Deployment failed:', error.message);
        process.exit(1);
    }
}

// Run deployment
main();
