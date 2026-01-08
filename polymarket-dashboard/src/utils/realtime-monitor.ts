import { WebSocket, WebSocketServer } from 'ws';
import { Server } from 'http';
import { WebSocketMessage } from '../types';

export class RealtimeMonitor {
    private wss: WebSocketServer;
    private clients: Set<WebSocket> = new Set();

    constructor(server: Server) {
        this.wss = new WebSocketServer({ server, path: '/ws' });
        
        this.wss.on('connection', (ws: WebSocket) => {
            console.log('🔌 Client connected to WebSocket');
            this.clients.add(ws);

            ws.on('close', () => {
                console.log('🔌 Client disconnected from WebSocket');
                this.clients.delete(ws);
            });

            ws.on('error', (error) => {
                console.error('WebSocket error:', error);
                this.clients.delete(ws);
            });

            // Send initial connection confirmation
            this.sendToClient(ws, {
                type: 'market_update',
                data: { connected: true },
                timestamp: Date.now()
            });
        });

        console.log('✅ WebSocket server initialized on /ws');
    }

    /**
     * Broadcast message to all connected clients
     */
    broadcast(message: WebSocketMessage): void {
        const payload = JSON.stringify(message);
        
        this.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(payload);
            }
        });
    }

    /**
     * Send message to specific client
     */
    private sendToClient(client: WebSocket, message: WebSocketMessage): void {
        if (client.readyState === WebSocket.OPEN) {
            client.send(JSON.stringify(message));
        }
    }

    /**
     * Broadcast market updates
     */
    broadcastMarketUpdate(markets: any[]): void {
        this.broadcast({
            type: 'market_update',
            data: markets,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast edge opportunity updates
     */
    broadcastEdgeUpdate(opportunities: any[]): void {
        this.broadcast({
            type: 'edge_update',
            data: opportunities,
            timestamp: Date.now()
        });
        
        console.log(`📊 Broadcasted ${opportunities.length} edge opportunities to ${this.clients.size} clients`);
    }

    /**
     * Broadcast trade updates
     */
    broadcastTradeUpdate(trade: any): void {
        this.broadcast({
            type: 'trade_update',
            data: trade,
            timestamp: Date.now()
        });
    }

    /**
     * Broadcast news updates
     */
    broadcastNewsUpdate(news: any[]): void {
        this.broadcast({
            type: 'news_update',
            data: news,
            timestamp: Date.now()
        });
    }

    /**
     * Get number of connected clients
     */
    getClientCount(): number {
        return this.clients.size;
    }

    /**
     * Close all connections
     */
    close(): void {
        this.clients.forEach((client) => {
            client.close();
        });
        this.wss.close();
    }
}

