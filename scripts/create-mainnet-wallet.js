const fs = require('fs');
const { Keypair } = require('@solana/web3.js');
const bs58 = require('bs58');

// Get the private key from environment variables
const privateKeyBase58 = process.env.MAINNET_WALLET_PRIVATE_KEY;

if (!privateKeyBase58) {
    console.error('MAINNET_WALLET_PRIVATE_KEY not found in environment');
    process.exit(1);
}

try {
    // Decode the base58 private key
    const privateKeyBytes = bs58.decode(privateKeyBase58);
    
    // Create keypair from the private key
    const keypair = Keypair.fromSecretKey(privateKeyBytes);
    
    // Convert to the format Anchor expects (array of numbers)
    const walletArray = Array.from(keypair.secretKey);
    
    // Write to mainnet-wallet.json
    fs.writeFileSync('./mainnet-wallet.json', JSON.stringify(walletArray));
    
    console.log('✅ Mainnet wallet created successfully!');
    console.log('📝 Wallet Address:', keypair.publicKey.toString());
    console.log('💾 Saved to: ./mainnet-wallet.json');
    
} catch (error) {
    console.error('❌ Error creating mainnet wallet:', error.message);
    process.exit(1);
}
