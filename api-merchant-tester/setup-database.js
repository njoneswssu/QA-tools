#!/usr/bin/env node

const path = require('path');
const fs = require('fs');

console.log('🗄️  Setting up API Merchant Tester Database');
console.log('='.repeat(50));

// Initialize database
try {
    console.log('📊 Initializing database tables...');
    require('./database/init_db.js');
    console.log('✅ Database tables created successfully');
} catch (error) {
    console.error('❌ Error initializing database:', error.message);
    process.exit(1);
}

console.log('='.repeat(50));
console.log('🎯 Database setup complete!');
console.log('');
console.log('Next steps:');
console.log('1. Start the server: npm start');
console.log('2. Open browser: http://localhost:3001');
console.log('3. Paste your merchant API data');
console.log('4. Start testing!');
console.log('='.repeat(50));
