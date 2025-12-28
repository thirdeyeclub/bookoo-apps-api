# WhopSandbox (mock Whop API)

Base URL: `/whopSandbox/api/v1`

Auth: require `Authorization: Bearer <token>`

Seed control:
- Default seed is `WHOP_SANDBOX_SEED` (env) or `default`
- Override per request with `x-whopsandbox-seed: <string>`

Pagination:
- Query: `limit` (1..100, default 50), `cursor` (offset integer as string)
- Response: `{ data: T[], pagination: { cursor, next_cursor, has_more, limit, total } }`

## endpoints guide

All requests must include:
- `Authorization: Bearer dev`

Optional (deterministic dataset override per request):
- `x-whopsandbox-seed: <string>`

### Root

```bash
curl 'http://localhost:4000/whopSandbox/api/v1' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{ "status": "whopSandbox", "version": "v1" }
```

### Users

#### GET /users/:id

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/users/usr_000000000001' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": {
    "id": "usr_000000000001",
    "username": "fast_fox_1",
    "email": "user1@example.com",
    "name": "User 1",
    "profile_picture": "https://picsum.photos/seed/default-user-1/200/200",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

#### GET /users/by-username/:username

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/users/by-username/bright_fox_12' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": {
    "id": "usr_000000000001",
    "username": "bright_fox_12",
    "email": "user1@example.com",
    "name": "User 1",
    "profile_picture": "https://picsum.photos/seed/default-user-1/200/200",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Companies

#### GET /companies/:id

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/companies/biz_000000000001' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": {
    "id": "biz_000000000001",
    "name": "Atlas Studio",
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Experiences

#### GET /experiences (optional: company_id) + pagination

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/experiences?company_id=biz_000000000001&limit=2&cursor=0' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": [
    {
      "id": "exp_000000000001",
      "name": "Experience 1",
      "company": { "id": "biz_000000000001", "name": "Atlas Studio" },
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "0",
    "next_cursor": "1",
    "has_more": true,
    "limit": 2,
    "total": 4
  }
}
```

#### GET /experiences/:id

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/experiences/exp_000000000001' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": {
    "id": "exp_000000000001",
    "name": "Experience 1",
    "company": { "id": "biz_000000000001", "name": "Atlas Studio" },
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Products

#### GET /products (required: company_id) + pagination

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/products?company_id=biz_000000000001&limit=2&cursor=0' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": [
    {
      "id": "prod_000000000001",
      "company_id": "biz_000000000001",
      "title": "Pro Academy",
      "route": "/pro-academy",
      "member_count": 78,
      "price": 9999,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "0",
    "next_cursor": "1",
    "has_more": true,
    "limit": 2,
    "total": 7
  }
}
```

#### GET /products (optional: route)

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/products?company_id=biz_000000000001&route=%2Fpro-academy&limit=10' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": [
    {
      "id": "prod_000000000001",
      "company_id": "biz_000000000001",
      "title": "Pro Academy",
      "route": "/pro-academy",
      "member_count": 78,
      "price": 9999,
      "created_at": "2024-01-01T00:00:00.000Z"
    }
  ],
  "pagination": {
    "cursor": "0",
    "next_cursor": null,
    "has_more": false,
    "limit": 10,
    "total": 1
  }
}
```

#### GET /products/:id

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/products/prod_000000000001' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": {
    "id": "prod_000000000001",
    "company_id": "biz_000000000001",
    "title": "Pro Academy",
    "route": "/pro-academy",
    "member_count": 78,
    "price": 9999,
    "created_at": "2024-01-01T00:00:00.000Z"
  }
}
```

### Members

#### GET /members (required: company_id, product_id; optional: statuses) + pagination

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/members?company_id=biz_000000000001&product_id=prod_000000000001&statuses=joined,left&limit=2&cursor=0' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": [
    {
      "id": "mem_000000000001",
      "company_id": "biz_000000000001",
      "product_id": "prod_000000000001",
      "status": "joined",
      "joined_at": "2024-01-01T00:00:00.000Z",
      "most_recent_action": "view",
      "most_recent_action_at": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "usr_000000000001",
        "username": "fast_fox_1",
        "email": "user1@example.com",
        "name": "User 1",
        "profile_picture": "https://picsum.photos/seed/default-user-1/200/200",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": {
    "cursor": "0",
    "next_cursor": "1",
    "has_more": true,
    "limit": 2,
    "total": 120
  }
}
```

#### GET /members (example: joined only)

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/members?company_id=biz_000000000001&product_id=prod_000000000001&statuses=joined&limit=5' \
  -H 'Authorization: Bearer dev' \
  -H 'x-whopsandbox-seed: funneloo'
```

Output:

```json
{
  "data": [
    {
      "id": "mem_000000000001",
      "company_id": "biz_000000000001",
      "product_id": "prod_000000000001",
      "status": "joined",
      "joined_at": "2024-01-01T00:00:00.000Z",
      "most_recent_action": "view",
      "most_recent_action_at": "2024-01-01T00:00:00.000Z",
      "user": { "id": "usr_000000000001", "username": "fast_fox_1", "email": "user1@example.com", "name": "User 1", "profile_picture": "https://picsum.photos/seed/funneloo-user-1/200/200", "created_at": "2024-01-01T00:00:00.000Z" }
    }
  ],
  "pagination": { "cursor": "0", "next_cursor": "5", "has_more": true, "limit": 5, "total": 78 }
}
```

### Memberships

#### GET /memberships (required: company_id, user_id) + pagination

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/memberships?company_id=biz_000000000001&user_id=usr_000000000001&limit=10&cursor=0' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": [
    {
      "id": "mem_000000000001",
      "company_id": "biz_000000000001",
      "product_id": "prod_000000000001",
      "status": "joined",
      "joined_at": "2024-01-01T00:00:00.000Z",
      "most_recent_action": "view",
      "most_recent_action_at": "2024-01-01T00:00:00.000Z",
      "user": {
        "id": "usr_000000000001",
        "username": "fast_fox_1",
        "email": "user1@example.com",
        "name": "User 1",
        "profile_picture": "https://picsum.photos/seed/default-user-1/200/200",
        "created_at": "2024-01-01T00:00:00.000Z"
      }
    }
  ],
  "pagination": { "cursor": "0", "next_cursor": null, "has_more": false, "limit": 10, "total": 1 }
}
```

### Payments

#### GET /payments (required: company_id; optional: product_ids, statuses, created_after, order, direction) + pagination

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/payments?company_id=biz_000000000001&product_ids=prod_000000000001&statuses=paid,refunded&order=paid_at&direction=desc&limit=2&cursor=0' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": [
    {
      "id": "pay_000000000001",
      "company_id": "biz_000000000001",
      "created_at": "2024-01-01T00:00:00.000Z",
      "paid_at": "2024-01-01T00:00:00.000Z",
      "status": "paid",
      "substatus": null,
      "currency": "usd",
      "total": 9999,
      "amount_after_fees": 9199,
      "refunded_amount": 0,
      "product": { "id": "prod_000000000001", "title": "Pro Academy" },
      "user": { "id": "usr_000000000001", "username": "fast_fox_1", "email": "user1@example.com", "name": "User 1" }
    }
  ],
  "pagination": { "cursor": "0", "next_cursor": "1", "has_more": true, "limit": 2, "total": 120 }
}
```

#### GET /payments/:id

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/payments/pay_000000000001' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "data": {
    "id": "pay_000000000001",
    "company_id": "biz_000000000001",
    "created_at": "2024-01-01T00:00:00.000Z",
    "paid_at": "2024-01-01T00:00:00.000Z",
    "status": "paid",
    "substatus": null,
    "currency": "usd",
    "total": 9999,
    "amount_after_fees": 9199,
    "refunded_amount": 0,
    "product": { "id": "prod_000000000001", "title": "Pro Academy" },
    "user": { "id": "usr_000000000001", "username": "fast_fox_1", "email": "user1@example.com", "name": "User 1" }
  }
}
```

### Error examples

#### Missing Authorization header (401)

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/products?company_id=biz_000000000001'
```

Output:

```json
{
  "error": {
    "code": "unauthorized",
    "message": "Missing Authorization: Bearer <token>"
  }
}
```

#### Invalid query (400)

```bash
curl 'http://localhost:4000/whopSandbox/api/v1/products?limit=9999&company_id=biz_000000000001' \
  -H 'Authorization: Bearer dev'
```

Output:

```json
{
  "error": {
    "code": "invalid_query",
    "message": "Invalid query parameters",
    "details": {}
  }
}
```


