import "dotenv/config";
import express from "express";
import mysql from "mysql2/promise";

const app = express();
const port = Number(process.env.API_PORT || 3001);

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "agenda_contatos",
  waitForConnections: true,
  connectionLimit: 10,
});

app.use(express.json());

function getPhoneDigits(phone) {
  return typeof phone === "string" ? phone.replace(/\D/g, "") : "";
}

function validateContact(body) {
  if (!body || typeof body !== "object") {
    return false;
  }

  const { name, surname, phone } = body;
  const digits = getPhoneDigits(phone);
  return (
    typeof name === "string" &&
    name.trim().length > 0 &&
    name.trim().length <= 100 &&
    typeof surname === "string" &&
    surname.trim().length > 0 &&
    surname.trim().length <= 100 &&
    (digits.length === 10 || digits.length === 11)
  );
}

function contactInput(body) {
  return {
    name: body.name.trim(),
    surname: body.surname.trim(),
    phone: getPhoneDigits(body.phone),
  };
}

async function getContacts(ids) {
  if (ids.length === 0) {
    return [];
  }

  const [rows] = await pool.query(
    `SELECT id, first_name AS name, last_name AS surname
     FROM contacts
     WHERE id IN (?)
     ORDER BY id`,
    [ids],
  );
  const [phoneRows] = await pool.query(
    `SELECT contact_id, phone
     FROM contact_phones
     WHERE contact_id IN (?)
     ORDER BY id`,
    [ids],
  );
  const phonesByContact = new Map(rows.map(({ id }) => [id, []]));

  phoneRows.forEach(({ contact_id, phone }) => {
    phonesByContact.get(contact_id)?.push(phone);
  });

  return rows.map((contact) => ({
    ...contact,
    phones: phonesByContact.get(contact.id),
  }));
}

async function getContactIdsByName(name) {
  const [rows] = await pool.query(
    `SELECT id
     FROM contacts
     WHERE LOWER(first_name) = LOWER(?)
     ORDER BY id`,
    [name],
  );
  return rows.map(({ id }) => id);
}

app.get("/api/contacts", async (_request, response) => {
  const [rows] = await pool.query("SELECT id FROM contacts ORDER BY id");
  response.json(await getContacts(rows.map(({ id }) => id)));
});

app.post("/api/contacts", async (request, response) => {
  if (!validateContact(request.body)) {
    return response.status(400).json({
      error: "Informe nome, sobrenome e telefone com DDD (10 ou 11 dígitos).",
    });
  }

  const contact = contactInput(request.body);

  if (request.body.allowDuplicate !== true) {
    const duplicateIds = await getContactIdsByName(contact.name);
    if (duplicateIds.length > 0) {
      return response.status(409).json({
        code: "DUPLICATE_NAME",
        error: "Já existe contato cadastrado com este nome.",
        contacts: await getContacts(duplicateIds),
      });
    }
  }

  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(
      "INSERT INTO contacts (first_name, last_name) VALUES (?, ?)",
      [contact.name, contact.surname],
    );
    await connection.execute(
      "INSERT INTO contact_phones (contact_id, phone) VALUES (?, ?)",
      [result.insertId, contact.phone],
    );
    await connection.commit();
    response.status(201).json((await getContacts([result.insertId]))[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

app.post("/api/contacts/:id/phones", async (request, response) => {
  const phone = getPhoneDigits(request.body?.phone);
  if (phone.length !== 10 && phone.length !== 11) {
    return response.status(400).json({
      error: "Informe um telefone com DDD e 10 ou 11 dígitos.",
    });
  }

  const [contacts] = await pool.execute(
    "SELECT id FROM contacts WHERE id = ?",
    [request.params.id],
  );
  if (contacts.length === 0) {
    return response.status(404).json({ error: "Contato não encontrado." });
  }

  await pool.execute(
    "INSERT INTO contact_phones (contact_id, phone) VALUES (?, ?)",
    [request.params.id, phone],
  );

  response.json((await getContacts([Number(request.params.id)]))[0]);
});

app.put("/api/contacts/:id", async (request, response) => {
  if (!validateContact(request.body)) {
    return response.status(400).json({
      error: "Informe nome, sobrenome e telefone com DDD (10 ou 11 dígitos).",
    });
  }

  const contact = contactInput(request.body);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [existingContacts] = await connection.execute(
      "SELECT id FROM contacts WHERE id = ?",
      [request.params.id],
    );
    if (existingContacts.length === 0) {
      await connection.rollback();
      return response.status(404).json({ error: "Contato não encontrado." });
    }

    await connection.execute(
      "UPDATE contacts SET first_name = ?, last_name = ? WHERE id = ?",
      [contact.name, contact.surname, request.params.id],
    );

    const [phones] = await connection.execute(
      "SELECT id FROM contact_phones WHERE contact_id = ? ORDER BY id LIMIT 1",
      [request.params.id],
    );
    if (phones.length > 0) {
      await connection.execute(
        "UPDATE contact_phones SET phone = ? WHERE id = ?",
        [contact.phone, phones[0].id],
      );
    } else {
      await connection.execute(
        "INSERT INTO contact_phones (contact_id, phone) VALUES (?, ?)",
        [request.params.id, contact.phone],
      );
    }
    await connection.commit();
    response.json((await getContacts([Number(request.params.id)]))[0]);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
});

app.delete("/api/contacts/:id", async (request, response) => {
  const [result] = await pool.execute(
    "DELETE FROM contacts WHERE id = ?",
    [request.params.id],
  );
  if (result.affectedRows === 0) {
    return response.status(404).json({ error: "Contato não encontrado." });
  }
  response.json({ deleted: true });
});

app.use((error, _request, response, _next) => {
  console.error("Erro na API:", error);
  response.status(500).json({
    error: "Erro interno do servidor. Verifique a conexão e a configuração do MySQL.",
  });
});

async function startServer() {
  await pool.query("SELECT 1");
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contacts (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      first_name VARCHAR(100) NOT NULL,
      last_name VARCHAR(100) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_contacts_first_name (first_name)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS contact_phones (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      contact_id INT UNSIGNED NOT NULL,
      phone VARCHAR(11) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_contact_phones_contact_id (contact_id),
      CONSTRAINT fk_contact_phones_contact
        FOREIGN KEY (contact_id) REFERENCES contacts(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  `);

  app.listen(port, () => {
    console.log(`API pronta em http://localhost:${port}`);
  });
}

startServer().catch((error) => {
  console.error("Não foi possível iniciar a API. Verifique o MySQL e o arquivo .env:", error);
  process.exitCode = 1;
});
