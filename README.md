# Vasati Properties

A Bengaluru real-estate listings website backed by PostgreSQL. The current production entry point is the Express server in `server.js`; it serves the static site in `public/`, exposes its API, and initializes the required tables when it starts.

## Requirements

- Git
- Docker Engine with the Docker Compose plugin (recommended for local use and VPS deployment)
- For running the Node server directly: Node.js 22 LTS and Corepack

## Local installation with Docker Compose

1. Clone the repository and enter the project directory:

   ```sh
   git clone https://github.com/velum7095-alt/vasati_properties_latest.git
   cd vasati_properties_latest
   ```

2. Create a `.env` file in the project root. Generate a database password consisting only of hex characters:

   ```sh
   docker run --rm node:22-alpine node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

   Add the generated value to `.env`:

   ```dotenv
   POSTGRES_USER=vasati_app
   POSTGRES_PASSWORD=paste_the_generated_hex_value_here
   POSTGRES_DB=vasati_properties
   PORT=3000
   ```

   Keep `.env` private; it is ignored by Git. Use a new, unique password for each deployment.

3. Build and start the application and database:

   ```sh
   docker compose up -d --build
   ```

4. Follow startup logs and open the site:

   ```sh
   docker compose logs -f app
   ```

   Visit [http://localhost:3000](http://localhost:3000). The server creates its tables and inserts starter listings when the database is empty.

Stop the containers with `docker compose down`. The database volume is retained. **Do not** run `docker compose down -v` unless you intend to delete the database and all its data.

## Local installation with Node.js and PostgreSQL

Use this option if PostgreSQL is already installed and running on your machine.

1. Clone the repository as shown above, then install the pinned pnpm version and dependencies:

   ```sh
   corepack enable
   pnpm install --frozen-lockfile
   ```

2. Create a PostgreSQL database and user. Set `DATABASE_URL` to that database's connection string.
3. Start the server:

   macOS/Linux:

   ```sh
   DATABASE_URL="postgresql://vasati_app:your_password@localhost:5432/vasati_properties" pnpm dev
   ```

   Windows PowerShell:

   ```powershell
   $env:DATABASE_URL = "postgresql://vasati_app:your_password@localhost:5432/vasati_properties"
   pnpm dev
   ```

   The database must already exist and the user must have permission to create tables. The server initializes the application tables at startup. No Prisma migration or seed command is required for this Express server.

## VPS deployment

For a self-hosted Linux VPS or Coolify deployment, follow [COOLIFY.md](./COOLIFY.md). It covers Docker Compose, environment configuration, reverse-proxy/TLS setup, backups, and deployment checks.

> **Production security warning:** The current Express server exposes administrative API operations without authentication, and `/admin` is not protected by a login. Do not expose this version to the public internet or use it with real customer data until authentication and authorization have been implemented and verified. TLS and a strong database password do not replace application-level access control.

## Configuration

| Variable | Required | Purpose |
| --- | --- | --- |
| `DATABASE_URL` | Yes for direct Node runs | PostgreSQL connection string used by `server.js`. Compose builds this value from the `POSTGRES_*` settings. |
| `POSTGRES_USER` | Compose | PostgreSQL application user; defaults to `vasati_app`. |
| `POSTGRES_PASSWORD` | Compose | Unique PostgreSQL password. Use a hex-only value to avoid URL-encoding issues in the Compose-generated connection string. |
| `POSTGRES_DB` | Compose | Database name; defaults to `vasati_properties`. |
| `PORT` | No | Host port published by Compose; defaults to `3000`. The app listens on port `3000` inside its container. |

The repository also contains a Next.js codebase and Prisma schema, but the current `pnpm dev`, `pnpm start`, and Docker deployment run `server.js`. Follow the runtime path above rather than running Prisma setup commands for local installation.

## Project documents

- [Coolify and VPS deployment](./COOLIFY.md)
- [Compliance notes](./COMPLIANCE.md)
- [Project configuration](./package.json)
