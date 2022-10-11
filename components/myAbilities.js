// const { SlashCommandBuilder } = require('@discordjs/builders');
const { MessageEmbed } = require('discord.js');
const { createAbilityDescription } = require('../tools.js');
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

        const embed = new MessageEmbed()
        .setColor("#7289da")
        .setTitle("Your Status")

        
        for(var i = 0; i < 6;i++){
            let abilityData = playerData.staticData.abilities[i]
            if(abilityData != undefined){
                embed.addField(
                    "Ability #" + (i+1) + " - " + abilityData.name,
                    "```diff\n" + createAbilityDescription(abilityData) + "```"
                ,true)
            } else {
                embed.addField(
                    "Ability #" + (i+1) + " - No Ability In This Slot",
                    "```diff\n---```"
                ,true)
            }
        }
        embed.addField(
            "Current Fighter Stats",
            "```diff\nLives: " + playerData.staticData.lives +
            "\nHP: " + playerData.liveData.stats.hp + "/" + playerData.liveData.maxhp +
            "\nATK: " + Math.floor(playerData.liveData.stats.atk * statChangeStages[playerData.liveData.statChanges.atk]) +
            "\nSPATK: " + Math.floor(playerData.liveData.stats.spatk * statChangeStages[playerData.liveData.statChanges.spatk]) +
            "\nDEF: " + Math.floor(playerData.liveData.stats.def * statChangeStages[playerData.liveData.statChanges.def]) +
            "\nSPDEF: " + Math.floor(playerData.liveData.stats.spdef * statChangeStages[playerData.liveData.statChanges.spdef]) +
            "\nSPD: " + Math.floor(playerData.liveData.stats.spd * statChangeStages[playerData.liveData.statChanges.spd]) + "```"
        ,true)

        interaction.reply({
            content:" ",
            ephemeral:true,
            embeds:[embed]   
        })

        callback({})
    }
}