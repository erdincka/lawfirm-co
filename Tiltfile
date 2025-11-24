# Tiltfile

# Define the image for the backend
docker_build('erdincka/lawfirm-backend',
    context='./backend',
    dockerfile='./backend/Dockerfile',
    live_update=[
        # If requirements change, we need a full rebuild
        fall_back_on(['./backend/requirements.txt']),
        # Sync the application code
        sync('./backend/app', '/app/app'),
    ]
)

# Define the image for the frontend
docker_build('erdincka/lawfirm-frontend',
    context='./frontend',
    dockerfile='./frontend/Dockerfile',
    live_update=[
        # If package files change, we need a full rebuild
        fall_back_on(['./frontend/package.json', './frontend/package-lock.json']),
        # Sync the source code
        sync('./frontend/src', '/app/src'),
        sync('./frontend/public', '/app/public'),
        sync('./frontend/next.config.ts', '/app/next.config.ts'),
    ]
)

# Load Kubernetes manifests
k8s_yaml([
    # 'kubernetes/db-init-configmap.yaml',
    'kubernetes/db.yaml',
    'kubernetes/backend.yaml',
    'kubernetes/frontend.yaml'
])

# Configure port forwards and resources
k8s_resource('frontend',
    port_forwards='3000:3000',
    labels=['ui']
)

k8s_resource('backend',
    port_forwards='8000:8000',
    labels=['api']
)

k8s_resource('db',
    port_forwards='5432:5432',
    labels=['database']
)
