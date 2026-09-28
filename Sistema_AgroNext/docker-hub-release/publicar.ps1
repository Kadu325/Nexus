param (
    [Parameter(Mandatory=$true, HelpMessage="Seu usuário do Docker Hub (ex: seunome)")]
    [string]$DockerHubUser,
    
    [Parameter(Mandatory=$false, HelpMessage="A tag da versão (padrão: latest)")]
    [string]$Version = "latest"
)

$BackendImage = "$DockerHubUser/agronext-backend:$Version"
$FrontendImage = "$DockerHubUser/agronext-frontend:$Version"

Write-Host "===================================================" -ForegroundColor Cyan
Write-Host " Preparando publicação no Docker Hub" -ForegroundColor Cyan
Write-Host " Usuário: $DockerHubUser" -ForegroundColor Cyan
Write-Host " Versão: $Version" -ForegroundColor Cyan
Write-Host "===================================================" -ForegroundColor Cyan

# Autenticação (opcional, assume que o usuário já fez docker login)
Write-Host "`n[1/3] Verificando login no Docker Hub..." -ForegroundColor Yellow
$loginStatus = docker info | Select-String "Username:"
if (-not $loginStatus) {
    Write-Host "ATENÇÃO: Você não parece estar logado. Por favor, execute 'docker login' primeiro se o push falhar." -ForegroundColor Red
} else {
    Write-Host "Logado como: $($loginStatus.ToString().Trim())" -ForegroundColor Green
}

# Subir para o diretório raiz do projeto para fazer o build correto
Push-Location ../

Write-Host "`n[2/3] Construindo e publicando a imagem do BACKEND..." -ForegroundColor Yellow
docker build -t $BackendImage ./backend
if ($LASTEXITCODE -eq 0) {
    docker push $BackendImage
} else {
    Write-Host "Erro no build do backend!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Write-Host "`n[3/3] Construindo e publicando a imagem do FRONTEND..." -ForegroundColor Yellow
docker build -t $FrontendImage --build-arg API_INTERNAL_URL=http://backend:3001 ./frontend
if ($LASTEXITCODE -eq 0) {
    docker push $FrontendImage
} else {
    Write-Host "Erro no build do frontend!" -ForegroundColor Red
    Pop-Location
    exit 1
}

Pop-Location

Write-Host "`n===================================================" -ForegroundColor Cyan
Write-Host " ✅ Publicação concluída com sucesso!" -ForegroundColor Green
Write-Host " Imagem Backend: $BackendImage" -ForegroundColor Green
Write-Host " Imagem Frontend: $FrontendImage" -ForegroundColor Green
Write-Host "===================================================" -ForegroundColor Cyan
