const { SlashCommandBuilder } = require('@discordjs/builders');
const { populateTownVisitWindow, populateTownVisitControls } = require("../sessionTools.js")
const { getTownDBData, updateTownDBData} = require("../firebaseTools.js");
const { parseReward } = require('../tools.js');


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
                let statVal = Math.ceil(session.session_data.player.stats[interaction.values[0]] * (0.1 * roll))
                let final = statVal * session.session_data.temp.currentTask.solutionMap[interaction.values[0]].multi
                
                let repVal = Math.ceil(final * session.session_data.temp.currentTask.repReward)
                let goldVal = Math.ceil(final * session.session_data.temp.currentTask.goldReward)
                let expVal = Math.ceil(final * session.session_data.temp.currentTask.expReward)
    
                if(!session.session_data.town.reputations){
                    session.session_data.town.reputations = {}
                    session.session_data.town.reputations[session.session_data.player.id] = repVal
                } else {
                    if(!session.session_data.town.reputations[session.session_data.player.id]){
                        session.session_data.town.reputations[session.session_data.player.id] = repVal
                    } else {
                        session.session_data.town.reputations[session.session_data.player.id] += repVal
                    }
                }
                
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

                let now = new Date()
                //session.session_data.player.taskTimer = now.getTime() + 3600000 

                session.session_data.temp.taskRollResults = {
                    roll:roll,
                    statVal:statVal,
                    multi:session.session_data.temp.currentTask.solutionMap[interaction.values[0]].multi,
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