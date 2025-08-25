# HALO INDEXER - COMPLETE ARCHITECTURE

## 🏗️ **System Overview**

The Halo Indexer acts as a **Layer 1.5 bridge** between LASKO Frontend (Layer 2) and Telestai blockchain (Layer 1), providing chronological record-keeping for decentralized social media.

## 📊 **High-Level Architecture**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                                    LASKO FRONTEND (Layer 2)                  │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   User Interface│  │   Post Creation │  │   Feed Display  │  │   Reactions │ │
│  │                 │  │                 │  │                 │  │             │ │
│  │ • React/Next.js│  │ • Content Input │  │ • Chronological │  │ • Like/Share│ │
│  │ • Mobile App   │  │ • File Upload   │  │ • Filtering     │  │ • Comments  │ │
│  │ • Web App      │  │ • Core Wallet   │  │ • Pagination    │  │ • Moderation│ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              HALO INDEXER (Layer 1.5)                        │
│                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Trinity System│  │   Batch Manager │  │ Sequential Code │  │   Cassandra │ │
│  │   (Lead + 2)   │  │   (LGB#)        │  │   Generator     │  │   Storage   │ │
│  │                 │  │                 │  │   (LP#)         │  │             │ │
│  │ • Leader Election│  │ • Group Posts  │  │ • Unique Codes  │  │ • Decentralized│ │
│  │ • Heartbeat     │  │ • Batch Timeout │  │ • Collision     │  │ • High Perf │ │
│  │ • Failover      │  │ • TLS Writing   │  │ • Validation    │  │ • Scalable  │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
│                                                                               │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   TLS Client    │  │   Redis Cache   │  │   API Gateway   │  │   Health    │ │
│  │   Integration   │  │   & Sessions    │  │   & Routing     │  │   Monitoring│ │
│  │                 │  │                 │  │                 │  │             │ │
│  │ • Block Writing │  │ • Session Mgmt  │  │ • Rate Limiting │  │ • Probes    │ │
│  │ • Transaction   │  │ • Caching       │  │ • Load Balance  │  │ • Metrics   │ │
│  │ • Network Status│  │ • Pub/Sub       │  │ • Auth          │  │ • Alerts    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
                                        │
                                        ▼
┌─────────────────────────────────────────────────────────────────────────────────┐
│                              TELESTAI BLOCKCHAIN (Layer 1)                    │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────┐ │
│  │   Block Storage │  │   Transaction   │  │   Consensus     │  │   Network   │ │
│  │   & Validation  │  │   Processing    │  │   Protocol      │  │   Status    │ │
│  │                 │  │                 │  │                 │  │             │ │
│  │ • Immutable     │  │ • Batch Writing │  │ • Proof of Work │  │ • Nodes     │ │
│  │ • Chronological │  │ • Sequential    │  │ • Block Time    │  │ • Difficulty│ │
│  │ • Distributed   │  │ • Verification  │  │ • Finality      │  │ • Peers     │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 **Data Flow Architecture**

### **1. Post Creation Flow**
```
User Input → Core Wallet → Halo Indexer → TLS Blockchain
     │           │              │              │
     ▼           ▼              ▼              ▼
Content    Signature      LP# Code      Block Height
     │           │              │              │
     ▼           ▼              ▼              ▼
Validation  Verification   LGB# Batch    Confirmation
```

### **2. Trinity System Flow**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Lead Node     │    │   Slave Node 1  │    │   Slave Node 2  │
│   (indexer-lead)│    │ (indexer-slave-1)│    │ (indexer-slave-2)│
│                 │    │                 │    │                 │
│ • Leader Election│    │ • Heartbeat     │    │ • Heartbeat     │
│ • Batch Process │    │ • Backup Data   │    │ • Backup Data   │
│ • Cluster Sync  │    │ • Failover      │    │ • Failover      │
│ • TLS Writing   │    │ • Read Replica  │    │ • Read Replica  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                                 ▼
                    ┌─────────────────┐
                    │   Redis Cluster │
                    │   (Coordination)│
                    │                 │
                    │ • Leader Key    │
                    │ • Heartbeats    │
                    │ • Node Registry │
                    │ • Cluster State │
                    └─────────────────┘
```

### **3. Batch Processing Flow**
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   User Posts    │    │   Batch Manager │    │   TLS Blockchain│
│   (Multiple)    │    │   (LGB#)        │    │   (Layer 1)    │
│                 │    │                 │    │                 │
│ • Post 1        │    │ • Group Posts   │    │ • Block Writing │
│ • Post 2        │───▶│ • Batch Timeout │───▶│ • Transaction   │
│ • Post 3        │    │ • Max Size 100  │    │ • Confirmation  │
│ • Post N        │    │ • LGB#00000001  │    │ • Block Height  │
└─────────────────┘    └─────────────────┘    └─────────────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   LP# Codes     │    │   Batch Status  │    │   Block Data    │
│   (Individual)  │    │   (Metadata)    │    │   (Immutable)   │
│                 │    │                 │    │                 │
│ • LP#00000001   │    │ • Created At    │    │ • Block Height  │
│ • LP#00000002   │    │ • Post Count    │    │ • Transaction ID│
│ • LP#00000003   │    │ • Status        │    │ • Timestamp     │
│ • LP#0000000N   │    │ • Error Info    │    │ • Batch Code    │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 🗄️ **Database Architecture**

### **Cassandra Schema**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              CASSANDRA CLUSTER                            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │     posts       │  │     batches     │  │ sequential_codes│            │
│  │   (Primary)     │  │   (Metadata)    │  │   (Tracking)    │            │
│  │                 │  │                 │  │                 │            │
│  │ • sequential_code│  │ • batch_code   │  │ • code          │            │
│  │ • user_address  │  │ • batch_number  │  │ • user_address  │            │
│  │ • content       │  │ • status        │  │ • timestamp     │            │
│  │ • signature     │  │ • post_count    │  │ • nonce         │            │
│  │ • timestamp     │  │ • created_at    │  │ • uniqueness    │            │
│  │ • live_flag     │  │ • processed_at  │  │ • created_at    │            │
│  │ • batch_code    │  │ • block_height  │  │                 │            │
│  │ • block_height  │  │ • error         │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                                  │
│  │   user_posts    │  │chronological_feed│                                │
│  │   (Index)       │  │   (Index)       │                                │
│  │                 │  │                 │                                │
│  │ • user_address  │  │ • feed_timestamp│                                │
│  │ • timestamp     │  │ • sequential_code│                                │
│  │ • sequential_code│  │                 │                                │
│  │                 │  │                 │                                │
│  └─────────────────┘  └─────────────────┘                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### **Redis Architecture**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              REDIS CLUSTER                                 │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Trinity       │  │   Sessions      │  │   Rate Limiting │            │
│  │   Coordination  │  │   & Cache       │  │   & Throttling  │            │
│  │                 │  │                 │  │                 │            │
│  │ • trinity:leader│  │ • user:sessions │  │ • rate:limit:ip │            │
│  │ • trinity:nodes │  │ • post:cache    │  │ • daily:limit   │            │
│  │ • trinity:status│  │ • feed:cache    │  │ • minute:limit  │            │
│  │ • heartbeat     │  │ • batch:cache   │  │ • user:limits   │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Batch Data    │  │   Sequential    │  │   Chronological │            │
│  │   & Metadata    │  │   Code Cache    │  │   Feed Index    │            │
│  │                 │  │                 │  │                 │            │
│  │ • halo:batch:*  │  │ • halo:code:*   │  │ • halo:feed:*   │            │
│  │ • batch:posts   │  │ • code:metadata │  │ • feed:posts    │            │
│  │ • batch:status  │  │ • code:sequence │  │ • feed:chrono   │            │
│  │ • batch:errors  │  │ • code:uniqueness│ │ • feed:latest   │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🌐 **API Architecture**

### **REST API Endpoints**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              API GATEWAY                                  │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Posts API     │  │   Trinity API   │  │   Health API    │            │
│  │                 │  │                 │  │                 │            │
│  │ POST /api/posts │  │ GET /api/trinity│  │ GET /api/health │            │
│  │ GET /api/posts  │  │ /status         │  │ GET /api/health │            │
│  │ GET /api/posts/ │  │ GET /api/trinity│  │ /ready          │            │
│  │ :code           │  │ /nodes          │  │ GET /api/health │            │
│  │ PUT /api/posts/ │  │ POST /api/trinity│ │ /live           │            │
│  │ :code/flag      │  │ /force-election │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Blocks API    │  │   TLS API       │  │   Monitoring    │            │
│  │                 │  │                 │  │                 │            │
│  │ GET /api/blocks │  │ GET /api/tls/   │  │ GET /api/metrics│            │
│  │ /current        │  │ blocks/current  │  │ GET /api/logs   │            │
│  │ GET /api/blocks │  │ GET /api/tls/   │  │ GET /api/status │            │
│  │ /next           │  │ blocks/next     │  │                 │            │
│  │ GET /api/blocks │  │ POST /api/tls/  │  │                 │            │
│  │ /:height        │  │ blocks/:height/ │  │                 │            │
│  │                 │  │ imprint         │  │                 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔧 **Deployment Architecture**

### **FluxDrive Kubernetes Deployment**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              FLUXDRIVE CLUSTER                            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Lead Node     │  │   Slave Node 1  │  │   Slave Node 2  │            │
│  │   (indexer-lead)│  │ (indexer-slave-1)│  │ (indexer-slave-2)│            │
│  │                 │  │                 │  │                 │            │
│  │ • Replicas: 1   │  │ • Replicas: 1   │  │ • Replicas: 1   │            │
│  │ • CPU: 250m     │  │ • CPU: 250m     │  │ • CPU: 250m     │            │
│  │ • Memory: 512Mi │  │ • Memory: 512Mi │  │ • Memory: 512Mi │            │
│  │ • Auto-scale: 5 │  │ • Auto-scale: 5 │  │ • Auto-scale: 5 │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Redis         │  │   Cassandra     │  │   PostgreSQL    │            │
│  │   (Cache)       │  │   (Storage)     │  │   (Metadata)    │            │
│  │                 │  │                 │  │                 │            │
│  │ • Replicas: 1   │  │ • Replicas: 1   │  │ • Replicas: 1   │            │
│  │ • Storage: 5Gi  │  │ • Storage: 10Gi │  │ • Storage: 5Gi  │            │
│  │ • Memory: 256Mi │  │ • Memory: 1Gi   │  │ • Memory: 512Mi │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
│                                                                             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐            │
│  │   Load Balancer │  │   Ingress       │  │   Monitoring    │            │
│  │                 │  │                 │  │                 │            │
│  │ • Type: LoadBalancer│ │ • Host: halo.runonflux.io│ │ • Prometheus    │            │
│  │ • Port: 80      │  │ • SSL: Enabled  │  │ • Grafana       │            │
│  │ • Health Checks │  │ • Rewrite Rules │  │ • Logging       │            │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 🔄 **Request Flow Architecture**

### **Complete Request Journey**
```
1. User Input
   ┌─────────────────┐
   │   LASKO Frontend│
   │   (React/Next.js)│
   └─────────────────┘
           │
           ▼
2. Core Wallet Signature
   ┌─────────────────┐
   │   Core Wallet   │
   │   (iOS App)     │
   └─────────────────┘
           │
           ▼
3. API Gateway
   ┌─────────────────┐
   │   Rate Limiting │
   │   Authentication│
   │   Load Balancing│
   └─────────────────┘
           │
           ▼
4. Trinity Leader
   ┌─────────────────┐
   │   Lead Node     │
   │   (indexer-lead)│
   └─────────────────┘
           │
           ▼
5. Sequential Code Generation
   ┌─────────────────┐
   │   LP# Generator │
   │   (Unique Code) │
   └─────────────────┘
           │
           ▼
6. Batch Processing
   ┌─────────────────┐
   │   LGB# Manager  │
   │   (Group Posts) │
   └─────────────────┘
           │
           ▼
7. TLS Blockchain Writing
   ┌─────────────────┐
   │   TLS Client    │
   │   (Blockchain)  │
   └─────────────────┘
           │
           ▼
8. Cassandra Storage
   ┌─────────────────┐
   │   Cassandra     │
   │   (Decentralized)│
   └─────────────────┘
           │
           ▼
9. Redis Caching
   ┌─────────────────┐
   │   Redis Cache   │
   │   (Performance) │
   └─────────────────┘
           │
           ▼
10. Response
   ┌─────────────────┐
   │   API Response  │
   │   (LP# Code)    │
   └─────────────────┘
```

## 🎯 **Key Architectural Principles**

### **1. Decentralization**
- **Cassandra**: Distributed database across multiple nodes
- **Trinity System**: Lead + 2 slaves for redundancy
- **TLS Blockchain**: Immutable, distributed ledger
- **FluxDrive**: Decentralized hosting platform

### **2. Scalability**
- **Horizontal Scaling**: Up to 5 replicas per node type
- **Auto-scaling**: CPU/Memory based scaling
- **Load Balancing**: Automatic traffic distribution
- **Database Scaling**: Cassandra horizontal scaling

### **3. Reliability**
- **Leader Failover**: Automatic leader replacement
- **Node Redundancy**: 3-node Trinity system
- **Data Persistence**: Cassandra + PostgreSQL
- **Health Checks**: Liveness and readiness probes

### **4. Performance**
- **Caching**: Redis for session and data caching
- **Batch Processing**: Efficient blockchain writes
- **Connection Pooling**: Optimized database connections
- **Rate Limiting**: API protection and throttling

### **5. Security**
- **Core Wallet**: Cryptographic signatures
- **Rate Limiting**: API abuse prevention
- **Input Validation**: Request sanitization
- **Error Handling**: Secure error responses

## 📊 **System Metrics**

### **Performance Targets**
- **Response Time**: < 100ms for API calls
- **Throughput**: 1000+ posts per minute
- **Batch Processing**: 30-second intervals
- **Database**: High-throughput Cassandra

### **Scalability Limits**
- **Horizontal Scaling**: Up to 5 replicas per node type
- **Batch Size**: Maximum 100 posts per batch
- **Sequential Codes**: 32-digit extensible format
- **Trinity Nodes**: 1 lead + 2 slaves

### **Reliability Metrics**
- **Uptime**: 99.9% target availability
- **Failover Time**: < 60 seconds
- **Data Durability**: 99.999% with Cassandra
- **Backup Strategy**: Real-time replication

This architecture provides a robust, scalable, and decentralized foundation for the Halo Indexer system, bridging LASKO Frontend with Telestai blockchain through efficient Layer 1.5 processing. 