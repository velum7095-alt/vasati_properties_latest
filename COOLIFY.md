# VPS and Coolify Deployment

This guide deploys the current `server.js` Express application and PostgreSQL using the repository's Docker Compose configuration. The server initializes its application tables when it starts; there is no Prisma migration step for this runtime.

> **Do not expose this version publicly yet.** The current Express server does not authenticate administrative API operations, and `/admin` has no login protection. Deploy only in a private, access-restricted environment until application-level authentication and authorization have been implemented and verified. HTTPS, a firewall, and database credentials are not substitutes for API authorization.

## Before you deploy

- A Linux VPS with a supported distribution such as Ubuntu 22.04/24.04, or a working Coolify installation.
- Docker Engine and the Docker Compose plugin if deploying directly to a VPS.
- A GitHub connection to `velum7095-alt/vasati_properties_latest`.
- A domain name and DNS pointing to the VPS for a web deployment.
- A unique PostgreSQL password. Generate a hex-only value to avoid special-character URL parsing problems:

  ```sh
  openssl rand -hex 32
  ```

## Option A: Deploy directly on a VPS with Docker Compose

1. Install Docker Engine and its Compose plugin using the official instructions for your Linux distribution. Confirm both commands work:

   ```sh
   docker --version
   docker compose version
   ```

2. Clone the repository and enter its directory:

   ```sh
   git clone https://github.com/velum7095-alt/vasati_properties_latest.git
   cd vasati_properties_latest
   ```

3. Create a private `.env` file in the repository root. Do not commit or share it:

   ```dotenv
   POSTGRES_USER=vasati_app
   POSTGRES_PASSWORD=replace_with_a_unique_hex_password
   POSTGRES_DB=vasati_properties
   PORT=3000
   ```

   Replace the password with the value generated above. Keep the `.env` file readable only by the deployment administrator.

4. Build and start the services:

   ```sh
   docker compose up -d --build
   docker compose ps
   docker compose logs --tail=100 app
   ```

   The application container waits for PostgreSQL to become healthy, then creates the required tables and starter listings if the database is empty.

5. Restrict network access to the application port. For any test deployment, allow access only from trusted IP addresses; do not make the admin panel or its APIs publicly reachable. For a production website, configure a reverse proxy with HTTPS only after the application has proper authentication and authorization.

6. Verify the app locally on the VPS:

   ```sh
   curl --fail http://127.0.0.1:3000/
   ```

   Visit `http://SERVER_IP:3000` only from a trusted network if your firewall permits it. The application container's health check also probes `/`.

To update after a code change, fetch the intended branch and rebuild:

```sh
git pull --ff-only
docker compose up -d --build
docker compose logs --tail=100 app
```

### Backups and persistence

PostgreSQL data is stored in the Compose-managed `pgdata` volume and survives container recreation. Schedule encrypted off-server backups and test restores. An example manual backup on a Linux VPS is:

```sh
docker compose exec -T db sh -c 'pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB"' > vasati_properties-$(date +%F).sql
```

Store backups securely and outside the public web root. `docker compose down` preserves the database volume. `docker compose down -v` deletes it and must not be used for routine updates.

## Option B: Deploy with Coolify

1. Create a new project and add a Docker Compose resource connected to `velum7095-alt/vasati_properties_latest`.
2. Select the intended branch and set the Compose file to `docker-compose.yml`.
3. Add the same `POSTGRES_USER`, unique hex-only `POSTGRES_PASSWORD`, `POSTGRES_DB`, and `PORT` variables in the resource's environment settings. Do not rely on repository defaults for production credentials.
4. Deploy and check the application and database logs. Confirm the application health check succeeds before routing any traffic.
5. Keep the resource private or restrict it to trusted IPs. Do not expose `/admin` or the administrative API publicly; address the production security warning above before enabling public access.
6. Configure encrypted, off-server PostgreSQL backups and periodically test a restore.

Coolify's domain proxy and TLS configuration varies by version and resource type. Follow the Coolify documentation for routing the Compose `app` service on container port `3000`; do not publish the database port.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `POSTGRES_USER` | No | Database user; defaults to `vasati_app`. |
| `POSTGRES_PASSWORD` | Yes for deployment | Unique database password. Use only hex characters because Compose inserts it into `DATABASE_URL`. |
| `POSTGRES_DB` | No | Database name; defaults to `vasati_properties`. |
| `PORT` | No | Host port mapped to the application; defaults to `3000`. The app listens on container port `3000`. |

For direct Node.js runs outside Compose, set `DATABASE_URL` to a PostgreSQL connection string instead. See the [local installation instructions](./README.md#local-installation-with-nodejs-and-postgresql).
