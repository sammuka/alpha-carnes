# Rollback de Migrations — F1

## Migration inicial (0000_initial_auth_rbac)

Esta é a primeira migration do sistema. Não há down script — o rollback é feito
recriando o banco do zero:

```bash
docker compose down -v   # remove o volume do postgres
docker compose up --build # sobe tudo do zero (migrate + seed no entrypoint)
```

A partir de F2+, migrations que alterem schema existente incluirão down scripts
explícitos por arquivo de migration.
