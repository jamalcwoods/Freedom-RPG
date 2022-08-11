// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { populateAbilityCreatorWindow, populateAbilityCreatorButtons } = require("../sessionTools.js")

module.exports = {
    config:{
        getSession:true
    },
    data:{
        name:"changeAtt"
    },
    execute(interaction,componentConfig,callback){
        let session = componentConfig.session
        if(session.type == "makeAbility"){
            let args = componentConfig.args
            let subAttributes = ["statchangevalue"]
            let valChange;
            switch(args[0]){
                case "increase":
                    valChange = parseInt(args[1])
                    break;

                case "decrease":
                    valChange = -parseInt(args[1])
                    break;
            }
            if(subAttributes.includes(session.session_data.editingAttribute.split("|")[0])){
                let subatt = session.session_data.editingAttribute.split("|")[0]
                let index = session.session_data.editingAttribute.split("|")[1]
                switch(subatt){
                    case "statchangevalue":
                        session.session_data.ability.effects[index].value += valChange
                        break;
                }
            } else {
                session.session_data.ability[session.session_data.editingAttribute] += valChange
            }

            if(session.session_data.editingAttribute == "statChangeCount"){
                while(session.session_data.ability.effects.length < session.session_data.ability[session.session_data.editingAttribute]){
                    session.session_data.ability.effects.push({
                        "target":"0",
                        "stat":"atk",
                        "value":50
                    })
                }
                while(session.session_data.ability.effects.length > session.session_data.ability[session.session_data.editingAttribute]){
                    session.session_data.ability.effects.splice(session.session_data.ability.effects.length - 1, 1)
                }
            }

            interaction.update({
                content: populateAbilityCreatorWindow(session),
                components: populateAbilityCreatorButtons(session)
            })
            
            callback({
                updateSession:session
            })
        }
    }
}