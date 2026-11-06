# IntelliGuard — Final Business-Code Identifier Architecture

## 1. Overview & Single-Identifier Strategy (Option A)

IntelliGuard uses **human-readable business codes as the sole canonical identifiers** for its five core business entities:
1. `Person` (`personCode`)
2. `Device` (`deviceCode`)
3. `FaceEmbedding` (`embeddingCode`)
4. `AccessLog` (`accessCode`)
5. `Alert` (`alertCode`)

All legacy integer `id` columns, `uuid_id` columns, foreign-key shadow columns, and synchronization triggers have been removed. Business codes serve as:
- Primary keys (`@id`)
- Foreign keys
- API resource identifiers (`/api/persons/PER-482910`, `/api/devices/DEV-918273`, etc.)
- URL identifiers (`/dashboard/persons/PER-482910`, `/dashboard/devices/DEV-918273`, etc.)
- Frontend references, search queries, and selection references

---

## 2. Final Business-Code Convention

Every business code consists of an uppercase three-letter prefix, a hyphen (`-`), and **exactly six numeric digits** (`[0-9]{6}`):

| Entity | Primary Key Field | DB Column | Prefix | Regex Pattern | Example |
|---|---|---|---|---|---|
| **Person** | `personCode` | `person_code` | `PER` | `^PER-[0-9]{6}$` | `PER-482910` |
| **Device** | `deviceCode` | `device_code` | `DEV` | `^DEV-[0-9]{6}$` | `DEV-918273` |
| **FaceEmbedding** | `embeddingCode` | `embedding_code` | `EMB` | `^EMB-[0-9]{6}$` | `EMB-123456` |
| **AccessLog** | `accessCode` | `access_code` | `ASL` | `^ASL-[0-9]{6}$` | `ASL-456789` |
| **Alert** | `alertCode` | `alert_code` | `ALT` | `^ALT-[0-9]{6}$` | `ALT-987654` |

---

## 3. Cryptographic Generation & Collision Handling

Business codes are generated centrally in `frontend/lib/identifiers.ts` using Node.js `crypto.randomInt(0, 1_000_000)`:
- **Unbiased Sampling**: `crypto.randomInt` uses rejection sampling internally, eliminating modulo bias across the `000000`–`999999` numeric range.
- **Bounded Collision Retry**: `generateUniqueBusinessIdentifier` checks the target table's primary key for uniqueness and retries up to a bounded limit (default: 5 attempts) before throwing a clear error, without swallowing unrelated database errors.

---

## 4. Relational Schema Summary

```text
Person
  personCode (PRIMARY KEY)

Device
  deviceCode (PRIMARY KEY)

FaceEmbedding
  embeddingCode (PRIMARY KEY)
  personCode (FOREIGN KEY -> Person.personCode, ON DELETE CASCADE)
  embedding vector(512) (HNSW cosine index preserved)

AccessLog
  accessCode (PRIMARY KEY)
  personCode (FOREIGN KEY -> Person.personCode, ON DELETE SET NULL)
  deviceCode (FOREIGN KEY -> Device.deviceCode, ON DELETE SET NULL)
  embeddingCode (FOREIGN KEY -> FaceEmbedding.embeddingCode, ON DELETE SET NULL)

Alert
  alertCode (PRIMARY KEY)
  personCode (FOREIGN KEY -> Person.personCode, ON DELETE SET NULL)
  deviceCode (FOREIGN KEY -> Device.deviceCode, ON DELETE SET NULL)
  resolvedBy (FOREIGN KEY -> User.id, ON DELETE SET NULL)
```

---

## 5. Protected Better Auth Schema

The Better Auth models (`User`, `Session`, `Account`, `Verification`) remain untouched and retain their native string identifiers (`User.id`, etc.). `Alert.resolvedBy` continues to reference `User.id`.
