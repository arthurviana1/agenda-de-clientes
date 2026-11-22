import React, { useEffect, useMemo, useState } from "react";
import {
  addPhone,
  createContact,
  deleteContact,
  getContacts,
  updateContact,
} from "./api.js";

const emptyContact = { name: "", surname: "", phone: "" };

function formatPhone(value) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 2) {
    return digits ? `(${digits}` : "";
  }

  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}${
      digits.length > 6 ? `-${digits.slice(6)}` : ""
    }`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function phoneDigits(phone) {
  return phone.replace(/\D/g, "");
}

export default function App() {
  const [contacts, setContacts] = useState([]);
  const [form, setForm] = useState(emptyContact);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [duplicates, setDuplicates] = useState([]);
  const [pendingContact, setPendingContact] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    getContacts()
      .then(setContacts)
      .catch((loadError) => {
        console.error("Erro ao carregar contatos:", loadError);
        setError("Não foi possível carregar os contatos do banco de dados.");
      })
      .finally(() => setLoading(false));
  }, []);

  const filteredContacts = useMemo(() => {
    const query = search.trim().toLocaleLowerCase();
    const digits = phoneDigits(query);

    return contacts.filter(
      (contact) =>
        `${contact.name} ${contact.surname}`.toLocaleLowerCase().includes(query) ||
        contact.phones.some(
          (phone) =>
            phone.includes(query) || (digits && phone.includes(digits)),
        ),
    );
  }, [contacts, search]);

  function updateField(event) {
    const { name, value } = event.target;
    setForm((currentForm) => ({
      ...currentForm,
      [name]: name === "phone" ? formatPhone(value) : value,
    }));
    setError("");
  }

  function resetForm() {
    setForm(emptyContact);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError("");

    if (phoneDigits(form.phone).length !== 10 && phoneDigits(form.phone).length !== 11) {
      setError("Informe um telefone com DDD e 10 ou 11 dígitos.");
      return;
    }

    setSaving(true);
    try {
      if (editingId !== null) {
        const updatedContact = await updateContact(editingId, form);
        setContacts((currentContacts) =>
          currentContacts.map((contact) =>
            contact.id === editingId ? updatedContact : contact,
          ),
        );
        resetForm();
      } else {
        const contact = await createContact(form);
        if (contact.duplicate) {
          setDuplicates(contact.contacts);
          setPendingContact(form);
        } else {
          setContacts((currentContacts) => [...currentContacts, contact]);
          resetForm();
        }
      }
    } catch (submitError) {
      if (submitError.code === "DUPLICATE_NAME") {
        setDuplicates(submitError.contacts);
        setPendingContact(form);
      } else {
        console.error("Erro ao salvar contato:", submitError);
        setError(submitError.message);
      }
    } finally {
      setSaving(false);
    }
  }

  async function confirmDuplicate(contactId) {
    setSaving(true);
    setError("");
    try {
      const updatedContact = await addPhone(contactId, pendingContact.phone);
      setContacts((currentContacts) =>
        currentContacts.map((contact) =>
          contact.id === updatedContact.id ? updatedContact : contact,
        ),
      );
      setPendingContact(null);
      setDuplicates([]);
      resetForm();
    } catch (phoneError) {
      console.error("Erro ao adicionar telefone:", phoneError);
      setError(phoneError.message);
    } finally {
      setSaving(false);
    }
  }

  async function createAnotherContact() {
    setSaving(true);
    setError("");
    try {
      const contact = await createContact(pendingContact, true);
      setContacts((currentContacts) => [...currentContacts, contact]);
      setPendingContact(null);
      setDuplicates([]);
      resetForm();
    } catch (createError) {
      console.error("Erro ao criar contato:", createError);
      setError(createError.message);
    } finally {
      setSaving(false);
    }
  }

  function editContact(contact) {
    setForm({
      name: contact.name,
      surname: contact.surname,
      phone: formatPhone(contact.phones[0] ?? ""),
    });
    setEditingId(contact.id);
    setError("");
  }

  async function removeContact(id) {
    setError("");
    try {
      await deleteContact(id);
      setContacts((currentContacts) =>
        currentContacts.filter((contact) => contact.id !== id),
      );
      if (editingId === id) {
        resetForm();
      }
    } catch (deleteError) {
      console.error("Erro ao excluir contato:", deleteError);
      setError(deleteError.message);
    }
  }

  async function exportToExcel() {
    try {
      const { default: ExcelJS } = await import("exceljs");
      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Contatos");
      worksheet.addRow(["Nome", "Sobrenome", "Telefones"]);
      contacts.forEach(({ name, surname, phones }) => {
        worksheet.addRow([name, surname, phones.map(formatPhone).join(", ")]);
      });

      const file = new Blob([await workbook.xlsx.writeBuffer()], {
        type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = "agenda_contatos.xlsx";
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 0);
    } catch (exportError) {
      console.error("Erro ao exportar contatos:", exportError);
      setError("Não foi possível exportar os contatos. Tente novamente.");
    }
  }

  return (
    <main className="min-vh-100 bg-dark text-light py-5">
      <div className="container">
        <div className="mx-auto" style={{ maxWidth: "900px" }}>
          <section className="card bg-dark border-secondary shadow">
            <div className="card-body p-4">
              <h1 className="h2 text-center mb-4">Agenda de Contatos</h1>

              {error && (
                <div className="alert alert-danger" role="alert">
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="row g-3 mb-4">
                <div className="col-12 col-md-6">
                  <label htmlFor="name" className="form-label">
                    Nome
                  </label>
                  <input
                    id="name"
                    name="name"
                    className="form-control bg-dark text-light border-secondary"
                    placeholder="Nome"
                    value={form.name}
                    onChange={updateField}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="col-12 col-md-6">
                  <label htmlFor="surname" className="form-label">
                    Sobrenome
                  </label>
                  <input
                    id="surname"
                    name="surname"
                    className="form-control bg-dark text-light border-secondary"
                    placeholder="Sobrenome"
                    value={form.surname}
                    onChange={updateField}
                    maxLength={100}
                    required
                  />
                </div>
                <div className="col-12">
                  <label htmlFor="phone" className="form-label">
                    Telefone
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    className="form-control bg-dark text-light border-secondary"
                    placeholder="(00) 00000-0000"
                    value={form.phone}
                    onChange={updateField}
                    maxLength={15}
                    required
                  />
                </div>
                <div className="col-12 d-flex gap-2">
                  <button
                    type="submit"
                    className="btn btn-primary flex-grow-1"
                    disabled={saving || loading}
                  >
                    {saving
                      ? "Salvando..."
                      : editingId === null
                        ? "Cadastrar contato"
                        : "Salvar edição"}
                  </button>
                  {editingId !== null && (
                    <button
                      type="button"
                      className="btn btn-outline-light"
                      onClick={resetForm}
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </form>

              <div className="mb-3">
                <label htmlFor="search" className="form-label">
                  Buscar contato
                </label>
                <input
                  id="search"
                  type="search"
                  className="form-control bg-dark text-light border-secondary"
                  placeholder="Buscar por nome, sobrenome ou telefone..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <div className="table-responsive">
                <table className="table table-dark table-striped table-hover align-middle mb-0">
                  <thead>
                    <tr>
                      <th scope="col">Nome</th>
                      <th scope="col">Sobrenome</th>
                      <th scope="col">Telefones</th>
                      <th scope="col" className="text-end">
                        Ações
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr>
                        <td colSpan="4" className="text-center py-4">
                          Carregando contatos...
                        </td>
                      </tr>
                    ) : filteredContacts.length === 0 ? (
                      <tr>
                        <td colSpan="4" className="text-center text-secondary py-4">
                          Nenhum contato encontrado.
                        </td>
                      </tr>
                    ) : (
                      filteredContacts.map((contact) => (
                        <tr key={contact.id}>
                          <td>{contact.name}</td>
                          <td>{contact.surname}</td>
                          <td>
                            {contact.phones.map(formatPhone).map((phone) => (
                              <div key={`${contact.id}-${phone}`}>{phone}</div>
                            ))}
                          </td>
                          <td className="text-end text-nowrap">
                            <button
                              type="button"
                              className="btn btn-warning btn-sm me-2"
                              onClick={() => editContact(contact)}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              className="btn btn-danger btn-sm"
                              onClick={() => removeContact(contact.id)}
                            >
                              Deletar
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <button
                type="button"
                className="btn btn-success w-100 mt-4"
                onClick={exportToExcel}
                disabled={loading}
              >
                Exportar para o Excel
              </button>
            </div>
          </section>
        </div>
      </div>

      {pendingContact && (
        <>
          <div className="modal-backdrop show" />
          <div
            className="modal d-block"
            role="dialog"
            aria-modal="true"
            aria-labelledby="duplicate-title"
          >
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content bg-dark text-light border-secondary">
                <div className="modal-header border-secondary">
                  <h2 className="modal-title fs-5" id="duplicate-title">
                    Nome já cadastrado
                  </h2>
                </div>
                <div className="modal-body">
                  <p>
                    Já existe contato com o nome{" "}
                    <strong>{pendingContact.name}</strong>. Deseja adicionar este
                    telefone a um contato existente?
                  </p>
                  {error && (
                    <div className="alert alert-danger" role="alert">
                      {error}
                    </div>
                  )}
                  {duplicates.map((contact) => (
                    <button
                      key={contact.id}
                      type="button"
                      className="btn btn-outline-light w-100 text-start mb-2"
                      onClick={() => confirmDuplicate(contact.id)}
                      disabled={saving}
                    >
                      Adicionar a {contact.name} {contact.surname}
                      <span className="d-block small text-secondary">
                        {contact.phones.map(formatPhone).join(", ")}
                      </span>
                    </button>
                  ))}
                </div>
                <div className="modal-footer border-secondary">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={createAnotherContact}
                    disabled={saving}
                  >
                    Não, criar outro contato
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
