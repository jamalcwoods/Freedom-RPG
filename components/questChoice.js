const { quests } = require("../data.json");
const { populateQuestConsole, populateCombatData, populateCombatControls, populateCombatWindow, populateQuestScript } = require("../sessionTools.js")
const { runEnemyCombatAI } = require("../tools.js")
function runQuestSequence(interaction,session,callback){
    if(session.type == "quest"){

        let lastType = quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].type
        switch(lastType){
            case "choice":
                let choice = JSON.parse(interaction.values[0])

                let actionFollowUp = quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].data
       
                if(actionFollowUp.resultToPlayer){
                    if(choice.choiceData.reference != undefined){
                        choice.choiceData = actionFollowUp.dataReferences[choice.choiceData.reference]
                    }

                    for(result of actionFollowUp.resultToPlayer){
                        if(result.editValues){
                            for(editDetails of result.editValues){
                                switch(editDetails.path.type){
                                    case "single":
                                            session.session_data.player[editDetails.path.pathString] = choice.choiceData
                                        break;
                                    case "array":
                                            session.session_data.player[editDetails.path.pathString][editDetails.path.index] = choice.choiceData
                                        break;
                                }
                            }
                        }
                    }
                }

                session.session_data.questStep = choice.choiceStep
                break;

            case "combat":
                if(session.session_data.quest.winner == "1234"){
                    session.session_data.questStep = quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].data.lineValue.l
                } else {
                    session.session_data.questStep = quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].data.lineValue.w
                }
                break;
        }
        if(session.session_data.questStep == "LOSE"){
            
        } else {
            switch(quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].type){
                case "choice":
                        interaction.update(populateQuestConsole(session))
                        callback({
                            updateSession:session
                        })
                    break;

                case "combat":
                        let fighters = [
                            session.session_data.player,
                            quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].data.enemy
                        ]
                        let newSession = {
                            type:"combat",
                            session_id: Math.floor(Math.random() * 100000),
                            user_ids:[interaction.user.id],
                            session_data:populateCombatData(fighters,{
                                fightType:"pve",
                                quest:{
                                    nextStep:quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].data.lineValue,
                                    entryText: populateQuestScript(session),
                                    title: "Quest #" + quests[session.session_data.quest_id].id + ": " + quests[session.session_data.quest_id].name,
                                    session:session,
                                    callback:callback
                                },
                                options:quests[session.session_data.quest_id].actionPlan[session.session_data.questStep].data.options
                            })
                        }

                        runEnemyCombatAI(newSession.session_data.fighters)

                        interaction.update({
                            content:" ",
                            components:populateCombatControls(newSession),
                            embeds:populateCombatWindow(newSession)
                        })
                        callback({
                            updateSession:session,
                            addSession:newSession
                        })
                    break;

                case "end":
                    let updates = [{
                        id:session.user_ids[0],
                        path:"",
                        value:session.session_data.player
                    }]
                    interaction.update(populateQuestConsole(session))
                    callback({
                        updatePlayer:updates,
                        removeSession:session
                    })
                    break;
            }
        }
    }
}

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"questChoice"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        runQuestSequence(interaction,session,callback)
    },
    executeFromSession(interaction,session,callback){
        runQuestSequence(interaction,session,callback)
    }
}