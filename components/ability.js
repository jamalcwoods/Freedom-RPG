// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateCombatWindow, processCombatSession, populateCombatToQuestTransition, populateCombatControls, populateReturnFromCombat} = require("../sessionTools.js")
const { getTownDBData } = require("../firebaseTools.js")
const { raidPresets, challengeDict } = require("../data.json")
const { parseReward } = require("../tools.js")
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
        // for(var i = 0;i < session.session_data.fighters.length;i++){
        //     let fighter = session.session_data.fighters[i]
        //     if(!fighter.alive){
        //         session.session_data.fighters.splice(i,1)
        //     }
        // }
        // for(var i = 0;i < session.session_data.fighters.length;i++){
        //     session.session_data.fighters[i].index = i
        // }
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
                    switch(session.type){
                        case "combat":
                                switch(session.session_data.options.fightType){
                                    case "pvp":
                                        interaction.update({
                                            embeds:populateCombatWindow(session),
                                            components:populateReturnFromCombat(session)
                                        })
                                        callback({
                                            removeSession:session
                                        })
                                        break;
                                }
                            break;
                    }
                } else {
                    getTownDBData(session.server_id,function(town){
                        let updates = []
                        let now = new Date()

                        for(var i = 0; i < session.session_data.fighters.length; i++){
                            let fighter = session.session_data.fighters[i]
                            if(session.user_ids.includes(fighter.staticData.id)){
                                // Update actual player data here

                                if(fighter.staticData.statGrowthTimer < now.getTime()){
                                    let growthMessage = fighter.staticData.name + "'s stats slightly grew!"
                                    if(fighter.records.timesBlocked < fighter.records.timesHit){
                                        if(fighter.records.spattacks > fighter.records.attacks){
                                            fighter.staticData.stats.spatk++
                                            fighter.staticData.stats.spd++
                                            growthMessage += "\n(+1 SPATK / +1 SPD)"
                                        } else if(fighter.records.spattacks < fighter.records.attacks){
                                            fighter.staticData.stats.atk++
                                            fighter.staticData.stats.spd++
                                            growthMessage += "\n(+1 ATK / +1 SPD)"
                                        } else {
                                            fighter.staticData.stats.hp++
                                            fighter.staticData.stats.spd++
                                            growthMessage += "\n(+1 HP / +1 SPD)"
                                        }
                                    } else if(fighter.records.timesBlocked < fighter.records.timesHit){
                                        if(fighter.records.spguards > fighter.records.guards){
                                            fighter.staticData.stats.spdef++
                                            fighter.staticData.stats.hp++
                                            growthMessage += "\n(+1 HP / +1 SPDEF)"
                                        } else if(fighter.records.spguards < fighter.records.guards){
                                            fighter.staticData.stats.def++
                                            fighter.staticData.stats.hp++
                                            growthMessage += "\n(+1 HP / +1 DEF)"
                                        } else {
                                            fighter.staticData.stats.hp++
                                            fighter.staticData.stats.spd++
                                            growthMessage += "\n(+1 HP / +1 SPD)"
                                        }
                                    }
                                    session.session_data.battlelog.rewards.push(growthMessage)
                                    fighter.staticData.statGrowthTimer = now.getTime() + 14400000
                                }

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
                                                                        town.points++
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
                                                                        m.completers[fighter.staticData.id].progression[0] += fighter.records.spattacks
                                                                    }
                                                                    while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                        m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                        m.completers[fighter.staticData.id].times++
                                                                        town.points++
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
                                                                        m.completers[fighter.staticData.id].progression[0] += fighter.records.guards
                                                                    }
                                                                    while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                        m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                        m.completers[fighter.staticData.id].times++
                                                                        town.points++
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
                                                                        m.completers[fighter.staticData.id].progression[0] += fighter.records.spguards
                                                                    }
                                                                    while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                        m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                        m.completers[fighter.staticData.id].times++
                                                                        town.points++
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
                                                                        m.completers[fighter.staticData.id].progression[0] += fighter.records.statChanges
                                                                    }
                                                                    while(m.completers[fighter.staticData.id].progression[0] >= m.completers[fighter.staticData.id].progression[1]){
                                                                        m.completers[fighter.staticData.id].progression[0] -= m.completers[fighter.staticData.id].progression[1]
                                                                        m.completers[fighter.staticData.id].times++
                                                                        town.points++
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
                                                                        town.points += 2
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
                                                                        town.points += 2
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
                                                                        town.points += 2
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
                                                        if(!m.completers){
                                                            m.completers = {}
                                                        }
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
                                                            town.points += 3
                                                            fighter.staticData.gold += raidPresets.goldRewards[2]
                                                        }
                                                    }
                                                    break;

                                                case 1:
                                                    if(session.user_ids.includes(session.session_data.winners[0])){
                                                        let m = town.raid.bossDefeats
                                                        if(!m){
                                                            m = {}
                                                        }
                                                        if(!m[fighter.staticData.id]){
                                                            m[fighter.staticData.id] = {
                                                                times:1
                                                            }
                                                        } else {
                                                            m[fighter.staticData.id].times += 1
                                                        }
                                                        town.points += 5
                                                        fighter.staticData.gold += raidPresets.goldRewards[3]
                                                        town.raid.bossDefeats = m
                                                    }
                                                    break;
                                            }
                                            
                                        }
                                    }
                                }  
                                let challengesCompleted = 0;
                                let totalGoldReward = 0;
                                if(fighter.staticData.challenges){
                                    for(var i = 0; i < fighter.staticData.challenges.length;i++){
                                        let c = fighter.staticData.challenges[i]
                                        let progressVal = 0;
                                        switch(c.type){
                                            case 0:
                                                progressVal = fighter.records.unitsDefeated
                                                break;

                                            case 1:
                                                progressVal = fighter.records.enemyDamageTaken
                                                break;

                                            case 2:
                                                progressVal = fighter.records.baseDamageBlocked
                                                break;

                                            case 3:
                                                progressVal = fighter.records.attackDamageDone
                                                break;

                                            case 4:
                                                progressVal = fighter.records.timesFirstAttack
                                                break;

                                            case 5:
                                                progressVal = fighter.records.criticalsLanded
                                                break;

                                            case 6:
                                                progressVal = fighter.records.counterDamageDone
                                                break;

                                            case 7:
                                                progressVal = fighter.records.completeBlocks
                                                break;

                                            case 8:
                                                progressVal = fighter.records.timesStatsRaised
                                                break;

                                            case 9:
                                                progressVal = fighter.records.timesStatsLowered
                                                break;

                                            case 10:
                                                progressVal = fighter.records.timesAbilityRepeat
                                                break;
                                        }

                                        if(progressVal > 0){
                                            c.progress += progressVal
                                            if(c.goal <= c.progress){
                                                challengesCompleted++
                                                totalGoldReward += c.rank * 5   
                                                session.session_data.battlelog.rewards.push(challengeDict[c.type].name + " - Rank " + c.rank + ": Complete!")
                                                fighter.staticData.challenges.splice(i)
                                                i--
                                            } else {
                                                session.session_data.battlelog.alerts.push("Challenge Progress: " + challengeDict[c.type].name + ": " + c.progress + "/" + c.goal)
                                            }
                                        }
                                    }

                                    if(totalGoldReward > 0){ 
                                        let result = parseReward({
                                            type:"resource",
                                            resource:"gold",
                                            resourceName: "gold",
                                            amount: totalGoldReward * challengesCompleted
                                        }, fighter.staticData)
                                        fighter.staticData = result[0]
                                        if(result[1].length > 0){
                                            for(msg of result[1]){
                                                session.session_data.battlelog.rewards.push(msg)
                                            }
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

                        if(session.session_data.options.combatRewards){
                            let rewards = session.session_data.options.combatRewards
                            if(rewards.overwriteHallOwner){
                                if(session.user_ids.includes(session.session_data.winners[0])){
                                    let newOwner = rewards.overwriteHallOwner
                                    if(session.session_data.fighters[1].staticData.prevID != session.session_data.winners[0]){
                                        newOwner.id = "playerClone"
                                        newOwner.name = "Shadow of " + newOwner.name
                                        newOwner.prevID = session.session_data.winners[0]
                                        townUpdates.push({
                                            id:session.server_id,
                                            path:"hallOwner",
                                            value:newOwner
                                        })
                                        
                                        townUpdates.push({
                                            id:session.server_id,
                                            path:"hallStart",
                                            value:now.getTime()
                                        })  
                                    }
                                }
                            }    
                        }
                        if(town.raid){
                            townUpdates.push({
                                id:session.server_id,
                                path:"raid",
                                value:town.raid
                            })

                            townUpdates.push({
                                id:session.server_id,
                                path:"points",
                                value:town.points
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
                        components:populateReturnFromCombat(session,session.session_data.options.getRankingStats)
                    })

                    
                    callback({
                        unHoldSession:session.session_data.options.returnSession,
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