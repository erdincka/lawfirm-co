# Production Deployment Guide

## Prerequisites

- Kubernetes cluster (GKE, EKS, AKS, or self-hosted)
- kubectl configured
- Docker registry access
- PostgreSQL database (managed or self-hosted)

## Step 1: Build and Push Images

### Build Production Images

```bash
# Backend
cd backend
docker build -f Dockerfile.prod -t erdincka/lawfirm-backend:v1.0.0 .
docker push erdincka/lawfirm-backend:v1.0.0

# Tag as latest
docker tag erdincka/lawfirm-backend:v1.0.0 erdincka/lawfirm-backend:latest
docker push erdincka/lawfirm-backend:latest

# Frontend
cd ../frontend
docker build -f Dockerfile.prod -t erdincka/lawfirm-frontend:v1.0.0 .
docker push erdincka/lawfirm-frontend:v1.0.0

# Tag as latest
docker tag erdincka/lawfirm-frontend:v1.0.0 erdincka/lawfirm-frontend:latest
docker push erdincka/lawfirm-frontend:latest
```

## Step 2: Configure Secrets

Create a Kubernetes secret for sensitive data:

```bash
kubectl create secret generic lawfirm-secrets \
  --from-literal=database-url='postgresql://user:password@host:5432/lawfirm' \
  --from-literal=llm-api-key='your-llm-api-key'
```

## Step 3: Update Kubernetes Manifests

Update image references in `kubernetes/` files:

```yaml
# In backend-deployment.yaml and frontend-deployment.yaml
image: erdincka/lawfirm-backend:v1.0.0
image: erdincka/lawfirm-frontend:v1.0.0
```

## Step 4: Deploy to Kubernetes

```bash
# Apply all manifests
kubectl apply -f kubernetes/

# Verify deployments
kubectl get pods
kubectl get services
```

## Step 5: Configure Ingress (Optional)

If using an ingress controller:

```yaml
apiVersion: networking.k8.io/v1
kind: Ingress
metadata:
  name: lawfirm-ingress
  annotations:
    cert-manager.io/cluster-issuer: "letsencrypt-prod"
spec:
  tls:
  - hosts:
    - lawfirm.yourdomain.com
    secretName: lawfirm-tls
  rules:
  - host: lawfirm.yourdomain.com
    http:
      paths:
      - path: /api
        pathType: Prefix
        backend:
          service:
            name: backend
            port:
              number: 8000
      - path: /
        pathType: Prefix
        backend:
          service:
            name: frontend
            port:
              number: 3000
```

## Step 6: Monitoring Setup

### Health Checks

The application includes health check endpoints:
- Backend: `/health`
- Frontend: `/api/health`

### Prometheus Metrics (Optional)

Add Prometheus annotations to deployments:

```yaml
metadata:
  annotations:
    prometheus.io/scrape: "true"
    prometheus.io/port: "8000"
    prometheus.io/path: "/metrics"
```

## Step 7: Scaling

### Horizontal Pod Autoscaler

```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 2
  maxReplicas: 10
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
```

## Step 8: Backup Strategy

### Database Backups

Set up automated PostgreSQL backups:

```bash
# Using pg_dump
kubectl exec -it <postgres-pod> -- pg_dump -U user lawfirm > backup.sql

# Restore
kubectl exec -i <postgres-pod> -- psql -U user lawfirm < backup.sql
```

## Step 9: Monitoring and Logging

### Recommended Tools

- **Monitoring**: Prometheus + Grafana
- **Logging**: ELK Stack or Loki
- **Tracing**: Jaeger or Zipkin
- **Alerting**: AlertManager

### Log Aggregation

```bash
# View logs
kubectl logs -f deployment/backend
kubectl logs -f deployment/frontend
```

## Security Checklist

- [ ] Use secrets for sensitive data
- [ ] Enable RBAC in Kubernetes
- [ ] Use network policies
- [ ] Enable TLS/SSL
- [ ] Regular security updates
- [ ] Implement rate limiting
- [ ] Use image scanning
- [ ] Enable audit logging

## Performance Optimization

### Backend
- Use connection pooling
- Enable caching (Redis)
- Optimize database queries
- Use CDN for static assets

### Frontend
- Enable Next.js image optimization
- Use CDN for assets
- Enable compression
- Implement service workers

## Troubleshooting

### Common Issues

**Pods not starting:**
```bash
kubectl describe pod <pod-name>
kubectl logs <pod-name>
```

**Database connection issues:**
```bash
kubectl exec -it <backend-pod> -- env | grep DATABASE
```

**Image pull errors:**
```bash
kubectl get events --sort-by='.lastTimestamp'
```

## Rollback Strategy

```bash
# Rollback to previous version
kubectl rollout undo deployment/backend
kubectl rollout undo deployment/frontend

# Check rollout status
kubectl rollout status deployment/backend
```

## Cost Optimization

- Implement pod disruption budgets
- Right-size resource requests/limits
- Use cluster autoscaler
- Implement resource quotas

## Maintenance

### Regular Tasks

- Weekly: Review logs and metrics
- Monthly: Update dependencies
- Quarterly: Security audit
- Annually: Disaster recovery drill

## Support

For production issues, contact: support@justitia.co.uk
