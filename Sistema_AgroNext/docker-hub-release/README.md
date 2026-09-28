# Publicando no Docker Hub

Esta pasta contém o necessário para publicar as imagens da sua aplicação de forma independente no seu Docker Hub. Ao invés de misturar os arquivos no projeto original, separamos as instruções aqui.

## 1. Fazendo Login no Docker

No seu terminal, faça o login usando a sua conta do Docker Hub:
```ps1
docker login
```
*(Ele pedirá seu usuário e senha).*

## 2. Compilando e Enviando as imagens (Push)

Nós preparamos o script `publicar.ps1`. Execute-o informando o seu usuário do Docker Hub:

```ps1
cd docker-hub-release
.\publicar.ps1 -DockerHubUser "SEU_USUARIO_AQUI"
```

O script fará o build da imagem do backend, depois da imagem do frontend e, por fim, vai realizar o upload das duas imagens para o Docker Hub:
- `SEU_USUARIO_AQUI/agronext-backend:latest`
- `SEU_USUARIO_AQUI/agronext-frontend:latest`

## 3. Rodando em Servidores / Produção

O arquivo `docker-compose.yml` desta pasta está configurado para baixar as imagens do Docker Hub (ele não precisa mais do código-fonte `src/`). 

Para usá-lo em produção:
1. Edite o `docker-compose.yml` e substitua `<SEU_USUARIO_DOCKERHUB>` pelo seu usuário do Docker Hub.
2. Copie este `docker-compose.yml` para a sua VPS (ou Easypanel).
3. Execute `docker-compose up -d`.

Pronto! Sua aplicação irá iniciar baixando diretamente da internet, sem depender do seu código-fonte local.
