const fs = require('fs');
const path = require('path');

class NFTDataLoader {
    constructor() {
        this.nftData = [];
        this.collectionSummary = null;
        this.loadCollectionData();
    }

    loadCollectionData() {
        try {
            // Load collection summary
            const summaryPath = path.join(__dirname, 'generated_metadata', 'collection_summary.json');
            this.collectionSummary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));

            // Load all NFT metadata
            const metadataDir = path.join(__dirname, 'generated_metadata');
            const files = fs.readdirSync(metadataDir);
            
            for (const file of files) {
                if (file.endsWith('.json') && file !== 'collection_summary.json') {
                    const filePath = path.join(metadataDir, file);
                    const metadata = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                    
                    // Extract token ID from filename
                    const tokenId = parseInt(path.basename(file, '.json'));
                    
                    // Check if corresponding image exists
                    const imagePath = path.join(__dirname, 'generated_images', `${tokenId}.png`);
                    if (fs.existsSync(imagePath)) {
                        this.nftData.push({
                            id: tokenId.toString(),
                            metadata: metadata,
                            imagePath: `./generated_images/${tokenId}.png`,
                            isStaked: false,
                            stakedTime: 0
                        });
                    }
                }
            }

            // Sort by token ID
            this.nftData.sort((a, b) => parseInt(a.id) - parseInt(b.id));
            
            console.log(`Loaded ${this.nftData.length} NFTs from collection: ${this.collectionSummary.collection_name}`);
            
        } catch (error) {
            console.error('Error loading NFT data:', error);
            this.nftData = [];
        }
    }

    getAllNFTs() {
        return this.nftData;
    }

    getRandomNFTs(count = 10) {
        const shuffled = [...this.nftData].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    }

    getNFTsByRarity(minRarity = 80) {
        return this.nftData.filter(nft => {
            const rarityTrait = nft.metadata.attributes.find(attr => attr.trait_type === 'Rarity Rank');
            return rarityTrait && rarityTrait.value >= minRarity;
        });
    }

    getNFTsByTraits(traits = {}) {
        return this.nftData.filter(nft => {
            return Object.entries(traits).every(([traitType, value]) => {
                const trait = nft.metadata.attributes.find(attr => attr.trait_type === traitType);
                return trait && trait.value === value;
            });
        });
    }

    getCollectionStats() {
        if (!this.collectionSummary) return null;
        
        return {
            name: this.collectionSummary.collection_name,
            symbol: this.collectionSummary.symbol,
            totalSupply: this.collectionSummary.total_supply,
            loadedCount: this.nftData.length,
            description: this.collectionSummary.description,
            traits: this.collectionSummary.traits,
            royaltyPercentage: this.collectionSummary.royalty_percentage,
            creatorAddress: this.collectionSummary.creator_address
        };
    }

    // Generate a JSON file with sample NFTs for the frontend
    generateFrontendData(sampleSize = 50) {
        const sampleNFTs = this.getRandomNFTs(sampleSize);
        const frontendData = {
            collection: this.getCollectionStats(),
            nfts: sampleNFTs.map((nft, index) => {
                // Simulate some NFTs being staked
                const isStaked = index < 3; // First 3 NFTs are staked
                const stakedTime = isStaked ? Date.now() - (Math.random() * 7 * 24 * 60 * 60 * 1000) : 0; // Random staking time up to 7 days
                
                return {
                    id: nft.id,
                    name: nft.metadata.name,
                    description: nft.metadata.description,
                    image: nft.imagePath,
                    attributes: nft.metadata.attributes,
                    symbol: nft.metadata.symbol,
                    rarity: nft.metadata.attributes.find(attr => attr.trait_type === 'Rarity Rank')?.value || 0,
                    isStaked: isStaked,
                    stakedTime: stakedTime
                };
            })
        };

        // Write to a file that the frontend can use
        const outputPath = path.join(__dirname, 'nft-data.json');
        fs.writeFileSync(outputPath, JSON.stringify(frontendData, null, 2));
        console.log(`Generated frontend data with ${sampleSize} NFTs at: ${outputPath}`);
        
        return frontendData;
    }
}

// If running directly, generate the frontend data
if (require.main === module) {
    const loader = new NFTDataLoader();
    loader.generateFrontendData(20); // Generate data for 20 random NFTs
}

module.exports = NFTDataLoader;