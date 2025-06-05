# DeepScrape Docker Documentation

## Approach 1: Running the Pre-built Docker Image

This approach allows you to quickly run DeepScrape without building the Docker image yourself. You'll use a pre-built image from Docker Hub.

### Prerequisites
- Docker installed on your system
- An OpenAI API key

### Steps

#### 1. Run with Docker Run Command

```bash
docker run -d \
  --name deepscrape \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your-openai-api-key \
  -e OPENAI_MODEL=gpt-4o \
  -e API_KEY=your-api-key-for-auth \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/cache:/app/cache \
  your-dockerhub-username/deepscrape:latest
```

Replace:
- `your-openai-api-key` with your actual OpenAI API key
- `your-api-key-for-auth` with a secret key of your choice for DeepScrape API authentication
- `your-dockerhub-username` with the actual username where the image is hosted

#### 2. Run with Docker Compose

If you prefer using Docker Compose, create a `docker-compose.yml` file:

```yaml
version: '3.8'

services:
  deepscrape:
    image: your-dockerhub-username/deepscrape:latest
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPENAI_API_KEY=your-openai-api-key
      - OPENAI_MODEL=gpt-4o
      - API_KEY=your-api-key-for-auth
      - CACHE_ENABLED=true
      - CACHE_TTL=3600
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    volumes:
      - ./logs:/app/logs
      - ./cache:/app/cache
    restart: unless-stopped
    shm_size: 1gb
    depends_on:
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

Then run:

```bash
docker-compose up -d
```

### Environment Variables

| Variable | Description | Default Value |
|----------|-------------|---------------|
| OPENAI_API_KEY | Your OpenAI API key (required) | None |
| OPENAI_MODEL | OpenAI model to use | gpt-4o |
| OPENAI_ORGANIZATION | OpenAI organization ID (optional) | None |
| API_KEY | Secret key for DeepScrape API authentication | None |
| PORT | Port the server listens on | 3000 |
| CACHE_ENABLED | Enable caching | true |
| CACHE_TTL | Cache time-to-live in seconds | 3600 |
| CACHE_DIRECTORY | Directory to store cache files | ./cache |
| MAX_EXTRACTION_TOKENS | Max tokens for LLM extraction | 15000 |
| LLM_TEMPERATURE | LLM temperature setting | 0.2 |
| REDIS_HOST | Redis host | localhost |
| REDIS_PORT | Redis port | 6379 |
| REDIS_PASSWORD | Redis password | None |
| LOG_LEVEL | Logging level | info |

---

## Approach 2: Building Your Own Docker Image

This approach allows you to customize the DeepScrape Docker image before running it.

### Prerequisites
- Docker installed on your system
- Git installed on your system
- An OpenAI API key

### Steps

#### 1. Clone the Repository
```bash
git clone https://github.com/your-username/deepscrape.git
cd deepscrape
```

#### 2. Build the Docker Image
```bash
docker build -t deepscrape:custom .
```

#### 3. Run the Custom Image

Using Docker run:
```bash
docker run -d \
  --name deepscrape \
  -p 3000:3000 \
  -e OPENAI_API_KEY=your-openai-api-key \
  -e OPENAI_MODEL=gpt-4o \
  -e API_KEY=your-api-key-for-auth \
  -v $(pwd)/logs:/app/logs \
  -v $(pwd)/cache:/app/cache \
  deepscrape:custom
```

Or create a custom docker-compose.yml file:
```yaml
version: '3.8'

services:
  deepscrape:
    image: deepscrape:custom
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - OPENAI_API_KEY=your-openai-api-key
      - OPENAI_MODEL=gpt-4o
      - API_KEY=your-api-key-for-auth
      - CACHE_ENABLED=true
      - CACHE_TTL=3600
      - REDIS_HOST=redis
      - REDIS_PORT=6379
    volumes:
      - ./logs:/app/logs
      - ./cache:/app/cache
    restart: unless-stopped
    shm_size: 1gb
    depends_on:
      - redis

  redis:
    image: redis:alpine
    volumes:
      - redis-data:/data
    restart: unless-stopped

volumes:
  redis-data:
```

Then run:
```bash
docker-compose up -d
```

### Customizing the Image

If you want to make modifications to the DeepScrape codebase before building:

1. Make your code changes in the src/ directory
2. Update any dependencies in package.json if needed
3. Build your custom image with `docker build -t deepscrape:custom .`

Common customizations include:
- Changing default parameters in source files
- Adding additional middlewares or routes
- Modifying how content is processed or scraped

### Publishing Your Custom Image

If you want to publish your customized image to Docker Hub:

```bash
# Tag your image
docker tag deepscrape:custom your-dockerhub-username/deepscrape:custom

# Login to Docker Hub
docker login

# Push the image
docker push your-dockerhub-username/deepscrape:custom
```

---

## Verifying the Installation

After running the container with either approach, verify that DeepScrape is working:

1. Check the container logs:
   ```bash
   docker logs deepscrape
   ```

2. Test the API health endpoint:
   ```bash
   curl http://localhost:3000/health
   ```
   You should see a response like: `{"status":"ok"}`

3. Test a simple scrape operation:
   ```bash
   curl -X POST http://localhost:3000/api/scrape \
     -H "Content-Type: application/json" \
     -H "X-API-KEY: your-api-key-for-auth" \
     -d '{"url": "https://example.com", "options": {"extractorFormat": "markdown"}}'
   ```

## Troubleshooting

- **API Key Issues**: Make sure the OPENAI_API_KEY environment variable contains a valid API key.
- **Volume Permissions**: If you see permission errors, ensure the host directories for volumes have appropriate permissions.
- **Memory Issues**: When scraping complex websites, you might need to increase the memory limit in docker-compose.yml.
- **Container Crashes**: Check logs with `docker logs deepscrape` to identify the cause.
