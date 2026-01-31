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
        const u = document.getElementById('usernameInput').value;
        const p = document.getElementById('passwordInput').value;
        if (!await auth.login(u, p)) {
            if(confirm("Criar nova conta?")) auth.register(u, p);
        }
    },
    login: async (u, p) => {
        const { data } = await _supabase.from('usuarios').select('*').eq('username', u).maybeSingle();
        if (data && data.password === p) {
            state.user = u;
            state.allTourneys = data.data_tourneys || [];
            localStorage.setItem(SESSION_KEY, `${u}|${p}`);
            ui.showSelector();
            return true;
        }
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
            }
        }
    }
};

// --- APP CORE ---
const app = {
    // 1. CAMPEONATOS
    createTourney: () => {
        const name = document.getElementById('newTourneyName').value;
        if(!name) return;
        state.allTourneys.push({
            id: Date.now(),
            config: { name, ptsWin: 3, ptsDraw: 1 },
            teams: [],
            matches: [],
            knockout: []
        });
        app.save();
        ui.closeModal('modal-new-tourney');
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
        t.config.ptsWin = parseInt(document.getElementById('confWin').value);
        t.config.ptsDraw = parseInt(document.getElementById('confDraw').value);
        app.save();
        app.renderAll();
    },

    // 2. TIMES & ELENCO
    addTeam: () => {
        if(state.isReadOnly) return;
        const name = document.getElementById('teamNameInput').value;
        const logo = document.getElementById('teamLogoInput').value;
        if(!name) return;
        getCurrent().teams.push({ id: Date.now(), name, logo, players: [] }); // Players array init
        document.getElementById('teamNameInput').value = '';
        ui.closeModal('modal-team');
        app.save();
        app.renderTeams();
    },
    
    // Abrir modal de Elenco
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
        const name = document.getElementById('playerNameInput').value;
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

    // 3. JOGOS E SÚMULA
    generateFixture: () => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        if(!confirm("Gerar tabela apagará jogos existentes. Continuar?")) return;
        t.matches = [];
        for(let i=0; i<t.teams.length; i++) {
            for(let j=i+1; j<t.teams.length; j++) {
                t.matches.push({
                    id: Date.now() + Math.random(),
                    teamA: t.teams[i].id,
                    teamB: t.teams[j].id,
                    scoreA: 0, scoreB: 0,
                    events: [], // Array de eventos (Gols, Cartões)
                    ended: false
                });
            }
        }
        app.save();
        app.renderMatches();
    },

    currentMatchId: null,
    openMatchModal: (mId) => {
        app.currentMatchId = mId;
        const t = getCurrent();
        const m = t.matches.find(x => x.id === mId);
        const teamA = t.teams.find(x => x.id === m.teamA);
        const teamB = t.teams.find(x => x.id === m.teamB);

        // UI Text
        document.getElementById('mTeamA').innerText = teamA.name;
        document.getElementById('mTeamB').innerText = teamB.name;
        
        // Popula Selects de Eventos (apenas se for admin)
        if (!state.isReadOnly) {
            const selTeam = document.getElementById('eventTeamSel');
            selTeam.innerHTML = `
                <option value="${teamA.id}">${teamA.name}</option>
                <option value="${teamB.id}">${teamB.name}</option>
            `;
            app.updatePlayerSelect(); // Popula jogadores do time A inicialmente
        }

        ui.renderMatchStats(m); // Mostra placar e timeline
        ui.openModal('modal-match');
    },

    updatePlayerSelect: () => {
        const tId = parseInt(document.getElementById('eventTeamSel').value);
        const team = getCurrent().teams.find(x => x.id === tId);
        const selPlayer = document.getElementById('eventPlayerSel');
        
        if (team.players.length === 0) {
            selPlayer.innerHTML = '<option value="">Sem jogadores cadastrados</option>';
        } else {
            selPlayer.innerHTML = team.players.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        }
    },

    addEvent: (type) => {
        const t = getCurrent();
        const m = t.matches.find(x => x.id === app.currentMatchId);
        
        const teamId = parseInt(document.getElementById('eventTeamSel').value);
        const playerId = parseInt(document.getElementById('eventPlayerSel').value);
        const team = t.teams.find(x => x.id === teamId);
        const player = team.players.find(x => x.id === playerId);
        
        const playerName = player ? player.name : "Desconhecido"; // Caso não tenha jogador selecionado

        // Adiciona evento
        m.events.push({
            type: type, // 'goal', 'yellow', 'red'
            teamId: teamId,
            playerId: playerId || null,
            playerName: playerName,
            time: new Date().toLocaleTimeString('pt-BR', {hour:'2-digit', minute:'2-digit'})
        });

        // Atualiza Placar se for GOL
        if (type === 'goal') {
            if (teamId === m.teamA) m.scoreA++;
            else m.scoreB++;
        }

        app.save();
        ui.renderMatchStats(m); // Atualiza modal em tempo real
    },

    removeEvent: (idx) => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        const m = t.matches.find(x => x.id === app.currentMatchId);
        const evt = m.events[idx];

        // Se remover GOL, decrementa placar
        if(evt.type === 'goal') {
            if(evt.teamId === m.teamA) m.scoreA--;
            else m.scoreB--;
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
        app.renderStandings(); // Atualiza tabela
        app.renderStats(); // Atualiza artilharia
    },

    // 4. MATA-MATA (Simples)
    generateKnockout: (n) => {
        if(state.isReadOnly) return;
        const t = getCurrent();
        const std = logic.getStandings(t);
        if(std.length < n) return alert("Times insuficientes");
        
        t.knockout = [];
        for(let i=0; i<n/2; i++) {
            t.knockout.push({
                round: n===4?'Semi':'Quartas',
                tA: std[i].id, tB: std[n-1-i].id
            });
        }
        app.save();
        app.renderKnockout();
    },

    // 5. RENDERIZAÇÃO
    renderAll: () => {
        const t = getCurrent();
        document.getElementById('displayTourneyName').innerText = t.config.name;
        document.getElementById('confName').value = t.config.name;
        document.getElementById('confWin').value = t.config.ptsWin;
        document.getElementById('confDraw').value = t.config.ptsDraw;

        app.renderTeams();
        app.renderMatches();
        app.renderStandings();
        app.renderKnockout();
        app.renderStats();
    },

    renderTeams: () => {
        const t = getCurrent();
        document.getElementById('teams-list').innerHTML = t.teams.map(tm => `
            <div class="card">
                <div style="display:flex; align-items:center; margin-bottom:10px;">
                    ${tm.logo ? `<img src="${tm.logo}" class="team-logo">` : ''} 
                    <b>${tm.name}</b>
                </div>
                <small>${tm.players.length} jogadores</small>
                <button class="btn-secondary full admin-only" onclick="app.openSquadModal(${tm.id})">Gerenciar Elenco</button>
            </div>
        `).join('');
    },

    renderMatches: () => {
        const t = getCurrent();
        document.getElementById('matches-list').innerHTML = t.matches.map(m => {
            const tA = t.teams.find(x => x.id === m.teamA);
            const tB = t.teams.find(x => x.id === m.teamB);
            return `
            <div class="match-card" onclick="app.openMatchModal(${m.id})" style="${m.ended?'opacity:0.7':''}">
                <span>${tA.name}</span>
                <span class="score-badge">${m.ended ? `${m.scoreA}-${m.scoreB}` : 'vs'}</span>
                <span>${tB.name}</span>
            </div>`;
        }).join('');
    },

    renderStandings: () => {
        const std = logic.getStandings(getCurrent());
        document.getElementById('standings-body').innerHTML = std.map((s,i) => `
            <tr>
                <td>${i+1}</td>
                <td style="text-align:left">${s.name}</td>
                <td><strong>${s.P}</strong></td>
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
        if(!t.knockout || !t.knockout.length) { div.innerHTML='Vazio'; return; }
        div.innerHTML = t.knockout.map(k => {
            const A = t.teams.find(x=>x.id===k.tA);
            const B = t.teams.find(x=>x.id===k.tB);
            return `<div class="card" style="min-width:150px; text-align:center"><small>${k.round}</small><br><b>${A.name}</b><br>vs<br><b>${B.name}</b></div>`
        }).join('');
    },

    renderStats: () => {
        const stats = logic.getPlayerStats(getCurrent());
        
        // Artilharia
        const scorers = stats.filter(p => p.goals > 0).sort((a,b) => b.goals - a.goals);
        document.getElementById('stats-scorers').innerHTML = scorers.map(p => `
            <tr><td>${p.name}</td><td>${p.team}</td><td><strong>${p.goals}</strong></td></tr>
        `).join('');

        // Cartões
        const cards = stats.filter(p => p.yellow > 0 || p.red > 0).sort((a,b) => b.red - a.red || b.yellow - a.yellow);
        document.getElementById('stats-cards').innerHTML = cards.map(p => `
            <li style="padding:5px; border-bottom:1px solid #eee; display:flex; justify-content:space-between;">
                <span>${p.name} <small>(${p.team})</small></span>
                <span>
                    ${p.yellow ? `<span style="color:#f1c40f">■</span>${p.yellow}` : ''} 
                    ${p.red ? `<span style="color:#c0392b">■</span>${p.red}` : ''}
                </span>
            </li>
        `).join('');
    },

    showTab: (id) => {
        document.querySelectorAll('.tab-content').forEach(e => e.classList.add('hidden'));
        document.querySelectorAll('.nav-links li').forEach(e => e.classList.remove('active'));
        document.getElementById(`tab-${id}`).classList.remove('hidden');
        document.getElementById(`link-${id}`).classList.add('active');
    },

    save: async () => {
        if(state.isReadOnly) return;
        await _supabase.from('usuarios').update({ data_tourneys: state.allTourneys }).eq('username', state.user);
    },
    shareLink: () => {
        prompt("Link Público:", `${location.origin}${location.pathname}?u=${state.user}&id=${getCurrent().id}`);
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
            A.J++; B.J++;
            A.GP+=m.scoreA; A.GC+=m.scoreB; A.SG = A.GP-A.GC;
            B.GP+=m.scoreB; B.GC+=m.scoreA; B.SG = B.GP-B.GC;
            if(m.scoreA > m.scoreB) { A.V++; A.P += t.config.ptsWin; B.D++; }
            else if(m.scoreB > m.scoreA) { B.V++; B.P += t.config.ptsWin; A.D++; }
            else { A.E++; B.E++; A.P += t.config.ptsDraw; B.P += t.config.ptsDraw; }
        });
        return Object.values(map).sort((a,b) => b.P - a.P || b.SG - a.SG);
    },
    
    getPlayerStats: (t) => {
        let players = {}; // id -> {name, team, goals, yellow, red}
        
        t.matches.forEach(m => {
            if(!m.events) return;
            m.events.forEach(evt => {
                if(!evt.playerId) return; // ignora eventos sem jogador
                const pid = evt.playerId;
                
                if(!players[pid]) {
                    // Busca nome do time
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
    openModal: (id) => document.getElementById(id).style.display = 'flex',
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
        document.getElementById('tourney-list').innerHTML = state.allTourneys.map((t,i) => `
            <div class="card">
                <h3>${t.config.name}</h3>
                <button class="btn-primary full" onclick="app.loadTourney(${i})">Entrar</button>
            </div>`).join('');
    },
    renderSquadList: (team) => {
        document.getElementById('squad-list').innerHTML = team.players.map(p => `
            <li>${p.name} <span style="color:red; cursor:pointer" onclick="app.removePlayer(${p.id})">&times;</span></li>
        `).join('');
    },
    renderMatchStats: (m) => {
        document.getElementById('displayScoreA').innerText = m.scoreA;
        document.getElementById('displayScoreB').innerText = m.scoreB;
        
        // Render Timeline
        const timeline = document.getElementById('match-timeline');
        if (!m.events || m.events.length === 0) {
            timeline.innerHTML = '<small style="color:#999">Nenhum evento registrado.</small>';
            return;
        }

        timeline.innerHTML = m.events.map((evt, idx) => {
            let icon = '';
            let color = '';
            if(evt.type === 'goal') { icon = 'fa-futbol'; color='#27ae60'; }
            if(evt.type === 'yellow') { icon = 'fa-square'; color='#f1c40f'; }
            if(evt.type === 'red') { icon = 'fa-square'; color='#c0392b'; }

            return `
            <div style="display:flex; justify-content:space-between; align-items:center; padding:5px 0; border-bottom:1px solid #eee">
                <div>
                    <i class="fas ${icon}" style="color:${color}; margin-right:5px;"></i>
                    <strong>${evt.playerName}</strong> 
                </div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <small>${evt.time}</small>
                    ${!state.isReadOnly ? `<i class="fas fa-trash" style="color:red; cursor:pointer" onclick="app.removeEvent(${idx})"></i>` : ''}
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
