# Moving the account layer to a Java servlet + database

This project is static HTML, so `sakaytayoauth.js` keeps accounts in `localStorage`.
Every function in it matches one endpoint, so the pages do not change when it moves to a server.

| JS function                 | Endpoint                       | Server must                                              |
|-----------------------------|--------------------------------|----------------------------------------------------------|
| `register(fields, role)`    | `POST /api/register`           | reject duplicate email (409), hash password, start session |
| `login(email, password)`    | `POST /api/login`              | 401 wrong password / 404 no account, start session      |
| `current()`                 | `GET /api/me`                  | read the session cookie, return the account or 401       |
| `save(account)`             | `PUT /api/me`                  | update name, contact, driver draft, driver profile       |
| `switchRole(role)`          | `POST /api/role`               | add "passenger" role if missing                          |
| `logout()`                  | `POST /api/logout`             | invalidate the session                                   |
| `routeFor(role, account)`   | check in each servlet/filter   | verified driver -> dashboard, otherwise verification page |

Suggested table:

```sql
CREATE TABLE users (
  email          VARCHAR(254) PRIMARY KEY,         -- one email = one account
  full_name      VARCHAR(120) NOT NULL,
  contact_number VARCHAR(20)  NOT NULL,
  password_hash  VARCHAR(255) NOT NULL,            -- PBKDF2/bcrypt, never plain text
  roles          SET('passenger','driver') NOT NULL,
  driver_status  ENUM('not_started','in_progress','verified') NOT NULL DEFAULT 'not_started',
  driver_draft   JSON NULL,                        -- last saved verification step + fields
  driver_profile JSON NULL,
  passenger_profile JSON NULL,
  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```
