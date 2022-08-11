// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');


const fight = require("../commands/fight.js")
const { populateCombatWindow, processCombatSession, populateCombatToQuestTransition, populateCombatControls, populateReturnFromCombat} = require("../sessionTools.js")
const { getTownDBData } = require("../firebaseTools.js")
const { raidPresets } = require("../data.json")
const { data } = require("../commands/fight.js")
module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"ability"
    },
    execute(interaction,componentConfig,callback){
        let error = ""
        let session = componentConfig.session
        for(var i = 0;i < session.session_data.fighters.length;i++){
            let fighter = session.session_data.fighters[i]
            if(fighter.staticData.id == interaction.user.id){
                if(fighter.staticData.abilities[componentConfig.args[0]]){
                    fighter.choosenAbility = componentConfig.args[0]
                    if(session.session_data.fighters.length == 2){
                        fighter.target = [1,0][fighter.index]
                    } else {
                        if(fighter.staticData.abilities[fighter.choosenAbility].action_type == "stats"){
                            let needTarget = false;
                            for(e of fighter.staticData.abilities[fighter.choosenAbility].effects){
                                if(e.target == "2"){
                                    needTarget = true;
                                    break;
                                }
                            }
                            if(fighter.target == -1 && needTarget){
                                error  = 'You must choose a target for this ability in a Multi-Duel'
                                break;
                            }
                        } else {
                            if(fighter.target == -1 && fighter.staticData.abilities[fighter.choosenAbility].targetType == 1){
                                error  = 'You must choose a target for this ability in a Multi-Duel'
                                break;
                            }
                        }
                    }
                    session = processCombatSession(session)
                    break;
                } else {
                    error  = 'You do not have an ability in slot #' + (parseInt(componentConfig.args[0]) + 1)
                    break;
                }
            }
        }
        if(session.session_data.completed){
            if(session.session_data.options.progressiveCombat != false){
                if(session.session_data.options.quest){
                    interaction.update({
                        embeds:populateCombatWindow(session),
                        components:populateCombatToQuestTransition(session)
                    })
                    callback({
                        updateSession:session
                    })
                } else if(session.session_data.options.lobby){
                    let updates = []
                    for(var i = 0; i < session.session_data.fighters.length; i++){
                        let fighter = session.session_data.fighters[i]
                        if(session.user_ids.includes(fighter.staticData.id)){
                            updates.push({
                                id:fighter.staticData.id,
                                path:"",
                                value:fighter.staticData
                            })
                        }
                    }
                    interaction.update({
                        embeds:populateCombatWindow(session),
                        components:populateReturnFromCombat(session)
                    })
                    callback({
                        updateSession:session
                    })
                } else {
                    getTownDBData(session.server_id,function(town){
                        let updates = []
                        for(var i = 0; i < session.session_data.fighters.length; i++){
                            let fighter = session.session_data.fighters[i]
                            if(session.user_ids.includes(fighter.staticData.id)){
                                if(session.server_id == fighter.staticData.raidGuard && fighter.staticData.raidGuard.includes(session.server_id.toString())){
                                    if(town){
                                        if(town.raid){
                                            let missions = town.raid.missions
                                            for(x in missions){
                                                let tier = missions[x]
                                                for(m of tier){
                                                    if(!m.completers){
                                                        m.completers = {}
                                                    }
                                                    switch(x){
                                                        case "0":
                                                            switch(m.type){
                                                                case 0:
                                                                    if(fighter.records.attacks > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.attacks,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.attacks
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;

                                                                case 1:
                                                                    if(fighter.records.spattacks > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.spattacks,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.attacks
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;
                                                                    
                                                                case 2:
                                                                    if(fighter.records.guards > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.guards,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.attacks
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;

                                                                case 3:
                                                                    if(fighter.records.spguards > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.spguards,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.attacks
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;

                                                                case 4:
                                                                    if(fighter.records.statChanges > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.statChanges,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.attacks
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;
                                                            }
                                                            break;

                                                        case "1":
                                                            switch(m.type){
                                                                case 0:
                                                                    if(fighter.records.weaponsLooted > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.weaponsLooted,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.weaponsLooted
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;

                                                                case 1:
                                                                    if(fighter.records.gearLooted > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.gearLooted,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.gearLooted
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;
                                                                    
                                                                case 2:
                                                                    if(fighter.records.raresDefeated > 0){
                                                                        if(!m.completers[fighter.staticData.id]){
                                                                            m.completers[fighter.staticData.id] = {
                                                                                times:0,
                                                                                progression:[fighter.records.raresDefeated,raidPresets.missionGoalValues[x][m.type]]
                                                                            }
                                                                        } else {
                                                                            m.completers[fighter.staticData.id].progression[0] += fighter.records.raresDefeated
                                                                        }
                                                                        while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                            m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                            m.completers[fighter.staticData.id].times++
                                                                            fighter.staticData.gold += raidPresets.goldRewards[x]
                                                                        }
                                                                    }
                                                                    break;
                                                            }
                                                            break;
                                                    }
                                                }
                                            }
                                            if(session.session_data.options.raidMission){
                                                switch(session.session_data.options.raidMission.missionLevel){
                                                    case 0:
                                                        if(session.user_ids.includes(session.session_data.winners[0])){
                                                            let m = town.raid.missions[2][0]
                                                            if(!m.completers[fighter.staticData.id]){
                                                                m.completers[fighter.staticData.id] = {
                                                                    times:0,
                                                                    progression:[1,raidPresets.missionGoalValues[2][session.session_data.options.raidMission.type]]
                                                                }
                                                            } else {
                                                                m.completers[fighter.staticData.id].progression[0] += 1
                                                            }
                                                            while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                m.completers[fighter.staticData.id].times++
                                                                fighter.staticData.gold += raidPresets.goldRewards[2]
                                                            }
                                                        }
                                                        break;

                                                    case 1:
                                                        if(session.user_ids.includes(session.session_data.winners[0])){
                                                            let m = town.raid.bossDefeats
                                                            if(!m[fighter.staticData.id]){
                                                                m[fighter.staticData.id] = {
                                                                    times:0
                                                                }
                                                            } else {
                                                                m[fighter.staticData.id].times += 1
                                                            }
                                                            fighter.staticData.gold += raidPresets.goldRewards[3]
                                                        }
                                                        break;
                                                }
                                                
                                            }
                                            break;
                                        }
                                    }
                                }
                                
                                updates.push({
                                    id:fighter.staticData.id,
                                    path:"",
                                    value:fighter.staticData
                                })
                            }
                        }
                        let townUpdates = []
                        if(town.raid){
                            townUpdates.push({
                                id:session.server_id,
                                path:"raid",
                                value:town.raid
                            })
                        }
                        interaction.update({
                            embeds:populateCombatWindow(session),
                            components:[]
                        })
                        callback({
                            removeSession:session,
                            updatePlayer:updates,
                            updateTown:townUpdates 
                        })
                    })
                }
            } else {
                if(session.session_data.options.returnSession){
                    interaction.update({
                        embeds:populateCombatWindow(session),
                        components:populateReturnFromCombat(session)
                    })

                    callback({
                        removeSession:session
                    })
                } else {
                    interaction.update({
                        embeds:populateCombatWindow(session),
                        components:[]
                    })

                    callback({
                        removeSession:session
                    })
                }
            }
        } else {
            if(error != ""){
                interaction.reply({ content: error, ephemeral: true });
            } else {
                interaction.update({
                    embeds:populateCombatWindow(session),
                    components:populateCombatControls(session)
                })
            }
            callback({
                updateSession:session
            })
        }
    }
}