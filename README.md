# ZDA Funding Wallet API

Public-facing API for ZDA funding wallet project cards and exchange rate data.

## 🌐 Base URL
```
https://zdabe.onrender.com/api/v1

```

---

## 🚀 Endpoints

### `GET /exchange-rate`
Returns the current (mocked) ZEC → USD exchange rate.
✅ Example:
```
https://zdabe.onrender.com/api/v1/exchange-rate

````
✅ Response:
```json
{
  "zec_to_usd": 72.55,
  "timestamp": "2025-06-22T20:22:37.568Z"
}
````

---

### `GET /cards`

```
https://zdabe.onrender.com/api/v1/cards
```

Returns a list of project cards.

| Name                | Type          | Usage           | Allowed Values / Notes                                                                       |
| ------------------- | ------------- | --------------- | -------------------------------------------------------------------------------------------- |
| `page`              | integer       | Query parameter | Page number (default `1`)                                                                    |
| `per_page`          | integer       | Query parameter | Cards per page (default `10`, max `100`)                                                     |
| `sort_by`           | string        | Query parameter | `last_updated`, `priority`, `percent_funded`, `date` (default `last_updated`)                |
| `sort_dir`          | string        | Query parameter | `asc`, `desc` (default `desc`)                                                               |
| `priority`          | string        | Query parameter | `HIGH`, `MEDIUM`, `LOW`                                                                      |
| `status`            | string        | Query parameter | `NOT STARTED`, `IN PROGRESS`, `BLOCKED`, `COMPLETED`                   |
| `stage`             | string        | Query parameter | `ANALYZE`, `DESIGN`, `DEVELOP`, `DEPLOY`, `MAINTAIN`                   |
| `tags`              | string        | Query parameter | Comma-separated tags (e.g. `privacy,communication`)                                          |
| `id`                | uuid          | Response field  | Unique ID of the card                                                                        |
| `title`             | text          | Response field  | Project title                                                                                |
| `description`       | text          | Response field  | Project description                                                                          |
| `creators`          | text\[]       | Response field  | List of creators                                                                             |
| `date`              | timestamptz   | Response field  | Project creation date                                                                        |
| `contributors`      | integer       | Response field  | Number of contributors                                                                       |
| `tags`              | text\[]       | Response field  | Tags assigned to the project                                                                 |
| `priority`          | text          | Response field  | Priority level                                                                               |
| `funding_earned`    | numeric(20,8) | Response field  | ZEC earned                                                                                   |
| `funding_spent`     | numeric(20,8) | Response field  | ZEC spent                                                                                    |
| `funding_requested` | numeric(20,8) | Response field  | ZEC requested                                                                                |
| `funding_received`  | numeric(20,8) | Response field  | ZEC received                                                                                 |
| `funding_available` | numeric(20,8) | Response field  | ZEC available                                                                                |
| `percent_funded`    | numeric       | Response field  | Percent funded                                                                               |
| `visibility`        | text          | Response field  | Always `PUBLIC`                                                                              |
| `milestones`        | jsonb         | Response field  | Milestones data                                                                              |
| `status`            | text          | Response field  | Project status                                                                               |
| `stage`             | text          | Response field  | Project stage                                                                                |
| `created_by`        | text          | Response field  | Creator ID                                                                                   |
| `owned_by`          | text          | Response field  | Owner ID                                                                                     |
| `last_updated`      | timestamptz   | Response field  | Last update timestamp                                                                        |
| `wallet_addresses`  | text\[]       | Response field  | Transparent addresses linked to project                                                      |
| `view_keys`         | text\[]       | Response field  | View keys linked to project                                                                  |


---

✅ Example:

---

#### 1️⃣ All public cards (default, no query params needed)

```
https://zdabe.onrender.com/api/v1/cards
```

---

#### 2️⃣ Limit 10 (default behavior is per\_page=10)

```
https://zdabe.onrender.com/api/v1/cards?per_page=10
```

---

#### 3️⃣ Pagination with offset (page 2, per\_page 10 → offset 10)

```
https://zdabe.onrender.com/api/v1/cards?page=2&per_page=10
```

---

#### 4️⃣ Order by last\_updated descending (default)

```
https://zdabe.onrender.com/api/v1/cards?sort_by=last_updated&sort_dir=desc
```

---

#### 5️⃣ Filter by priority HIGH

```
https://zdabe.onrender.com/api/v1/cards?priority=HIGH
```

---

#### 6️⃣ Filter by priority HIGH and status IN PROGRESS

```
https://zdabe.onrender.com/api/v1/cards?priority=HIGH&status=IN%20PROGRESS
```

---

### `GET /cards/{id}`

Returns a single project card by ID (UUID).
✅ Example:

```
https://zdabe.onrender.com/api/v1/cards/4c999973-8929-4f51-8964-21f2677935e4
```


---

✅ One step at a time.

➡ **Here’s exactly what you should add to `README.md` to showcase your new funding summary endpoint:**

---

### 📌 `GET /funding-summary`

Returns aggregate funding statistics across all public project cards.

✅ Example:

```
https://zdabe.onrender.com/api/v1/funding-summary
```

✅ Response:

```json
{
  "total_earned": "XX.XXXXXXXX",
  "total_spent": "XX.XXXXXXXX",
  "total_requested": "XX.XXXXXXXX",
  "total_received": "XX.XXXXXXXX",
  "total_available": "XX.XXXXXXXX"
}
```

✅ Notes:

* All values are strings with 8 decimal places
* Only `PUBLIC` cards are included

---

## 🛡 Rate limit

10 requests per minute per IP. Exceeding this returns:

```json
{
  "message": "Too many requests, please try again later."
}
```

---

## ⚙ Response headers

* `X-API-Version: v1`
* `Cache-Control: public, max-age=30`

---

## 📂 Code repository

[https://github.com/zcashug/zdabe](https://github.com/zcashug/zdabe)

---

## 🔑 CORS

All origins allowed.

---

## ❗ Error codes

* `400` — bad query
* `404` — resource not found
* `429` — too many requests
* `500` — internal server error

---

