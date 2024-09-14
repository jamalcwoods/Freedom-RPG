// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { processCombatSession, processEndOfTurn} = require("../sessionTools.js")
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
                        if(session.session_data.livingFighters == 2){
                            let indexes = []
                            for(f of session.session_data.fighters){
                                if(f.alive && !fighter.forfeit){
                                    indexes.push(f.index)
                                }
                            }
                            if(fighter.index == indexes[0]){
                                fighter.target = indexes[1]
                            } else {
                                fighter.target = indexes[0]
                            }
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
                    }
                    console.log("test1")
                    session = processCombatSession(session)
                    break;
                } else {
                    error  = 'You do not have an ability in slot #' + (parseInt(componentConfig.args[0]) + 1)
                    break;
                }
            }
        }

        processEndOfTurn(error,session,interaction,callback)
    }
}