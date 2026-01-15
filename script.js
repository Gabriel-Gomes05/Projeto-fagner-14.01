/**
 * SISTEMA BARBEARIA DO FAGNER PRO - VERSÃO 3.0
 * Foco: Gestão Financeira, Bloqueio de Conflitos e Comunicação via WhatsApp
 */

// --- 1. CONFIGURAÇÕES GLOBAIS (Regras de Negócio) ---
const CONFIG = { 
    horaInicio: 8, 
    horaFechamento: 19, 
    almocoInicio: 12, 
    almocoFim: 13, 
    intervaloMinutos: 30 
};

const SERVICOS = { 
    "corte": 35, 
    "barba": 20, 
    "sobrancelha": 7, 
    "acabamento": 15, 
    "luzes": 50, 
    "alisamento": 20, 
    "nevou": 150 
};

const PRODUTOS = { "nenhum": 0, "gel": 15, "pomada": 20 };

// Credenciais de Admin (No futuro, estas serão validadas via Banco de Dados/Spring Security)
const ADMIN_EMAIL = "fagner@admin.com";
const ADMIN_SENHA = "123";

// --- 2. ESTADO DA APLICAÇÃO (Simulando Tabelas SQL) ---
let usuarios = JSON.parse(localStorage.getItem('barbearia_users')) || [];
let atendimentos = JSON.parse(localStorage.getItem('barbearia_fagner_dados')) || [];
let barbeiros = JSON.parse(localStorage.getItem('barbearia_barbeiros')) || [];
let usuarioLogado = null;

// Inicialização ao carregar a página
window.onload = function() {
    gerarListaServicos();
    popularSelect('produto', PRODUTOS);
    gerarHorarios();
    verificarSessao();
    renderizarBarbeiros();
    popularBarbeirosAgendamento();
    atualizarDashboard(); // Inicializa o financeiro do Fagner
    
    // Define a data mínima de agendamento para "hoje"
    if(document.getElementById('data-agendamento')) {
        document.getElementById('data-agendamento').setAttribute('min', new Date().toISOString().split('T')[0]);
    }
};

// --- 3. LÓGICA DE AGENDAMENTO COM BLOQUEIO DE CONFLITOS ---
document.getElementById('agendamento-form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = document.getElementById('data-agendamento').value;
    const hora = document.getElementById('horario').value;
    const barbeiro = document.getElementById('escolha-barbeiro').value;
    const checks = document.querySelectorAll('input[name="servico"]:checked');

    if (checks.length === 0) return showToast("Escolha pelo menos um serviço!", "error");
    if (!barbeiro) return showToast("Selecione um barbeiro!", "error");

    // TRAVA DE SEGURANÇA: Bloqueia se o barbeiro já tiver compromisso no mesmo dia e hora
    const conflito = atendimentos.some(a => 
        a.data === data && 
        a.horario === hora && 
        a.barbeiro === barbeiro
    );

    if (conflito) {
        return showToast(`O profissional ${barbeiro} já está ocupado às ${hora} do dia ${data.split('-').reverse().join('/')}.`, "error");
    }

    // Cálculo de valores
    let servs = [], totalS = 0;
    checks.forEach(c => { 
        servs.push(c.value); 
        totalS += parseFloat(c.dataset.preco); 
    });
    
    // Objeto pronto para virar um JSON para o Backend Java
    const novoAgendamento = {
        id: Date.now(), // Simula Primary Key
        clienteNome: usuarioLogado.nome,
        clienteEmail: usuarioLogado.email,
        data,
        horario: hora,
        barbeiro,
        servicos: servs.join(', '),
        total: totalS + PRODUTOS[document.getElementById('produto').value]
    };

    atendimentos.push(novoAgendamento);
    localStorage.setItem('barbearia_fagner_dados', JSON.stringify(atendimentos));
    
    renderizarLista();
    atualizarDashboard();
    showToast("Agendado com sucesso!");
    e.target.reset();
});

// --- 4. PAINEL FINANCEIRO (BI - BUSINESS INTELLIGENCE) ---
function atualizarDashboard() {
    if (usuarioLogado?.role !== 'admin') return;

    const hoje = new Date().toISOString().split('T')[0];
    
    // Cálculos Financeiros
    const atendidosHoje = atendimentos.filter(a => a.data === hoje).length;
    const faturamentoBruto = atendimentos.reduce((acc, curr) => acc + curr.total, 0);
    const totalVendas = atendimentos.length;
    const ticketMedio = totalVendas > 0 ? (faturamentoBruto / totalVendas) : 0;

    // Atualização da Interface do Fagner
    document.getElementById('stat-count-hoje').innerText = atendidosHoje;
    document.getElementById('stat-faturamento-bruto').innerText = `R$ ${faturamentoBruto.toFixed(2)}`;
    document.getElementById('stat-ticket-medio').innerText = `R$ ${ticketMedio.toFixed(2)}`;
    document.getElementById('stat-total-clientes').innerText = usuarios.length;
    document.getElementById('total-valor').innerText = faturamentoBruto.toFixed(2);
}

// --- 5. COMUNICAÇÃO (WHATSAPP) ---
function enviarConfirmacaoWhatsapp(atendimentoId) {
    const a = atendimentos.find(item => item.id == atendimentoId);
    const cliente = usuarios.find(u => u.nome === a.clienteNome || u.email === a.clienteEmail);
    
    if (!cliente || !cliente.tel) return showToast("Telefone não encontrado!", "error");

    const telLimpo = cliente.tel.replace(/\D/g, ''); // Limpa máscara
    const msg = `Olá *${a.clienteNome}*! Aqui é o Fagner. 👋%0A%0A` +
                `Confirmando seu horário no sistema:%0A` +
                `📅 Dia: *${a.data.split('-').reverse().join('/')}*%0A` +
                `⏰ Hora: *${a.horario}*%0A` +
                `✂️ Serviços: ${a.servicos}%0A%0A` +
                `Posso confirmar na agenda?`;

    window.open(`https://api.whatsapp.com/send?phone=55${telLimpo}&text=${msg}`, '_blank');
}

// --- 6. AUTENTICAÇÃO E SESSÃO ---
function login() {
    const email = document.getElementById('login-email').value.toLowerCase().trim();
    const senha = document.getElementById('login-senha').value.trim();

    if (email === ADMIN_EMAIL && senha === ADMIN_SENHA) {
        usuarioLogado = { nome: "Fagner (Admin)", role: "admin", email: ADMIN_EMAIL };
    } else {
        const user = usuarios.find(u => u.email === email && u.senha === senha);
        if (user) usuarioLogado = user;
        else return showToast("Credenciais incorretas!", "error");
    }
    sessionStorage.setItem('sessao_user', JSON.stringify(usuarioLogado));
    verificarSessao();
}

function registrar() {
    const email = document.getElementById('reg-email').value.toLowerCase().trim();
    const tel = document.getElementById('reg-tel').value;
    
    if(usuarios.find(u => u.email === email)) return showToast("E-mail já cadastrado!", "error");

    const novoUser = {
        id: Date.now(),
        nome: document.getElementById('reg-nome').value,
        tel: tel,
        email: email,
        senha: document.getElementById('reg-senha').value,
        role: 'cliente'
    };

    if(!novoUser.nome || !novoUser.tel) return showToast("Preencha todos os campos!", "error");

    usuarios.push(novoUser);
    localStorage.setItem('usuarios_barbearia', JSON.stringify(usuarios));
    showToast("Cadastro realizado! Faça login.");
    toggleAuth();
}

function verificarSessao() {
    const s = sessionStorage.getItem('sessao_user');
    if (s) {
        usuarioLogado = JSON.parse(s);
        document.getElementById('auth-screen').classList.add('hidden');
        document.getElementById('main-content').classList.remove('hidden');
        document.getElementById('nav-sistema').classList.remove('hidden');
        document.getElementById('user-nome').innerText = usuarioLogado.nome;
        
        const isAdmin = usuarioLogado.role === 'admin';
        document.getElementById('section-caixa').classList.toggle('hidden', !isAdmin);
        document.getElementById('section-agendamento').classList.toggle('hidden', isAdmin);
        document.getElementById('section-meus-agendamentos').classList.toggle('hidden', isAdmin);
        
        renderizarLista();
        atualizarDashboard();
    }
}

// --- 7. RENDERIZAÇÃO DE LISTAS E COMPONENTES ---
function renderizarLista() {
    const lAdmin = document.getElementById('lista-admin');
    const lCliente = document.getElementById('lista-cliente');
    if (lAdmin) lAdmin.innerHTML = "";
    if (lCliente) lCliente.innerHTML = "";

    atendimentos.forEach(item => {
        const isAdmin = usuarioLogado.role === 'admin';
        const btnWpp = isAdmin ? `<button class="btn-wpp" onclick="enviarConfirmacaoWhatsapp(${item.id})"><i class="fa-brands fa-whatsapp"></i></button>` : '';

        const html = `<li>
            <span><strong>${item.horario}</strong> - ${item.clienteNome} <br> 
            <small>${item.servicos} | <b>Barbeiro: ${item.barbeiro}</b></small></span>
            <div class="acoes-lista">
                <span>R$ ${item.total.toFixed(2)}</span>
                ${btnWpp}
                <button class="btn-del-mini" onclick="excluirAtendimento(${item.id})">X</button>
            </div>
        </li>`;

        if (isAdmin) lAdmin.innerHTML += html;
        else if (item.clienteEmail === usuarioLogado.email) lCliente.innerHTML += html;
    });
}

// --- 8. UTILITÁRIOS (GERADORES) ---
function gerarHorarios() {
    const s = document.getElementById('horario');
    if(!s) return;
    for (let h = CONFIG.horaInicio; h < CONFIG.horaFechamento; h++) {
        for (let m = 0; m < 60; m += CONFIG.intervaloMinutos) {
            if (h >= CONFIG.almocoInicio && h < CONFIG.almocoFim) continue;
            let t = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
            s.innerHTML += `<option value="${t}">${t}</option>`;
        }
    }
}

function gerarListaServicos() {
    const c = document.getElementById('servicos-lista');
    if(!c) return;
    for (let s in SERVICOS) {
        c.innerHTML += `<label class="serv-item"><input type="checkbox" name="servico" value="${s}" data-preco="${SERVICOS[s]}"> ${s.toUpperCase()} (R$${SERVICOS[s]})</label>`;
    }
}

function popularSelect(id, obj) {
    const s = document.getElementById(id);
    if(!s) return;
    for (let k in obj) s.innerHTML += `<option value="${k}">${k.toUpperCase()}</option>`;
}

function showToast(m, t='success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${t === 'error' ? 'error' : ''}`;
    toast.innerHTML = `<i class="fa-solid ${t === 'success' ? 'fa-check' : 'fa-triangle-exclamation'}"></i> ${m}`;
    container.appendChild(toast);
    setTimeout(() => toast.remove(), 4000);
}

// Funções de Troca de Tela e Limpeza
function logout() { sessionStorage.removeItem('sessao_user'); location.reload(); }
function toggleAuth() { document.getElementById('login-box').classList.toggle('hidden'); document.getElementById('register-box').classList.toggle('hidden'); }
function switchAdminTab(t) {
    ['caixa', 'clientes', 'barbeiros'].forEach(v => {
        document.getElementById(`admin-view-${v}`).classList.add('hidden');
        document.getElementById(`tab-${v}`).classList.remove('active');
    });
    document.getElementById(`admin-view-${t}`).classList.remove('hidden');
    document.getElementById(`tab-${t}`).classList.add('active');
}
function popularBarbeirosAgendamento() {
    const s = document.getElementById('escolha-barbeiro');
    if(!s) return;
    s.innerHTML = '<option value="">Selecione um profissional</option>' + barbeiros.map(b => `<option value="${b.nome}">${b.nome}</option>`).join('');
}
function renderizarBarbeiros() {
    const l = document.getElementById('lista-barbeiros'); if(!l) return;
    l.innerHTML = barbeiros.map(b => `<li>${b.nome} <button onclick="removerBarbeiro(${b.id})" class="btn-del-mini">X</button></li>`).join('');
}
function adminCadastrarBarbeiro() {
    const n = document.getElementById('adm-b-nome').value;
    if(!n) return;
    barbeiros.push({id: Date.now(), nome: n});
    localStorage.setItem('barbearia_barbeiros', JSON.stringify(barbeiros));
    renderizarBarbeiros(); popularBarbeirosAgendamento();
}
function removerBarbeiro(id) { barbeiros = barbeiros.filter(b => b.id !== id); localStorage.setItem('barbearia_barbeiros', JSON.stringify(barbeiros)); renderizarBarbeiros(); popularBarbeirosAgendamento(); }
function excluirAtendimento(id) {
    atendimentos = atendimentos.filter(a => a.id !== id);
    localStorage.setItem('barbearia_fagner_dados', JSON.stringify(atendimentos));
    renderizarLista();
    atualizarDashboard();
}
function toggleConfiguracoes() {
    document.getElementById('section-configuracoes').classList.toggle('hidden');
    document.getElementById('main-content').classList.toggle('hidden');
}