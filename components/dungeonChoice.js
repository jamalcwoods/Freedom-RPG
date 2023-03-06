const { populateDungeonEvent, populateCombatData, populateCombatWindow, populateCombatControls, populateCloseInteractionMessage } = require("../sessionTools.js")
const { clone, simulateCPUSPAssign, simulateCPUAbilityAssign, runEnemyCombatAI} = require("../tools.js")
const data = require ("../data.json");

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"dungeonChoice"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.session_data.rankStats.currentLives == "0"){
            interaction.update(populateCloseInteractionMessage("Dungeon Run Failed",true))

            let updates = []

            updates.push({
                id:session.session_data.player.id,
                path:"lives",
                value:1
            })

            updates.push({
                id:session.session_data.player.id,
                path:"dungeon",
                value:null
            })

            callback({
                updatePlayer:updates,
                removeSession:session
            })
        } else {
            let choiceVal;
            if(interaction.values){
                choiceVal = JSON.parse(interaction.values[0])
            } else {
                choiceVal = null
            }
            let pass = choiceVal == null;
            let ended = false
            if(!pass){
                switch(choiceVal.type){
                    case "end":
                        response = "Dungeon Adventure Cancelled"

                        delete session.session_data.player.dungeon

                        let updates = [
                            {
                                id:session.user_ids[0],
                                path:"",
                                value:session.session_data.player
                            }
                        ]
                        
                        ended = true
                        interaction.update(populateCloseInteractionMessage(response,true))
                        callback({
                            updatePlayer:updates,
                            removeSession:session
                        })
                        break;

                    case "skip":
                        session.session_data.dangerValue += 3
                        session.session_data.rankStats.skips++
                        pass = true
                        session.session_data.eventResult = {
                            skip: session.session_data.player.name + " found another way around the obstacle\n(Danger level is now " + session.session_data.dangerValue + ")"
                        } 
                        break;

                    default:
                        let eventRank = session.session_data.dungeonRank + session.session_data.dangerValue/8
                        let eventReq = choiceVal.split("|")
                        let playerRoll = Math.floor(session.session_data.player.stats[eventReq[0]] * 0.25 + (Math.random() * session.session_data.player.stats[eventReq[0]] * 0.75))
                        let eventRoll = 5 + Math.ceil(Math.random() * (parseInt(eventReq[1]) * 0.1666) * (10 * eventRank))
                        pass = playerRoll >= eventRoll
                        if(!pass){
                            session.session_data.dangerValue++
                            session.session_data.rankStats.failedChecks++
                        }
                        session.session_data.eventResult = {
                            proll:[playerRoll,session.session_data.player.stats[eventReq[0]]],
                            eroll:[eventRoll,10 + Math.ceil((parseInt(eventReq[1]) * 0.1666) * (10 * eventRank))],
                        } 
                }
            }
            if(pass){
                if(session.session_data.eventNum < 10){
                    session.session_data.eventNum++
                    if(session.session_data.eventNum % 2 == 1){
                        let index = Math.floor(session.session_data.eventNum/2)
                        session.session_data.event = clone(data.dungeonEvents.choice[session.session_data.eventLineUp.choices[index]])

                        populateDungeonEvent(session,interaction)

                        callback({
                            updateSession:session
                        })
                    } else {
                        let index = session.session_data.eventNum/2
                        let combatEvent = clone(data.dungeonEvents.combat[session.session_data.eventLineUp.combats[index - 1]])

                        let enemies = []

                        for(e in combatEvent.mobs){
                            let enemyData = combatEvent.mobs[e]
                            let enemy = enemyData[0]
                            let innateAbilities = enemyData[1]
                            let allowanceScalar = enemyData[2]
                            let combatRank = session.session_data.dungeonRank + session.session_data.dangerValue/8
                            let statPoints = 30 + Math.ceil((combatRank - 1) * 60)
                            enemy.intelligence = enemyData[3]
                            enemy = simulateCPUSPAssign(enemy,statPoints,enemyData[4])
                            enemy = simulateCPUAbilityAssign(enemy,innateAbilities,allowanceScalar * (Math.floor(3 * combatRank)))
                            enemies.push(enemy)
                        }

                        let fighters = [clone(session.session_data.player)]
                        for(var i = 0; i < enemies.length; i++){
                            fighters.push(enemies[i])
                        }
                        let alliances = [0]
                        for(var i = 0; i < enemies.length; i++){
                            alliances.push(1)
                        }
                        
                        let openingDialogue;
                        let dialogue;

                        if(session.session_data.eventResult.proll){
                            let result = session.session_data.eventResult;
                            let resultText = "Roll Requirement: " + result.eroll[0] + " (Max: " + result.eroll[1] + ")" +
                            "\nPlayer Roll: " + result.proll[0] + " (Max: " + result.proll[1] + ")"
                            if(result.proll[0] >= result.eroll[0]){
                                resultText += "\n\n" + session.session_data.player.name + " is able to progress through the dungeon"
                            } else {
                                resultText += "\n\n" + session.session_data.player.name + " was not able to progress through the dungeon"
                            }
                            resultText += "\n(Danger level is now " + session.session_data.dangerValue + ")"
                            dialogue = [
                                resultText
                            ],
                            openingDialogue = 0
                            session.session_data.eventResult = {}
                        } else if (session.session_data.eventResult.skip){
                            dialogue = [
                                session.session_data.eventResult.skip
                            ],
                            openingDialogue = 0
                            session.session_data.eventResult = {}
                        }

                        newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:[interaction.user.id],
                            server_id:interaction.guildId,
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                alliances:alliances,
                                canFlee:true,
                                progressiveCombat:false,
                                rewardPlayer:false,
                                returnSession:session.session_id,
                                events:combatEvent.events,
                                triggers:combatEvent.triggers,
                                dialogue:dialogue,
                                openingDialogue:openingDialogue,
                                getRankingStats:true
                            }),
                            linkedSession_data:session.session_data
                        }

                        
                        
                        newSession.session_data.fighters[0].staticData.lives = session.session_data.rankStats.currentLives  
                        newSession.session_data.fighters[0].liveData.stats.hp = session.session_data.rankStats.currentHP  
                
                        

                        runEnemyCombatAI(newSession.session_data.fighters)

                        interaction.update({
                            content:" ",
                            components:populateCombatControls(newSession),
                            embeds:populateCombatWindow(newSession)
                        })
                        callback({
                            addSession:newSession
                        })
                    }
                } else {
                    session.session_data.event = {
                        type:"complete"
                    }
        
                    populateDungeonEvent(session,interaction,callback)
                }
            } else if(!ended){
                populateDungeonEvent(session,interaction)
            }
        }
    }
}