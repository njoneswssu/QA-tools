#!/bin/bash

# PostgreSQL Setup Script for Merchant Tester
# This script will help you set up PostgreSQL for the Merchant Tester application

echo "🚀 PostgreSQL Setup for Merchant Tester"
echo "========================================"
echo ""

# Check if PostgreSQL is installed
if ! command -v psql &> /dev/null; then
    echo "❌ PostgreSQL is not installed!"
    echo ""
    echo "📦 Install PostgreSQL:"
    echo ""
    echo "   macOS (Homebrew):"
    echo "   brew install postgresql@15"
    echo "   brew services start postgresql@15"
    echo ""
    echo "   Ubuntu/Debian:"
    echo "   sudo apt-get update"
    echo "   sudo apt-get install postgresql postgresql-contrib"
    echo "   sudo systemctl start postgresql"
    echo ""
    echo "   Windows:"
    echo "   Download from: https://www.postgresql.org/download/windows/"
    echo ""
    exit 1
fi

echo "✅ PostgreSQL is installed"
echo ""

# Database configuration
DB_NAME=${PGDATABASE:-"merchant_tester"}
DB_USER=${PGUSER:-"postgres"}
DB_HOST=${PGHOST:-"localhost"}
DB_PORT=${PGPORT:-5432}

echo "📊 Database Configuration:"
echo "   Database: $DB_NAME"
echo "   User: $DB_USER"
echo "   Host: $DB_HOST"
echo "   Port: $DB_PORT"
echo ""

# Check if database exists
if psql -U $DB_USER -h $DB_HOST -p $DB_PORT -lqt | cut -d \| -f 1 | grep -qw $DB_NAME; then
    echo "⚠️  Database '$DB_NAME' already exists"
    echo ""
    read -p "Do you want to drop and recreate it? (y/N): " -n 1 -r
    echo ""
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo "🗑️  Dropping database..."
        psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "DROP DATABASE IF EXISTS $DB_NAME;"
        echo "📦 Creating database..."
        psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;"
    fi
else
    echo "📦 Creating database '$DB_NAME'..."
    psql -U $DB_USER -h $DB_HOST -p $DB_PORT -c "CREATE DATABASE $DB_NAME;"
fi

echo ""
echo "✅ Database setup complete!"
echo ""
echo "🔧 Environment Configuration:"
echo "   You can customize the database connection by setting these environment variables:"
echo ""
echo "   export PGUSER=postgres"
echo "   export PGHOST=localhost"
echo "   export PGDATABASE=merchant_tester"
echo "   export PGPASSWORD=your_password"
echo "   export PGPORT=5432"
echo ""
echo "💡 Or create a .env file in the api-merchant-tester directory:"
echo ""
echo "   PGUSER=postgres"
echo "   PGHOST=localhost"
echo "   PGDATABASE=merchant_tester"
echo "   PGPASSWORD=your_password"
echo "   PGPORT=5432"
echo ""
echo "🚀 Starting the application will automatically create the tables."
echo ""
echo "✅ Setup complete! Run 'npm start' to start the server."

