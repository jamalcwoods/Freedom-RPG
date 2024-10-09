const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateTownVisitWindow, populateTownVisitControls } = require("../sessionTools.js")
const { getTownDBData, updateTownDBData} = require("../firebaseTools.js");
const { parseReward, applyTownReputation } = require('../tools.js');


module.exports = {

	config:{
        getSession:true
    },
    data:{
        name:"taskSolution"
    },
	execute(interaction,componentConfig,callback) {
        let session = componentConfig.session
        if(session.type == "townVisit"){
            getTownDBData(session.session_data.town.id,function(liveTown){
                session.session_data.town = liveTown;

                let extra = []
                let roll = Math.ceil(Math.random() * 10)
                if(session.session_data.town.bossDefeats){
                    roll = Math.ceil(roll * 1.25)
                    if(roll > 10){
                        roll = 10
                    }
                }
                let statVal = Math.ceil(session.session_data.player.stats[interaction.values[0]] * (0.1 * roll))
                let final = Math.ceil(statVal * session.session_data.temp.currentTask.solutionMap[interaction.values[0]].multi)
                let max = Math.ceil(session.session_data.player.stats[interaction.values[0]] * session.session_data.temp.currentTask.solutionMap[interaction.values[0]].multi)
                let clearVal = Math.ceil(session.session_data.town.level * 8)
                let clear = final >= clearVal


                let repVal = Math.ceil(final * session.session_data.temp.currentTask.repReward) * (final? 1 : 2)
                let goldVal = Math.ceil((roll/10) * (session.session_data.town.level * 500) * session.session_data.temp.currentTask.goldReward)
                let expVal = Math.ceil((roll/10) * (session.session_data.player.expCap * 0.25 * session.session_data.temp.currentTask.expReward))
    
                applyTownReputation(session.session_data.town,session.session_data.player.id,repVal)
                
                let result = parseReward({
                    type:"resource",
                    resource:"exp",
                    resourceName: "experience",
                    amount: expVal
                }, session.session_data.player)
                session.session_data.player = result[0]
                
                if(result[1].length > 0){
                    for(msg of result[1]){
                        extra.push(msg)
                    }
                }

                result = parseReward({
                    type:"resource",
                    resource:"gold",
                    resourceName: "gold",
                    amount: goldVal
                }, session.session_data.player)
                session.session_data.player = result[0]

                if(result[1].length > 0){
                    for(msg of result[1]){
                        extra.push(msg)
                    }
                }

                extra.push("Effort Goal: " + clearVal + "\nPlayer Effort: " + final + " (Max Effort Possible: " + max + ')')
                if(clear){
                    let newData = {
                        ref:{
                            type: "rngEquipment",
                            rngEquipment: {
                                scaling: false,
                                value:1,
                                conStats:0,
                                conValue:0,
                                lockStatTypes: false,
                                baseVal: 6 * session.session_data.town.level,
                                types: ["weapon","gear"]
                            }
                        }
                    }
                    result = parseReward(newData,  session.session_data.player)
                    session.session_data.player = result[0]

                    if(result[1].length > 0){
                        for(msg of result[1]){
                            extra.push(msg)
                        }
                    }
                } else {
                    extra.push("Reaching the effort goal will net you an extra reward! Better luck next time!")
                }

                let now = new Date()

                if(session.session_data.player.statGrowthTimer < now.getTime()){
                    let val = roll
                    if(val > 0){
                        let growthMessage = session.session_data.player.name + "'s stats slightly grew!"
                        let stat = interaction.values[0]
                        session.session_data.player.stats[interaction.values[0]] += val
                        growthMessage += "\n(+" + val + " " + stat.toUpperCase() + ")"
                        session.session_data.player.statGrowthTimer = now.getTime() + 1800000 
                        extra.push(growthMessage)
                    }
                }

                session.session_data.player.taskTimer = now.getTime() + 600000
                if(!session.session_data.player.achievements){
                    session.session_data.player.achievements = {
                        kills:0,
                        abilitiesUsed:0,
                        livesLost:0,
                        strongestAttack:0,
                        tasksCompleted:0,
                        dungeonsCleared:0,
                        raidLeaderKills:0,
                        playerBattlesWon:0
                    }
                }
                session.session_data.player.achievements.tasksCompleted++

                session.session_data.temp.taskRollResults = {
                    clear:clear,
                    roll:roll,
                    statVal:statVal,
                    multi:session.session_data.temp.currentTask.solutionMap[interaction.values[0]].multi,
                    solutionText:session.session_data.temp.currentTask.solutionMap[interaction.values[0]].solutionDesc,
                    final:final,
                    rep:repVal,
                    extra:extra
                }
                
                interaction.update({
                    content: " ",
                    embeds: populateTownVisitWindow(session),
                    components: populateTownVisitControls(session)
                })
    
                let updates = []
                let townUpdates = []

                townUpdates.push({
                    id:liveTown.id,
                    path:"reputations",
                    value:session.session_data.town.reputations
                })

                updates.push({
                    id:session.session_data.player.id,
                    path:"",
                    value:session.session_data.player
                })

                callback({
                    updatePlayer:updates,
                    updateSession:session,
                    updateTown:townUpdates
                })
            })
        }
	},
};