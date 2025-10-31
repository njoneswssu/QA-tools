# PostgreSQL Setup Guide

The Merchant Tester application now uses PostgreSQL for multi-device data syncing!

## 🚀 Quick Start

### 1. Install PostgreSQL

**macOS (Homebrew):**
```bash
brew install postgresql@15
brew services start postgresql@15
```

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install postgresql postgresql-contrib
sudo systemctl start postgresql
```

**Windows:**
Download from: https://www.postgresql.org/download/windows/

### 2. Create Database

Run the setup script:
```bash
cd api-merchant-tester
./setup-postgres.sh
```

Or manually:
```bash
psql -U postgres -c "CREATE DATABASE merchant_tester;"
```

### 3. Configure Connection

Create a `.env` file in the `api-merchant-tester` directory:

```env
PGUSER=postgres
PGHOST=localhost
PGDATABASE=merchant_tester
PGPASSWORD=your_password_here
PGPORT=5432
```

**Or use environment variables:**
```bash
export PGUSER=postgres
export PGHOST=localhost
export PGDATABASE=merchant_tester
export PGPASSWORD=your_password
export PGPORT=5432
```

### 4. Start the Application

```bash
npm start
```

The application will automatically create all required tables on first run.

## 🌐 Multi-Device Setup

To access the database from multiple devices:

### Option 1: Local Network Access

1. **Configure PostgreSQL to accept remote connections:**

Edit `postgresql.conf`:
```conf
listen_addresses = '*'
```

Edit `pg_hba.conf`:
```conf
# Allow connections from your local network
host    merchant_tester    postgres    192.168.1.0/24    md5
```

2. **Restart PostgreSQL:**
```bash
# macOS
brew services restart postgresql@15

# Linux
sudo systemctl restart postgresql
```

3. **Connect from other devices:**
```env
PGHOST=192.168.1.100  # Replace with your database server IP
```

### Option 2: Cloud PostgreSQL

Use a managed PostgreSQL service:
- **Heroku Postgres** (Free tier available)
- **AWS RDS**
- **Google Cloud SQL**
- **DigitalOcean Managed Databases**
- **Supabase** (Free tier available)

Example connection for cloud database:
```env
PGHOST=your-db-host.postgres.database.azure.com
PGUSER=your_username@your-server
PGDATABASE=merchant_tester
PGPASSWORD=your_password
PGPORT=5432
PGSSLMODE=require
```

## 📊 Database Schema

The application creates three main tables:

1. **test_sessions** - Tracks test runs
2. **merchant_test_results** - Stores individual merchant test results
3. **merchant_master_data** - Caches merchant information

## 🔄 Migration from SQLite

To migrate existing data from SQLite to PostgreSQL:

1. Export data from SQLite:
```bash
sqlite3 database/merchant_tests.db .dump > sqlite_data.sql
```

2. Convert and import (manual process - contact support if needed)

## 🔧 Troubleshooting

**Connection refused:**
- Check if PostgreSQL is running: `pg_isready`
- Verify connection settings in `.env`

**Authentication failed:**
- Check password in `.env`
- Verify user exists: `psql -U postgres -c "\du"`

**Database doesn't exist:**
- Run `./setup-postgres.sh` to create it

**Permission denied:**
- Grant permissions: `psql -U postgres -c "GRANT ALL PRIVILEGES ON DATABASE merchant_tester TO your_user;"`

## 💡 Tips

- Use **pgAdmin** or **DBeaver** for GUI database management
- Regular backups: `pg_dump merchant_tester > backup.sql`
- Monitor connections: `SELECT * FROM pg_stat_activity;`
- View table sizes: `SELECT pg_size_pretty(pg_total_relation_size('table_name'));`

## 🔐 Security Best Practices

1. Use strong passwords
2. Enable SSL for remote connections
3. Limit network access with firewall rules
4. Regular backups
5. Keep PostgreSQL updated

