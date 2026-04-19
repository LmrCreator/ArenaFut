// --- CONFIGURAÇÃO ---
const SUPABASE_URL = 'https://irervfyouykavrfizgbp.supabase.co'; 
const SUPABASE_KEY = 'sb_publishable_cIf6g2c8wBIZTaGakhOwvQ_qzBlDtcn';
const _supabase = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

const SESSION_KEY = 'ArenaFut_V3_Session';

// Estado Global
let state = {
    user: null,
    allTourneys: [],
    currentIdx: null,
    isReadOnly: false
};

// --- INICIALIZAÇÃO ---
document.addEventListener('DOMContentLoaded', async () => {
    const params = new URLSearchParams(window.location.search);
    if (params.has('u') && params.has('id')) {
        await auth.loadPublicMode(params.get('u'), params.get('id'));
    } else {
        await auth.checkSession();
    }
});

// --- AUTH ---
const auth = {
    checkSession: async () => {
        const session = localStorage.getItem(SESSION_KEY);
        if (session) {
            const [u, p] = session.split('|');
            if(await auth.login(u, p)) return;
        }
        document.getElementById('loginForm').addEventListener('submit', (e) => {
            e.preventDefault();
            auth.handleLogin();
        });
    },
    handleLogin: async () => {
        const u = document.getElementById('usernameInput').value.trim();
        const p = document.getElementById('passwordInput').value.trim();
        if (!u || !p) return;
        
        const btn = document.querySelector('#loginForm button');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Carregando...';
        btn.disabled = true;

        if (!await auth.login(u, p)) {
            if(confirm("Usuário não encontrado ou senha incorreta. Deseja criar uma nova conta com estes dados?")) {
                await auth.register(u, p);
            } else {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }
        }
    },
    login: async (u, p) => {
        try {
            const { data, error } = await _supabase.from('usuarios').select('*').eq('username', u).maybeSingle();
            if (data && data.password === p) {
                state.user = u;
                state.allTourneys = data.data_tourneys || [];
                localStorage.setItem(SESSION_KEY, `${u}|${p}`);
                ui.showSelector();
                return true;
            }
        } catch(e) { console.error(e); }
        return false;
    },
    register: async (u, p) => {
        await _supabase.from('usuarios').insert([{ username: u, password: p, data_tourneys: [] }]);
        auth.login(u, p);
    },
    logout: () => {
        localStorage.removeItem(SESSION_KEY);
        location.href = location.pathname;
    },
    loadPublicMode: async (u, id) => {
        const { data } = await _supabase.from('usuarios').select('data_tourneys').eq('username', u).maybeSingle();
        if (data) {
            const t = data.data_tourneys.find(x => x.id == id);
            if (t) {
                state.isReadOnly = true;
                state.allTourneys = [t];
                state.currentIdx = 0;
                ui.preparePublic();
                app.loadTourney(0);
            } else {
                alert("Campeonato não encontrado.");
            }
        }
    }
};

// --- APP CORE ---
const app = {
    createTourney: () => {
        const name = document.getElementById('newTourneyName').value.trim();
        if(!name) return alert("Digite um nome para o campeonato!");
        state.allTourneys.push({
            id: Date.now(),
            config: { name, ptsWin: 3, ptsDraw: 1 },
            teams: [],
            matches: [],
            knockout: []
        });
        app.save();
        ui.closeModal('modal-new-tourney');
        document.getElementById('newTourneyName').value = '';
        ui.renderTourneyList();
    },
    loadTourney: (idx) => {
        state.currentIdx = idx;
        ui.showDashboard();
        app.renderAll();
    },
    exitTourney: () => {
        if(state.isReadOnly) location.href = location.pathname;
        else ui.showSelector();
    },
    saveConfig: () => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        t.config.name = document.getElementById('confName').value;
        t.config.ptsWin = parseInt(document.getElementById('confWin').value) || 3;
        t.config.ptsDraw = parseInt(document.getElementById('confDraw').value) || 1;
        app.save();
        app.renderAll();
        alert("Configurações salvas com sucesso!");
    },

    addTeam: () => {
        if(state.isReadOnly) return;
        const name = document.getElementById('teamNameInput').value.trim();
        const logo = document.getElementById('teamLogoInput').value.trim();
        if(!name) return alert("O nome do time é obrigatório!");
        
        getCurrent().teams.push({ id: Date.now(), name, logo, players: [] });
        document.getElementById('teamNameInput').value = '';
        document.getElementById('teamLogoInput').value = '';
        ui.closeModal('modal-team');
        app.save();
        app.renderTeams();
    },
    
    currentTeamId: null,
    openSquadModal: (teamId) => {
        if(state.isReadOnly) return;
        app.currentTeamId = teamId;
        const t = getCurrent().teams.find(x => x.id === teamId);
        document.getElementById('squadTitle').innerText = `Elenco: ${t.name}`;
        ui.renderSquadList(t);
        ui.openModal('modal-squad');
    },

    addPlayerToSquad: () => {
        const name = document.getElementById('playerNameInput').value.trim();
        if(!name) return;
        const team = getCurrent().teams.find(x => x.id === app.currentTeamId);
        team.players.push({ id: Date.now(), name: name });
        document.getElementById('playerNameInput').value = '';
        app.save();
        ui.renderSquadList(team);
    },

    removePlayer: (pId) => {
        const team = getCurrent().teams.find(x => x.id === app.currentTeamId);
        team.players = team.players.filter(p => p.id !== pId);
        app.save();
        ui.renderSquadList(team);
    },

    generateFixture: () => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        if(t.teams.length < 2) return alert("Adicione pelo menos 2 times para gerar a tabela.");
        if(t.matches.length > 0 && !confirm("Gerar uma nova tabela apagará todos os jogos e placares atuais. Deseja continuar?")) return;
        
        t.matches = [];
        for(let i=0; i<t.teams.length; i++) {
            for(let j=i+1; j<t.teams.length; j++) {
                t.matches.push({
                    id: Date.now() + Math.random(),
                    teamA: t.teams[i].id,
                    teamB: t.teams[j].id,
                    scoreA: 0, scoreB: 0,
                    events: [],
                    ended: false
                });
            }
        }
        app.save();
        app.renderMatches();
        app.renderStandings();
    },

    currentMatchId: null,
    openMatchModal: (mId) => {
        app.currentMatchId = mId;
        const t = getCurrent();
        const m = t.matches.find(x => x.id === mId);
        const teamA = t.teams.find(x => x.id === m.teamA);
        const teamB = t.teams.find(x => x.id === m.teamB);

        document.getElementById('mTeamA').innerText = teamA.name;
        document.getElementById('mTeamB').innerText = teamB.name;
        
        if (!state.isReadOnly) {
            const selTeam = document.getElementById('eventTeamSel');
            selTeam.innerHTML = `
                <option value="${teamA.id}">${teamA.name}</option>
                <option value="${teamB.id}">${teamB.name}</option>
            `;
            app.updatePlayerSelect(); 
        }

        ui.renderMatchStats(m); 
        ui.openModal('modal-match');
    },

    updatePlayerSelect: () => {
        const tId = parseInt(document.getElementById('eventTeamSel').value);
        const team = getCurrent().teams.find(x => x.id === tId);
        const selPlayer = document.getElementById('eventPlayerSel');
        
        if (!team || team.players.length === 0) {
            selPlayer.innerHTML = '<option value="">Sem jogadores (Adicione no Elenco)</option>';
        } else {
            selPlayer.innerHTML = team.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
    },

    addEvent: (type) => {
        const t = getCurrent();
        const m = t.matches.find(x => x.id === app.currentMatchId);
        if(m.ended && !confirm("Esta partida já foi encerrada. Deseja adicionar evento mesmo assim?")) return;
        
        const teamId = parseInt(document.getElementById('eventTeamSel').value);
        const playerId = parseInt(document.getElementById('eventPlayerSel').value);
        const team = t.teams.find(x => x.id === teamId);
        const player = team.players.find(x => x.id === playerId);
        
        const playerName = player ? player.name : "Jogador Desconhecido"; 

        if(!m.events) m.events = [];
        m.events.push({
            type: type, 
            teamId: teamId,
            playerId: playerId || null,
            playerName: playerName,
            time: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
        });

        if (type === 'goal') {
            if (teamId === m.teamA) m.scoreA++;
            else m.scoreB++;
        }

        app.save();
        ui.renderMatchStats(m); 
    },

    removeEvent: (idx) => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        const m = t.matches.find(x => x.id === app.currentMatchId);
        const evt = m.events[idx];

        if(evt.type === 'goal') {
            if(evt.teamId === m.teamA && m.scoreA > 0) m.scoreA--;
            else if(m.scoreB > 0) m.scoreB--;
        }

        m.events.splice(idx, 1);
        app.save();
        ui.renderMatchStats(m);
    },

    finishMatch: () => {
        const t = getCurrent();
        const m = t.matches.find(x => x.id === app.currentMatchId);
        m.ended = true;
        app.save();
        ui.closeModal('modal-match');
        app.renderMatches();
        app.renderStandings(); 
        app.renderStats(); 
    },

    generateKnockout: (n) => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        const std = logic.getStandings(t);
        if(std.length < n) return alert(`Você precisa de pelo menos ${n} times para gerar esta fase.`);
        
        t.knockout = [];
        for(let i=0; i<n/2; i++) {
            t.knockout.push({
                round: n===4?'Semifinal':'Quartas',
                tA: std[i].id, tB: std[n-1-i].id
            });
        }
        app.save();
        app.renderKnockout();
    },

    // --- RENDERIZADORES ---
    renderAll: () => {
        const t = getCurrent();
        document.getElementById('displayTourneyName').innerText = t.config.name;
        document.getElementById('confName').value = t.config.name;
        document.getElementById('confWin').value = t.config.ptsWin || 3;
        document.getElementById('confDraw').value = t.config.ptsDraw || 1;

        app.renderTeams();
        app.renderMatches();
        app.renderStandings();
        app.renderKnockout();
        app.renderStats();
    },

    renderTeams: () => {
        const t = getCurrent();
        const container = document.getElementById('teams-list');
        if(t.teams.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1">Nenhum time cadastrado. Clique em "Novo Time" para começar.</div>`;
            return;
        }
        container.innerHTML = t.teams.map(tm => `
            <div class="card">
                <div class="team-item">
                    ${tm.logo ? `<img src="${tm.logo}" class="team-logo">` : `<div class="team-logo"><i class="fas fa-shield-alt"></i></div>`} 
                    <h3 style="margin:0">${tm.name}</h3>
                </div>
                <p class="mb-10" style="color:var(--text-muted); font-size:13px"><i class="fas fa-users"></i> ${tm.players.length} jogadores cadastrados</p>
                <button class="btn btn-secondary full-width admin-only" onclick="app.openSquadModal(${tm.id})">Gerenciar Elenco</button>
            </div>
        `).join('');
    },

    renderMatches: () => {
        const t = getCurrent();
        const container = document.getElementById('matches-list');
        if(t.matches.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1 / -1">Nenhum jogo gerado. Clique em "Gerar Tabela" para criar os confrontos.</div>`;
            return;
        }
        container.innerHTML = t.matches.map(m => {
            const tA = t.teams.find(x => x.id === m.teamA);
            const tB = t.teams.find(x => x.id === m.teamB);
            if(!tA || !tB) return '';
            return `
            <div class="match-card ${m.ended ? 'ended' : ''}" onclick="app.openMatchModal(${m.id})">
                <span class="team-name-card" style="text-align:right">${tA.name}</span>
                <span class="score-badge ${!m.ended ? 'vs' : ''}">${m.ended ? `${m.scoreA} - ${m.scoreB}` : 'VS'}</span>
                <span class="team-name-card" style="text-align:left">${tB.name}</span>
            </div>`;
        }).join('');
    },

    renderStandings: () => {
        const std = logic.getStandings(getCurrent());
        const tbody = document.getElementById('standings-body');
        if(std.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="empty-state" style="border:none">Tabela vazia.</td></tr>`;
            return;
        }
        tbody.innerHTML = std.map((s,i) => `
            <tr>
                <td><strong>${i+1}º</strong></td>
                <td style="text-align:left; font-weight:500;">${s.name}</td>
                <td><strong style="color:var(--primary)">${s.P}</strong></td>
                <td>${s.J}</td>
                <td>${s.V}</td>
                <td>${s.E}</td>
                <td>${s.D}</td>
                <td>${s.SG}</td>
            </tr>
        `).join('');
    },

    renderKnockout: () => {
        const t = getCurrent();
        const div = document.getElementById('knockout-area');
        if(!t.knockout || !t.knockout.length) { 
            div.innerHTML='<div class="empty-state" style="width:100%">Fase mata-mata não gerada.</div>'; 
            return; 
        }
        div.innerHTML = t.knockout.map(k => {
            const A = t.teams.find(x=>x.id===k.tA);
            const B = t.teams.find(x=>x.id===k.tB);
            if(!A || !B) return '';
            return `
            <div class="bracket-match">
                <span class="round-badge">${k.round}</span>
                <div class="b-team">${A.name}</div>
                <div class="b-vs">X</div>
                <div class="b-team">${B.name}</div>
            </div>`
        }).join('');
    },

    renderStats: () => {
        const stats = logic.getPlayerStats(getCurrent());
        
        // Artilharia
        const scorers = stats.filter(p => p.goals > 0).sort((a,b) => b.goals - a.goals).slice(0, 10);
        const scorersBody = document.getElementById('stats-scorers');
        if(scorers.length === 0) {
            scorersBody.innerHTML = `<tr><td colspan="3" class="empty-state" style="border:none; padding:15px">Nenhum gol registrado.</td></tr>`;
        } else {
            scorersBody.innerHTML = scorers.map((p, i) => `
                <tr>
                    <td>${i===0?'👑 ':''}${p.name}</td>
                    <td><small class="badge">${p.team}</small></td>
                    <td><strong>${p.goals}</strong></td>
                </tr>
            `).join('');
        }

        // Cartões
        const cards = stats.filter(p => p.yellow > 0 || p.red > 0).sort((a,b) => b.red - a.red || b.yellow - a.yellow);
        const cardsBody = document.getElementById('stats-cards');
        if(cards.length === 0) {
            cardsBody.innerHTML = `<li class="empty-state" style="border:none">Nenhum cartão registrado.</li>`;
        } else {
            cardsBody.innerHTML = cards.map(p => `
                <li>
                    <div>
                        <strong>${p.name}</strong> <small class="text-muted ml-10">${p.team}</small>
                    </div>
                    <div>
                        ${p.yellow ? `<span class="text-warning" style="margin-right:8px"><i class="fas fa-square"></i> ${p.yellow}</span>` : ''} 
                        ${p.red ? `<span class="text-danger"><i class="fas fa-square"></i> ${p.red}</span>` : ''}
                    </div>
                </li>
            `).join('');
        }
    },

    showTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
        document.querySelectorAll('.nav-links li').forEach(e => e.classList.remove('active'));
        document.getElementById(`tab-${id}`).classList.remove('hidden');
        document.getElementById(`link-${id}`).classList.add('active');
        window.scrollTo(0,0);
    },

    save: async () => {
        if(state.isReadOnly) return;
        await _supabase.from('usuarios').update({ data_tourneys: state.allTourneys }).eq('username', state.user);
    },
    shareLink: () => {
        const link = `${location.origin}${location.pathname}?u=${state.user}&id=${getCurrent().id}`;
        navigator.clipboard.writeText(link).then(() => {
            alert("Link público copiado para a área de transferência!\nQualquer pessoa com este link pode ver a tabela.");
        }).catch(() => {
            prompt("Copie o Link Público abaixo:", link);
        });
    }
};

// --- LOGIC ---
const logic = {
    getStandings: (t) => {
        let map = {};
        t.teams.forEach(team => {
            map[team.id] = { id: team.id, name: team.name, P:0, J:0, V:0, E:0, D:0, GP:0, GC:0, SG:0 };
        });
        t.matches.filter(m => m.ended).forEach(m => {
            const A = map[m.teamA], B = map[m.teamB];
            if(!A || !B) return;
            A.J++; B.J++;
            A.GP+=m.scoreA; A.GC+=m.scoreB; A.SG = A.GP-A.GC;
            B.GP+=m.scoreB; B.GC+=m.scoreA; B.SG = B.GP-B.GC;
            
            const ptsW = t.config.ptsWin || 3;
            const ptsD = t.config.ptsDraw || 1;

            if(m.scoreA > m.scoreB) { A.V++; A.P += ptsW; B.D++; }
            else if(m.scoreB > m.scoreA) { B.V++; B.P += ptsW; A.D++; }
            else { A.E++; B.E++; A.P += ptsD; B.P += ptsD; }
        });
        return Object.values(map).sort((a,b) => b.P - a.P || b.SG - a.SG || b.GP - a.GP);
    },
    
    getPlayerStats: (t) => {
        let players = {}; 
        
        t.matches.forEach(m => {
            if(!m.events) return;
            m.events.forEach(evt => {
                if(!evt.playerId) return; 
                const pid = evt.playerId;
                
                if(!players[pid]) {
                    const tm = t.teams.find(x => x.id === evt.teamId);
                    players[pid] = { name: evt.playerName, team: tm ? tm.name : '-', goals:0, yellow:0, red:0 };
                }
                
                if(evt.type === 'goal') players[pid].goals++;
                if(evt.type === 'yellow') players[pid].yellow++;
                if(evt.type === 'red') players[pid].red++;
            });
        });
        return Object.values(players);
    }
};

// --- UI HELPERS ---
const ui = {
    openModal: (id) => {
        const modal = document.getElementById(id);
        modal.style.display = 'flex';
        // Foca no primeiro input automaticamente se houver
        const firstInput = modal.querySelector('input');
        if(firstInput) setTimeout(() => firstInput.focus(), 100);
    },
    closeModal: (id) => document.getElementById(id).style.display = 'none',
    hideAll: () => {
        ['landing-page','tourney-selector','app-dashboard'].forEach(id => document.getElementById(id).classList.add('hidden'));
    },
    showSelector: () => {
        ui.hideAll();
        document.getElementById('tourney-selector').classList.remove('hidden');
        ui.renderTourneyList();
    },
    showDashboard: () => {
        ui.hideAll();
        document.getElementById('app-dashboard').classList.remove('hidden');
    },
    renderTourneyList: () => {
        const container = document.getElementById('tourney-list');
        if(state.allTourneys.length === 0) {
            container.innerHTML = `<div class="empty-state" style="grid-column: 1/-1">Você ainda não possui campeonatos. Crie um novo!</div>`;
            return;
        }
        container.innerHTML = state.allTourneys.map((t,i) => `
            <div class="card" style="text-align:center">
                <i class="fas fa-trophy" style="font-size:40px; color:var(--primary); margin-bottom:15px; opacity:0.8"></i>
                <h3 style="margin-bottom:20px">${t.config.name}</h3>
                <button class="btn btn-primary full-width" onclick="app.loadTourney(${i})">Acessar Painel</button>
            </div>`).join('');
    },
    renderSquadList: (team) => {
        const list = document.getElementById('squad-list');
        if(team.players.length === 0) {
            list.innerHTML = `<li class="empty-state" style="border:none">Nenhum jogador cadastrado.</li>`;
            return;
        }
        list.innerHTML = team.players.map(p => `
            <li>
                <span><i class="fas fa-user text-muted" style="margin-right:10px"></i> ${p.name}</span> 
                <span class="text-danger" style="cursor:pointer; padding:5px" onclick="app.removePlayer(${p.id})" title="Remover"><i class="fas fa-times"></i></span>
            </li>
        `).join('');
    },
    renderMatchStats: (m) => {
        document.getElementById('displayScoreA').innerText = m.scoreA;
        document.getElementById('displayScoreB').innerText = m.scoreB;
        
        const timeline = document.getElementById('match-timeline');
        if (!m.events || m.events.length === 0) {
            timeline.innerHTML = '<div class="empty-state" style="border:none; padding:20px">A partida não possui eventos registrados.</div>';
            return;
        }

        timeline.innerHTML = m.events.map((evt, idx) => {
            let icon = ''; let colorClass = '';
            if(evt.type === 'goal') { icon = 'fa-futbol'; colorClass='text-success'; }
            if(evt.type === 'yellow') { icon = 'fa-square'; colorClass='text-warning'; }
            if(evt.type === 'red') { icon = 'fa-square'; colorClass='text-danger'; }

            return `
            <div class="timeline-item">
                <div>
                    <i class="fas ${icon} ${colorClass}" style="margin-right:10px; font-size:16px;"></i>
                    <strong>${evt.playerName}</strong> 
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <small class="badge">${evt.time}</small>
                    ${!state.isReadOnly ? `<i class="fas fa-trash text-danger" style="cursor:pointer" onclick="app.removeEvent(${idx})"></i>` : ''}
                </div>
            </div>`;
        }).join('');
    },
    preparePublic: () => {
        document.querySelectorAll('.admin-only').forEach(e => e.remove());
        document.getElementById('public-msg').classList.remove('hidden');
    }
};

function getCurrent() { return state.allTourneys[state.currentIdx]; }

// Fechar modais ao clicar fora
window.onclick = function(event) {
    if (event.target.classList.contains('modal')) {
        event.target.style.display = "none";
    }
}
