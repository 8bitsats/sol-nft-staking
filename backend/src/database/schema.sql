-- init.sql - Database Schema for Terminal Staking
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Stake records table
CREATE TABLE IF NOT EXISTS stake_records (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_wallet VARCHAR(44) NOT NULL,
    terminal_mint VARCHAR(44) NOT NULL UNIQUE,
    stake_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    last_claim_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    total_staked_time BIGINT DEFAULT 0,
    is_staked BOOLEAN DEFAULT false,
    rarity_multiplier INTEGER DEFAULT 100,
    pending_rewards DECIMAL(20, 6) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_stake_records_user_wallet ON stake_records(user_wallet);
CREATE INDEX IF NOT EXISTS idx_stake_records_terminal_mint ON stake_records(terminal_mint);
CREATE INDEX IF NOT EXISTS idx_stake_records_is_staked ON stake_records(is_staked);
CREATE INDEX IF NOT EXISTS idx_stake_records_created_at ON stake_records(created_at);

-- Pool statistics table
CREATE TABLE IF NOT EXISTS pool_stats (
    id SERIAL PRIMARY KEY,
    total_staked INTEGER DEFAULT 0,
    total_rewards_distributed DECIMAL(20, 6) DEFAULT 0,
    active_users INTEGER DEFAULT 0,
    daily_volume INTEGER DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert initial pool stats if not exists
INSERT INTO pool_stats (total_staked, total_rewards_distributed, active_users, daily_volume)
SELECT 0, 0, 0, 0
WHERE NOT EXISTS (SELECT 1 FROM pool_stats);

-- Function to update timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger to auto-update updated_at
DROP TRIGGER IF EXISTS update_stake_records_updated_at ON stake_records;
CREATE TRIGGER update_stake_records_updated_at 
    BEFORE UPDATE ON stake_records 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to calculate pending rewards
CREATE OR REPLACE FUNCTION calculate_pending_rewards(stake_id UUID)
RETURNS DECIMAL(20, 6) AS $$
DECLARE
    stake_record RECORD;
    hours_since_claim DECIMAL;
    calculated_rewards DECIMAL(20, 6);
BEGIN
    SELECT * INTO stake_record 
    FROM stake_records 
    WHERE id = stake_id AND is_staked = true;
    
    IF NOT FOUND THEN
        RETURN 0;
    END IF;
    
    hours_since_claim := EXTRACT(EPOCH FROM (NOW() - stake_record.last_claim_timestamp)) / 3600.0;
    calculated_rewards := hours_since_claim * (stake_record.rarity_multiplier::DECIMAL / 100.0);
    
    RETURN calculated_rewards;
END;
$$ LANGUAGE plpgsql;
