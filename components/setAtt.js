// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateAbilityCreatorWindow, populateAbilityCreatorButtons } = require("../sessionTools.js")
const { clone } = require("../tools.js")
const data = require("../data.json")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"setAtt"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        let subAttributes = ["statchangestat","statchangetarget"]
        let error = false
        if(session.type == "makeAbility"){
            let args = componentConfig.args
            if(subAttributes.includes(session.session_data.editingAttribute.split("|")[0])){
                let subatt = session.session_data.editingAttribute.split("|")[0]
                let index = session.session_data.editingAttribute.split("|")[1]
                switch(subatt){
                    case "statchangestat":
                        let repeat = false
                        for(e of session.session_data.ability.effects){
                            if(e.stat == args[0]){
                                error = true
                                repeat = true;
                                break;
                            }
                        }
                        if(!repeat){
                            session.session_data.ability.effects[index].stat = args[0];
                        } else {
                            interaction.reply({ content: 'Two effects on the same ability can not modify the same stat', ephemeral: true });
                        }
                        break;

                    case "statchangetarget":
                        session.session_data.ability.effects[index].target = args[0];
                        break;
                }
            } else {
                switch(session.session_data.editingAttribute){
                    case "action_type":
                        let tempName = session.session_data.ability.name
                        switch(args[0]){
                            case "guard":
                                session.session_data.ability = clone(data.templates.guard)
                                break;

                            case "attack":
                                session.session_data.ability = clone(data.templates.attack)
                                break;

                            case "stats":
                                session.session_data.ability = clone(data.templates.stats)
                                break;
                        }
                        session.session_data.ability.name = tempName
                        break;
                    
                    default:
                        session.session_data.ability[session.session_data.editingAttribute] = args[0]
                        break;
                }
            }

            if(!error){
                interaction.update({
                    content: " ",
                    components: populateAbilityCreatorButtons(session),
                    embeds: populateAbilityCreatorWindow(session)
                })
                
                callback({
                    updateSession:session
                })
            }
        }
    }
}