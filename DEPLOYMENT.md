# 🚀 Gryt Deployment Guide

This guide covers all deployment options for the Gryt voice chat platform, from local development to production Kubernetes clusters.

## 📋 Prerequisites

### Required Software
- **Docker** 20.10+ and **Docker Compose** 2.0+
- **Kubernetes** 1.24+ (for K8s deployment)
- **kubectl** configured with cluster access
- **Bun** or **Node.js** 18+ (for local development)
- **Go** 1.21+ (for SFU development)

### Required Infrastructure
- **Domain with SSL/TLS** (production)
- **STUN/TURN Server** (recommended: [coturn](https://github.com/coturn/coturn))
- **Container Registry** (for Kubernetes deployment)

## 🐳 Docker Deployment

### Quick Start with Docker Compose

1. **Clone and navigate to the repository**
   ```bash
   git clone <repository-url>
   cd webrtc
   ```

2. **Start all services**
   ```bash
   # Development environment
   docker-compose up -d
   
   # Production environment
   docker-compose -f docker-compose.prod.yml up -d
   ```

3. **Access the application**
   - Web Client: http://localhost:5173
   - Server 1: http://localhost:5000
   - Server 2: http://localhost:5001
   - SFU: http://localhost:5005

### Building Custom Images

```bash
# Make the build script executable
chmod +x scripts/build-images.sh

# Build all images
./scripts/build-images.sh

# Build with custom tag
TAG=v1.0.0 ./scripts/build-images.sh

# Build and push to registry
REGISTRY=myregistry.com/gryt PUSH=true ./scripts/build-images.sh
```

### Individual Service Deployment

```bash
# SFU Server
docker build -f Dockerfile.sfu -t gryt/sfu:latest .
docker run -p 5005:5005 --env-file sfu-v2/.env gryt/sfu:latest

# Signaling Server
docker build -f Dockerfile.server -t gryt/server:latest .
docker run -p 5000:5000 --env-file server/.env gryt/server:latest

# Web Client
docker build -f Dockerfile.client -t gryt/client:latest .
docker run -p 80:80 gryt/client:latest
```

## 🚀 Kubernetes Deployment

### Prerequisites

- Kubernetes cluster (1.24+)
- Helm 3.8+
- NGINX Ingress Controller
- cert-manager (optional, for automatic SSL certificates)

### Quick Start with Helm

1. **Install with default values**
   ```bash
   # Install from local chart
   helm install my-gryt ./helm/gryt
   
   # Or install from repository (if published)
   helm repo add gryt https://charts.gryt.chat
   helm install my-gryt gryt/gryt
   ```

2. **Verify deployment**
   ```bash
   # Check pod status
   kubectl get pods -l app.kubernetes.io/name=gryt
   
   # Check services
   kubectl get services -l app.kubernetes.io/name=gryt
   
   # Check ingress
   kubectl get ingress
   ```

### Production Deployment

1. **Create custom values file**
   ```bash
   # Copy production example
   cp helm/gryt/examples/production-values.yaml my-production-values.yaml
   ```

2. **Edit configuration**
   ```yaml
   # my-production-values.yaml
   gryt:
     domain: "gryt.mycompany.com"
     
   server:
     secrets:
       serverPassword: "super-secure-production-password"
       corsOrigin: "https://gryt.mycompany.com"
   ```

3. **Deploy with custom values**
   ```bash
   helm install my-gryt ./helm/gryt -f my-production-values.yaml
   ```

### Development Deployment

```bash
# Use development example with minimal resources
helm install my-gryt ./helm/gryt -f helm/gryt/examples/development-values.yaml
```

### Helm Management

```bash
# Upgrade deployment
helm upgrade my-gryt ./helm/gryt -f my-production-values.yaml

# Check status
helm status my-gryt

# View values
helm get values my-gryt

# Uninstall
helm uninstall my-gryt
```

### Advanced Configuration

#### Custom Image Registry
```yaml
# values.yaml
global:
  imageRegistry: "myregistry.com"

sfu:
  image:
    repository: gryt/sfu
    tag: "v1.0.0"
```

#### Subdomain vs Path-based Routing
```yaml
# Subdomain routing (recommended)
ingress:
  routing:
    useSubdomains: true
    subdomains:
      client: "gryt"      # gryt.yourdomain.com
      api: "api"          # api.yourdomain.com

# Path-based routing
ingress:
  routing:
    useSubdomains: false
    paths:
      client: "/"
      api: "/api"
      sfu: "/sfu"
```

## 🔧 Configuration

### Environment Variables

#### SFU Server
```env
PORT=5005
STUN_SERVERS=stun:stun.l.google.com:19302,stun:stun1.l.google.com:19302
```

#### Signaling Server
```env
PORT=5000
SERVER_NAME="My Gryt Server"
SERVER_ICON="example.png"
SFU_WS_HOST="ws://gryt-sfu:5005"
STUN_SERVERS="stun:stun.l.google.com:19302"
CORS_ORIGIN="https://yourdomain.com"
SERVER_PASSWORD="your-secure-password"
GRYT_AUTH_API="https://auth.gryt.chat"
NODE_ENV=production
```

#### Web Client
```env

```

### SSL/TLS Configuration

#### Docker Compose
```yaml
# Mount SSL certificates
volumes:
  - ./ssl:/etc/nginx/ssl:ro
  - ./nginx.prod.conf:/etc/nginx/nginx.conf:ro
```

#### Kubernetes
```yaml
# Use cert-manager for automatic certificates
metadata:
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - gryt.yourdomain.com
    secretName: gryt-tls
```

## 🔍 Monitoring and Troubleshooting

### Health Checks

All services expose health check endpoints:
- **SFU**: `GET /health` on port 5005
- **Server**: `GET /health` on port 5000
- **Client**: `GET /health` on port 80

### Logging

#### Docker Compose
```bash
# View logs for all services
docker-compose logs -f

# View logs for specific service
docker-compose logs -f server
```

#### Kubernetes
```bash
# View pod logs (replace 'my-gryt' with your release name)
kubectl logs -f deployment/my-gryt-server

# View logs from all Gryt pods
kubectl logs -f -l app.kubernetes.io/name=gryt

# View logs for specific component
kubectl logs -f -l app.kubernetes.io/component=server
kubectl logs -f -l app.kubernetes.io/component=sfu
kubectl logs -f -l app.kubernetes.io/component=client
```

### Common Issues

#### WebSocket Connection Failures
```bash
# Check ingress configuration
kubectl describe ingress my-gryt-ingress

# Verify WebSocket annotations
kubectl get ingress my-gryt-ingress -o yaml | grep websocket

# Check Helm values
helm get values my-gryt
```

#### Audio Not Working
```bash
# Check STUN server configuration
kubectl get configmap my-gryt-config -o yaml

# Verify SFU connectivity
kubectl port-forward service/my-gryt-sfu 5005:5005

# Check SFU logs
kubectl logs -f -l app.kubernetes.io/component=sfu
```

#### High Resource Usage
```bash
# Check HPA status
kubectl get hpa

# View resource usage
kubectl top pods -l app.kubernetes.io/name=gryt

# Check Helm deployment status
helm status my-gryt
```

#### Configuration Issues
```bash
# Validate Helm chart
helm lint ./helm/gryt

# Test template rendering
helm template my-gryt ./helm/gryt -f my-values.yaml

# Check current values
helm get values my-gryt
```

## 📊 Scaling

### Horizontal Pod Autoscaling

The Helm chart includes HPA for automatic scaling when enabled:

```yaml
# values.yaml - Server autoscaling
server:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 10
    targetCPUUtilizationPercentage: 70
    targetMemoryUtilizationPercentage: 80

# Client autoscaling
client:
  autoscaling:
    enabled: true
    minReplicas: 2
    maxReplicas: 5
    targetCPUUtilizationPercentage: 70
```

### Manual Scaling

#### Using Helm Values
```bash
# Scale by updating values and upgrading
helm upgrade my-gryt ./helm/gryt --set server.replicaCount=5
helm upgrade my-gryt ./helm/gryt --set client.replicaCount=3

# Or update your values file and upgrade
helm upgrade my-gryt ./helm/gryt -f my-values.yaml
```

#### Using kubectl (temporary scaling)
```bash
# Scale server replicas
kubectl scale deployment my-gryt-server --replicas=5

# Scale client replicas
kubectl scale deployment my-gryt-client --replicas=3

# Note: These changes will be reverted on next Helm upgrade
```

### Monitoring Scaling
```bash
# Check HPA status
kubectl get hpa

# Watch scaling events
kubectl get events --sort-by=.metadata.creationTimestamp

# Monitor resource usage
kubectl top pods -l app.kubernetes.io/name=gryt
```

## 🔒 Security Considerations

### Container Security
- All containers run as non-root users
- Read-only root filesystems where possible
- Minimal base images (Alpine Linux)
- Security contexts with dropped capabilities

### Network Security
- TLS termination at ingress
- Internal service communication over cluster network
- CORS configuration for WebRTC
- Rate limiting on ingress

### Secrets Management
```bash
# Create secrets from files
kubectl create secret generic gryt-secrets \
  --from-file=server-password=./server-password.txt \
  --from-file=cors-origin=./cors-origin.txt \
  -n gryt

# Use external secret management
# - HashiCorp Vault
# - AWS Secrets Manager
# - Azure Key Vault
```

## 🚀 Production Checklist

### Before Deployment
- [ ] SSL certificates configured
- [ ] STUN/TURN servers set up
- [ ] Container images built and pushed
- [ ] Environment variables configured
- [ ] Secrets properly managed
- [ ] Domain DNS configured

### After Deployment
- [ ] Health checks passing
- [ ] WebSocket connections working
- [ ] Audio quality tested
- [ ] Monitoring configured
- [ ] Backup strategy implemented
- [ ] Scaling policies tested

### Monitoring Setup
```bash
# Install Prometheus and Grafana (example with Helm)
helm repo add prometheus-community https://prometheus-community.github.io/helm-charts
helm install prometheus prometheus-community/kube-prometheus-stack -n monitoring --create-namespace

# Configure ServiceMonitor for Gryt metrics
kubectl apply -f monitoring/servicemonitor.yaml
```

## 📚 Additional Resources

- [Docker Documentation](https://docs.docker.com/)
- [Kubernetes Documentation](https://kubernetes.io/docs/)
- [NGINX Ingress Controller](https://kubernetes.github.io/ingress-nginx/)
- [cert-manager Documentation](https://cert-manager.io/docs/)
- [Coturn STUN/TURN Server](https://github.com/coturn/coturn)

## 🆘 Support

For deployment issues:
1. Check the [troubleshooting section](#monitoring-and-troubleshooting)
2. Review service logs
3. Verify configuration
4. Open an issue with deployment details

---

**Happy deploying! 🎉**