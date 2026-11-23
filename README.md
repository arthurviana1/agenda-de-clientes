# Agenda de Contatos

Projeto web para cadastrar e organizar contatos com nome, sobrenome e telefone.
Os dados são armazenados em um banco MySQL.

Ao cadastrar um contato, o sistema verifica se já existe outro com o mesmo nome,
sem considerar o sobrenome. Se encontrar, permite adicionar o telefone ao
contato existente ou criar um novo contato. Cada contato pode ter vários
telefones, exibidos em grupo.

A aplicação também permite buscar, editar e excluir contatos. A interface é
desenvolvida com React, Vite e Bootstrap, e a comunicação com o banco é feita
por uma API em Express.
