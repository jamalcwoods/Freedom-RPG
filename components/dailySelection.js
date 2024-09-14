const { MessageEmbed } = require('discord.js');
const { populateTownVisitWindow, populateTownVisitControls } = require('../sessionTools.js')
const executeProfile = require("../commands/profile.js").execute;
const executeWild = require("../commands/explore.js").execute;
const executeChallenges = require("../commands/challenges.js").execute;

module.exports = {
    config:{
        getPlayerData:true,
        getGuildTown:true
    },
    data:{
        name:"dailySelection"
    },
    execute(interaction,componentConfig,callback){
        let playerData = componentConfig.playerData
        let townData = componentConfig.townData
        switch(interaction.values[0]){
            case "profile":
                componentConfig.choices = [
                    {
                        member:interaction.member,
                        value:interaction.member.user.id
                    }
                    ,{
                        value:"stats"
                    }
                ] 
                componentConfig.forceUpdateInteraction = true
                executeProfile(interaction,componentConfig,callback)
                break;

            case "explore":
                componentConfig.choices = [{value: "wild"}]
                componentConfig.forceUpdateInteraction = true
                executeWild(interaction,componentConfig,callback)
                break;

            case "challenges":
                componentConfig.forceUpdateInteraction = true
                executeChallenges(interaction,componentConfig,callback)
                break;

            case "rewards":
                const embed = new MessageEmbed()
                embed.setColor("#7289da")
                embed.addField("Rewards",playerData.dailyText)

                interaction.reply({
                    content: ' ',
                    embeds:[embed],
                    ephemeral:true
                })
                break;

            case "militia":
                playerData.exploreStreak = 0

                let newSession = {
                    type:"townVisit",
                    session_id: Math.floor(Math.random() * 100000),
                    user_ids:[playerData.id],
                    session_data:{
                        player:playerData,
                        town:townData,
                        location:"defense"
                    }
                }
        
                let updates = []
                updates.push({
                    id:playerData.id,
                    path:"exploreStreak",
                    value:0
                })
                
                interaction.update({
                        content: " ",
                        embeds: populateTownVisitWindow(newSession),
                        components: populateTownVisitControls(newSession)
                })
                callback({
                    addSession:newSession,
                    updatePlayer:updates
                })
                break;
        }
    }
}