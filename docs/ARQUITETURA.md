# Arquitetura Easy BI

## Visão geral

O Easy BI é dividido em três camadas:

```txt
frontend React + TypeScript
        |
backend NestJS + Prisma
        |
MySQL
```

## Multi-tenant

O isolamento é feito por `organization_id`. Toda consulta operacional precisa validar:

1. usuário autenticado;
2. organização ativa;
3. vínculo do usuário com a organização;
4. permissão necessária;
5. recurso pertencente à organização.

## Segurança

- JWT access token.
- Refresh token salvo com hash.
- Senha com bcrypt.
- Guards: JWT, Tenant e Permission.
- Prisma ORM contra SQL Injection.
- DTOs com validação.
- Logs de auditoria.

## Upload

A leitura de CSV/Excel acontece no backend. O motor de análise identifica tipos e semântica das colunas e salva metadados em `dataset_columns`.

## Persistência dos dados

A primeira versão salva linhas importadas em JSON na tabela `dataset_rows`. Isso facilita aceitar qualquer planilha. Para alto volume, evoluir para tabelas materializadas ou pré-agregações.
