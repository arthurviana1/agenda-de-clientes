# Agenda de Contatos

Aplicação React com Vite, Bootstrap, API Express e persistência em MySQL.

## Requisitos

- Node.js
- MySQL em execução

## Configuração

1. Crie o banco de dados no MySQL:

   ```sql
   CREATE DATABASE agenda_contatos
     CHARACTER SET utf8mb4
     COLLATE utf8mb4_unicode_ci;
   ```

2. Copie `.env.example` para `.env` e ajuste as credenciais do MySQL.
3. Instale as dependências:

   ```bash
   npm install
   ```

4. Em um terminal, inicie a API:

   ```bash
   npm run server
   ```

5. Em outro terminal, inicie o React com Vite:

   ```bash
   npm run dev
   ```

As tabelas `contacts` e `contact_phones` são criadas automaticamente pela API.
O campo usado para detectar duplicidade é o nome; sobrenome não participa da
comparação. Ao confirmar um contato existente, o telefone é associado a ele.
Ao escolher criar outro contato, o cadastro duplicado é mantido como um novo
registro.
