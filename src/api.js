async function request(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || "Erro ao comunicar com o servidor.");
    error.code = data.code;
    error.contacts = data.contacts;
    throw error;
  }

  return data;
}

export function getContacts() {
  return request("/contacts");
}

export function createContact(contact, allowDuplicate = false) {
  return request("/contacts", {
    method: "POST",
    body: JSON.stringify({ ...contact, allowDuplicate }),
  });
}

export function updateContact(id, contact) {
  return request(`/contacts/${id}`, {
    method: "PUT",
    body: JSON.stringify(contact),
  });
}

export function addPhone(id, phone) {
  return request(`/contacts/${id}/phones`, {
    method: "POST",
    body: JSON.stringify({ phone }),
  });
}

export function deleteContact(id) {
  return request(`/contacts/${id}`, { method: "DELETE" });
}
