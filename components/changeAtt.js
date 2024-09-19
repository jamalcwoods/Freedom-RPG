// const { SlashCommandBuilder } = require('@discordjs/builders');
// const { MessageActionRow, MessageSelectMenu, MessageButton } = require('discord.js');

const { stat } = require("fs")
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
                    let stats = ["atk","spatk","def","spdef","spd"]
                    for(e of session.session_data.ability.effects){
                        stats.splice(stats.indexOf(e.stat),1)
                    }
                    let newStat = stats[Math.floor(Math.random() * stats.length)]
                    session.session_data.ability.effects.push({
                        "target":"0",
                        "stat":newStat,
                        "value":1
                    })
                }
                while(session.session_data.ability.effects.length > session.session_data.ability[session.session_data.editingAttribute]){
                    session.session_data.ability.effects.splice(session.session_data.ability.effects.length - 1, 1)
                }
            }

            let msg = " "
            if(session.session_data.tutorialMsg){
                msg = session.session_data.tutorialMsg
            }
            interaction.update({
                content: msg,
                components: populateAbilityCreatorButtons(session),
                embeds: populateAbilityCreatorWindow(session)
            })
            
            callback({
                updateSession:session
            })
        }
    }
}