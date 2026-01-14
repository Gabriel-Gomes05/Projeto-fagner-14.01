/**
 * SISTEMA BARBEARIA DO FAGNER PRO
 */

// --- CONFIGURAÇÕES ---
const CONFIG = { horaInicio: 8, horaFechamento: 19, almocoInicio: 12, almocoFim: 13, intervaloMinutos: 30 };
const SERVICOS = { "corte": 35, "barba": 20, "sobrancelha": 7, "acabamento": 15, "luzes": 50, "alisamento": 20, "nevou": 150 };
const PRODUTOS = { "nenhum": 0, "gel": 15, "pomada": 20 };
const ADMIN_EMAIL = "fagner@admin.com";
const ADMIN_SENHA = "123";

// --- ESTADO DA APLICAÇÃO ---
let usuarios = JSON.parse(localStorage.getItem('barbearia_users')) || [];
let atendimentos = JSON.parse(localStorage.getItem('barbearia_fagner_dados')) || [];
let barbeiros = JSON.parse(localStorage.getItem('barbearia_barbeiros')) || [];
let usuarioLogado = null;

// --- INICIALIZAÇÃO ---
window.onload = function() {
    gerarListaServicos();
    popularSelect('produto', PRODUTOS);
    gerarHorarios();
    verificarSessao();
    renderizarBarbeiros();
    popularBarbeirosAgendamento();
    atualizarDashboard();
    
    if(document.getElementById('data-agendamento')) {
        document.getElementById('data-agendamento').setAttribute('min', new Date().toISOString().split('T')[0]);
    }
};

// --- UTILITÁRIOS: UI ---

function showToast(mensagem, tipo = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    const icon = tipo === 'success' ? 'fa-check-circle' : 'fa-exclamation-triangle';
    toast.className = `toast ${tipo === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${mensagem}</span>`;
    container.appendChild(toast);
    setTimeout(() => {
        toast.style.animation = "slideIn 0.3s ease-in reverse forwards";
        setTimeout(() => toast.remove(), 300);
    }, 3500);
}

function popularBarbeirosAgendamento() {
    const select = document.getElementById('escolha-barbeiro');
    if(!select) return;
    const options = barbeiros.map(b => `<option value="${b.nome}">${b.nome}</option>`).join('');
    select.innerHTML = '<option value="">Selecione um profissional</option>' + options;
}

function atualizarDashboard() {
    if (usuarioLogado?.role !== 'admin') return;
    const hoje = new Date().toISOString().split('T')[0];
    const totalHoje = atendimentos.filter(a => a.data === hoje).length;
    const totalClientes = usuarios.filter(u => u.role === 'cliente').length;
    
    if(document.getElementById('stat-count-hoje')) document.getElementById('stat-count-hoje').innerText = totalHoje;
    if(document.getElementById('stat-total-clientes')) document.getElementById('stat-total-clientes').innerText = totalClientes;
}

// --- AUTENTICAÇÃO ---

function toggleAuth() {
    document.getElementById('login-box').classList.toggle('hidden');
    document.getElementById('register-box').classList.toggle('hidden');
}

function registrar() {
    const email = document.getElementById('reg-email').value.toLowerCase().trim();
    if(usuarios.find(u => u.email === email)) return showToast("E-mail já cadastrado!", "error");

    const novoUser = {
        nome: document.getElementById('reg-nome').value,
        tel: document.getElementById('reg-tel').value,
        email: email,
        senha: document.getElementById('reg-senha').value,
        role: 'cliente'
    };

    if(!novoUser.nome || !novoUser.email) return showToast("Preencha os campos obrigatórios!", "error");

    usuarios.push(novoUser);
    localStorage.setItem('barbearia_users', JSON.stringify(usuarios));
    showToast("Conta criada com sucesso!");
    toggleAuth();
}

function login() {
    const email = document.getElementById('login-email').value.toLowerCase().trim();
    const senha = document.getElementById('login-senha').value.trim();

    if (email === ADMIN_EMAIL && senha === ADMIN_SENHA) {
        usuarioLogado = { nome: "Fagner (Admin)", role: "admin" };
    } else {
        const user = usuarios.find(u => u.email === email && u.senha === senha);
        if (user) usuarioLogado = user;
        else return showToast("Credenciais inválidas!", "error");
    }
    sessionStorage.setItem('sessao_user', JSON.stringify(usuarioLogado));
    verificarSessao();
    showToast(`Bem-vindo, ${usuarioLogado.nome}!`);
}

function verificarSessao() {
    const sessao = sessionStorage.getItem('sessao_user');
    if (sessao) {
        usuarioLogado = JSON.parse(sessao);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        document.getElementById('nav-sistema').classList.remove('hidden');
        document.getElementById('user-nome').innerText = usuarioLogado.nome;
        
        const isAdmin = usuarioLogado.role === 'admin';
        document.getElementById('section-caixa').classList.toggle('hidden', !isAdmin);
        document.getElementById('section-agendamento').classList.toggle('hidden', isAdmin);
        document.getElementById('section-meus-agendamentos').classList.toggle('hidden', isAdmin);
        document.getElementById('btn-config-nav').classList.toggle('hidden', isAdmin);
        
        renderizarLista();
        atualizarDashboard();
    }
}

function logout() { sessionStorage.removeItem('sessao_user'); location.reload(); }

// --- PAINEL ADMIN ---

function switchAdminTab(tab) {
    ['caixa', 'clientes', 'barbeiros'].forEach(v => {
        document.getElementById(`admin-view-${v}`).classList.add('hidden');
        document.getElementById(`tab-${v}`).classList.remove('active');
    });
    document.getElementById(`admin-view-${tab}`).classList.remove('hidden');
    document.getElementById(`tab-${tab}`).classList.add('active');
}

function adminCadastrarBarbeiro() {
    const nome = document.getElementById('adm-b-nome').value;
    const esp = document.getElementById('adm-b-especialidade').value;
    if(!nome) return showToast("Nome necessário!", "error");

    barbeiros.push({ id: Date.now(), nome, especialidade: esp });
    localStorage.setItem('barbearia_barbeiros', JSON.stringify(barbeiros));
    renderizarBarbeiros();
    popularBarbeirosAgendamento();
    showToast("Barbeiro adicionado!");
}

function filtrarListaAdmin() {
    const termo = document.getElementById('busca-admin').value.toLowerCase();
    document.querySelectorAll('#lista-admin li').forEach(item => {
        item.style.display = item.innerText.toLowerCase().includes(termo) ? 'flex' : 'none';
    });
}

// --- AGENDAMENTO E REGRAS DE NEGÓCIO ---

function gerarHorarios() {
    const s = document.getElementById('horario');
    if(!s) return;
    s.innerHTML = "";
    for (let h = CONFIG.horaInicio; h < CONFIG.horaFechamento; h++) {
        for (let m = 0; m < 60; m += CONFIG.intervaloMinutos) {
            if (h >= CONFIG.almocoInicio && h < CONFIG.almocoFim) continue;
            let t = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
            s.innerHTML += `<option value="${t}">${t}</option>`;
        }
    }
}

document.getElementById('agendamento-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = document.getElementById('data-agendamento').value;
    const hora = document.getElementById('horario').value;
    const barbeiro = document.getElementById('escolha-barbeiro').value;
    const checks = document.querySelectorAll('input[name="servico"]:checked');

    if (checks.length === 0) return showToast("Escolha um serviço!", "error");
    
    // Validação de Conflito
    const conflito = atendimentos.some(a => a.data === data && a.horario === hora && a.barbeiro === barbeiro);
    if(conflito) return showToast("Este profissional já está ocupado neste horário!", "error");

    let servs = [], totalS = 0;
    checks.forEach(c => { servs.push(c.value); totalS += parseFloat(c.dataset.preco); });
    
    atendimentos.push({
        id: Date.now(),
        clienteNome: usuarioLogado.nome,
        clienteEmail: usuarioLogado.email,
        data,
        horario: hora,
        barbeiro,
        servicos: servs.join(', '),
        total: totalS + PRODUTOS[document.getElementById('produto').value]
    });

    localStorage.setItem('barbearia_fagner_dados', JSON.stringify(atendimentos));
    renderizarLista();
    atualizarDashboard();
    showToast("Agendado com sucesso!");
    e.target.reset();
});

// --- RENDERIZAÇÃO ---

function renderizarLista() {
    const lAdmin = document.getElementById('lista-admin');
    const lCliente = document.getElementById('lista-cliente');
    if (lAdmin) lAdmin.innerHTML = "";
    if (lCliente) lCliente.innerHTML = "";
    let soma = 0;

    atendimentos.forEach(item => {
        const html = `<li>
            <span><strong>${item.horario}</strong> - ${item.clienteNome} <br> 
            <small>${item.servicos} | <b>Prof: ${item.barbeiro}</b></small></span>
            <span>R$ ${item.total.toFixed(2)} <button class="btn-del-mini" onclick="excluirAtendimento(${item.id})">X</button></span>
        </li>`;

        if (usuarioLogado.role === 'admin') { lAdmin.innerHTML += html; soma += item.total; }
        else if (item.clienteEmail === usuarioLogado.email) { lCliente.innerHTML += html; }
    });
    if(document.getElementById('total-valor')) document.getElementById('total-valor').innerText = soma.toFixed(2);
}

// Restante das funções auxiliares...
function excluirAtendimento(id) {
    atendimentos = atendimentos.filter(a => a.id !== id);
    localStorage.setItem('barbearia_fagner_dados', JSON.stringify(atendimentos));
    renderizarLista();
    atualizarDashboard();
}

function gerarListaServicos() {
    const container = document.getElementById('servicos-lista');
    if(!container) return;
    container.innerHTML = "";
    for (let s in SERVICOS) {
        container.innerHTML += `<label class="serv-item"><input type="checkbox" name="servico" value="${s}" data-preco="${SERVICOS[s]}"> ${s.toUpperCase()} (R$${SERVICOS[s]})</label>`;
    }
}

function popularSelect(id, obj) {
    const s = document.getElementById(id); if(!s) return;
    for (let k in obj) s.innerHTML += `<option value="${k}">${k.toUpperCase()}</option>`;
}

function renderizarBarbeiros() {
    const lista = document.getElementById('lista-barbeiros'); if(!lista) return;
    lista.innerHTML = barbeiros.map(b => `<li><span><strong>${b.nome}</strong></span> <button onclick="removerBarbeiro(${b.id})" class="btn-del-mini">X</button></li>`).join('');
}

function removerBarbeiro(id) {
    barbeiros = barbeiros.filter(b => b.id !== id);
    localStorage.setItem('barbearia_barbeiros', JSON.stringify(barbeiros));
    renderizarBarbeiros();
    popularBarbeirosAgendamento();
}

function toggleConfiguracoes() {
    document.getElementById('section-configuracoes').classList.toggle('hidden');
    document.getElementById('section-agendamento').classList.toggle('hidden');
    document.getElementById('section-meus-agendamentos').classList.toggle('hidden');
}

function limparFluxo() {
    if(confirm("Zerar todos os registros do caixa?")) { 
        atendimentos = []; 
        localStorage.setItem('barbearia_fagner_dados', "[]"); 
        renderizarLista(); 
        atualizarDashboard();
        showToast("Caixa zerado!");
    }
}