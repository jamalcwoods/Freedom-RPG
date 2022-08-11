const { processCombatSession, populateCombatControls,populateCombatWindow, handlePlayerFlee, populateCombatToQuestTransition, populateReturnToLobbyTransition} = require("../sessionTools.js")
const data = require("../data.json")
const { processTurnEnd } = require("../tools")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"flee"
    },
    execute(interaction,componentConfig,callback){
        let error = ""
        let session = componentConfig.session
        if(session.type == "combat"){
            for(fighter of session.session_data.fighters){
                if(fighter.staticData.id == interaction.user.id){
                    let success = true;
                    if(session.session_data.options.fightType == "pve"){
                        for(enemy of session.session_data.fighters){
                            if(enemy.team != fighter.team || enemy.team == null){
                                if(enemy.liveData.spd > fighter.liveData.spd){
                                    if(Math.random() > 0.5){
                                        success = false;
                                        session.session_data.battlelog.combat.push(fighter.staticData.name + " was unable to escape!")
                                        break;
                                    }
                                }
                            }
                        }
                    }
                    if(success){
                        fighter.forfeit = true;
                        session.session_data.battlelog.combat.push(fighter.staticData.name + " fled from battle!")
                        handlePlayerFlee(session)
                    } else {
                        fighter.choosenAbility = -2
                        session = processCombatSession(session)
                    }
                    break;
                }
            }
            if(session.session_data.completed){
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
                        components:populateReturnToLobbyTransition(session)
                    })
                    callback({
                        updateSession:session
                    })
                } else {
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
                        components:[]
                    })
                    callback({
                        removeSession:session,
                        updatePlayer:updates 
                    })
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
}