# Halo Indexer - Layer 1.5 Bridge for LASKO

The Halo Indexer is a Layer 1.5 bridge that creates chronological records for decentralized social media posts, bridging user experience (Lasko Frontend) with blockchain permanence (Telestai).

## Architecture

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Lasko Frontend │    │   Halo Indexer   │    │  Telestai (TLS)  │
│   (Layer 2)      │◄──►│   (Layer 1.5)    │◄──►│   (Layer 1)      │
│                 │    │                 │    │                 │
│ • User Interface│    │ • Post Stamping │    │ • Blockchain    │
│ • Post Creation │    │ • Sequential    │    │ • Block Writing │
│ • Content View  │    │   Codes         │    │ • Chronological │
│ • Reactions     │    │ • Live/Not-Live │    │   Records       │
└─────────────────┘    │ • Flux Hosting  │    └─────────────────┘
                       └─────────────────┘
```

## Features

- **Sequential Code Generation**: LAS#0000000000000000000000000000001 format
- **Post Stamping**: Core Wallet signature verification
- **Live/Not-Live Flags**: Moderation system
- **Block Timing Coordination**: TLS block synchronization
- **Leader Election**: Flux redundancy support
- **Rate Limiting**: API protection
- **Health Monitoring**: Kubernetes-ready health checks

## Quick Start

### Prerequisites

- Node.js 18+
- Docker and Docker Compose
- Redis (for caching)
- PostgreSQL (for persistent storage)

### Local Development

1. **Clone and setup:**
```bash
cd halo-indexer
cp env.example .env
npm install
```

2. **Start with Docker Compose:**
```bash
docker-compose up -d
```

3. **Check health:**
```bash
curl http://localhost:3000/api/health
```

### Manual Setup

1. **Install dependencies:**
```bash
npm install
```

2. **Configure environment:**
```bash
cp env.example .env
# Edit .env with your configuration
```

3. **Start Redis and PostgreSQL:**
```bash
# Start Redis
redis-server

# Start PostgreSQL
# (Install and configure PostgreSQL)
```

4. **Run the indexer:**
```bash
npm start
```

## API Endpoints

### Posts

- `POST /api/posts` - Create a new post
- `GET /api/posts` - Get chronological feed
- `GET /api/posts/:sequentialCode` - Get specific post
- `PUT /api/posts/:sequentialCode/flag` - Update live/not-live flag

### Blocks

- `GET /api/blocks/next` - Get next block information
- `GET /api/blocks/current` - Get current block
- `GET /api/blocks/:height` - Get block by height
- `POST /api/blocks/:height/imprint` - Imprint sequential codes

### Health

- `GET /api/health` - Health check
- `GET /api/health/ready` - Readiness check
- `GET /api/health/live` - Liveness check

## Sequential Code System

The Halo indexer generates unique sequential codes in the format:
```
LAS#0000000000000000000000000000001
```

### Code Generation

- **Prefix**: Always "LAS#"
- **Length**: 32 digits (extensible)
- **Uniqueness**: timestamp + user_address + nonce
- **Extension**: Can add digits when approaching limit

### Example Usage

```javascript
// Generate sequential code
const sequentialCode = await sequentialCodeGenerator.generateSequentialCode(
  userAddress, 
  timestamp
);
// Returns: LAS#0000000000000000000000000000001
```

## Flux Deployment

The Halo indexer is designed for deployment on Flux infrastructure:

### Docker Configuration

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
```

### Flux Deployment

1. **Build and push to registry:**
```bash
docker build -t halo-indexer .
docker tag halo-indexer your-registry/halo-indexer:latest
docker push your-registry/halo-indexer:latest
```

2. **Deploy to Flux:**
```bash
# Configure Flux deployment
# Set environment variables
# Configure domain assignment
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3000` |
| `NODE_ID` | Node identifier | `indexer-1` |
| `REDIS_URL` | Redis connection | `redis://localhost:6379` |
| `TLS_API_ENDPOINT` | TLS API endpoint | `https://api.telestai.io` |
| `LEADER_ELECTION_ENABLED` | Enable leader election | `true` |

### Rate Limiting

- **Posts per minute**: 5
- **Posts per day**: 100
- **API requests per minute**: 60

## Development

### Project Structure

```
halo-indexer/
├── src/
│   ├── index.js              # Main application
│   ├── routes/               # API routes
│   ├── services/             # Core services
│   ├── database/             # Database layer
│   └── utils/                # Utilities
├── logs/                     # Log files
├── Dockerfile                # Docker configuration
├── docker-compose.yml        # Local development
└── package.json              # Dependencies
```

### Adding New Features

1. **Create service:**
```javascript
// src/services/newService.js
class NewService {
  async initialize() {
    // Initialization logic
  }
}
```

2. **Add to main app:**
```javascript
// src/index.js
const { initializeNewService } = require('./services/newService');
await initializeNewService();
```

3. **Create routes:**
```javascript
// src/routes/newFeature.js
const router = express.Router();
router.get('/', async (req, res) => {
  // Route logic
});
```

## Monitoring

### Health Checks

- **Health**: `GET /api/health`
- **Readiness**: `GET /api/health/ready`
- **Liveness**: `GET /api/health/live`

### Logging

Logs are written to:
- `logs/combined.log` - All logs
- `logs/error.log` - Error logs only
- Console output in development

### Metrics

Key metrics to monitor:
- Posts processed per minute
- Sequential code generation rate
- Block timing accuracy
- API response times
- Redis connection status

## Security

### Rate Limiting

- IP-based rate limiting
- User-based rate limiting
- API endpoint protection

### Signature Verification

- Core Wallet signature validation
- Post authenticity verification
- User address verification

### Data Protection

- Input validation with Joi
- SQL injection prevention
- XSS protection with helmet

## Troubleshooting

### Common Issues

1. **Redis connection failed:**
   - Check Redis server is running
   - Verify REDIS_URL configuration
   - Check network connectivity

2. **Sequential code collision:**
   - Check Redis for duplicate codes
   - Verify timestamp uniqueness
   - Review nonce generation

3. **Block timing issues:**
   - Check TLS API connectivity
   - Verify block prediction algorithms
   - Review timing synchronization

### Debug Mode

Enable debug logging:
```bash
LOG_LEVEL=debug npm start
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - see LICENSE file for details.

## Support

For support and questions:
- Create an issue on GitHub
- Check the documentation
- Review the logs for errors

---

**Halo Indexer v1.0.0** - Layer 1.5 Bridge for LASKO 