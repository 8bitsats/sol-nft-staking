import cors from 'cors';
// api/routes/staking.ts - Express API Routes
import express from 'express';
import rateLimit from 'express-rate-limit';
import {
  body,
  param,
  validationResult,
} from 'express-validator';
import helmet from 'helmet';

import { ScalableStakingService } from '../../services/stakingService';

const router = express.Router();

// Initialize the scalable staking service
const stakingService = new ScalableStakingService(
  process.env.SOLANA_RPC_URL || 'https://api.mainnet-beta.solana.com',
  parseInt(process.env.WS_PORT || '8080')
);

// Security middleware
router.use(helmet());
router.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true
}));

// Rate limiting for API protection
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

router.use(apiLimiter);

// Validation middleware
const validateRequest = (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// Helper function to get client IP
const getClientIP = (req: express.Request): string => {
  return req.ip || req.connection.remoteAddress || '127.0.0.1';
};

// Routes

// GET /api/staking/user/:wallet/stakes - Get user's staked terminals
router.get('/user/:wallet/stakes', 
  param('wallet').isLength({ min: 32, max: 44 }).withMessage('Invalid wallet address'),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { wallet } = req.params;
      const userIp = getClientIP(req);

      const stakes = await stakingService.getUserStakes(wallet, userIp);
      
      res.json({
        success: true,
        data: stakes,
        count: stakes.length,
        timestamp: Date.now()
      });
    } catch (error) {
      console.error('Get user stakes error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
);

// GET /api/staking/stats - Get pool statistics
router.get('/stats', async (req: express.Request, res: express.Response) => {
  try {
    const stats = await stakingService.getPoolStats();
    const performanceMetrics = await stakingService.getPerformanceMetrics();
    
    res.json({
      success: true,
      data: {
        ...stats,
        performance: performanceMetrics
      },
      timestamp: Date.now()
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

// POST /api/staking/stake - Stake a terminal
router.post('/stake',
  body('userWallet').isLength({ min: 32, max: 44 }).withMessage('Invalid user wallet'),
  body('terminalMint').isLength({ min: 32, max: 44 }).withMessage('Invalid terminal mint'),
  body('rarity').isInt({ min: 1, max: 100 }).withMessage('Rarity must be between 1-100'),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { userWallet, terminalMint, rarity } = req.body;
      const userIp = getClientIP(req);

      const result = await stakingService.stakeTerminal({
        userWallet,
        terminalMint,
        rarity,
        userIp
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            txSignature: result.txSignature,
            terminalMint,
            timestamp: Date.now()
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Stake terminal error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
);

// POST /api/staking/unstake - Unstake a terminal
router.post('/unstake',
  body('userWallet').isLength({ min: 32, max: 44 }).withMessage('Invalid user wallet'),
  body('terminalMint').isLength({ min: 32, max: 44 }).withMessage('Invalid terminal mint'),
  validateRequest,
  async (req: express.Request, res: express.Response) => {
    try {
      const { userWallet, terminalMint } = req.body;
      const userIp = getClientIP(req);

      const result = await stakingService.unstakeTerminal({
        userWallet,
        terminalMint,
        userIp
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            txSignature: result.txSignature,
            rewards: result.rewards,
            terminalMint,
            timestamp: Date.now()
          }
        });
      } else {
        res.status(400).json({
          success: false,
          error: result.error
        });
      }
    } catch (error) {
      console.error('Unstake terminal error:', error);
      res.status(500).json({
        success: false,
        error: (error as Error).message
      });
    }
  }
);

// GET /api/staking/health - System health check
router.get('/health', async (req: express.Request, res: express.Response) => {
  try {
    const health = await stakingService.getSystemHealth();
    
    res.json({
      success: true,
      data: health,
      timestamp: Date.now(),
      uptime: process.uptime()
    });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(500).json({
      success: false,
      error: (error as Error).message
    });
  }
});

export default router;
