param (
    [string]$DockerHubUser = "meudockerhub"
)

Write-Host "Construindo imagens do projeto principal..."
cd ..\agro
docker build -t ${DockerHubUser}/agro-frontend:latest -f frontend/Dockerfile frontend
docker build -t ${DockerHubUser}/agro-backend:latest -f backend/Dockerfile backend

Write-Host "Enviando imagens para o Docker Hub..."
docker push ${DockerHubUser}/agro-frontend:latest
docker push ${DockerHubUser}/agro-backend:latest

Write-Host "Concluído! O arquivo docker-compose.yml em agro-release pode ser usado no Easypanel."
