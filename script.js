// --- CONFIGURAÇÃO E BD ---
const DB_KEY = 'arenaFut_DB';
const SESSION_KEY = 'arenaFut_Session';

let currentUser = null;
let currentData = {
    config: { name: '', type: 'futebol', ptsWin: 3, ptsDraw: 1, ptsLoss: 0, cardsSuspension: 3, fineRed: 0 },
    teams: [],
    matches: []
};

// --- INICIALIZAÇÃO E AUTH ---
document.addEventListener('DOMContentLoaded', () => {
    
    // 1. Verifica se já existe login salvo
    const session = localStorage.getItem(SESSION_KEY);
    if(session) {
        const [user, pass] = session.split('|');
        if(user && pass) {
            executeLogin(user, pass, false); // false = não alerta se der certo
        }
    }

    // 2. Configura o Formulário de Login (O botão "Funcionar")
    const authForm = document.getElementById('authForm');
    if(authForm) {
        authForm.addEventListener('submit', function(e) {
            e.preventDefault(); // Impede recarregar a página
            
            const user = document.getElementById('username').value.trim();
            const pass = document.getElementById('password').value.trim();

            if(!user || pass.length < 4) {
                alert("Por favor, digite um usuário e uma senha com no mínimo 4 dígitos.");
                return;
            }

            handleLoginRequest(user, pass);
        });
    }
});

// Lógica de Decisão: Entrar ou Criar
function handleLoginRequest(user, pass) {
    const db = JSON.parse(localStorage.getItem(DB_KEY)) || {};
    
    if(db[user]) {
        // Usuário existe, tenta logar
        executeLogin(user, pass, true);
    } else {
        // Usuário não existe, pergunta se quer criar
        if(confirm(`O usuário "${user}" não existe. Deseja criar uma conta nova agora?`)) {
            createNewAccount(user, pass);
        }
    }
}

function createNewAccount(user, pass) {
    const db = JSON.parse(localStorage.getItem(DB_KEY)) || {};
    
    // Estrutura inicial da conta
    db[user] = {
        password: pass,
        data: {
            config: { name: 'Meu Novo Campeonato', type: 'futebol', ptsWin: 3, ptsDraw: 1, ptsLoss: 0, cardsSuspension: 3, fineRed: 0 },
            teams: [],
            matches: []
        }
    };

    localStorage.setItem(DB_KEY, JSON.stringify(db));
    alert("Conta criada com sucesso!");
    executeLogin(user, pass, true);
}

function executeLogin(user, pass, showAlert) {
    const db = JSON.parse(localStorage.getItem(DB_KEY)) || {};

    if(db[user] && db[user].password === pass) {
        currentUser = user;
        currentData = db[user].data;
        
        // Salva sessão
        localStorage.setItem(SESSION_KEY, `${user}|${pass}`);
        
        // Inicia App
        showApp();
    } else {
        if(showAlert) alert("Senha incorreta!");
    }
}

function performLogout() {
    localStorage.removeItem(SESSION_KEY);
    location.reload();
}

function saveData() {
    if(!currentUser) return;
    const db = JSON.parse(localStorage.getItem(DB_KEY)) || {};
    db[currentUser].data = currentData;
    localStorage.setItem(DB_KEY, JSON.stringify(db));
    app.renderAll();
}

// --- APP LÓGICA (Tudo igual, garantindo funcionamento) ---
const app = {
    tempMatchId: null,
    tempTeamId: null,

    showTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
        const target = document.getElementById(`tab-${id}`);
        if(target) target.classList.add('active');
        app.renderAll();
    },

    renderAll: () => {
        // UI Updates
        document.getElementById('displayUsername').innerText = currentUser;
        document.getElementById('tourneyName').value = currentData.config.name || '';
        document.getElementById('tourneyType').value = currentData.config.type || 'futebol';
        
        // Regras Values
        document.getElementById('ptsWin').value = currentData.config.ptsWin;
        document.getElementById('ptsDraw').value = currentData.config.ptsDraw;
        document.getElementById('ptsLoss').value = currentData.config.ptsLoss;
        document.getElementById('cardsSuspension').value = currentData.config.cardsSuspension;
        document.getElementById('fineRed').value = currentData.config.fineRed;

        app.renderTeams();
        app.renderMatches();
        app.renderStandings();
        app.renderStats();
    },

    // 1. CONFIG & REGRAS
    saveConfig: () => {
        currentData.config.name = document.getElementById('tourneyName').value;
        currentData.config.type = document.getElementById('tourneyType').value;
        saveData();
        alert("Configuração Salva!");
    },

    saveRules: () => {
        currentData.config.ptsWin = parseInt(document.getElementById('ptsWin').value);
        currentData.config.ptsDraw = parseInt(document.getElementById('ptsDraw').value);
        currentData.config.ptsLoss = parseInt(document.getElementById('ptsLoss').value);
        currentData.config.cardsSuspension = parseInt(document.getElementById('cardsSuspension').value);
        currentData.config.fineRed = parseInt(document.getElementById('fineRed').value);
        saveData();
        alert("Regras Atualizadas!");
    },

    // 2. TIMES & ELENCO
    addTeam: () => {
        const name = document.getElementById('newTeamName').value;
        if(!name) return;
        currentData.teams.push({ id: Date.now(), name, players: [] });
        document.getElementById('newTeamName').value = '';
        ui.closeModal('modal-team');
        saveData();
    },

    renderTeams: () => {
        const list = document.getElementById('teams-list');
        list.innerHTML = currentData.teams.map(t => `
            <div class="team-card" onclick="app.openSquad(${t.id})">
                <h4>${t.name}</h4>
                <small>${t.players.length} Jogadores</small>
            </div>
        `).join('');
    },

    openSquad: (teamId) => {
        app.tempTeamId = teamId;
        const team = currentData.teams.find(t => t.id === teamId);
        document.getElementById('squadTeamName').innerText = `Elenco: ${team.name}`;
        app.renderSquadList();
        ui.openModal('modal-squad');
    },

    addPlayerToTeam: () => {
        const name = document.getElementById('pName').value;
        const num = document.getElementById('pNumber').value;
        const pos = document.getElementById('pPos').value;
        if(!name) return;

        const team = currentData.teams.find(t => t.id === app.tempTeamId);
        team.players.push({ id: Date.now(), name, number: num, pos });
        
        document.getElementById('pName').value = '';
        document.getElementById('pNumber').value = '';
        saveData();
        app.renderSquadList();
    },

    renderSquadList: () => {
        const team = currentData.teams.find(t => t.id === app.tempTeamId);
        const tbody = document.getElementById('squad-list-body');
        tbody.innerHTML = team.players.map((p, idx) => `
            <tr>
                <td>${p.number}</td>
                <td>${p.name}</td>
                <td>${p.pos}</td>
                <td><button onclick="app.removePlayer(${idx})" style="color:red;border:none;background:none;cursor:pointer">X</button></td>
            </tr>
        `).join('');
    },
    
    removePlayer: (idx) => {
        const team = currentData.teams.find(t => t.id === app.tempTeamId);
        team.players.splice(idx, 1);
        saveData();
        app.renderSquadList();
    },

    // 3. JOGOS E SÚMULA
    generateFixture: () => {
        if(currentData.teams.length < 2) return alert("Mínimo 2 times.");
        currentData.matches = [];
        const teams = currentData.teams;
        
        for(let i=0; i<teams.length; i++){
            for(let j=i+1; j<teams.length; j++){
                currentData.matches.push({
                    id: Date.now() + Math.random(),
                    teamA: teams[i].id,
                    teamB: teams[j].id,
                    events: [],
                    ended: false
                });
            }
        }
        saveData();
        app.renderAll(); // Atualiza tudo
    },

    renderMatches: () => {
        const list = document.getElementById('matches-list');
        list.innerHTML = currentData.matches.map(m => {
            const tA = currentData.teams.find(t => t.id === m.teamA);
            const tB = currentData.teams.find(t => t.id === m.teamB);
            
            // Segurança caso um time tenha sido deletado
            if(!tA || !tB) return '';

            // Calcular placar baseado nos eventos
            const goalsA = m.events.filter(e => e.type === 'goal' && e.teamId === m.teamA).length;
            const goalsB = m.events.filter(e => e.type === 'goal' && e.teamId === m.teamB).length;

            return `
            <div class="match-card">
                <div style="flex:1; text-align:right"><b>${tA.name}</b></div>
                <div style="padding: 0 15px; font-weight:bold; background:#eee; border-radius:4px; margin:0 10px;">
                    ${m.ended ? `${goalsA} x ${goalsB}` : 'VS'}
                </div>
                <div style="flex:1; text-align:left"><b>${tB.name}</b></div>
                <button class="btn-secondary" onclick="app.openMatch(${m.id})">Súmula</button>
            </div>`;
        }).join('');
    },

    openMatch: (matchId) => {
        app.tempMatchId = matchId;
        const m = currentData.matches.find(x => x.id === matchId);
        const tA = currentData.teams.find(t => t.id === m.teamA);
        const tB = currentData.teams.find(t => t.id === m.teamB);

        document.getElementById('matchTeamA').innerText = tA.name;
        document.getElementById('matchTeamB').innerText = tB.name;
        
        // Popula Select de Times na Súmula
        const selectT = document.getElementById('eventTeamSelect');
        selectT.innerHTML = `<option value="">Selecione Time</option>
                             <option value="${tA.id}">${tA.name}</option>
                             <option value="${tB.id}">${tB.name}</option>`;
        
        // Limpa select de jogador
        document.getElementById('eventPlayerSelect').innerHTML = '<option>Jogador</option>';

        app.updateScoreboard();
        ui.openModal('modal-match');
    },

    loadPlayersForEvent: () => {
        const teamId = parseInt(document.getElementById('eventTeamSelect').value);
        if(!teamId) return;
        const team = currentData.teams.find(t => t.id === teamId);
        const selectP = document.getElementById('eventPlayerSelect');
        selectP.innerHTML = team.players.map(p => `<option value="${p.id}">${p.number} - ${p.name}</option>`).join('');
    },

    addMatchEvent: () => {
        const m = currentData.matches.find(x => x.id === app.tempMatchId);
        const teamId = parseInt(document.getElementById('eventTeamSelect').value);
        const playerId = parseInt(document.getElementById('eventPlayerSelect').value);
        const type = document.getElementById('eventType').value;
        const time = document.getElementById('eventTime').value;

        if(!teamId || !playerId || !time) return alert("Preencha todos os dados do evento.");

        const team = currentData.teams.find(t => t.id === teamId);
        const player = team.players.find(p => p.id === playerId);

        m.events.push({
            teamId, playerId, playerName: player.name, type, time: parseInt(time)
        });

        // Ordenar eventos por tempo
        m.events.sort((a,b) => a.time - b.time);

        saveData();
        app.updateScoreboard();
    },

    updateScoreboard: () => {
        const m = currentData.matches.find(x => x.id === app.tempMatchId);
        const goalsA = m.events.filter(e => e.type === 'goal' && e.teamId === m.teamA).length;
        const goalsB = m.events.filter(e => e.type === 'goal' && e.teamId === m.teamB).length;

        document.getElementById('displayScoreA').innerText = goalsA;
        document.getElementById('displayScoreB').innerText = goalsB;

        const logList = document.getElementById('match-events-log');
        logList.innerHTML = m.events.map(e => {
            const icon = e.type === 'goal' ? '⚽' : (e.type === 'yellow' ? '🟨' : '🟥');
            return `<li>${e.time}' - ${icon} ${e.playerName}</li>`;
        }).join('');
    },

    finishMatch: () => {
        const m = currentData.matches.find(x => x.id === app.tempMatchId);
        m.ended = true;
        saveData();
        ui.closeModal('modal-match');
        app.renderMatches(); // Atualiza lista
        app.renderStandings(); // Atualiza tabela
    },

    // 4. CLASSIFICAÇÃO E STATS
    renderStandings: () => {
        let stats = {};
        currentData.teams.forEach(t => {
            stats[t.id] = { name: t.name, P:0, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0 };
        });

        const cfg = currentData.config;

        currentData.matches.forEach(m => {
            if(m.ended) {
                const goalsA = m.events.filter(e => e.type === 'goal' && e.teamId === m.teamA).length;
                const goalsB = m.events.filter(e => e.type === 'goal' && e.teamId === m.teamB).length;

                let sA = stats[m.teamA];
                let sB = stats[m.teamB];

                // Segurança
                if(!sA || !sB) return;

                sA.J++; sB.J++;
                sA.GP += goalsA; sA.GC += goalsB; sA.SG = sA.GP - sA.GC;
                sB.GP += goalsB; sB.GC += goalsA; sB.SG = sB.GP - sB.GC;

                if(goalsA > goalsB) { sA.V++; sA.P += cfg.ptsWin; sB.D++; sB.P += cfg.ptsLoss; }
                else if(goalsB > goalsA) { sB.V++; sB.P += cfg.ptsWin; sA.D++; sA.P += cfg.ptsLoss; }
                else { sA.E++; sB.E++; sA.P += cfg.ptsDraw; sB.P += cfg.ptsDraw; }
            }
        });

        const sorted = Object.values(stats).sort((a,b) => b.P - a.P || b.V - a.V || b.SG - a.SG);
        document.getElementById('standings-body').innerHTML = sorted.map((t,i) => `
            <tr><td>${i+1}</td><td style="text-align:left">${t.name}</td><td><b>${t.P}</b></td><td>${t.J}</td><td>${t.V}</td><td>${t.E}</td><td>${t.D}</td><td>${t.GP}</td><td>${t.GC}</td><td>${t.SG}</td></tr>
        `).join('');
    },

    renderStats: () => {
        let players = {}; // id -> {name, goals, yellow, red, team}
        
        currentData.matches.forEach(m => {
            m.events.forEach(e => {
                if(!players[e.playerId]) players[e.playerId] = { name: e.playerName, goals:0, yellow:0, red:0 };
                if(e.type === 'goal') players[e.playerId].goals++;
                if(e.type === 'yellow') players[e.playerId].yellow++;
                if(e.type === 'red') players[e.playerId].red++;
            });
        });

        const list = Object.values(players);
        
        // Render Functions
        const renderList = (arr, prop, elId) => {
            const sorted = arr.sort((a,b) => b[prop] - a[prop]).slice(0, 5);
            document.getElementById(elId).innerHTML = sorted.map(p => 
                `<li><span>${p.name}</span> <b>${p[prop]}</b></li>`
            ).join('');
        };

        renderList(list.filter(p=>p.goals>0), 'goals', 'stats-goals');
        renderList(list.filter(p=>p.red>0), 'red', 'stats-reds');
        renderList(list.filter(p=>p.yellow>0), 'yellow', 'stats-yellows');
    },
};

const ui = {
    openModal: (id) => document.getElementById(id).style.display = 'flex',
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    showLanding: () => {
        document.getElementById('landing-page').classList.remove('hidden');
        document.getElementById('app-dashboard').classList.add('hidden');
    },
    showApp: () => {
        document.getElementById('landing-page').classList.add('hidden');
        document.getElementById('app-dashboard').classList.remove('hidden');
        app.showTab('config');
    }
};

function showApp() { ui.showApp(); }
