use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
use mpl_core::{
    ID as MPL_CORE_ID,
    fetch_plugin,
    accounts::BaseAssetV1, 
    instructions::{AddPluginV1CpiBuilder, RemovePluginV1CpiBuilder, UpdatePluginV1CpiBuilder}, 
    types::{Attribute, Attributes, FreezeDelegate, Plugin, PluginAuthority, PluginType, UpdateAuthority}, 
};

declare_id!("Zkc1y5YhcFi82Q6wmLjfreQd2nsS1eWBcxWVn3KCrP7");

// Reward rate: 1 $GOR per hour (3600 seconds)
const REWARD_RATE_PER_SECOND: u64 = 277_778; // 1 token with 6 decimals per hour / 3600 seconds ≈ 277,778 micro-tokens per second

#[program]
pub mod terminal_staking {
    use super::*;

    /// Initialize the global staking pool
    pub fn initialize_pool(
        ctx: Context<InitializePool>, 
        reward_rate: u64,
        max_terminals: u32
    ) -> Result<()> {
        let pool = &mut ctx.accounts.staking_pool;
        pool.authority = ctx.accounts.authority.key();
        pool.reward_mint = ctx.accounts.reward_mint.key();
        pool.collection = ctx.accounts.collection.key();
        pool.reward_rate = reward_rate;
        pool.total_staked = 0;
        pool.total_rewards_distributed = 0;
        pool.max_terminals = max_terminals;
        pool.bump = ctx.bumps.staking_pool;
        
        Ok(())
    }

    /// Stake a terminal NFT
    pub fn stake_terminal(ctx: Context<StakeTerminal>) -> Result<()> {
        let clock = Clock::get()?;

        // Extract values we need before mutable borrow
        let pool_collection = ctx.accounts.staking_pool.collection;
        let current_staked = ctx.accounts.staking_pool.total_staked;
        let max_terminals = ctx.accounts.staking_pool.max_terminals;

        // Deserialize and validate the terminal asset
        let terminal_data = ctx.accounts.terminal_asset.try_borrow_data()?;
        let terminal_asset = BaseAssetV1::from_bytes(&terminal_data)?;

        // Verify terminal belongs to collection  
        require!(
            terminal_asset.update_authority == UpdateAuthority::Collection(pool_collection),
            StakingError::InvalidCollection
        );

        // Check pool capacity
        require!(
            current_staked < max_terminals,
            StakingError::PoolAtCapacity
        );

        // Initialize or validate stake account
        if ctx.accounts.stake_account.is_staked {
            return Err(StakingError::AlreadyStaked.into());
        }

        // Now get mutable references
        let pool = &mut ctx.accounts.staking_pool;
        let stake_account = &mut ctx.accounts.stake_account;

        // Check if asset has attributes plugin
        match fetch_plugin::<BaseAssetV1, Attributes>(
            &ctx.accounts.terminal_asset.to_account_info(), 
            PluginType::Attributes
        ) {
            Ok((_, fetched_attributes, _)) => {
                // Update existing attributes
                let mut attribute_list: Vec<Attribute> = Vec::new();
                let mut staking_initialized = false;

                for attribute in fetched_attributes.attribute_list {
                    if attribute.key == "staked" {
                        require!(attribute.value == "0", StakingError::AlreadyStaked);
                        attribute_list.push(Attribute {
                            key: "staked".to_string(),
                            value: clock.unix_timestamp.to_string(),
                        });
                        staking_initialized = true;
                    } else {
                        attribute_list.push(attribute);
                    }
                }

                // Add staking attributes if not present
                if !staking_initialized {
                    attribute_list.push(Attribute {
                        key: "staked".to_string(),
                        value: clock.unix_timestamp.to_string(),
                    });
                    attribute_list.push(Attribute {
                        key: "staked_time".to_string(),
                        value: "0".to_string(),
                    });
                }

                // Update attributes plugin
                UpdatePluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
                    .asset(&ctx.accounts.terminal_asset.to_account_info())
                    .collection(Some(&ctx.accounts.collection.to_account_info()))
                    .payer(&ctx.accounts.payer.to_account_info())
                    .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
                    .system_program(&ctx.accounts.system_program.to_account_info())
                    .plugin(Plugin::Attributes(Attributes { attribute_list }))
                    .invoke()?;
            }
            Err(_) => {
                // Add attributes plugin if it doesn't exist
                AddPluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
                    .asset(&ctx.accounts.terminal_asset.to_account_info())
                    .collection(Some(&ctx.accounts.collection.to_account_info()))
                    .payer(&ctx.accounts.payer.to_account_info())
                    .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
                    .system_program(&ctx.accounts.system_program.to_account_info())
                    .plugin(Plugin::Attributes(Attributes {
                        attribute_list: vec![
                            Attribute {
                                key: "staked".to_string(),
                                value: clock.unix_timestamp.to_string(),
                            },
                            Attribute {
                                key: "staked_time".to_string(),
                                value: "0".to_string(),
                            },
                        ],
                    }))
                    .init_authority(PluginAuthority::UpdateAuthority)
                    .invoke()?;
            }
        }

        // Apply freeze delegate plugin
        AddPluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.terminal_asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .authority(Some(&ctx.accounts.owner.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: true }))
            .init_authority(PluginAuthority::UpdateAuthority)
            .invoke()?;

        // Update stake account
        stake_account.owner = ctx.accounts.owner.key();
        stake_account.terminal_mint = ctx.accounts.terminal_asset.key();
        stake_account.pool = pool.key();
        stake_account.stake_timestamp = clock.unix_timestamp;
        stake_account.last_claim_timestamp = clock.unix_timestamp;
        stake_account.total_staked_time = 0;
        stake_account.is_staked = true;
        stake_account.rarity_multiplier = calculate_rarity_multiplier()?;
        stake_account.bump = ctx.bumps.stake_account;

        // Update pool stats
        pool.total_staked += 1;

        emit!(TerminalStaked {
            owner: ctx.accounts.owner.key(),
            terminal: ctx.accounts.terminal_asset.key(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Unstake a terminal NFT and claim rewards
    pub fn unstake_terminal(ctx: Context<UnstakeTerminal>) -> Result<()> {
        let clock = Clock::get()?;

        // Extract values before mutable borrow
        let collection_ref = ctx.accounts.staking_pool.collection;
        let pool_bump = ctx.accounts.staking_pool.bump;
        let staking_pool_info = ctx.accounts.staking_pool.to_account_info();

        let pool = &mut ctx.accounts.staking_pool;
        let stake_account = &mut ctx.accounts.stake_account;

        require!(stake_account.is_staked, StakingError::NotStaked);
        require!(stake_account.owner == ctx.accounts.owner.key(), StakingError::Unauthorized);

        // Calculate and transfer rewards
        let staking_duration = clock.unix_timestamp - stake_account.stake_timestamp;
        let rewards = calculate_rewards(staking_duration, stake_account.rarity_multiplier)?;

        if rewards > 0 {
            let pool_seeds = &[
                b"pool",
                collection_ref.as_ref(),
                &[pool_bump],
            ];
            let signer_seeds = &[&pool_seeds[..]];

            token::mint_to(
                CpiContext::new_with_signer(
                    ctx.accounts.token_program.to_account_info(),
                    token::MintTo {
                        mint: ctx.accounts.reward_mint.to_account_info(),
                        to: ctx.accounts.user_reward_account.to_account_info(),
                        authority: staking_pool_info,
                    },
                    signer_seeds,
                ),
                rewards,
            )?;
        }

        // Update attributes on the NFT
        match fetch_plugin::<BaseAssetV1, Attributes>(
            &ctx.accounts.terminal_asset.to_account_info(), 
            PluginType::Attributes
        ) {
            Ok((_, fetched_attributes, _)) => {
                let mut attribute_list: Vec<Attribute> = Vec::new();
                let mut total_staked_time: i64 = 0;

                for attribute in fetched_attributes.attribute_list.iter() {
                    if attribute.key == "staked" {
                        attribute_list.push(Attribute {
                            key: "staked".to_string(),
                            value: "0".to_string(), // Mark as unstaked
                        });
                    } else if attribute.key == "staked_time" {
                        total_staked_time = attribute.value.parse::<i64>()
                            .map_err(|_| StakingError::InvalidTimestamp)?;
                    } else {
                        attribute_list.push(attribute.clone());
                    }
                }

                // Add current staking session to total time
                total_staked_time += staking_duration;
                attribute_list.push(Attribute {
                    key: "staked_time".to_string(),
                    value: total_staked_time.to_string(),
                });

                // Update attributes
                UpdatePluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
                    .asset(&ctx.accounts.terminal_asset.to_account_info())
                    .collection(Some(&ctx.accounts.collection.to_account_info()))
                    .payer(&ctx.accounts.payer.to_account_info())
                    .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
                    .system_program(&ctx.accounts.system_program.to_account_info())
                    .plugin(Plugin::Attributes(Attributes { attribute_list }))
                    .invoke()?;
            }
            Err(_) => {
                return Err(StakingError::AttributesNotInitialized.into());
            }
        }

        // Thaw and remove freeze delegate
        UpdatePluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.terminal_asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .authority(Some(&ctx.accounts.collection_authority.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .plugin(Plugin::FreezeDelegate(FreezeDelegate { frozen: false }))
            .invoke()?;

        RemovePluginV1CpiBuilder::new(&ctx.accounts.mpl_core_program.to_account_info())
            .asset(&ctx.accounts.terminal_asset.to_account_info())
            .collection(Some(&ctx.accounts.collection.to_account_info()))
            .payer(&ctx.accounts.payer.to_account_info())
            .authority(Some(&ctx.accounts.owner.to_account_info()))
            .system_program(&ctx.accounts.system_program.to_account_info())
            .plugin_type(PluginType::FreezeDelegate)
            .invoke()?;

        // Update stake account
        stake_account.total_staked_time += staking_duration;
        stake_account.is_staked = false;
        stake_account.stake_timestamp = 0;

        // Update pool stats
        pool.total_staked -= 1;
        pool.total_rewards_distributed += rewards;

        emit!(TerminalUnstaked {
            owner: ctx.accounts.owner.key(),
            terminal: ctx.accounts.terminal_asset.key(),
            rewards_claimed: rewards,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Claim rewards without unstaking
    pub fn claim_rewards(ctx: Context<ClaimRewards>) -> Result<()> {
        let clock = Clock::get()?;

        // Extract all values before any mutable borrows
        let collection_ref = ctx.accounts.staking_pool.collection;
        let pool_bump = ctx.accounts.staking_pool.bump;
        let terminal_mint = ctx.accounts.stake_account.terminal_mint;
        let stake_owner = ctx.accounts.stake_account.owner;
        let is_staked = ctx.accounts.stake_account.is_staked;
        let last_claim_timestamp = ctx.accounts.stake_account.last_claim_timestamp;
        let rarity_multiplier = ctx.accounts.stake_account.rarity_multiplier;
        let owner_key = ctx.accounts.owner.key();

        // Validation checks using extracted values
        require!(is_staked, StakingError::NotStaked);
        require!(stake_owner == owner_key, StakingError::Unauthorized);

        let staking_duration = clock.unix_timestamp - last_claim_timestamp;
        let rewards = calculate_rewards(staking_duration, rarity_multiplier)?;

        if rewards > 0 {
            let pool_seeds = &[
                b"pool",
                collection_ref.as_ref(),
                &[pool_bump],
            ];
            let signer_seeds = &[&pool_seeds[..]];

            // Create a separate scope for the CPI call
            {
                let staking_pool_info = ctx.accounts.staking_pool.to_account_info();
                token::mint_to(
                    CpiContext::new_with_signer(
                        ctx.accounts.token_program.to_account_info(),
                        token::MintTo {
                            mint: ctx.accounts.reward_mint.to_account_info(),
                            to: ctx.accounts.user_reward_account.to_account_info(),
                            authority: staking_pool_info,
                        },
                        signer_seeds,
                    ),
                    rewards,
                )?;
            }

            // Now we can safely take mutable borrows
            let stake_account = &mut ctx.accounts.stake_account;
            let pool = &mut ctx.accounts.staking_pool;

            stake_account.last_claim_timestamp = clock.unix_timestamp;
            pool.total_rewards_distributed += rewards;

            emit!(RewardsClaimed {
                owner: owner_key,
                terminal: terminal_mint,
                amount: rewards,
                timestamp: clock.unix_timestamp,
            });
        }

        Ok(())
    }

    /// Get pending rewards for a staked terminal
    pub fn get_pending_rewards(ctx: Context<GetPendingRewards>) -> Result<u64> {
        let stake_account = &ctx.accounts.stake_account;
        let clock = Clock::get()?;

        if !stake_account.is_staked {
            return Ok(0);
        }

        let staking_duration = clock.unix_timestamp - stake_account.last_claim_timestamp;
        let rewards = calculate_rewards(staking_duration, stake_account.rarity_multiplier)?;

        msg!("Pending rewards: {}", rewards);
        Ok(rewards)
    }
}

// Helper functions
fn calculate_rewards(duration_seconds: i64, rarity_multiplier: u16) -> Result<u64> {
    let base_rewards = (duration_seconds as u64)
        .checked_mul(REWARD_RATE_PER_SECOND)
        .ok_or(StakingError::CalculationOverflow)?;

    let multiplied_rewards = base_rewards
        .checked_mul(rarity_multiplier as u64)
        .ok_or(StakingError::CalculationOverflow)?
        .checked_div(100)
        .ok_or(StakingError::CalculationOverflow)?;

    Ok(multiplied_rewards)
}

fn calculate_rarity_multiplier() -> Result<u16> {
    // In a real implementation, you'd fetch attributes and calculate rarity
    // For now, return a base multiplier
    // Rarity score 1-100 maps to multiplier 100-200 (1x to 2x rewards)
    Ok(150) // 1.5x multiplier as default
}

// Account structs
#[derive(Accounts)]
pub struct InitializePool<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + StakingPool::INIT_SPACE,
        seeds = [b"pool", collection.key().as_ref()],
        bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    /// CHECK: Validated through MPL Core
    pub collection: UncheckedAccount<'info>,
    pub reward_mint: Account<'info, Mint>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct StakeTerminal<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub collection_authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", collection.key().as_ref()],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        init,
        payer = payer,
        space = 8 + StakeAccount::INIT_SPACE,
        seeds = [b"stake", terminal_asset.key().as_ref()],
        bump
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// CHECK: Validated through MPL Core
    #[account(mut)]
    pub terminal_asset: UncheckedAccount<'info>,

    /// CHECK: Validated through MPL Core
    #[account(mut)]
    pub collection: UncheckedAccount<'info>,

    #[account(address = MPL_CORE_ID)]
    /// CHECK: this will be checked by mpl-core
    pub mpl_core_program: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UnstakeTerminal<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(mut)]
    pub collection_authority: Signer<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", collection.key().as_ref()],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"stake", terminal_asset.key().as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == owner.key()
    )]
    pub stake_account: Account<'info, StakeAccount>,

    /// CHECK: Validated through MPL Core
    #[account(mut)]
    pub terminal_asset: UncheckedAccount<'info>,

    /// CHECK: Validated through MPL Core
    #[account(mut)]
    pub collection: UncheckedAccount<'info>,

    #[account(
        mut,
        constraint = reward_mint.key() == staking_pool.reward_mint
    )]
    pub reward_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_reward_account: Account<'info, TokenAccount>,

    #[account(address = MPL_CORE_ID)]
    /// CHECK: this will be checked by mpl-core
    pub mpl_core_program: UncheckedAccount<'info>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimRewards<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"pool", staking_pool.collection.as_ref()],
        bump = staking_pool.bump
    )]
    pub staking_pool: Account<'info, StakingPool>,

    #[account(
        mut,
        seeds = [b"stake", stake_account.terminal_mint.as_ref()],
        bump = stake_account.bump,
        constraint = stake_account.owner == owner.key()
    )]
    pub stake_account: Account<'info, StakeAccount>,

    #[account(
        mut,
        constraint = reward_mint.key() == staking_pool.reward_mint
    )]
    pub reward_mint: Account<'info, Mint>,

    #[account(mut)]
    pub user_reward_account: Account<'info, TokenAccount>,

    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct GetPendingRewards<'info> {
    #[account(
        seeds = [b"stake", stake_account.terminal_mint.as_ref()],
        bump = stake_account.bump
    )]
    pub stake_account: Account<'info, StakeAccount>,
}

// Data structures
#[account]
#[derive(InitSpace)]
pub struct StakingPool {
    pub authority: Pubkey,
    pub collection: Pubkey,
    pub reward_mint: Pubkey,
    pub reward_rate: u64,
    pub total_staked: u32,
    pub total_rewards_distributed: u64,
    pub max_terminals: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct StakeAccount {
    pub owner: Pubkey,
    pub terminal_mint: Pubkey,
    pub pool: Pubkey,
    pub stake_timestamp: i64,
    pub last_claim_timestamp: i64,
    pub total_staked_time: i64,
    pub rarity_multiplier: u16, // 100 = 1x, 150 = 1.5x, 200 = 2x
    pub is_staked: bool,
    pub bump: u8,
}

// Events
#[event]
pub struct TerminalStaked {
    pub owner: Pubkey,
    pub terminal: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct TerminalUnstaked {
    pub owner: Pubkey,
    pub terminal: Pubkey,
    pub rewards_claimed: u64,
    pub timestamp: i64,
}

#[event]
pub struct RewardsClaimed {
    pub owner: Pubkey,
    pub terminal: Pubkey,
    pub amount: u64,
    pub timestamp: i64,
}

// Error codes
#[error_code]
pub enum StakingError {
    #[msg("Terminal is already staked")]
    AlreadyStaked,
    #[msg("Terminal is not currently staked")]
    NotStaked,
    #[msg("Staking pool is at maximum capacity")]
    PoolAtCapacity,
    #[msg("Invalid collection for this terminal")]
    InvalidCollection,
    #[msg("Unauthorized access")]
    Unauthorized,
    #[msg("Calculation overflow")]
    CalculationOverflow,
    #[msg("Invalid timestamp format")]
    InvalidTimestamp,
    #[msg("Attributes plugin not initialized")]
    AttributesNotInitialized,
}
