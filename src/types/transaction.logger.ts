export interface TransactionLog {
    orderId: string;
    transactionType: 'CREATE' | 'UPDATE' | 'PAYMENT' | 'PROCESS' | 'CALLBACK' | 'ERROR';
    status: string;
    userId?: string;
    productCode?: string;
    amount?: number;
    paymentMethod?: string;
    reference?: string;
    data?: any;
    error?: string;
    timestamp: Date;
    ip?: string;
    userAgent?: string;
    // Tambahan untuk tracking
    sessionId?: string;
    socketId?: string;
}

export interface WebSocketTransactionData {
    orderId: string;
    type: string;
    status: string;
    message: string;
    data?: any;
    timestamp: string;
    progress?: number;
}

// Enum untuk role-based access
export enum AccessLevel {
    USER = 'USER',
    ADMIN = 'ADMIN'
}

// Interface untuk filter logs
export interface LogFilter {
    orderId?: string;
    userId?: string;
    status?: string;
    transactionType?: string;
    paymentMethod?: string;
    dateFrom?: string;
    dateTo?: string;
    socketId?: string;
    sessionId?: string;
  }