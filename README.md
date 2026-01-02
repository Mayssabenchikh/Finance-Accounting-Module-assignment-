# Finance & Accounting Module for Tenants

A minimal multi-tenant finance application built with Next.js, Express, TypeScript, and Supabase.

## Project Structure

```
finance-app/
├── backend/              # Express API server
├── frontend/             # Next.js frontend
└── database_setup.sql    # Complete database setup script
```

## Prerequisites

- Node.js >= 18
- PostgreSQL database (via Supabase)
- Supabase account with project configured

## Setup Instructions

### 1. Supabase Setup

1. Create a Supabase project at https://supabase.com
2. Go to **SQL Editor** in your Supabase dashboard
3. Run the complete SQL script from `database_setup.sql`
   - This creates all tables, RLS policies, helper functions, and the `create_tenant_and_join` function

### 2. Backend Setup

```bash
cd backend
npm install
```

Create a `.env` file in the `backend/` directory (use `.env.example` as reference):

```env
PORT=4000
SUPABASE_URL=your_supabase_project_url
SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key
```

**Note:** The service role key is only used in test setup, never in production code.

### 3. Frontend Setup

```bash
cd frontend
npm install
```

Create a `frontend/.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Running the Application

### Backend

```bash
cd backend
npm run dev
```

The API will run on `http://localhost:4000`

### Frontend

```bash
cd frontend
npm run dev
```

The frontend will run on `http://localhost:3000`

## Running Tests

```bash
cd backend
npm test
```

The test suite includes:
- **Tenant Isolation Test**: Verifies users cannot access other tenants' data
- **Unauthorized Write Test**: Verifies read-only users cannot create transactions
- **Financial Summary Test**: Verifies correct calculation of income, expenses, and balance

## API Endpoints

### POST /transactions
Create a new transaction.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "tenantId": "uuid",
  "type": "income" | "expense",
  "amount": 100.0,
  "description": "Transaction description",
  "category": "Category name",
  "date": "2024-01-15"
}
```

**Response:** `201 Created`
```json
{
  "id": "transaction-uuid"
}
```

### GET /transactions?tenantId=...
List all transactions for a tenant.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "transactions": [...]
}
```

### GET /summary?tenantId=...
Get financial summary for a tenant.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "totalIncome": 1500.0,
  "totalExpense": 500.0,
  "balance": 1000.0
}
```

### POST /documents
Create a new document for a transaction.

**Headers:**
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

**Body:**
```json
{
  "transactionId": "uuid",
  "fileUrl": "https://example.com/document.pdf"
}
```

**Response:** `201 Created`
```json
{
  "id": "document-uuid"
}
```

### GET /documents?transactionId=...
List all documents for a transaction.

**Headers:**
```
Authorization: Bearer <access_token>
```

**Response:** `200 OK`
```json
{
  "documents": [...]
}
```

## Frontend Pages

- **/** - Home page
- **/login** - Login/Signup page
- **/tenants** - Manage tenants (requires authentication)
- **/transactions** - View and create transactions (requires tenant selection)
- **/summary** - View financial summary (requires tenant selection)

## Data Model

### Tables

- **tenants** (id, name)
- **tenant_users** (tenant_id, user_id, role) - Membership and RBAC
- **transactions** (id, tenant_id, type, amount, category, description, date, created_by, created_at)
- **documents** (id, transaction_id, file_url, created_at) - Optional

### Access Control

- **Row Level Security (RLS)**: Enforced at the database level via Supabase
- **JWT Authentication**: All API requests require valid Supabase JWT tokens
- **Tenant Isolation**: Users can only access data for their assigned tenants
- **Role-Based Access Control**: 
  - `read` role: Can view transactions and documents
  - `write` role: Can create transactions and documents

## Security Features

- All backend routes require authentication via Bearer token
- Tenant isolation enforced through RLS policies
- Role-based access control (RBAC) for write operations
- Input validation using Zod schemas
- Safe handling of financial data (positive amounts, numeric types)

## Notes

- The application uses Supabase RLS policies for security
- Tenant selection is stored in browser localStorage
- The UI is minimal as per assignment requirements (styling not evaluated)
- Category is required for all transactions
- Documents are optional and can be attached to transactions (HTTP/HTTPS URLs only, not file://)
