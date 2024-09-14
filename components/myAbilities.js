// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { populateManegeAbilityWindow, populateManageAbilityControls } = require("../sessionTools.js")
const { statChangeStages } = require("../data.json")


module.exports = {
    config:{
        getSession:true,
    },
    data:{
        name:"myAbilities"
    },
    async execute(interaction,componentConfig,callback){
        let session = componentConfig.session

        let playerData;
        for(fighter of session.session_data.fighters){
            if(fighter.staticData.id == interaction.user.id){
                playerData = fighter;
                break;
            }
        }

        let newSession = {
            type:"manageAbilities",
            session_id: Math.floor(Math.random() * 100000),
            user_ids:[playerData.staticData.id],
            session_data:{
                fighter:playerData,
                player:playerData.staticData,
                noEdit:true,
                subSession:session.session_id,
                removeOnUpdate:true,
                noRelocate:true
            }
        }
    
        interaction.reply({
            content:" ",
            embeds:populateManegeAbilityWindow(newSession),
            components:populateManageAbilityControls(newSession),
            ephemeral:true
        })

        callback({
            addSession: newSession
        })
    }
}