import { ethers } from 'ethers';
import { TradeExecutorConfig, TradeRecord } from '../types';

export class TradeExecutor {
    private autoTradeEnabled: boolean;
    private maxTradeSize: number;
    private wallet?: ethers.Wallet;

    constructor(config?: Partial<TradeExecutorConfig>) {
        this.autoTradeEnabled = config?.autoTradeEnabled ?? (process.env.AUTO_TRADE_ENABLED === 'true');
        this.maxTradeSize = config?.maxTradeSize ?? parseFloat(process.env.MAX_TRADE_SIZE || '100');
        
        if (this.autoTradeEnabled && (config?.privateKey || process.env.POLYMARKET_PRIVATE_KEY)) {
            this.initializeWallet(config?.privateKey);
        }
    }

    private initializeWallet(privateKey?: string): void {
        try {
            const key = privateKey || process.env.POLYMARKET_PRIVATE_KEY;
            if (!key) throw new Error('Private key not provided');

            const provider = new ethers.JsonRpcProvider('https://polygon-rpc.com');
            this.wallet = new ethers.Wallet(key, provider);
            console.log('✅ Wallet initialized:', this.wallet.address);
        } catch (error) {
            console.error('❌ Failed to initialize wallet:', error);
            this.autoTradeEnabled = false;
        }
    }

    /**
     * Execute a trade on Polymarket
     */
    async executeTrade(trade: Partial<TradeRecord>): Promise<any> {
        if (!this.autoTradeEnabled) {
            throw new Error('Auto-trading is disabled');
        }

        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }

        const { market_id, side, size, price } = trade;

        if (!market_id || !side || !size || !price) {
            throw new Error('Missing required trade parameters');
        }

        if (size > this.maxTradeSize) {
            throw new Error(`Trade size ${size} exceeds maximum ${this.maxTradeSize}`);
        }

        try {
            console.log('Executing trade:', {
                market_id,
                side,
                size,
                price,
                wallet: this.wallet.address
            });

            const result = await this.simulateTradeExecution(trade as TradeRecord);

            return {
                success: true,
                transactionHash: result.txHash,
                executedPrice: result.executedPrice,
                executedSize: result.executedSize,
                timestamp: Date.now(),
                gasUsed: result.gasUsed
            };

        } catch (error) {
            console.error('Trade execution failed:', error);
            throw error;
        }
    }

    /**
     * Simulate trade execution (replace with real Polymarket API calls)
     */
    private async simulateTradeExecution(trade: TradeRecord): Promise<any> {
        await new Promise(resolve => setTimeout(resolve, 1000));

        const slippage = (Math.random() - 0.5) * 0.02;
        const executedPrice = trade.price * (1 + slippage);

        return {
            txHash: '0x' + this.generateRandomHash(),
            executedPrice,
            executedSize: trade.size,
            gasUsed: Math.floor(Math.random() * 100000) + 50000
        };
    }

    /**
     * Get current balance
     */
    async getBalance(): Promise<{ usdc: number; matic: number }> {
        if (!this.wallet || !this.wallet.provider) {
            return { usdc: 0, matic: 0 };
        }

        try {
            const maticBalance = await this.wallet.provider.getBalance(this.wallet.address);
            
            const usdcAddress = '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174';
            const usdcAbi = ['function balanceOf(address) view returns (uint256)'];
            const usdcContract = new ethers.Contract(usdcAddress, usdcAbi, this.wallet);
            const usdcBalance = await usdcContract.balanceOf(this.wallet.address);

            return {
                usdc: parseFloat(ethers.formatUnits(usdcBalance, 6)),
                matic: parseFloat(ethers.formatEther(maticBalance))
            };
        } catch (error) {
            console.error('Error getting balance:', error);
            return { usdc: 0, matic: 0 };
        }
    }

    /**
     * Calculate position P&L
     */
    calculatePnL(entryPrice: number, exitPrice: number, size: number, side: 'YES' | 'NO'): number {
        if (side === 'YES') {
            return (exitPrice - entryPrice) * size;
        } else {
            return (entryPrice - exitPrice) * size;
        }
    }

    /**
     * Calculate optimal position size based on Kelly Criterion
     */
    calculateOptimalSize(edge: number, price: number, bankroll: number): number {
        const b = 1 / price - 1;
        const p = price + edge;
        const q = 1 - p;
        
        const kellyFraction = (b * p - q) / b;
        const fractionalKelly = kellyFraction * 0.25;
        
        const optimalSize = Math.min(
            bankroll * fractionalKelly,
            this.maxTradeSize
        );
        
        return Math.max(optimalSize, 0);
    }

    private generateRandomHash(): string {
        return Array.from({ length: 64 }, () => 
            Math.floor(Math.random() * 16).toString(16)
        ).join('');
    }
}

