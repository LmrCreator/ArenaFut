// --- GESTÃO DE DADOS E USUÁRIOS ---
const DB_KEY = 'arenaFut_users';
const SESSION_KEY = 'arenaFut_session';

// Estado Global da Aplicação
let currentUser = null;
let currentData = {
    config: { name: '', type: 'futebol' },
    teams: [],
    matches: []
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', () => {
    checkSession();
});

// --- SISTEMA DE LOGIN/AUTH ---
function checkSession() {
    const savedUser = localStorage.getItem(SESSION_KEY);
    if (savedUser) {
        currentUser = savedUser;
        loadUserData();
        showApp();
    } else {
        showLanding();
    }
}

function showLogin(mode) {
    document.getElementById('auth-box').classList.remove('hidden');
    toggleAuthMode(mode);
}

function hideAuth() {
    document.getElementById('auth-box').classList.add('hidden');
}

function toggleAuthMode(mode) {
    if (mode === 'login') {
        document.getElementById('form-login').classList.remove('hidden');
        document.getElementById('form-register').classList.add('hidden');
    } else {
        document.getElementById('form-login').classList.add('hidden');
        document.getElementById('form-register').classList.remove('hidden');
    }
}

function getUsersDB() {
    return JSON.parse(localStorage.getItem(DB_KEY)) || {};
}

function performRegister() {
    const username = document.getElementById('regUsername').value.trim();
    if (!username) return alert("Digite um nome de usuário.");
    
    const db = getUsersDB();
    if (db[username]) {
        return alert("Este nome de usuário já existe. Tente outro.");
    }

    // Cria novo usuário vazio
    db[username] = {
        config: { name: 'Meu Torneio', type: 'futebol' },
        teams: [],
        matches: []
    };
    
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    loginUser(username);
}

function performLogin() {
    const username = document.getElementById('loginUsername').value.trim();
    const db = getUsersDB();
    
    if (db[username]) {
        loginUser(username);
    } else {
        if(confirm("Usuário não encontrado. Deseja criar uma conta com o nome '" + username + "'?")) {
             document.getElementById('regUsername').value = username;
             toggleAuthMode('register');
        }
    }
}

function loginUser(username) {
    localStorage.setItem(SESSION_KEY, username);
    currentUser = username;
    loadUserData();
    showApp();
    hideAuth();
}

function performLogout() {
    localStorage.removeItem(SESSION_KEY);
    currentUser = null;
    showLanding();
}

// --- CARREGAMENTO DE DADOS ---
function loadUserData() {
    const db = getUsersDB();
    currentData = db[currentUser];
    
    // Atualiza UI
    document.getElementById('displayUsername').textContent = currentUser;
    document.getElementById('tourneyName').value = currentData.config.name;
    document.getElementById('tourneyType').value = currentData.config.type;
    
    app.renderTeams();
    app.renderMatches();
    app.renderStandings();
}

function saveUserData() {
    const db = getUsersDB();
    db[currentUser] = currentData;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
}

// --- CONTROLE DE TELAS ---
function showLanding() {
    document.getElementById('landing-page').classList.remove('hidden');
    document.getElementById('app-dashboard').classList.add('hidden');
}

function showApp() {
    document.getElementById('landing-page').classList.add('hidden');
    document.getElementById('app-dashboard').classList.remove('hidden');
    app.showTab('config'); // Vai para o início do painel
}

// --- LÓGICA DO APP (Dashboard) ---
const app = {
    currentMatchId: null,

    showTab: (tabName) => {
        // Esconde todas as abas
        document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
        document.getElementById(`tab-${tabName}`).classList.add('active');
        
        // Atualiza Menu Sidebar
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        // (Opcional: lógica para destacar o li clicado)
    },

    saveConfig: () => {
        currentData.config.name = document.getElementById('tourneyName').value;
        currentData.config.type = document.getElementById('tourneyType').value;
        saveUserData();
        alert("Configurações salvas!");
    },

    deleteData: () => {
        if(confirm("Tem certeza? Isso apagará TODOS os times e jogos deste usuário.")) {
            currentData.teams = [];
            currentData.matches = [];
            saveUserData();
            location.reload();
        }
    },

    // 1. TIMES
    addTeam: () => {
        const name = document.getElementById('newTeamName').value;
        if (!name) return alert("Digite um nome");
        
        currentData.teams.push({ id: Date.now(), name: name });
        saveUserData();
        document.getElementById('newTeamName').value = '';
        ui.closeModal('modal-team');
        app.renderTeams();
    },

    renderTeams: () => {
        const list = document.getElementById('teams-list');
        if (currentData.teams.length === 0) {
            list.innerHTML = '<p class="empty-state">Nenhuma equipe cadastrada.</p>';
            return;
        }
        list.innerHTML = currentData.teams.map(t => 
            `<div class="team-card"><h4>${t.name}</h4></div>`
        ).join('');
    },

    // 2. JOGOS
    generateFixture: () => {
        const teams = currentData.teams;
        if (teams.length < 2) return alert("Adicione pelo menos 2 times.");
        
        // Algoritmo simples de todos contra todos (apenas ida)
        currentData.matches = [];
        let matchId = 1;

        for (let i = 0; i < teams.length; i++) {
            for (let j = i + 1; j < teams.length; j++) {
                currentData.matches.push({
                    id: matchId++,
                    teamA: teams[i],
                    teamB: teams[j],
                    scoreA: null,
                    scoreB: null,
                    played: false
                });
            }
        }
        saveUserData();
        app.renderMatches();
        alert("Tabela gerada com sucesso!");
    },

    renderMatches: () => {
        const list = document.getElementById('matches-list');
        if (currentData.matches.length === 0) {
            list.innerHTML = '<p class="empty-state">Gere a tabela para ver os jogos.</p>';
            return;
        }
        list.innerHTML = currentData.matches.map(m => {
            const result = m.played ? `${m.scoreA} x ${m.scoreB}` : 'vs';
            const btnText = m.played ? 'Editar' : 'Informar Placar';
            const btnClass = m.played ? 'btn-secondary' : 'btn-primary';
            
            return `
            <div class="match-card">
                <span class="team-name">${m.teamA.name}</span>
                <span class="match-score">${result}</span>
                <span class="team-name">${m.teamB.name}</span>
                <button class="${btnClass}" onclick="app.openMatchModal(${m.id})">${btnText}</button>
            </div>`;
        }).join('');
    },

    openMatchModal: (id) => {
        const match = currentData.matches.find(m => m.id === id);
        app.currentMatchId = id;
        document.getElementById('matchTitle').innerText = `${match.teamA.name} x ${match.teamB.name}`;
        document.getElementById('scoreA').value = match.scoreA;
        document.getElementById('scoreB').value = match.scoreB;
        ui.openModal('modal-match');
    },

    saveMatch: () => {
        const match = currentData.matches.find(m => m.id === app.currentMatchId);
        const sa = document.getElementById('scoreA').value;
        const sb = document.getElementById('scoreB').value;
        
        if (sa === '' || sb === '') return alert("Informe o placar");

        match.scoreA = parseInt(sa);
        match.scoreB = parseInt(sb);
        match.played = true;

        saveUserData();
        ui.closeModal('modal-match');
        app.renderMatches();
        app.renderStandings(); // Atualiza tabela
    },

    // 3. CLASSIFICAÇÃO
    renderStandings: () => {
        // Inicializa stats
        let stats = {};
        currentData.teams.forEach(t => {
            stats[t.id] = { name: t.name, P:0, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0 };
        });

        // Calcula
        currentData.matches.forEach(m => {
            if (m.played) {
                let sA = stats[m.teamA.id];
                let sB = stats[m.teamB.id];
                
                if(!sA || !sB) return; // Segurança caso time tenha sido deletado

                sA.J++; sB.J++;
                sA.GP += m.scoreA; sA.GC += m.scoreB; sA.SG = sA.GP - sA.GC;
                sB.GP += m.scoreB; sB.GC += m.scoreA; sB.SG = sB.GP - sB.GC;

                if (m.scoreA > m.scoreB) { sA.V++; sA.P += 3; sB.D++; }
                else if (m.scoreB > m.scoreA) { sB.V++; sB.P += 3; sA.D++; }
                else { sA.E++; sA.P++; sB.E++; sB.P++; }
            }
        });

        // Ordena e Renderiza
        const sorted = Object.values(stats).sort((a,b) => b.P - a.P || b.SG - a.SG);
        
        document.getElementById('standings-body').innerHTML = sorted.map((t, i) => `
            <tr>
                <td>${i+1}º</td>
                <td style="text-align:left; font-weight:bold">${t.name}</td>
                <td><strong>${t.P}</strong></td>
                <td>${t.J}</td>
                <td>${t.V}</td>
                <td>${t.E}</td>
                <td>${t.D}</td>
                <td>${t.SG}</td>
            </tr>
        `).join('');
    }
};

// --- INTERFACE ---
const ui = {
    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none'
};
