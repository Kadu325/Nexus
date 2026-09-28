# Guia de implantação — FPNexus etapa 1 em VPS Linux

Destino de referência: VPS Hostinger (KVM 1 para desenvolvimento de baixa carga, KVM 2 para piloto — hipóteses a
medir, ver `FPNexus_comparativo_hospedagem.md`). Os passos valem para qualquer VPS Ubuntu 24.04 com Docker.

Valores a substituir aparecem entre `< >`. Os comandos usam os arquivos reais deste repositório.

## 1. Contratação do plano e acesso administrativo

1. Contrate o plano escolhido com **Ubuntu 24.04 LTS** (sem painel pré-instalado). Confirme período, total cobrado,
   renovação e local do servidor antes de pagar.
2. No painel do provedor, cadastre sua chave SSH pública e anote o IP.
3. Primeiro acesso e usuário não-root:

```bash
ssh root@<IP>
adduser fpnexus && usermod -aG sudo fpnexus
mkdir -p /home/fpnexus/.ssh && cp ~/.ssh/authorized_keys /home/fpnexus/.ssh/ && chown -R fpnexus: /home/fpnexus/.ssh
# desative login por senha e de root
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp && ufw allow 443/udp && ufw --force enable
apt update && apt -y upgrade && apt -y install unattended-upgrades fail2ban
```

Resultado esperado: `ssh fpnexus@<IP>` funciona com a chave; `ufw status` mostra apenas 22, 80 e 443.

## 2. Docker

```bash
ssh fpnexus@<IP>
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker fpnexus && exit
ssh fpnexus@<IP>
docker version && docker compose version    # Compose deve ser v2.24 ou superior
```

Em planos com 4 GB de RAM (KVM 1), crie swap para a compilação das imagens:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

Alternativa recomendada no `sistema.md` para planos pequenos: compilar as imagens fora da VPS (CI ou máquina de
desenvolvimento), publicá-las num registro privado e trocar `build:` por `image:` no `docker-compose.yml`.

## 3. Domínio, DNS, proxy e HTTPS

1. No DNS do domínio, crie um registro **A** `<fpnexus.seudominio.com.br>` → `<IP>` (e AAAA se houver IPv6).
2. Aguarde a propagação: `dig +short <fpnexus.seudominio.com.br>` deve retornar o IP.
3. O proxy é o Caddy (serviço `proxy`), configurado em `infra/Caddyfile`. Ele obtém e renova o certificado
   automaticamente quando `SITE_ADDRESS` é o domínio (passo 5). Nada a instalar à parte.

## 4. PostgreSQL, filas e volumes persistentes

- O PostgreSQL 17 roda no serviço `db`, sem porta publicada (acesso só pela rede interna do Compose).
- Dados em volumes nomeados que sobrevivem a `docker compose down` e à atualização das imagens:
  `fpnexus_pgdata` (banco), `fpnexus_caddy_data` (certificados), `fpnexus_caddy_config`.
- **Nunca** use `docker compose down -v` em produção: `-v` apaga os volumes.
- Redis e workers não fazem parte da etapa 1 (nenhum módulo entregue usa processamento assíncrono). Quando forem
  necessários, entram como novos serviços no mesmo `docker-compose.yml`.

## 5. Variáveis de ambiente e segredos do backend

```bash
cd ~ && git clone <URL-do-repositório> fpnexus && cd fpnexus    # ou envie a pasta com scp/rsync
cp .env.example .env
nano .env
```

Preencha em `.env`:

| Variável | Valor em produção |
| --- | --- |
| `SITE_ADDRESS` | `<fpnexus.seudominio.com.br>` (sem `http://`) |
| `COOKIE_SECURE` | `true` |
| `POSTGRES_PASSWORD` | resultado de `openssl rand -hex 24` |
| `ORG_INITIAL_NAME` / `ORG_INITIAL_SLUG` | nome e identificador da organização inicial |
| `AI_API_KEY` / `AI_MODEL` | opcional; em branco, a IA generativa aparece como indisponível |

Arquivo reservado da conta administrativa (lido apenas pelo backend):

```bash
cp FPNexus_acesso_inicial.env.example FPNexus_acesso_inicial.env
nano FPNexus_acesso_inicial.env          # ADMIN_INITIAL_USERNAME=admin e ADMIN_INITIAL_PASSWORD=<senha definida>
chmod 600 .env FPNexus_acesso_inicial.env
```

Nenhum desses arquivos vai para o repositório (`.gitignore`).

## 6. Envio do projeto, dependências, build e migrações

```bash
cd ~/fpnexus
docker compose build            # instala dependências pelos lockfiles (npm ci) e compila backend e frontend
docker compose up -d db
docker compose up -d backend    # o entrypoint executa: prisma migrate deploy → provisionamento → API
docker compose logs -f backend  # aguarde "API FPNexus em http://0.0.0.0:3001/api"
```

As migrações ficam em `backend/prisma/migrations` e são aplicadas por `prisma migrate deploy` a cada inicialização
(sem efeito quando não há migração nova).

## 7. Provisionamento idempotente do admin

O provisionamento roda automaticamente na inicialização do backend (`node dist/provision.js`). Confira:

```bash
docker compose logs backend | grep provisionamento
# esperado na primeira vez:  [provisionamento] CRIADO: Conta "admin" criada como Administrador de "<organização>".
# nas seguintes:             [provisionamento] JA_PROVISIONADO: ... senha preservada ...
```

Depois de entrar e **alterar a senha** em *Minha conta*, retire o segredo de inicialização do servidor:

```bash
shred -u FPNexus_acesso_inicial.env
docker compose up -d backend
docker compose logs backend | grep provisionamento
# esperado: SEM_ALTERACAO: Administrador já existente; variáveis de provisionamento ausentes (esperado após a instalação).
```

A senha vigente não é redefinida por nenhuma dessas etapas.

## 8. Inicialização em produção, reinício automático e tarefas

```bash
docker compose up -d
docker compose ps       # db, backend e frontend "healthy"; proxy "running"
```

- Todos os serviços usam `restart: unless-stopped` e sobem sozinhos após reinício da VPS (o serviço Docker é
  habilitado pelo instalador: `systemctl is-enabled docker` → `enabled`).
- Backup diário às 02h com retenção de 14 dias (ver passo 11):

```bash
crontab -e
0 2 * * * cd /home/fpnexus/fpnexus && ./scripts/backup.sh 14 >> /home/fpnexus/backup.log 2>&1
```

## 9. Testes de login, permissões, isolamento e fluxos essenciais

1. `curl -s https://<domínio>/api/health` → `{"status":"ok","database":"ok",...}`
2. `curl -s -o /dev/null -w '%{http_code}\n' https://<domínio>/api/projects` → `401` (API sem sessão é rejeitada).
3. No navegador, `https://<domínio>` redireciona para `/login`; senha errada mostra “Usuário ou senha inválidos.”;
   a senha correta abre o painel; **Sair** encerra a sessão (voltar com o botão do navegador exige novo login).
4. Em *Usuários e organização*, crie um usuário com papel **Leitor** e confirme que ele não vê botões de edição e que
   a API recusa alterações (HTTP 403).
5. Testes automatizados de ponta a ponta contra um **banco de teste** (não use o de produção — o teste cria uma
   segunda organização):

```bash
docker compose -p fpnexus-teste --env-file .env.teste up -d --build   # instância separada, se desejar
cd backend && E2E_ADMIN_USER=admin E2E_ADMIN_PASSWORD=<senha> API_URL=http://localhost:3001/api DATABASE_URL=<url-do-banco-de-teste> npm run test:e2e
```

## 10. Logs, monitoramento e alertas

- Logs: `docker compose logs -f --since 1h backend` (API e auditoria de erros), `proxy` (acessos em JSON).
  Limite o crescimento dos logs do Docker em `/etc/docker/daemon.json`:

```json
{ "log-driver": "json-file", "log-opts": { "max-size": "20m", "max-file": "5" } }
```

  e `sudo systemctl restart docker`.
- Disponibilidade: cadastre `https://<domínio>/api/health` num monitor externo (ex.: Uptime Kuma, UptimeRobot,
  Better Stack) com alerta por e-mail ou Telegram.
- Recursos: `docker stats` e `df -h`. Alerta sugerido: disco acima de 80% e memória acima de 85% por 10 minutos.
- A trilha de auditoria funcional fica em *Administração → Trilha de auditoria*.

## 11. Backups e teste de restauração

```bash
./scripts/backup.sh 14                           # cria backups/fpnexus-AAAAMMDD-HHMMSS.dump + .sha256
./scripts/restore-test.sh backups/<arquivo>.dump # restaura num banco temporário, compara contagens e o remove
```

- Copie `backups/` para fora da VPS (requisito do `sistema.md`). Exemplo com rclone para um bucket S3 compatível:
  `rclone copy backups remoto:fpnexus-backups --max-age 48h` no mesmo cron, após o backup.
- Faça o `restore-test.sh` pelo menos uma vez por mês e registre o resultado: backup só é válido depois de restaurado.
- Restauração real em produção (substitui os dados, com backup de segurança antes):
  `./scripts/restore.sh backups/<arquivo>.dump`

## 12. Atualização, migração de dados e reversão

```bash
cd ~/fpnexus
./scripts/backup.sh                                  # 1. backup antes de qualquer atualização
git fetch && git log --oneline HEAD..origin/main     # 2. revise o que muda (especialmente prisma/migrations)
docker image tag fpnexus-backend:latest fpnexus-backend:anterior
docker image tag fpnexus-frontend:latest fpnexus-frontend:anterior
git pull
docker compose build                                 # 3. compila a nova versão sem derrubar a atual
docker compose up -d                                 # 4. recria backend (aplica migrações) e frontend
docker compose ps && curl -s https://<domínio>/api/health
```

Reversão se a nova versão falhar:

```bash
git checkout <commit-anterior>
docker image tag fpnexus-backend:anterior fpnexus-backend:latest
docker image tag fpnexus-frontend:anterior fpnexus-frontend:latest
# se a atualização aplicou migração incompatível com a versão anterior, restaure o backup do passo 1:
./scripts/restore.sh backups/<backup-do-passo-1>.dump
docker compose up -d --no-build
```

Regra para quem desenvolve: migrações devem ser aditivas sempre que possível (novas colunas opcionais, novas tabelas),
para que a versão anterior continue funcionando sobre o banco migrado e a reversão não exija restauração.
