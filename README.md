# Bounty Platform API

Anonymous bounty-based assignment platform — Node.js / Express / MongoDB.

## Architecture at a Glance

```
src/
├── config/
│   └── db.js                  # MongoDB connection (exits on failure)
├── middleware/
│   ├── adminAuth.js            # API-key guard for admin routes
│   ├── identity.js             # Lazy token generation (poster / hunter)
│   └── upload.js               # Multer — renames files to bountyId
├── models/
│   ├── Bounty.js               # Bounty lifecycle model
│   └── User.js                 # One doc per mobile, holds both tokens
├── routes/
│   ├── bounty.routes.js        # POST /bounties, GET /active, PATCH /claim
│   └── admin.routes.js         # /admin/* (protected)
├── utils/
│   └── tokenGenerator.js       # $PXXXXX$ / $HXXXXX$ / $BXXXXX$ generators
├── app.js                      # Express app, routes, error handler
└── server.js                   # Entry point, graceful shutdown
```

---

## Setup

```bash
git clone <repo>
cd bounty-platform
npm install
cp .env.example .env      # fill in your values
npm run dev
```

### Environment Variables

| Variable       | Required | Description                          |
|----------------|----------|--------------------------------------|
| `MONGODB_URI`  | ✅        | Full MongoDB connection string       |
| `ADMIN_SECRET` | ✅        | Secret key sent in `x-admin-key` header |
| `PORT`         | ❌        | Defaults to 3000                     |
| `NODE_ENV`     | ❌        | `development` or `production`        |

---

## API Reference

### Public Routes

#### `POST /bounties`
Create a new bounty. Mobile is used to resolve/create a `posterToken`.

**Headers / Body (multipart/form-data):**
```
mobile:        "9876543210"
title:         "Need calculus homework solved"
description:   "Chapter 5, problems 1–10. Due Friday."
bountyAmount:  500
assignment:    <file upload — optional>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bountyId": "$B3KZ9A$",
    "posterToken": "$P7XQ2M$",
    "title": "Need calculus homework solved",
    "bountyAmount": 500,
    "status": "OPEN",
    "hasAttachment": true
  }
}
```

---

#### `GET /bounties/active`
Returns all `OPEN` bounties. **No mobile numbers or internal IDs are ever returned.**

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "bountyId": "$B3KZ9A$",
      "posterToken": "$P7XQ2M$",
      "title": "Need calculus homework solved",
      "bountyAmount": 500,
      "status": "OPEN"
    }
  ]
}
```

---

#### `PATCH /bounties/claim`
Atomically claim an OPEN bounty. If two hunters hit this simultaneously, exactly one succeeds.

**Body:**
```json
{
  "mobile": "9123456780",
  "bountyId": "$B3KZ9A$"
}
```

**Response (success):**
```json
{
  "success": true,
  "message": "Bounty claimed successfully.",
  "data": {
    "bountyId": "$B3KZ9A$",
    "status": "CLAIMED",
    "claimedBy": {
      "hunterToken": "$HY9PL3$",
      "claimedAt": "2024-06-01T10:30:00.000Z"
    }
  }
}
```

**Response (race lost — 409):**
```json
{
  "success": false,
  "message": "Bounty is no longer available — it may have already been claimed."
}
```

---

### Admin Routes (require `x-admin-key` header)

#### `PATCH /admin/finalize/:bountyId`
Mark a bounty as `COMPLETED` and `isPaid: true`. Offline payment confirmation.

```bash
curl -X PATCH http://localhost:3000/admin/finalize/\$B3KZ9A\$ \
  -H "x-admin-key: your_secret" \
  -H "Content-Type: application/json" \
  -d '{"adminNote": "Cash paid to hunter in person — 2024-06-01"}'
```

**Response:**
```json
{
  "success": true,
  "data": {
    "bountyId": "$B3KZ9A$",
    "status": "COMPLETED",
    "isPaid": true,
    "completedAt": "2024-06-01T14:00:00.000Z"
  }
}
```

---

#### `GET /admin/bounties?status=CLAIMED&page=1&limit=20`
Full bounty list with all internal fields (including `posterMobile`).

#### `GET /admin/bounties/:bountyId`
Single bounty detail.

#### `GET /admin/users?page=1&limit=20`
All users with tokens (audit trail).

---

## Key Design Decisions

### Race Condition Prevention
`PATCH /bounties/claim` uses `findOneAndUpdate` with `{ status: 'OPEN' }` as a filter condition. MongoDB's atomic document-level write guarantees that even under high concurrency, only one update can match and flip the status to `CLAIMED`. All subsequent attempts will find `status !== 'OPEN'` and receive a 409.

### Anonymity Enforcement
- `GET /bounties/active` uses a **whitelist projection** — only explicitly listed fields are returned. `posterMobile`, `_id`, and any future internal fields are excluded by default.
- Uploaded files are **renamed** to `<bountyId>_assignment<ext>` by Multer before hitting disk, stripping the original filename.
- The `posterMobile` field is stored for admin audit only and never appears in public API responses.

### Lazy Token Generation
The `identity` middleware uses `findOneAndUpdate` with an existence guard (`$exists: false`) to ensure tokens are generated and written atomically. Duplicate-key collisions (from race conditions or token entropy collision) are caught and retried up to 3 times.

### Token Format
```
Poster:  $PXXXXX$  (e.g., $P7XQ2M$)
Hunter:  $HXXXXX$  (e.g., $HY9PL3$)
Bounty:  $BXXXXX$  (e.g., $B3KZ9A$)
```
36^5 = ~60 million combinations per prefix — sufficient for most platforms. Increase `TOKEN_LENGTH` in `tokenGenerator.js` to scale.
